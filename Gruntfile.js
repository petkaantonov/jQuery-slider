module.exports = function( grunt ) {

    var TMP_DEST = './js/tmp.js',
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

    gruntConfig.concat = {
        options: {
            separator: '\n'
        },

        dist: {
            src: [
                "./src/begin.js",
                "./src/utils.js",
                "./src/hook.js",
                "./src/box.js",
                "./src/slider_knob.js",
                "./src/slider.js",
                "./src/plugin.js",
                "./src/end.js"
            ],

            nonull: true,

            dest: BUILD_DEST
        }

    };

    gruntConfig.watch = {
            scripts: {
            files: [
                "./src/**/*"
            ],
            tasks: ["concat", "build", "clean"],
            options: {
              interrupt: true,
              debounceDelay: 2500
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
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-concat');


    grunt.registerTask( "build", function() {
        var fs = require("fs");

        var src = fs.readFileSync( BUILD_DEST, "utf8" );

        var devSrc = src.replace( /%_PRODUCTION/g, "false" );
        var prodSrc = src.replace( /%_PRODUCTION/g, "true" );

        fs.writeFileSync( BUILD_DEST, devSrc );
        fs.writeFileSync( TMP_DEST, prodSrc );

    });

    grunt.registerTask( "clean", function() {
        var fs = require("fs");
        fs.unlink( TMP_DEST );

    });

    grunt.registerTask( "dev", ["concat", "build", "jshint", "clean"] );
    grunt.registerTask( "default", ["concat", "build", "jshint", "closure-compiler", "clean"] );

};