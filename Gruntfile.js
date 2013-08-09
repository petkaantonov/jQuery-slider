module.exports = function( grunt ) {

    var SRC_DEST = './src/jQuery-slider.js',
        TMP_DEST = './js/tmp.js',
        BUILD_DEST = './js/jQuery-slider.js',
        MIN_DEST = './js/jQuery-slider.min.js'

    var gruntConfig = {};

    gruntConfig.pkg = grunt.file.readJSON("package.json");

    gruntConfig.jshint = {
        all: {
            options: {
                jshintrc: "./.jshintrc"
            },

            files: {
                src: [
                    BUILD_DEST
                ]
            }
        }
    };

    gruntConfig["closure-compiler"] = {
        frontend: {
            closurePath: '../closure_compiler',
            js: TMP_DEST,
            jsOutputFile: MIN_DEST,
            maxBuffer: 8192,
            options: {
                compilation_level: 'SIMPLE_OPTIMIZATIONS',
                language_in: 'ECMASCRIPT5',
                charset: "UTF-8",
                debug: false
            },
            noreport: true
        }
    };

    grunt.initConfig(gruntConfig);
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-closure-compiler');

    grunt.registerTask( "build", function() {
        var fs = require("fs");

        var src = fs.readFileSync( SRC_DEST, "utf8" );

        var devSrc = src.replace( /%_PRODUCTION/g, "false" );
        var prodSrc = src.replace( /%_PRODUCTION/g, "true" );

        fs.writeFileSync( BUILD_DEST, devSrc );
        fs.writeFileSync( TMP_DEST, prodSrc );

    });

    grunt.registerTask( "clean", function() {
        var fs = require("fs");
        fs.unlink( TMP_DEST );

    });

    grunt.registerTask( "default", ["build", "jshint", "closure-compiler", "clean"] );

};