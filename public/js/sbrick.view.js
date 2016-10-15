var SBrickView = Backbone.View.extend({
    template: _.template($('#sbrick-view').text()),

    initialize: function () {
        this.channelViews = [];
    },

    render: function () {
        this.$el.html(this.template(this.model.attributes));

        var _this = this;

        this.model.channels.forEach(function (channel) {
            var channelView = new SBrickChannelView({model: channel});
            channelView.render().$el.appendTo(_this.$('.sbrick-control-panel-channels'));
            _this.channelViews.push(channelView);
        });

        return this;
    },

    destroy: function () {
        this.channelViews.forEach(function (channelView) {
            channelView.destroy();
        });

        this.remove();
    }
});
