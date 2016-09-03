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
    socket.on('connectSBrick', function (uuid) {
        const sbrick = new SBrick(uuid);
        sbrick.start();
        sbricks.uuid = sbrick;
    });

    socket.on('controlSBrickChannel', function (uuid, channel, pwm) {
        sbricks.uuid.channels[channel].pwm = pwm;
    })
});
