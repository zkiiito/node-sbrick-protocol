const SBrick = require('./SBrick');
const sbricks = {};

var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

server.listen(8000);

console.log('Open your browser at http://localhost:8000');

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', function (socket) {
    socket.on('SBrick.scan', () => {
        SBrick.scanSBricks((err, uuids) => {
            io.emit('SBrick.scanResults', uuids);
        });
    });

    socket.on('SBrick.connect', (uuid) => {
        const sbrick = new SBrick(uuid);
        sbrick.start((err) => {
            if (err) {
                return io.emit('SBrick.error', uuid, err);
            }

            io.emit('SBrick.ready', uuid);
        });
        sbricks.uuid = sbrick;
    });

    socket.on('SBrick.controlChannel', (uuid, channel, pwm) => {
        sbricks.uuid.channels[channel].pwm = pwm;
    })
});
