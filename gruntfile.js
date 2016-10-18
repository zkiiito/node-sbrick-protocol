module.exports = function (grunt) {
    'use strict';

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-text-replace');

    var jsFilesThirdParty = [
        "node_modules/socket.io/node_modules/socket.io-client/socket.io.js",
        "node_modules/jquery/dist/jquery.js",
        "node_modules/lodash/lodash.js",
        "node_modules/backbone/backbone.js",
        "node_modules/smoothie/smoothie.js",
        "public/js/keycode.js"
    ];

    var jsFiles = [
        "public/js/sbrickchannel.model.js",
        "public/js/sbrick.model.js",
        "public/js/sbrickchannel.view.js",
        "public/js/sbrick.view.js",
        "public/js/sbrickcontroller.view.js",
        "public/js/socket.js",
        //"public/js/socket-mock.js",
        "public/js/app.js"
    ];

    grunt.initConfig({
        uglify: {
            thirdParty: {
                files: {
                    'public/js-min/thirdparty.min.js': jsFilesThirdParty
                }
            },
            public: {
                files: {
                    'public/js-min/sbrickcontroller.min.js': jsFiles
                }
            }
        },
        concat: {
            public: {
                src: jsFiles,
                dest: 'public/js-min/sbrickcontroller.min.js'
            },
            thirdParty: {
                src: jsFilesThirdParty,
                dest: 'public/js-min/thirdparty.min.js'
            }
        },
        replace: {
            keycode: {
                src: 'node_modules/keycode/index.js',
                dest: 'public/js/keycode.js',
                replacements: [{
                    from: 'exports',
                    to: 'keycode'
                }, {
                    from: 'module.keycode',
                    to: 'keycode'
                }]
            }
        }
    });

    grunt.registerTask('default', 'concat:public');
};