const SBrick = require('./SBrick');
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const bodyParser = require('body-parser');
const storage = require('node-persist');
const async = require('async');
const Ajv = require('ajv');
const schema = require('./SBrickSchema');

const ajv = new Ajv();

storage.initSync({
    dir: __dirname + '/data'
});

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

app.put('/sbricks/:uuid', function (req, res) {
    if (!ajv.validate(schema, req.body)) {
        res.status(400).send(ajv.errors);
    } else {
        storage.setItem(req.params.uuid, req.body).then(() => {
            res.sendStatus(200);
        });
    }
});

io.on('connection', function (socket) {
    socket.sbricks = {};

    socket.on('SBrick.scan', () => {
        Object.keys(socket.sbricks).forEach((uuid) => {
            socket.sbricks[uuid].disconnect();
        });

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
            sbrick.on('SBrick.disconnected', () => {
                io.emit('SBrick.disconnected', uuid);
            });
        });
        socket.sbricks[uuid] = sbrick;
    });

    socket.on('SBrick.controlChannel', (uuid, channel, pwm) => {
        if (socket.sbricks.hasOwnProperty(uuid)) {
            socket.sbricks[uuid].channels[channel].pwm = pwm;
        }
    });

    socket.on('SBrick.disconnect', (uuid) => {
        if (socket.sbricks.hasOwnProperty(uuid)) {
            socket.sbricks[uuid].disconnect();
        }
    });

    socket.on('SBrick.command', (uuid, command) => {
        console.log(uuid, command);
        if (socket.sbricks.hasOwnProperty(uuid)) {
            if (typeof socket.sbricks[uuid][command] === 'function') {
                socket.sbricks[uuid][command]().then(console.log).catch(console.log);
            }
        }
    });

    socket.on('disconnect', () => {
        Object.keys(socket.sbricks).forEach((uuid) => {
            socket.sbricks[uuid].disconnect();
        });
    });
});

server.listen(8000);
console.log('Open your browser at http://localhost:8000');
