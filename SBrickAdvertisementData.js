const SBrickAdvertisementData = function () {
    this.uuid = null;
    this.hwVersion = null;
    this.swVersion = null;
    this.secured = false;
    this.identifier = null;
};

SBrickAdvertisementData.parse = function (data) {
    data = data instanceof Buffer ? data : new Buffer(data, 'hex');
    if (SBrickAdvertisementData.winston) {
        SBrickAdvertisementData.winston.debug(data.toString('hex'));
    }
    let i = 0;
    let byteLength = 0;
    let nextByteLength = 2;
    let section = [];
    let curSection = 0;
    let advertisementData = new SBrickAdvertisementData();

    for (let byte of data) {
        if (i === nextByteLength) {
            if (handleSection['s' + curSection]) {
                handleSection['s' + curSection](advertisementData, section);
            }
            byteLength = byte;
            nextByteLength = i + byteLength + 1;
            section = [];
            curSection++;
        } else {
            section.push(byte);
        }
        i++;
    }

    if (handleSection['s' + curSection]) {
        handleSection['s' + curSection](advertisementData, section);
    }

    return advertisementData;
};

const handleSection = {
    //header
    s0: function (data, bytes) {
        if (bytes[0] !== 152 || bytes[1] !== 1) {
            throw new Error('not SBrick');
        }
    },

    /*
     00 Product type
     00 <1: Product ID> <2: HW major/minor version> <2: FW major/minor version>
     00 - SBrick
     Example 1: 02 00 00 - Product SBrick
     Example 2: 06 00 00 04 00 04 01 - Product SBrick, HW 4.0, FW 4.1
     */
    s1: function (data, bytes) {
        if (bytes[0] !== 0 || bytes[1] !== 0) {
            throw new Error('not SBrick');
        }

        if (bytes.length > 2) {
            data.hwVersion = parseFloat(bytes[2] + '.' + bytes[3]);
        }

        if (bytes.length > 4) {
            data.swVersion = parseFloat(bytes[4] + '.' + bytes[5]);
        }
    },

    /*
     01 BlueGiga ADC sensor raw reading
     01 <1: channel> <2: raw sensor reading>
     Example, battery reading '12f0' on SBrick: 04 01 00 12 F0
     Example, temperature reading '12f0': 04 01 0e 12 F0
     */
    s2: function (data, bytes) {

    },

    /*
     02 Device Identifier
     02 < Device identifier string >
     Example, SBrick device ID: 07 02 0D 23 FC 19 87 63
     */
    s3: function (data, bytes) {
        bytes.shift();
        data.identifier = bytes.map(function (byte) {
            return ('00' + byte.toString(16)).substr(-2);
        }).join(':');
    },

    /*
     03 Simple Security status
     05 < status code >
     00: Freely accessible
     01: Authentication needed for some functions
     */
    s4: function (data, bytes) {
        data.secured = bytes[1] === 1;
    }
};

module.exports = SBrickAdvertisementData;
