/*global Backbone, SBrickChannel, SBrickChannelCollection, TimeSeries, _ */
var SBrick = Backbone.Model.extend(
    /** @lends SBrick.prototype */
    {
        idAttribute: 'uuid',
        defaults: {
            uuid: null,
            swVersion: null,
            hwVersion: null,
            secured: false,
            connected: false,
            password: null,
            streamUrl: null
        },
        /** @constructs */
        initialize: function () {
            this.listenTo(this.channels, 'change', function () {
                this.save(); //save gets the channel object, we have to save the sbrick object
            });
            this.voltages = new TimeSeries();
            this.temperatures = new TimeSeries();
            this.set('connected', false);
        },

        toJSON: function (options) {
            var json = {
                uuid: this.get('uuid'),
                password: this.get('password'),
                streamUrl: this.get('streamUrl'),
                channels: this.channels.toJSON(options)
            };
            return json;
        },

        parse: function (resp, options) {
            if (this.channels === undefined) {
                this.channels = new SBrickChannelCollection();
                this.channels.add(new SBrickChannel({channelId: 0}));
                this.channels.add(new SBrickChannel({channelId: 1}));
                this.channels.add(new SBrickChannel({channelId: 2}));
                this.channels.add(new SBrickChannel({channelId: 3}));
            }

            if (resp.channels) {
                this.channels.reset(resp.channels);
            }

            return _.omit(resp, 'channels');
        },

        addVoltage: function (time, voltage) {
            this.voltages.append(time, voltage);
        },

        addTemperature: function (time, temperature) {
            this.temperatures.append(time, temperature);
        },

        connect: function () {
            if (!this.get('connected')) {
                this.trigger('connect', this);
            }
        },

        disconnect: function () {
            if (this.get('connected')) {
                this.trigger('disconnect', this);
            }
        },

        setConnected: function (connected) {
            this.set('connected', connected);
            if (connected === false){
                this.voltages.clear();
                this.temperatures.clear();
            }
        }
    }
);

/** @class */
var SBrickCollection = Backbone.Collection.extend(
    /** @lends SBrickCollection.prototype */
    {
        model: SBrick,
        url: '/sbricks'
    }
);
