module.exports = function(grunt) {
  'use strict';

  /* read files.list and ignore empty lines */
  var files = grunt.file.read("files.list")
               .split(/[\r\n]+/)
               .filter(function(filename) { return !!filename })

  /* and prepend www/ */
  var sources = files.map(function(filename) { return "www/"+filename })

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    uglify: {
      options: {
        sourceMap: true
      },
      "qui.js": {
        files: { 'www/qui.js': sources }
      }
    },
    mustache_render: {
      'html': {
        files: [
          {src: 'tmpl/index.mustache',
           data: { src: files},
           dest: 'www/debug.html'},
          {src: 'tmpl/index.mustache',
           data: { src: 'qui.js' },
           dest: 'www/index.html'}
        ]
      }
    },
    jshint: {
      options: {
        asi: true
      },
      'all': ['Gruntfile.js',
              'config.js.example',
               sources]
    }
  });
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-mustache-render');

  grunt.registerTask('qui.js',  ['uglify:qui.js']);
  grunt.registerTask('html',    ['mustache_render:html']);
  grunt.registerTask('lint',    ['jshint']);
};
