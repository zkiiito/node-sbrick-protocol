var SBrickListView = Backbone.View.extend({
    initialize: function () {
        this.listenTo(this.model, 'change:connected', this.changeConnected);
        this.listenTo(this.model, 'add', this.addSBrick);
        this.listenTo(this.model, 'remove', this.removeSBrick);
    },

    findOptionByUUID: function (uuid) {
        return this.$el.find('option#sbrick-list-item-' + uuid);
    },

    changeConnected: function (sbrick) {
        var uuid = sbrick.get('uuid');
        var option = this.findOptionByUUID(uuid);

        if (sbrick.get('connected')) {
            option.attr('disabled', 'disabled');
        } else {
            option.removeAttr('disabled');
        }
    },

    addSBrick: function (sbrick) {
        var uuid = sbrick.get('uuid');
        if (this.findOptionByUUID(uuid).length === 0) {
            $('<option>').attr('id', 'sbrick-list-item-' + uuid).text(uuid).val(uuid).appendTo(this.$el);
            this.changeConnected(sbrick);
        }
    },

    removeSBrick: function (sbrick) {
        var uuid = sbrick.get('uuid');
        this.findOptionByUUID(uuid).remove();
    }
});