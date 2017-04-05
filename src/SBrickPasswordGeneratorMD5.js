const md5 = require('md5');

/**
 * Creates 8-bype password hash, using the first half of md5 hash.
 *
 * @param {string} password
 * @return {string}
 */
module.exports = function (password) {
    password = password || '';
    const passwordMD5 = md5(password);
    return passwordMD5.substr(0, 16);
};
