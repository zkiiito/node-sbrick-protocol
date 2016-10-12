const SBrick = require('./SBrick');
const sbricks = {};

const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

server.listen(8000);

console.log('Open your browser at http://localhost:8000');

app.use(express.static(__dirname + '/public'));

io.on('connection', function (socket) {
    socket.on('SBrick.scan', () => {
        SBrick.scanSBricks((err, sbricks) => {
            io.emit('SBrick.scanResponse', sbricks);
        });
    });

    socket.on('SBrick.connect', (uuid) => {
        const sbrick = new SBrick(uuid);
        sbrick.start((err) => {
            if (err) {
                return io.emit('SBrick.error', uuid, err);
            }

            io.emit('SBrick.connected', uuid);
        });
        sbricks.uuid = sbrick;
    });

    socket.on('SBrick.controlChannel', (uuid, channel, pwm) => {
        sbricks.uuid.channels[channel].pwm = pwm;
    })
});
