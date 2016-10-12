/*global io, app */
var Socket = {
    initialize: function () {
        this.socket = io.connect('http://localhost:8000');

        this.socket.on('SBrick.scanResponse', (sbricks) => {
            //app.
        });

        this.socket.on('SBrick.error', (uuid, err) => {
            app.error(uuid, err);
        });

        this.socket.on('SBrick.connected', (uuid) => {
            app.connected(uuid);
        });
    },

    scan: function () {
        this.socket.emit('SBrick.scan');
    },

    connect: function (uuid) {
        this.socket.emit('SBrick.connect', uuid);
    }
};