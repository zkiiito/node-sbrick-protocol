var SBrickView = Backbone.View.extend({
    template: _.template($('#sbrick-view').text()),

    events: {
        "blur .sbrick-control-panel-password": "updateModel"
    },

    initialize: function () {
        this.channelViews = [];
        this.timeline = null;
        this.listenTo(this.model, 'change:connected', this.initChart);
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

    initChart: function () {
        if (this.timeline === null) {
            this.timeline = new SmoothieChart();

            this.timeline.addTimeSeries(this.model.voltages, {
                strokeStyle: 'rgba(0, 255, 0, 1)',
                fillStyle: 'rgba(0, 255, 0, 0.2)',
                lineWidth: 1
            });

            this.timeline.addTimeSeries(this.model.temperatures, {
                strokeStyle: 'rgba(255, 0, 0, 1)',
                fillStyle: 'rgba(255, 0, 0, 0.2)',
                lineWidth: 1
            });

            this.timeline.streamTo(this.$('.sbrick-control-panel-chart')[0]);
        }
    },

    updateModel: function () {
        this.model.set('password', this.$('.sbrick-control-panel-password').val());
    },

    destroy: function () {
        this.channelViews.forEach(function (channelView) {
            channelView.destroy();
        });

        this.remove();
    }
});
