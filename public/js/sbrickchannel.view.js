var SBrickChannelView = Backbone.View.extend({
    template: _.template($('#sbrick-channel-view').text()),

    events: {
        'change input[type=number]': 'updateModel',
        'keydown input[type=text]': 'setKey'
    },

    initialize: function () {
    },

    render: function () {
        this.setElement(this.template(_.merge(this.model.attributes, this.model.getKeyNames())));
        return this;
    },

    setKey: function (e) {
        var targetAttribute = $(e.target).hasClass('sbrick-control-panel-channel-keyinc') ? 'keyInc' : 'keyDec';
        this.model.set(targetAttribute, e.which);
        $(e.target).val(keycode(e.which)).blur();
    },

    updateModel: function () {
        this.model.set({
            'min': this.$('.sbrick-control-panel-channel-minvalue').val(),
            'max': this.$('.sbrick-control-panel-channel-maxvalue').val()
        });
    },

    destroy: function () {
        this.remove();
    }
});
