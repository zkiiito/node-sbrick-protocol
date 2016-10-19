const noble = require('noble');
const winston = require('winston');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const SBrickChannel = require('./SBrickChannel');
const SBrickAdvertisementData = require('./SBrickAdvertisementData');

const nobleConnected = function () {
    return new Promise((resolve, reject) => {
        if (noble.state === 'poweredOn') {
            resolve();
        } else {
            noble.on('stateChange', (state) => {
                if (state === 'poweredOn') {
                    noble.removeAllListeners('stateChange');
                    resolve();
                }
            });
        }
    });
};

const convertToVoltage = function (value) {
    return value * 0.83875 / 2047.0;
};

const convertToTemperature = function (value) {
    return value  / 118.85795 - 160;
};

function SBrick (uuid) {
    this.uuid = uuid;
    this.connected = false;
    this.characteristic = null;
    this.runInterval = null;
    this.blocking = false;
    this.peripheral = null;
    this.readHandler = null;

    this.channels = [
        new SBrickChannel(0),
        new SBrickChannel(1),
        new SBrickChannel(2),
        new SBrickChannel(3)
    ];
}

util.inherits(SBrick, EventEmitter);

SBrick.prototype.start = function (callback, startFunction) {
    this.connect((err) => {
        if (err) {
            return callback(err);
        }
        if (startFunction) {
            startFunction(this);
        }
        this.run(callback);
    })
};

SBrick.prototype.connect = function (callback) {
    if (!this.connected) {
        var found = false; //somehow discover discovered the same sbrick multiple times
        nobleConnected().then(() => {
            winston.info('scanning for', this.uuid);
            noble.on('discover', (peripheral) => {
                winston.info('found', peripheral.uuid);
                if (!found && peripheral.uuid === this.uuid) {
                    found = true;
                    noble.stopScanning();
                    this.peripheral = peripheral;

                    peripheral.connect((err) => {
                        if (err) {
                            return callback(err);
                        }

                        this.connected = true;
                        winston.info('connected to peripheral: ' + peripheral.uuid, peripheral.advertisement);

                        peripheral.once('disconnect', () => {
                            clearInterval(this.runInterval);
                            this.connected = false;
                            winston.warn('disconnect peripheral', this.uuid);
                            this.emit('SBrick.disconnected');
                            this.removeAllListeners();
                        });

                        peripheral.discoverServices(['4dc591b0857c41deb5f115abda665b0c'], (err, services) => {
                            if (err) {
                                winston.warn("service discovery error", err);
                                return callback(err);
                            }

                            winston.info('remote control service found');

                            services[0].discoverCharacteristics(['02b8cbcc0e254bda8790a15f53e6010f'], (err, characteristics) => {
                                winston.info('remote control characteristic found');
                                this.characteristic = characteristics[0];
                                return callback(null);
                            });
                        });
                    });
                }
            });

            noble.startScanning()
        });
    }
};

SBrick.prototype.disconnect = function () {
    if (this.peripheral) {
        this.peripheral.disconnect();
    } else {
        this.removeAllListeners();
    }
};

SBrick.prototype.run = function (callback) {
    this.characteristic.on('data', (data, isNotification) => {
        if (isNotification) {
            const voltage = convertToVoltage(data.readUInt16LE(0));
            const temperature = convertToTemperature(data.readUInt16LE(2));
            this.emit('SBrick.voltage', voltage);
            this.emit('SBrick.temperature', temperature);
            this.emit('SBrick.voltAndTemp', voltage, temperature);
        } else if (this.readHandler) {
            this.readHandler(data);
        }
    });

    this.characteristic.subscribe((err) => {
        if (err) {
            winston.warn('subscribe error', err);
        }
    });

    this.runInterval = setInterval(() => {
        if (this.connected && !this.blocking) {
            this.channels.forEach((channel) => {
                var cmd = channel.getCommand();
                this.writeCommand(cmd);
            });
        }
    }, 200);

    callback(null);
};

SBrick.prototype.writeCommand = function (cmd) {
    if (!(cmd instanceof Buffer)) {
        cmd = new Buffer(cmd, "hex");
    }

    this.characteristic.write(cmd, false, (err) => {
        if (err) {
            winston.warn("write error", err, cmd);
        }
    });
};

SBrick.prototype.readCommand = function (cmd, callback) {
    callback = callback || () => {};

    if (!this.blocking) {
        this.blocking = true;

        this.writeCommand(cmd);

        this.readHandler = (data) => {
            winston.info("read", data);

            this.readHandler = null;
            this.blocking = false;
            callback(null, data);
        };
        this.characteristic.read(); //trigger extra read, apart from subscribe

    } else {
        winston.info('other read in progress');
        callback('other read in progress');
    }
};

SBrick.prototype.needAuthentication = function (callback) {
    this.readCommand("02", function (err, data) {
        return callback(err, data.readUInt8(0) === 1);
    });
};

SBrick.prototype.isAuthenticated = function (callback) {
    this.readCommand("03", function (err, data) {
        return callback(err, data.readUInt8(0) === 1);
    });
};

SBrick.prototype.getUserId = function (callback) {
    this.readCommand("04", function (err, data) {
        return callback(err, data.readUInt8(0));
    });
};

//TODO
SBrick.prototype.authenticate = function (userId, password) {
    if (userId === 0 || userId === 1) {
        //05 <1 byte user ID> <8 byte password>
    }
};

SBrick.prototype.clearPassword = function (userId) {
    if (userId === 0) {
        this.writeCommand("0600");
    } else if (userId === 1) {
        this.writeCommand("0601");
    }
};

//TODO
SBrick.prototype.setPassword = function (userId, password) {
    if (userId === 0 || userId === 1) {
        //07 < User ID > <8 byte password>: set the password
    }
};

SBrick.prototype.setAuthenticationTimeout = function (timeout) {
    if (timeout >= 0 && timeout <= 255 && Number.isInteger(timeout)) {
        var cmd = "08";
        cmd += ("00" + timeout.toString(16)).substr(-2);
        this.writeCommand(cmd);
    }
};

SBrick.prototype.getAuthenticationTimeout = function (callback) {
    this.readCommand("09", function (err, data) {
        return callback(err, data.readUInt8(0));
    });
};

//TODO
SBrick.prototype.getBrickID = function (callback) {
    this.readCommand("0A", function (err, data) {
        //< BRICK ID, 6 byte BlueGiga ID >
        //return callback(err, data.readUInt8(0));
    });
};

//SBrick.prototype.quickDriveSetup = function (channels) {};

//TODO
SBrick.prototype.readQuickDriveSetup =  function (callback) {
    this.readCommand("0C", function (err, data) {
        //Return: <5 byte quick drive setup>
        //return callback(err, data.readUInt8());
    });
};

SBrick.prototype.setWatchdogTimeout = function (timeout) {
    if (timeout >= 0 && timeout <= 255 && Number.isInteger(timeout)) {
        var cmd = "0D";
        cmd += ("00" + timeout.toString(16)).substr(-2);
        this.writeCommand(cmd);
    }
};

SBrick.prototype.getWatchdogTimeout = function (callback) {
    this.readCommand("0E", function (err, data) {
        return callback(err, data.readUInt8(0));
    });
};

//TODO
SBrick.prototype.queryADC = function (channelId, callback) {
    //0F < ADC channel ID, 00 or 0e >
    // voltage/temperature
};

//SBrick.prototype.sendEvent = function (eventID) {};

SBrick.prototype.eraseUserFlashOnNextReboot = function () {
    this.writeCommand("11");
};

SBrick.prototype.reboot = function () {
    this.writeCommand("12");
};

//SBrick.prototype.brakeWithPWMSupport = function () {};

//TODO
SBrick.prototype.setThermalLimit = function (limit) {
    //14 <2 byte ADC value>
};

SBrick.prototype.readThermalLimit = function (callback) {
    this.readCommand("0E", function (err, data) {
        return callback(err, convertToTemperature(data.readUInt16LE(0)));
    });
};

//SBrick.prototype.writeProgram = function (offset, data) {};

//SBrick.prototype.readProgram = function (offset) {};

SBrick.prototype.saveProgram = function () {
    this.writeCommand("18");
};

SBrick.prototype.eraseProgram = function () {
    this.writeCommand("19");
};

//SBrick.prototype.setEvent = function (eventID, offset) {};

//SBrick.prototype.readEvent = function (eventID) {};

SBrick.prototype.saveEvents = function () {
    this.writeCommand("1C");
};

//SBrick.prototype.startProgram = function (address) {};

SBrick.prototype.stopProgram = function () {
    this.writeCommand("1E");
};

//SBrick.prototype.setPWMCounterValue = function () {};

//SBrick.prototype.getPWMCounterValue = function () {};

//SBrick.prototype.savePWMCounterValue = function () {};

//TODO
SBrick.prototype.getChannelStatus = function () {
    // Return < brake status bits, 1 byte, 1:brake on, 0: brake off > <1 byte direction flags> <5 byte channel drive values from 0 to 4>
};

SBrick.prototype.isGuestPasswordSet = function (callback) {
    this.readCommand("23", function (err, data) {
        return callback(err, data.readUint8(0) === 1);
    });
};

//SBrick.prototype.setConnectionParameters = function () {};

//SBrick.prototype.getConnectionParameters = function () {};

SBrick.prototype.setReleaseOnReset = function (value) {
    if (value === false) {
        this.writeCommand("2600")
    } else if (value === true) {
        this.writeCommand("2601");
    }
};

SBrick.prototype.getReleaseOnReset = function (callback) {
    this.readCommand("27", function (err, data) {
        return callback(err, data.readUint8(0) === 1);
    });
};

SBrick.prototype.readPowerCycleCounter = function (callback) {
    this.readCommand("28", function (err, data) {
        return callback(err, data.readUint32LE(0));
    });
};

SBrick.prototype.readUptimeCounter = function (callback) {
    this.readCommand("29", function (err, data) {
        return callback(err, data.readUint32LE(0));
    });
};

SBrick.scanSBricks = function (callback) {
    winston.info('scanning...');
    nobleConnected().then(() => {
        var sbricks = [];
        noble.on('discover', (peripheral) => {

            try {
                var sbrickdata = SBrickAdvertisementData.parse(peripheral.advertisement.manufacturerData);
                sbrickdata.uuid = peripheral.uuid;
                winston.info('SBrick', sbrickdata);
                sbricks.push(sbrickdata);
            } catch (err) {
                winston.info(peripheral.uuid, err);
            }
        });

        noble.startScanning();

        setTimeout(() => {
            noble.stopScanning();
            noble.removeAllListeners('discover');
            callback(null, sbricks);
        }, 1000);
    });
};

module.exports = SBrick;