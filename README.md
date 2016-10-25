# SBrick Controller
Control your [Lego](https://lego.com) [SBrick](https://www.sbrick.com/) creations from the browser, using your keyboard!

## Requirements
A device with [node.js](https://nodejs.org/)  and a Bluetooth 4.x adapter, which is supported by [noble](https://github.com/sandeepmistry/noble#prerequisites).

## Installation
```
git clone git@github.com:zkiiito/node-sbrick-controller.git
cd node-sbrick-controller
npm install
npm start
```
then, open your browser at http://localhost:8000/

## Project status
Working from the web UI:
* scan for SBricks
* connect/disconnect
* channel control (drive with keyboard keys)
* temperature & voltage real time chart

Still under development:
* overall security: to put it on an raspberry PI, and control your creation from anywhere, it needs some :)
* some video streaming solution - to see where is your creation
* many SBrick commands implemented, but not available on the UI:
  * watchdog
  * thermal limit
  * release on reset
  * uptime counter
  * power cycle counter
* commands not implemented (yet):
  * authentication (in progress)
  * programming
  * events
  * connection parameters
  * PWM counter
  * quick drive
* I'm also thinking about separating the SBrick protocol implementation and the web UI.
