const noble = require('noble');
const winston = require('winston');
const SBrickChannel = require('./SBrickChannel');
const SBrickAdvertisementData = require('./SBrickAdvertisementData');

function SBrick (uuid) {
    this.uuid = uuid;
    this.connected = false;
    this.characteristic = null;
    this.runInterval = null;
    this.blocking = false;

    this.channels = [
        new SBrickChannel(0),
        new SBrickChannel(1),
        new SBrickChannel(2),
        new SBrickChannel(3)
    ];
}

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
        if (noble.state === 'poweredOn') {
            this.startScan(callback);
        } else {
            noble.on('stateChange', (state) => {
                if (state === 'poweredOn') {
                    this.startScan(callback);
                }
            });
        }
    }
};

SBrick.prototype.startScan = function (callback) {
    winston.info('scanning for', this.uuid);
    noble.on('discover', (peripheral) => {
        winston.info('found', peripheral.uuid);
        if (peripheral.uuid === this.uuid) {
            noble.stopScanning();

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
                    winston.info('reconnecting');
                    this.connect();
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
};

SBrick.prototype.run = function (callback) {
    this.characteristic.on('data',function (data) {
        if (!this.blocking) {
            winston.info('voltage', data.readInt16LE(0) * 0.83875 / 2047.0);
            winston.info('temperature', data.readInt16LE(2) / 118.85795 - 160)
        }
    });

    this.characteristic.subscribe(function (err) {
        winston.warn('subscribe error', err);
    });

    this.readCommand("0a");

    this.runInterval = setInterval(() => {
        if (!this.blocking) {
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
        this.writeCommand(cmd);

        this.blocking = true;

        this.characteristic.read((err, data) => {
            if (err) {
                winston.warn("read error", err, cmd);
            } else {
                console.log(data);
            }

            this.blocking = false;

            callback(err, data);
        });
    } else {
        winston.info('other read in progress');
        callback('other read in progress');
    }
};


SBrick.scanSBricks = function (callback) {
    if (noble.state === 'poweredOn') {
        scanSBricks(callback);
    } else {
        noble.on('stateChange', (state) => {
            if (state === 'poweredOn') {
                noble.off('stateChange');
                scanSBricks(callback);
            }
        });
    }
};

const scanSBricks = function (callback) {
    var sbrickUuids = [];
    noble.on('discover', (peripheral) => {

        try {
            SBrickAdvertisementData.parse(peripheral.advertisement.manufacturerData);
            winston.info(peripheral.uuid, 'SBrick');
            sbrickUuids.push(peripheral.uuid);
        } catch (err) {
            winston.info(peripheral.uuid, err);
        }
    });

    noble.startScanning();

    setTimeout(() => {
        noble.stopScanning();
        noble.removeAllListeners('discover');
        callback(null, sbrickUuids);
    }, 1000);
};

module.exports = SBrick;