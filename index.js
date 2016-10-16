const SBrick = require('./SBrick');
const sbricks = {};

const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const bodyParser = require('body-parser');
const storage = require('node-persist');
const async = require('async');

storage.initSync({
    dir: __dirname + '/data'
});

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

app.put('/sbricks/:uuid', function (req, res) {
    storage.setItem(req.params.uuid, req.body).then(() => {
        res.sendStatus(200);
    });
});

io.on('connection', function (socket) {
    socket.on('SBrick.scan', () => {
        SBrick.scanSBricks((err, sbricks) => {
            async.map(sbricks, (sbrick, callback) => {
                storage.getItem(sbrick.uuid).then((value) => {
                    callback(null, Object.assign({}, value, sbrick));
                })
            }, (err, results) => {
                io.emit('SBrick.scanResponse', results);
            });
        });
    });

    socket.on('SBrick.connect', (uuid) => {
        const sbrick = new SBrick(uuid);
        sbrick.start((err) => {
            if (err) {
                return io.emit('SBrick.error', uuid, err);
            }

            io.emit('SBrick.connected', uuid);
            sbrick.on('SBrick.voltAndTemp', (voltage, temperature) => {
                io.emit('SBrick.voltAndTemp', uuid, voltage, temperature);
            });
        });
        sbricks[uuid] = sbrick;
    });

    socket.on('SBrick.controlChannel', (uuid, channel, pwm) => {
        sbricks[uuid].channels[channel].pwm = pwm;
    })
});

server.listen(8000);
console.log('Open your browser at http://localhost:8000');
