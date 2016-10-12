/*global app, Communicator */
var SBrickChannel, SBrickChannelCollection;

SBrick = Backbone.Model.extend(
    /** @lends SBrick.prototype */
    {
        defaults: {
            uuid: null,
            swVersion: null,
            hwVersion: null,
            secured: false,
            connected: false
        },
        /** @constructs */
        initialize: function () {
            this.channels = new SBrickChannelCollection();
            this.channels.add(new SBrickChannel({channelId: 0}));
            this.channels.add(new SBrickChannel({channelId: 1}));
            this.channels.add(new SBrickChannel({channelId: 2}));
            this.channels.add(new SBrickChannel({channelId: 3}));
        },

        connect: function () {
            Socket.connect(this.get('uuid'));
        }
    }
);

/** @class */
SBrickCollection = Backbone.Collection.extend(
    /** @lends SBrickCollection.prototype */
    {
        model: SBrick
    }
);
