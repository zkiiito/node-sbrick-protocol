function SBrickChannel (channelId) {
    this.channelId = channelId;
    this.pwm = 0;
}

// brake or drive command
SBrickChannel.prototype.getCommand = function () {
    var dir = this.pwm < 0 ? '01' : '00';
    var cmdString = "010" + this.channelId.toString() + dir + (Math.abs(this.pwm) < 16 ? '0' : '') + Math.abs(this.pwm).toString(16);
    return new Buffer(cmdString, "hex");
};

module.exports = SBrickChannel;
