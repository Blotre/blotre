var babel = require("gulp-babel");
var gulp = require("gulp");
var sourcemaps = require("gulp-sourcemaps");
var plumber = require('gulp-plumber');

var path = {
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
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest('./public/js/')));

gulp.task("default", ['js:compile'], () => {
    gulp.watch(path.watch, ['js:compile']);
});
