/*global Backbone, SBrickChannel, SBrickChannelCollection */
var SBrick = Backbone.Model.extend(
    /** @lends SBrick.prototype */
    {
        idAttribute: "uuid",
        defaults: {
            uuid: null,
            swVersion: null,
            hwVersion: null,
            secured: false,
            connected: false,
            password: null
        },
        /** @constructs */
        initialize: function () {
            this.listenTo(this.channels, 'change', () => {
                this.save();
            });
        },

        toJSON: function (options) {
            var json = _.clone(this.attributes);
            json.channels = this.channels.toJSON(options);
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
