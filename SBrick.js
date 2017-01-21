/*
 * node.js driver for SBrick
 *
 * Complete protocol documentation can be found here:
 * https://social.sbrick.com/wiki/view/pageId/11/slug/the-sbrick-ble-protocol
 *
 * Current version supports SBrick Protocol 17
 */

const noble = require('noble');
const winston = require('winston');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const Queue = require('promise-queue');
const SBrickChannel = require('./SBrickChannel');
const SBrickAdvertisementData = require('./SBrickAdvertisementData');
const passwordGenerator = require('./SBrickPasswordGeneratorMD5');

/**
 * Promise to successful noble conneciton
 *
 * @return {Promise}
 */
const nobleConnected = function () {
    return new Promise((resolve, reject) => {
        if (noble.state === 'poweredOn') {
            resolve();
        } else {
            noble.removeAllListeners('stateChange');

            const nobleConnectTimeout = setTimeout(() => {
                noble.removeAllListeners('stateChange');
                winston.warn('connect timeout');
                reject('connect timeout');
            }, 1000);

            noble.on('stateChange', (state) => {
                if (state === 'poweredOn') {
                    clearTimeout(nobleConnectTimeout);
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
    this.adcInterval = null;
    this.peripheral = null;
    this.authenticated = false;
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

/**
 * Connect to SBrick
 *
 * @return {Promise}
 */
SBrick.prototype.connect = function () {
    return new Promise((resolve, reject) => {
        if (!this.connected) {
            let found = false; //somehow discover discovered the same sbrick multiple times
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
                                return reject(err);
                            }

                            this.connected = true;
                            winston.info('connected to peripheral: ' + peripheral.uuid, peripheral.advertisement);

                            peripheral.once('disconnect', () => {
                                clearInterval(this.runInterval);
                                clearInterval(this.adcInterval);
                                this.connected = false;
                                this.authenticated = false;
                                winston.warn('disconnected peripheral', this.uuid);
                                this.emit('SBrick.disconnected');
                                this.removeAllListeners();
                            });

                            peripheral.discoverServices(['4dc591b0857c41deb5f115abda665b0c'], (err, services) => {
                                if (err) {
                                    winston.warn('service discovery error', err);
                                    return reject(err);
                                }

                                winston.verbose('remote control service found');

                                services[0].discoverCharacteristics(['02b8cbcc0e254bda8790a15f53e6010f'], (err, characteristics) => {
                                    winston.verbose('remote control characteristic found');
                                    this.characteristic = characteristics[0];
                                    return resolve();
                                });
                            });
                        });
                    }
                });

                noble.startScanning();
            });
        } else {
            return resolve();
        }
    });
};

SBrick.prototype.disconnect = function () {
    if (this.peripheral) {
        this.peripheral.disconnect();
    } else {
        this.removeAllListeners();
    }
};

/**
 * Subscribe to main SBrick events, start loop and authenticate.
 *
 * @param {string} password - owner password
 * @return {Promise}
 */
SBrick.prototype.start = function (password) {
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
        if (this.connected && this.authenticated) {
            if (this.queue.getQueueLength() === 0) {
                this.channels.forEach((channel) => {
                    this.queue.add(() => {
                        return this.writeCommand(channel.getCommand());
                    });
                });
            } else {
                winston.verbose('queue full');
            }
        }
    }, 200);

    this.adcInterval = setInterval(() => {
        this
            .queryADCVoltage()
            .then((voltage) => {
                this.emit('SBrick.voltage', voltage);
                return this.queryADCTemperature();
            })
            .then((temperature) => {
                this.emit('SBrick.temperature', temperature);
            })
            .catch(winston.warn);
    }, 1100);

    return new Promise((resolve, reject) => {
        this.isAuthenticated()
            .then((authenticated) => {
                if (authenticated) {
                    winston.info('authenticated');
                    return resolve();
                }

                return this.login(0, password).then(resolve).catch(reject);
            })
            .catch(reject);
    });
};

/**
 * Login with response
 *
 * @param {number} userId - 0: owner, 1: guest
 * @param {string} password
 * @return {Promise}
 */
SBrick.prototype.login = function (userId, password) {
    return new Promise((resolve, reject) => {
        this.authenticate(userId, password)
            .then(() => {
                this.isAuthenticated()
                .then((authenticated) => {
                    winston.info('authentication ' + (authenticated ? 'successful' : 'failed'));
                    return authenticated ? resolve() : reject('authentication failed');
                }).catch(reject);
            }).catch((err) => {
                winston.info(err);
                reject(err);
            });
    });
};

/**
 * Add write command to the queue
 *
 * @param {string|Buffer} cmd
 * @return {Promise}
 */
SBrick.prototype.writeCommand = function (cmd) {
    if (!(cmd instanceof Buffer)) {
        cmd = new Buffer(cmd, 'hex');
    }

    return new Promise((resolve, reject) => {
        winston.verbose('write', cmd);
        const now = new Date().getTime();

        // noble does not handle write errors correctly
        const writeErrorTimeout = setTimeout(() => {
            winston.warn('write timeout');
            reject('write timeout');
        }, 100);

        this.characteristic.write(cmd, false, (err) => {
            winston.debug('write time: ', new Date().getTime() - now);
            clearTimeout(writeErrorTimeout);
            if (err) {
                winston.warn('write error', err, cmd);
                return reject(err);
            }
            resolve();
        });
    });
};

/**
 * Add write command to the queue and return with response
 *
 * @param {string|Buffer} cmd
 * @return {Promise}
 */
SBrick.prototype.readCommand = function (cmd) {
    return new Promise((resolve, reject) => {
        this.writeCommand(cmd).then(() => {
            this.once('SBrick.read', (data) => {
                winston.verbose('read', cmd, data);
                return resolve(data);
            });
            this.characteristic.read(); //trigger extra read, apart from subscribe
        }).catch(reject);
    });
};

/**
 * If owner password is set, this will return true.
 *
 * @return {Promise}
 */
SBrick.prototype.needAuthentication = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('02');
        }).then((data) => {
            resolve(data.readUInt8(0) === 1);
        }).catch(reject);
    });
};

/**
 * Returns wether the current session is authenticated. This will always
 * return true, if there's no owner password set.
 *
 * @return {Promise}
 */
SBrick.prototype.isAuthenticated = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('03');
        }).then((data) => {
            this.authenticated = data.readUInt8(0) === 1;
            resolve(this.authenticated);
        }).catch(reject);
    });
};

/**
 * Returns the authenticated user ID. If the user is not authenticated,
 * then a BLE error is returned.
 *
 * @return {Promise}
 */
SBrick.prototype.getUserId = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('04');
        }).then((data) => {
            resolve(data.readUInt8(0));
        }).catch(reject);
    });
};

/**
 * New sessions are unauthenticated if password set.
 * New sessions are authenticated if password is not set.
 *
 * @param {number} userId - 0: owner, 1: guest
 * @param {string} password
 * @return {Promise}
 */
SBrick.prototype.authenticate = function (userId, password) {
    return new Promise((resolve, reject) => {
        if (userId === 0 || userId === 1) {
            const cmd = '050' + userId + this.generatePassword(password);
            this.queue.add(() => {
                return this.writeCommand(cmd);
            }).then(resolve)
            .catch(() => {
                reject('authentication failed');
            });
        } else {
            reject('invalid value: userId');
        }
    });
};

/**
 * 0: clears owner password. This will 'open' SBrick, anyone
 * connecting will get owner rights. Guest password will also
 * be cleared.
 *
 * 1: clear only guest password, rendering guests unable to
 * authenticate
 *
 * @param {number} userId - 0: owner, 1: guest
 * @return {Promise}
 */
SBrick.prototype.clearPassword = function (userId) {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            if (userId === 0 || userId === 1) {
                return this.writeCommand('060' + userId);
            } else {
                reject('invalid value: userId');
            }
        }).then(resolve)
        .catch(reject);
    });
};

/**
 * Guest password can only be set if there is a password set for the
 * owner too (e.g. 'need authentication?' returns 1)
 *
 * @param {number} userId - 0: owner, 1: guest
 * @param {string} password
 * @return {Promise}
 */
SBrick.prototype.setPassword = function (userId, password) {
    return new Promise((resolve, reject) => {
        if (userId === 0 || userId === 1) {
            const cmd = '070' + userId + this.generatePassword(password);
            this.queue.add(() => {
                return this.writeCommand(cmd);
            }).then(resolve)
            .catch(reject);
        } else {
            reject('invalid value: userId');
        }
    });
};

/**
 * Sets the authentication timeout. This value is saved to the
 * persistent store, and loaded at boot time.
 *
 * @param {number} timeout - 0.1 seconds x N, minimum 1, maximum 25.5 seconds
 * @return {Promise}
 */
SBrick.prototype.setAuthenticationTimeout = function (timeout) {
    return new Promise((resolve, reject) => {
        if (timeout >= 0 && timeout <= 255 && Number.isInteger(timeout)) {
            let cmd = '08';
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

/**
 * @return {Promise}
 */
SBrick.prototype.getAuthenticationTimeout = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('09');
        }).then((data) => {
            resolve(data.readUInt8(0));
        }).catch(reject);
    });
};

/**
 * Return: < BRICK ID, 6 byte BlueGiga ID >
 *
 * @return {Promise}
 */
SBrick.prototype.getBrickID = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('0A');
        }).then((data) => {
            resolve(data.toString('hex'));
        }).catch(reject);
    });
};

/*
//TODO
SBrick.prototype.quickDriveSetup = function (channels) {};
*/

/*
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
*/

/**
 * The purpose of the watchdog is to stop driving in case of an application failure.
 * Watchdog starts when the first DRIVE command is issued during a connection.
 * Watchdog is stopped when all channels are either set to zero drive, or are braking.
 * The value is saved to the persistent store.
 * The recommended watchdog frequency is 0.2-0.5 seconds, but a smaller and many larger settings are also available.
 * Writing a zero disables the watchdog.
 * By default watchdog is set to 5, which means a 0.5 second timeout.
 *
 * @param {number} timeout - timeout in 0.1 secs
 * @return {Promise}
 */
SBrick.prototype.setWatchdogTimeout = function (timeout) {
    return new Promise((resolve, reject) => {
        if (timeout >= 0 && timeout <= 255 && Number.isInteger(timeout)) {
            let cmd = '0D';
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

/**
 * @return {Promise}
 */
SBrick.prototype.getWatchdogTimeout = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('0E');
        }).then((data) => {
            resolve(data.readUInt8(0));
        }).catch(reject);
    });
};

/**
 * The ADC channels are read at every 2 seconds. These values are stored
 * in variables, and this query simply reads those variables. Because of
 * this, ADC data can be up to 2 seconds old.
 *
 * @return {Promise}
 */
SBrick.prototype.queryADCVoltage = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('0F08');
        }).then((data) => {
            resolve(convertToVoltage(data.readUInt16LE(0)));
        }).catch(reject);
    });
};

/**
 * The ADC channels are read at every 2 seconds. These values are stored
 * in variables, and this query simply reads those variables. Because of
 * this, ADC data can be up to 2 seconds old.
 *
 * @return {Promise}
 */
SBrick.prototype.queryADCTemperature = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('0F09');
        }).then((data) => {
            resolve(convertToCelsius(data.readUInt16LE(0)));
        }).catch(reject);
    });
};

/**
 * Erase user flash on next reboot (compromises OTA!)
 *
 * @return {Promise}
 */
SBrick.prototype.eraseUserFlashOnNextReboot = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.writeCommand('11');
        }).then(resolve)
        .catch(reject);
    });
};

/**
 * @return {Promise}
 */
SBrick.prototype.reboot = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.writeCommand('12');
        })
        .then(resolve)
        .catch(reject);
    });
};

/*
//TODO
SBrick.prototype.brakeWithPWMSupport = function () {};
*/

/**
 * @param {number} limit - limit in celsius
 * @return {Promise}
 */
SBrick.prototype.setThermalLimit = function (limit) {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            //celsius = ADC / 118.85795 - 160
            let limitADC = (limit + 160) * 118.85795;
            limitADC = ('00' + limitADC.toString(16)).substr(-2);
            return this.writeCommand('14' + limitADC);
        }).then(resolve)
        .catch(reject);
    });
};

/**
 * @return {Promise}
 */
SBrick.prototype.readThermalLimit = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('15');
        }).then((data) => {
            resolve(convertToCelsius(data.readUInt16LE(0)));
        }).catch(reject);
    });
};

/*
//TODO
SBrick.prototype.setPWMCounterValue = function () {};
*/

/*
//TODO
SBrick.prototype.getPWMCounterValue = function () {};
*/

/*
//TODO
SBrick.prototype.savePWMCounterValue = function () {};
*/

/*
//TODO
SBrick.prototype.getChannelStatus = function () {
    // Return < brake status bits, 1 byte, 1:brake on, 0: brake off > <1 byte direction flags> <5 byte channel drive values from 0 to 4>
};
*/

/**
 * @return {Promise}
 */
SBrick.prototype.isGuestPasswordSet = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('23');
        }).then((data) => {
            resolve(data.readUInt8(0) === 1);
        }).catch(reject);
    });
};

/*
//TODO
SBrick.prototype.setConnectionParameters = function () {};
*/

/*
//TODO
SBrick.prototype.getConnectionParameters = function () {};
*/

/**
 * true : Default: the channel drive values are set to zero, non-braking,
 * and default '0' direction (clockwise with LEGO motors)
 *
 * false: The channels are left in whatever state the controlling application set
 * them. This option itself is preserved throughout connections.
 *
 * @param {boolean} value
 * @return {Promise}
 */
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

/**
 * @return {Promise}
 */
SBrick.prototype.getReleaseOnReset = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('27');
        }).then((data) => {
            resolve(data.readUInt8(0) === 1);
        }).catch(reject);
    });
};

/**
 * @return {Promise}
 */
SBrick.prototype.readPowerCycleCounter = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('28');
        }).then((data) => {
            resolve(data.readUInt32LE(0));
        }).catch(reject);
    });
};

/**
 * @return {Promise}
 */
SBrick.prototype.readUptimeCounter = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('29');
        }).then((data) => {
            resolve(data.readUInt32LE(0));
        }).catch(reject);
    });
};

/**
 * @param {string} deviceName - 10 char ascii
 * @return {Promise}
 */
SBrick.prototype.setDeviceName = function (deviceName) {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            deviceName = deviceName.replace(/[^a-z0-9]/gi, '').substr(0, 10);
            deviceName = Buffer.from(deviceName, 'ascii').toString('hex');
            return this.writeCommand('2A' + deviceName);
        }).then(resolve)
        .catch(reject);
    });
};

/**
 * @return {Promise}
 */
SBrick.prototype.getDeviceName = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('2B');
        }).then((data) => {
            resolve(data.toString('ascii'));
        }).catch(reject);
    });
};

SBrick.prototype.setupPeriodicVoltageMeasurement = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.writeCommand('2C0809');
        }).then(resolve)
        .catch(reject);
    });
};

SBrick.prototype.getVoltageMeasurementSetup = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('2D');
        }).then((data) => {
            resolve(data.toString('hex'));
        }).catch(reject);
    });
};


SBrick.prototype.setupPeriodicVoltageNotifications = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.writeCommand('2E0809');
        }).then(resolve)
        .catch(reject);
    });
};

SBrick.prototype.getVoltageNotificationSetup = function () {
    return new Promise((resolve, reject) => {
        this.queue.add(() => {
            return this.readCommand('2F');
        }).then((data) => {
            resolve(data.toString('hex'));
        }).catch(reject);
    });
};

/**
 * Scan for SBrick devices
 * promise returns SBrickAdvertisementData[]
 *
 * @return {Promise}
 */
SBrick.scanSBricks = function () {
    return new Promise((resolve, reject) => {
        winston.info('scanning...');
        nobleConnected().then(() => {
            const sbricks = [];
            noble.on('discover', (peripheral) => {

                try {
                    let sbrickdata = SBrickAdvertisementData.parse(peripheral.advertisement.manufacturerData);
                    sbrickdata.uuid = peripheral.uuid;
                    winston.info('SBrick', sbrickdata);
                    sbricks.push(sbrickdata);
                } catch (err) {
                    winston.info(peripheral.uuid, err);
                }
            });

            noble.startScanning();

            setTimeout(() => {
                winston.info('scanning finished');
                noble.stopScanning();
                noble.removeAllListeners('discover');
                resolve(sbricks);
            }, 1000);
        }).catch(reject);
    });
};

module.exports = SBrick;