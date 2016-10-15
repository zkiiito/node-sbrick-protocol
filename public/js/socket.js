/*global io, app */
var Socket = {
    initialize: function () {
        this.socket = io.connect('http://localhost:8000');

        this.socket.on('SBrick.scanResponse', this.scanResponse);
        this.socket.on('SBrick.connected', this.connected);
        this.socket.on('SBrick.error', this.error);
    },

    scan: function () {
        this.socket.emit('SBrick.scan');
    },

    scanResponse: function (sbricks) {
        app.scanResponse(sbricks);
    },

    connect: function (uuid) {
        this.socket.emit('SBrick.connect', uuid);
    },

    connected: function (uuid) {
        app.connected(uuid);
    },

    controlChannel: function (uuid, channelId, pwd) {
        this.socket.emit('SBrick.controlChannel', uuid, channelId, pwd);
    },

    error: function (uuid, err) {
        app.error(uuid, err);
    }
};