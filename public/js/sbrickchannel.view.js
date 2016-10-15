var SBrickChannelView = Backbone.View.extend({
    template: _.template($('#sbrick-channel-view').text()),

    events: {
        'change input': 'updateModel'
    },

    initialize: function () {
        this.listenTo(this.model, 'change', this.render);
    },

    render: function () {
        this.$el.html(this.template(this.model.attributes));
        return this;
    },

    updateModel: function () {
        this.model.set({
            'min': this.$('.minvalue').val(),
            'max': this.$('.maxvalue').val()
        }, {silent: true});
    }
});
