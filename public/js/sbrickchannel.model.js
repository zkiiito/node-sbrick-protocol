/*global Backbone, keycode */
var SBrickChannel = Backbone.Model.extend(
    /** @lends SBrickChannel.prototype */
    {
        idAttribute: 'channelId',
        defaults: {
            channelId: null,
            min: -255,
            max: 255,
            keyInc: null,
            keyDec: null
        },
        /** @constructs */
        initialize: function () {

        },

        getKeyNames: function () {
            return {
                keyIncName: keycode(this.get('keyInc')),
                keyDecName: keycode(this.get('keyDec'))
            };
        }
    }
);

/** @class */
var SBrickChannelCollection = Backbone.Collection.extend(
    /** @lends SBrickChannelCollection.prototype */
    {
        model: SBrickChannel
    }
);