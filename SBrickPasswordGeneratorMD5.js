/**
 * @param {String} password
 * @return {String}
 */
const crypto = require('crypto');

module.exports = function (password) {
    const passwordMD5 = crypto.createHash('md5').update(password).digest('hex');
    return passwordMD5.substr(0, 16);
};
