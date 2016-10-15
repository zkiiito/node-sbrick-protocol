var SBrickAdvertisementData = function () {
    this.uuid = null;
    this.hwVersion = null;
    this.swVersion = null;
    this.secured = false;
    this.identifier = null;
};

SBrickAdvertisementData.parse = function (data) {
    data = data instanceof Buffer ? data : new Buffer(data, 'hex');
    var i = 0;
    var byteLength = 0;
    var nextByteLength = 2;
    var section = [];
    var curSection = 1;
    var advertisementData = new SBrickAdvertisementData();

    for (var byte of data) {
        if (i === nextByteLength) {
            handleSection['s' + curSection](advertisementData, section);
            byteLength = byte;
            nextByteLength = i + byteLength + 1;
            section = [];
            curSection++;
        } else {
            section.push(byte);
        }
        i++;
    }

    handleSection['s' + curSection](advertisementData, section);

    return advertisementData;
};

const handleSection = {
    //header
    s1: function (data, bytes) {
        if (bytes[0] !== 152 || bytes[1] !== 1) {
            throw new Error('not SBrick');
        }
    },

    //Product type
    s2: function (data, bytes) {
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

    //BlueGiga ADC sensor raw reading
    s3: function (data, bytes) {
        if (bytes[0] === 1) {

        } else {
            throw new Error('not SBrick');
        }
    },

    //Device Identifier
    s4: function (data, bytes) {
        if (bytes[0] === 2) {
            bytes.shift();
            data.identifier = bytes.map(function (byte) {
                return ("00" + byte.toString(16)).substr(-2);
            }).join(':');
        } else {
            throw new Error('not SBrick');
        }
    },

    //Simple Security status
    s5: function (data, bytes) {
        if (bytes[0] === 3) {
            data.secured = bytes[1] === 1;
        } else {
            throw new Error('not SBrick');
        }
    }
};

module.exports = SBrickAdvertisementData;