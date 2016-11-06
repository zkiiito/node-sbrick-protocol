const noble = require('noble');
const winston = require('winston');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const Queue = require('promise-queue');
const SBrickChannel = require('./SBrickChannel');
const SBrickAdvertisementData = require('./SBrickAdvertisementData');
const passwordGenerator = require('./SBrickPasswordGeneratorMD5');

const nobleConnected = function () {
    return new Promise((resolve, reject) => {
        if (noble.state === 'poweredOn') {
            resolve();
        } else {
            noble.removeAllListeners('stateChange');
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

const convertToCelsius = function (value) {
    return value  / 118.85795 - 160;
};

function SBrick (uuid) {
    this.uuid = uuid;
    this.connected = false;
    this.characteristic = null;
    this.runInterval = null;
    this.peripheral = null;
    this.queue = new Queue(1, Infinity);

    this.channels = [
        new SBrickChannel(0),
        new SBrickChannel(1),
        new SBrickChannel(2),
        new SBrickChannel(3)
    ];
}

util.inherits(SBrick, EventEmitter);

SBrick.prototype.generatePassword = passwordGenerator;

SBrick.prototype.start = function (callback, startFunction) {
    this.connect((err) => {
        if (err) {
            return callback(err);
        }
        if (startFunction) {
            startFunction(this);
        }
        this.run(callback);
    });
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
                                winston.warn('service discovery error', err);
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

            noble.startScanning();
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
            const temperature = convertToCelsius(data.readUInt16LE(2));
            this.emit('SBrick.voltage', voltage);
            this.emit('SBrick.temperature', temperature);
            this.emit('SBrick.voltAndTemp', voltage, temperature);
        } else {
            this.emit('SBrick.read', data);
        }
    });

    this.characteristic.subscribe((err) => {
        if (err) {
            winston.warn('subscribe error', err);
        }
    });

    this.runInterval = setInterval(() => {
        if (this.connected && this.queue.getQueueLength() === 0) {
            this.channels.forEach((channel) => {
                this.queue.add(this.writeCommand(channel.getCommand()));
            });
        }
    }, 200);

    callback(null);
};

SBrick.prototype.writeCommand = function (cmd) {
    if (!(cmd instanceof Buffer)) {
        cmd = new Buffer(cmd, 'hex');
    }

    return new Promise((resolve, reject) => {
        this.characteristic.write(cmd, false, (err) => {
            if (err) {
                winston.warn('write error', err, cmd);
                return reject(err);
            }
            resolve();
        });
    });
};

SBrick.prototype.readCommand = function (cmd) {
    return new Promise((resolve, reject) => {
        this.writeCommand(cmd).then(() => {
            this.once('SBrick.read', (data) => {
                winston.info('read', cmd, data);
                return resolve(data);
            });
            this.characteristic.read(); //trigger extra read, apart from subscribe
        }).catch(reject);
    });
};

SBrick.prototype.needAuthentication = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('02');
        }).then((data) => {
            resolve(data.readUInt8(0) === 1);
        }).catch(reject);
    });
};

SBrick.prototype.isAuthenticated = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('03');
        }).then((data) => {
            resolve(data.readUInt8(0) === 1);
        }).catch(reject);
    });
};

SBrick.prototype.getUserId = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('04');
        }).then((data) => {
            resolve(data.readUInt8(0));
        }).catch(reject);
    });
};

SBrick.prototype.authenticate = function (userId, password) {
    return new Promise((resolve, reject) => {
        if (userId === 0 || userId === 1) {
            const cmd = '05' + this.generatePassword(password);
            this.queue.add(() => {
                return this.writeCommand(cmd);
            }).then(resolve)
            .catch(reject);
        } else {
            reject('invalid value: userId');
        }
    });
};

SBrick.prototype.clearPassword = function (userId) {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            if (userId === 0) {
                return this.writeCommand('0600');
            } else if (userId === 1) {
                return this.writeCommand('0601');
            } else {
                reject('invalid value: userId');
            }
        }).then(resolve)
        .catch(reject);
    });
};

SBrick.prototype.setPassword = function (userId, password) {
    return new Promise((resolve, reject) => {
        if (userId === 0 || userId === 1) {
            const cmd = '07' + this.generatePassword(password);
            this.queue.add(() => {
                return this.writeCommand(cmd);
            }).then(resolve)
            .catch(reject);
        } else {
            reject('invalid value: userId');
        }
    });
};

SBrick.prototype.setAuthenticationTimeout = function (timeout) {
    return new Promise((resolve, reject) => {
        if (timeout >= 0 && timeout <= 255 && Number.isInteger(timeout)) {
            var cmd = '08';
            cmd += ('00' + timeout.toString(16)).substr(-2);

            this.queue.add(() => {
                return this.writeCommand(cmd);
            }).then(resolve)
            .catch(reject);
        } else {
            reject('invalid value: timeout');
        }
    });
};

SBrick.prototype.getAuthenticationTimeout = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('09');
        }).then((data) => {
            resolve(data.readUInt8(0));
        }).catch(reject);
    });
};

SBrick.prototype.getBrickID = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('0A');
        }).then((data) => {
            resolve(data.toString('hex'));
        }).catch(reject);
    });
};

//TODO
SBrick.prototype.quickDriveSetup = function (channels) {};

//TODO
SBrick.prototype.readQuickDriveSetup =  function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('0C');
        }).then((data) => {
            //Return: <5 byte quick drive setup>
            resolve(data.toString('hex'));
        }).catch(reject);
    });
};

SBrick.prototype.setWatchdogTimeout = function (timeout) {
    return new Promise((resolve, reject) => {
        if (timeout >= 0 && timeout <= 255 && Number.isInteger(timeout)) {
            var cmd = '0D';
            cmd += ('00' + timeout.toString(16)).substr(-2);

            this.queue.add(() => {
                return this.writeCommand(cmd);
            }).then(resolve)
            .catch(reject);
        } else {
            reject('invalid value: timeout');
        }
    });
};

SBrick.prototype.getWatchdogTimeout = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('0E');
        }).then((data) => {
            resolve(data.readUInt8(0));
        }).catch(reject);
    });
};

SBrick.prototype.queryADCVoltage = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('0F00');
        }).then((data) => {
            resolve(convertToVoltage(data.readUInt16LE(0)));
        }).catch(reject);
    });
};

SBrick.prototype.queryADCTemperature = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('0F0E');
        }).then((data) => {
            resolve(convertToCelsius(data.readUInt16LE(0)));
        }).catch(reject);
    });
};

//TODO
SBrick.prototype.sendEvent = function (eventID) {};

SBrick.prototype.eraseUserFlashOnNextReboot = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.writeCommand('11');
        }).then(resolve)
        .catch(reject);
    });
};

SBrick.prototype.reboot = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.writeCommand('12');
        })
        .then(resolve)
        .catch(reject);
    });
};

//TODO
SBrick.prototype.brakeWithPWMSupport = function () {};

SBrick.prototype.setThermalLimit = function (limit) {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            //celsius = ADC / 118.85795 - 160
            var limitADC = (limit + 160) * 118.85795;
            limitADC = ('00' + limitADC.toString(16)).substr(-2);
            return this.writeCommand('14' + limitADC);
        }).then(resolve)
        .catch(reject);
    });
};

SBrick.prototype.readThermalLimit = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('15');
        }).then((data) => {
            resolve(convertToCelsius(data.readUInt16LE(0)));
        }).catch(reject);
    });
};

//TODO
SBrick.prototype.writeProgram = function (offset, data) {};

//TODO
SBrick.prototype.readProgram = function (offset) {};

SBrick.prototype.saveProgram = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.writeCommand('18');
        }).then(resolve)
        .catch(reject);
    });
};

SBrick.prototype.eraseProgram = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.writeCommand('19');
        }).then(resolve)
        .catch(reject);
    });
};

//TODO
SBrick.prototype.setEvent = function (eventID, offset) {};

//TODO
SBrick.prototype.readEvent = function (eventID) {};

SBrick.prototype.saveEvents = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.writeCommand('1C');
        }).then(resolve)
        .catch(reject);
    });
};

//TODO
SBrick.prototype.startProgram = function (address) {};

SBrick.prototype.stopProgram = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.writeCommand('1E');
        }).then(resolve)
        .catch(reject);
    });
};

//TODO
SBrick.prototype.setPWMCounterValue = function () {};

//TODO
SBrick.prototype.getPWMCounterValue = function () {};

//TODO
SBrick.prototype.savePWMCounterValue = function () {};

//TODO
SBrick.prototype.getChannelStatus = function () {
    // Return < brake status bits, 1 byte, 1:brake on, 0: brake off > <1 byte direction flags> <5 byte channel drive values from 0 to 4>
};

SBrick.prototype.isGuestPasswordSet = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('23');
        }).then((data) => {
            resolve(data.readUInt8(0) === 1);
        }).catch(reject);
    });
};

//TODO
SBrick.prototype.setConnectionParameters = function () {};

//TODO
SBrick.prototype.getConnectionParameters = function () {};

SBrick.prototype.setReleaseOnReset = function (value) {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            if (value === false) {
                return this.writeCommand('2600');
            } else if (value === true) {
                return this.writeCommand('2601');
            }
        }).then(resolve)
        .catch(reject);
    });
};

SBrick.prototype.getReleaseOnReset = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('27');
        }).then((data) => {
            resolve(data.readUInt8(0) === 1);
        }).catch(reject);
    });
};

SBrick.prototype.readPowerCycleCounter = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('28');
        }).then((data) => {
            resolve(data.readUInt32LE(0));
        }).catch(reject);
    });
};

SBrick.prototype.readUptimeCounter = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('29');
        }).then((data) => {
            resolve(data.readUInt32LE(0));
        }).catch(reject);
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