module.exports = {
    entry: './src/loader.js',
    output: {
        filename: 'bin/sbrick.webbluetooth.js'
    },
    externals: {
        'winston': '"winston"',
        'noble': '"noble"'
    }
};