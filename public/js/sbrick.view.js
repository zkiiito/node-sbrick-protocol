var SBrickView = Backbone.View.extend({
    template: _.template($('#sbrick-view').text()),

    render: function () {
        this.$el.html(this.template(this.model.attributes));

        var _this = this;

        this.model.channels.forEach(function (channel) {
            var channelView = new SBrickChannelView({model: channel});
            channelView.render().$el.appendTo(_this.$('.sbrick-control-panel-channels'));
        });

        return this;
    }
});
