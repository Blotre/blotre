"use strict";
var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var watchify = require('watchify');
var babel = require('babelify');
var jshint = require('gulp-jshint');

const path = {
    js: [
        'account_authorizations.js',
        'client.js',
        'stream_create_child.js',
        'stream_main.js',
        'stream_index.js',
        'tag.js'],
    watch: ['client/**/*.*']
};

gulp.task('js:compile', () => {
    const bundle = file => {
        var bundler = watchify(browserify('./client/js/' + file, { debug: true })
            .transform("babelify", { presets: ['es2015'] }));

        bundler.bundle()
          .on('error', function(err) { console.error(err); this.emit('end'); })
          .pipe(source(file))
          .pipe(buffer())

          .pipe(gulp.dest('./public/js/'));
    };
    path.js.forEach(bundle);
});

gulp.task('js:lint', () =>
  gulp.src(path.js)
    .pipe(jshint())
    .pipe(jshint.reporter('default')));

gulp.task("default", ['js:compile'], () => {
    gulp.watch(path.watch, ['js:compile']);
});
