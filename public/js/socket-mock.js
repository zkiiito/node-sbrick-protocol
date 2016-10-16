Socket.scan = function () {
    this.scanResponse([
        {
            uuid: '0xfsdfs',
            hwVersion: 4,
            swVersion: 4.2,
            secured: false,
            identifier: null,
            channels: JSON.parse('[{"channelId":0,"min":"-255","max":"254","keyInc":null,"keyDec":null},{"channelId":1,"min":-255,"max":255,"keyInc":null,"keyDec":null},{"channelId":2,"min":-255,"max":255,"keyInc":null,"keyDec":null},{"channelId":3,"min":-255,"max":255,"keyInc":null,"keyDec":null}]')
        },
        {
            uuid: '1xfsdfs',
            hwVersion: 4,
            swVersion: 4.2,
            secured: false,
            identifier: null
        }
    ]);
};

Socket.connect = function (uuid) {
    var _this = this;
    this.connected(uuid);
    setInterval(function () {
        _this.voltAndTemp(uuid, Math.random() * 9, Math.random() * 37);
    }, 500);
};

Socket.controlChannel = function (uuid, channelId, pwd) {
    console.log('SBrick.controlChannel', uuid, channelId, pwd);
};
