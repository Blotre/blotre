"use strict";
const babel = require("gulp-babel");
const gulp = require("gulp");
const sourcemaps = require("gulp-sourcemaps");
const plumber = require('gulp-plumber');
const jshint = require('gulp-jshint');
const webpack = require('gulp-webpack');

const path = {
    js: ['./client/js/*.js'],
    watch: ['client/**/*.*']
};

gulp.task('js:compile', () =>
    gulp.src(path.js)
        .pipe(plumber())
        .pipe(sourcemaps.init())
        .pipe(babel({
            presets: ['es2015']
        }))
        .pipe(webpack({
            entry: {
                account_authorizations: './client/js/account_authorizations.js',
                client: './client/js/client.js',
                stream_create_child: './client/js/stream_create_child.js',
                stream_main: './client/js/stream_main.js',
                stream_index: './client/js/stream_index.js',
                tag: './client/js/tag.js'
            },
            output: {
                filename: "[name].js",
                publicPath: '/assets/js/'
            }
        }))
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest('./public/js/')));

gulp.task('js:lint', () =>
  gulp.src(path.js)
    .pipe(jshint())
    .pipe(jshint.reporter('default')));

gulp.task("default", ['js:lint', 'js:compile'], () => {
    gulp.watch(path.watch, ['js:lint', 'js:compile']);
});
