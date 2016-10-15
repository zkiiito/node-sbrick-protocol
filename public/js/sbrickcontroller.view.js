var SBrickControllerView = Backbone.View.extend({
    events: {
        "keydown": "keydown",
        "keyup": "keyup",
        "click #sbrick-list-scan": "scan",
        "click #sbrick-list-connect": "connect"
    },

    initialize: function () {
        this.model = new SBrickCollection();
        this.listview = new SBrickListView({
            el: this.$('#sbrick-list-list'),
            model: this.model
        });

        this.listenTo(this.model, 'add', this.addSBrickView);
        this.listenTo(this.model, 'remove', this.removeSBrickView);
    },

    addSBrickView: function (sbrick) {
        var sbrickView = new SBrickView({model: sbrick});
        sbrickView.render().$el.appendTo(this.$el);
    },

    removeSBrickView: function (sbrick) {
        this.$('#sbrick-control-panel-' + sbrick.get('uuid')).remove();
    },

    keydown: function (event) {
        var keycode = event.which;

        this.model.forEach((sbrick) => {
            sbrick.channels.forEach((channel) => {
                if (channel.get('keyDec') === keycode) {
                    socket.emit('SBrick.controlChannel', sbrick.get('uuid'), channel.get('channelId'), channel.get('min'));
                }

                if (channel.get('keyInc') === keycode) {
                    socket.emit('SBrick.controlChannel', sbrick.get('uuid'), channel.get('channelId'), channel.get('max'));
                }
            });
        });
/*
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
        */
    },

    keyup: function (event) {
        var keycode = event.which;

        this.model.forEach((sbrick) => {
            sbrick.channels.forEach((channel) => {
                if (channel.get('keyDec') === keycode || channel.get('keyInc') === keycode) {
                    socket.emit('SBrick.controlChannel', sbrick.get('uuid'), channel.get('channelId'), 0);
                }
            });
        });
/*
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
        */
    },

    scan: function () {
        this.$('#sbrick-list-connect').attr('disabled', 'disabled');
        this.$('#sbrick-list-scan').attr('disabled', 'disabled');
        Socket.scan();
    },

    scanResponse: function (sbricks) {
        this.$('#sbrick-list-scan').removeAttr('disabled');
        this.model.set(sbricks);
        if (sbricks.length > 0) {
            this.$('#sbrick-list-connect').removeAttr('disabled');
        } else {
            this.$('#sbrick-list-connect').attr('disabled', 'disabled');
        }
    },

    error: function (uuid, err) {
        console.log('error', uuid, err);
    },

    connect: function () {
        var uuid = this.$('#sbrick-list-list').val();
        //load data if exist to tmp place? to fill in password
        if (uuid) {
            this.$('#sbrick-list-connect').attr('disabled', 'disabled');
            Socket.connect(uuid);
        }
    },

    connected: function (uuid) {
        this.$('#sbrick-list-connect').removeAttr('disabled');
        this.model.get(uuid).set('connected', true);
    }
});
