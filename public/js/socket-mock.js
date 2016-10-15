Socket.scan = function () {
    this.scanResponse([
        {
            uuid: '0xfsdfs',
            hwVersion: 4,
            swVersion: 4.2,
            secured: false,
            identifier: null
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
    this.connected(uuid);
};
