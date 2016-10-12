var SBrickControllerView = Backbone.View.extend({
    events: {
        "keydown": "keydown",
        "keyup": "keyup",
        "click #sbrick-list-scan": "scan",
        "click #sbrick-list-connect": "connect"
    },

    initialize: function () {
        this.listview = new SBrickListView({el: this.$el.find('#sbrick-list-list')});
    },
/*
    render: function () {
        return this;
    },
*/
    keydown: function (event) {
        var keycode = event.which;

        sbricks.forEach((sbrick) => {
            sbrick.channels.forEach((channel) => {
                if (channel.keyDec === keycode) {
                    socket.emit('SBrick.controlChannel', sbrick.uuid, channel.channelId, channel.min);
                }

                if (channel.keyInc === keycode) {
                    socket.emit('SBrick.controlChannel', sbrick.uuid, channel.channelId, channel.max);
                }
            });
        });

        //up
        if (keycode === 38) {
            socket.emit('SBrick.controlChannel', uuid, 1, 255);
        }

        //down
        if (keycode === 40) {
            socket.emit('SBrick.controlChannel', uuid, 1, -255);
        }

        //left
        if (keycode === 37) {
            socket.emit('SBrick.controlChannel', uuid, 2, 255);
        }

        //right
        if (keycode === 39) {
            socket.emit('SBrick.controlChannel', uuid, 2, -255);
        }
    },

    keyup: function (event) {
        var keycode = event.which;

        sbricks.forEach((sbrick) => {
            sbrick.channels.forEach((channel) => {
                if (channel.keyDec === keycode || channel.keyInc === keycode) {
                    socket.emit('SBrick.controlChannel', sbrick.uuid, channel.channelId, 0);
                }
            });
        });

        //up
        if (keycode === 38) {
            socket.emit('SBrick.controlChannel', uuid, 1, 0);
        }

        //down
        if (keycode === 40) {
            socket.emit('SBrick.controlChannel', uuid, 1, 0);
        }

        //left
        if (keycode === 37) {
            socket.emit('SBrick.controlChannel', uuid, 2, 0);
        }

        //right
        if (keycode === 39) {
            socket.emit('SBrick.controlChannel', uuid, 2, 0);
        }
    },

    scan: function () {
        this.$el.find('#sbrick-list-connect').attr('disabled', 'disabled');
        this.$el.find('#sbrick-list-scan').attr('disabled', 'disabled');
        Socket.scan();
    },

    scanReady: function (sbricks) {
        this.$el.find('#sbrick-list-scan').removeAttr('disabled');
        if (sbricks.length > 0) {
            this.$el.find('#sbrick-list-connect').removeAttr('disabled');
            //
            //on add to model
            //new view ami egy option, annak vannak allapotai aztan kesz
            //disable connected sbrick uuids
        }
    },

    error: function (uuid, err) {
        console.log('error', uuid, err);
    },

    connect: function () {
        //get selected uuid
        //disable button
        //load data if exist to tmp place? to fill in password
        Socket.connect(uuid);
    },

    connected: function (uuid) {
        //disable uuid in list
        this.$el.find('#sbrick-list-connect').removeAttr('disabled');
        this.sbricks.add(new SBrick({uuid: uuid}));
    }
});
