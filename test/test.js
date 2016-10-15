const assert = require('assert');

const SBrickChannelAdvertismentData = require('../SBrickAdvertisementData');

describe('SBrickChannelAdvertismentData', function () {
    describe('#parse()', function () {
        it('should valid SBrick data', function () {
            var sbrickData = SBrickChannelAdvertismentData.parse('98010600000400040204010E12f007020D23FC198763020300');
            assert.equal(4, sbrickData.hwVersion);
            assert.equal(4.2, sbrickData.swVersion);
            assert.equal(false, sbrickData.secured);
        });
    });
});