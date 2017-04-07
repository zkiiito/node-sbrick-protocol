module.exports = {
    entry: './src/loader.js',
    output: {
        filename: 'sbrick.webbluetooth.js'
    },
    externals: {
        'winston': '"winston"',
        'noble': '"noble"'
    }
};