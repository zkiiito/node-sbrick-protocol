const crypto = require('crypto');

/**
 * Creates 8-bype password hash, using the first half of md5 hash.
 *
 * @param {string} password
 * @return {string}
 */
module.exports = function (password) {
    password = password || '';
    const passwordMD5 = crypto.createHash('md5').update(password).digest('hex');
    return passwordMD5.substr(0, 16);
};
