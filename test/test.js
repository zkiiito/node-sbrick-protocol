const assert = require('assert');

const SBrickChannelAdvertismentData = require('../SBrickAdvertisementData');

describe('SBrickChannelAdvertismentData', function () {
    describe('#parse()', function () {
        it('should valid SBrick data', function () {
            const sbrickData = SBrickChannelAdvertismentData.parse('98010600000400040204010E12f007020D23FC198763020300');
            assert.equal(4, sbrickData.hwVersion);
            assert.equal(4.2, sbrickData.swVersion);
            assert.equal(false, sbrickData.secured);
            console.log(sbrickData);
        });

        it('valid SBrick data protocol 5.17', function () {
            const sbrickData = SBrickChannelAdvertismentData.parse('98010600000500051107020D23FC1987630203000506684b4957');
            assert.equal(5, sbrickData.hwVersion);
            assert.equal(5.17, sbrickData.swVersion);
            assert.equal(false, sbrickData.secured);
            console.log(sbrickData);
        });

        it('does not recognize other things', function () {
            let error = false;
            try {
                SBrickChannelAdvertismentData.parse('0600010920020f2d103673ba5223469024a78f57a6b56b8e919c31c80f')
            } catch (err) {
                error = true;
            }

            assert.equal(true, error);
        });
    });
});
