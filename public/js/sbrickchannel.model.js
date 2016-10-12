/*global app, Communicator */

SBrickChannel = Backbone.Model.extend(
    /** @lends SBrickChannel.prototype */
    {
        defaults: {
            channelId: null,
            min: -255,
            max: 255,
            keyInc: null,
            keyDec: null
        },
        /** @constructs */
        initialize: function () {

        }
    }
);

/** @class */
SBrickChannelCollection = Backbone.Collection.extend(
    /** @lends SBrickChannelCollection.prototype */
    {
        model: SBrickChannel
    }
);