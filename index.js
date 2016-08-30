var noble = require('noble');

var peripherals = [];

noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
        noble.startScanning([], false);//, function () {
            //noble.startScanning(['4dc591b0857c41deb5f115abda665b0c'], false);

        setTimeout(function () {
                console.log(peripherals.length, " peripherals");
                noble.stopScanning();
                peripherals.forEach(function (peripheral) {

                    peripheral.connect(function (error) {
                        console.log('connected to peripheral: ' + peripheral.uuid, peripheral.advertisement);
                        peripheral.discoverServices(null, function (error, services) {
                            if (error) {
                                console.log("error", error);
                            }
                            console.log('discovered the following services:');
                            for (var i in services) {
                                console.log('  ' + i + ' uuid: ' + services[i].uuid);

                                if (services[i].uuid.toString() === '4dc591b0857c41deb5f115abda665b0c') {
                                    console.log('service found');
                                    var characteristicUUIDs = [];
                                    services[i].discoverCharacteristics(characteristicUUIDs, function (error, characteristics) {
                                        console.log(characteristics);
                                        characteristics.forEach(function (characteristic) {
                                            if (characteristic.uuid === '02b8cbcc0e254bda8790a15f53e6010f') {
                                                console.log('writing stuff');

                                                var b = new Buffer("0a", "hex");
                                                console.log(b);
                                                characteristic.write(b, function (err) {
                                                    console.log('write', err);
                                                    characteristic.read(function(err, data) {
                                                        console.log("read", err, data);
                                                    });
                                                });

                                                characteristic.read(function(err, data) {
                                                    console.log("read2", err, data);
                                                });

                                                b = new Buffer("010101c0", "hex");
                                                characteristic.write(b, function (err) {
                                                    console.log('write', err);
                                                });


                                                characteristic.on('data',function (data) {
                                                    console.log('data', data);
                                                });

                                                characteristic.subscribe(function (err, data) {
                                                    console.log(err, data);
                                                });
                                            }
                                        });
                                    });
                                }
                            }
                        });
                    });
                });


            }, 1200);
        //});

    } else {
        noble.stopScanning();
    }
});

noble.on('discover', function(peripheral) {
    peripherals.push(peripheral);
});

