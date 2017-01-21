![david-dm](https://david-dm.org/zkiiito/node-sbrick-protocol.svg)

# SBrick Protocol
Control your [Lego](https://lego.com) [SBrick](https://www.sbrick.com/) creations from node.js!

## Requirements
An [SBrick](https://sbrickstore.com/) with Protocol 17, a device with [node.js](https://nodejs.org/)  and a Bluetooth 4.x adapter, which is supported by [noble](https://github.com/sandeepmistry/noble#prerequisites).

## Installation
```
npm install sbrick-protocol
```

## Usage
```
const SBrick = require('sbrick-protocol');
var sbrick = null;

//scan for SBricks
SBrick.scanSBricks()
    .then((sbricks) => {
        if (sbricks.length > 0) {
            //connect to first SBrick
            sbrick = new SBrick(sbricks[0].uuid);
            return sbrick.connect();
        } else {
            throw new Error('no SBricks found');
        }
    })
    .then(() => {
        //start sbrick main loop
        return sbrick.start();
    })
    .then(() => {
        //subscribe to events
        sbrick.on('SBrick.voltage', (voltage) => {
            console.log('voltage', voltage);
        });
        
        sbrick.on('SBrick.temperature', (temperature) => {
            console.log('temperature', temperature);
        });

        
        //set channel 0 to full speed
        sbrick.channels[0].pwm = 255;
    })
    .catch(console.log);
```

See the complete interface in [SBrick.js](SBrick.js).

A fully functional, browser-based interface also available at [node-sbrick-controller](https://github.com/zkiiito/node-sbrick-controller). 

## Commands not implemented yet
 * connection parameters
 * PWM counter
 * quick drive
 * SBrick Plus measurements
