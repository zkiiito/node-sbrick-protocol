/*global Backbone, SBrickChannelView, SmoothieChart, $, _ */
var SBrickView = Backbone.View.extend({
    template: _.template($('#sbrick-view').text()),

    events: {
        'blur .sbrick-control-panel-password': 'updateModel',
        'blur .sbrick-control-panel-stream-url': 'updateModel',
        'click .sbrick-control-panel-connect': 'connect',
        'click .sbrick-control-panel-disconnect': 'disconnect'
    },

    initialize: function () {
        this.channelViews = [];
        this.timeline = null;
        this.listenTo(this.model, 'change:connected', this.initChart);
        this.listenTo(this.model, 'change:connected', this.setButtons);
        this.listenTo(this.model, 'change:streamUrl', this.setStream);
    },

    render: function () {
        this.setElement(this.template(this.model.attributes));

        var _this = this;

        this.model.channels.forEach(function (channel) {
            var channelView = new SBrickChannelView({model: channel});
            channelView.render().$el.appendTo(_this.$('.sbrick-control-panel-channels'));
            _this.channelViews.push(channelView);
        });

        if (this.model.get('secured') === false) {
            this.$('.sbrick-control-panel-passwords').hide();
        }

        this.setButtons();
        this.setStream();

        return this;
    },

    initChart: function () {
        if (this.timeline === null) {
            this.resizeCanvas();
            this.timeline = new SmoothieChart({minValue:0, millisPerPixel:25});

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
        } else {
            if (this.model.get('connected')) {
                this.timeline.start();
            } else {
                this.timeline.stop();
            }
        }
    },

    setButtons: function () {
        if (this.model.get('connected')) {
            this.$('.sbrick-control-panel-connect').addClass('pure-button-disabled');
            this.$('.sbrick-control-panel-disconnect').removeClass('pure-button-disabled');
        } else {
            this.$('.sbrick-control-panel-connect').removeClass('pure-button-disabled');
            this.$('.sbrick-control-panel-disconnect').addClass('pure-button-disabled');
        }
    },

    setStream: function () {
        if (this.model.get('streamUrl')) {
            this.$('.sbrick-control-panel-stream').attr('src', this.model.getProxiedStreamUrl()).show();
        } else {
            this.$('.sbrick-control-panel-stream').hide();
        }
    },

    resizeCanvas: function () {
        this.$('.sbrick-control-panel-chart')[0].width = this.$el.width();
    },

    updateModel: function () {
        this.model.set('password', this.$('.sbrick-control-panel-password').val());
        this.model.set('streamUrl', this.$('.sbrick-control-panel-stream-url').val());
        this.model.save();
    },

    connect: function () {
        this.model.connect();
    },

    disconnect: function () {
        this.model.disconnect();
    },

    destroy: function () {
        this.channelViews.forEach(function (channelView) {
            channelView.destroy();
        });

        this.remove();
    }
});
