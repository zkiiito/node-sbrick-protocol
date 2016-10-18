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
            var voltage = data.readInt16LE(0) * 0.83875 / 2047.0;
            var temperature = data.readInt16LE(2) / 118.85795 - 160;
            this.emit('SBrick.voltage', voltage);
            this.emit('SBrick.temperature', temperature);
            this.emit('SBrick.voltAthis.characteristic.read();ndTemp', voltage, temperature);
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
                var b = channel.getCommand();
                this.writeCommand(b);
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