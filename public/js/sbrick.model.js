var SBrickChannel, SBrickChannelCollection;

SBrick = Backbone.Model.extend(
    /** @lends SBrick.prototype */
    {
        idAttribute: "uuid",
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
