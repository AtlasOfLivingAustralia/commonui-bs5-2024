var gulp = require('gulp'),
    gulpSass = require('gulp-sass')(require('sass')),
    cleanCSS = require('gulp-clean-css'),
    rename = require('gulp-rename'),
    replace = require('gulp-replace'),
    uglify = require('gulp-uglify'),
    babel = require('gulp-babel'),
    concat = require('gulp-concat'),
    streamSeries = require('stream-series'),
    del = require('del'),
    fs = require('fs'),
    buildvars = require('./buildvars.js');

const {src, dest, series, parallel} = gulp;

var paths = {
    styles: {
        src: ['source/vendor/jquery/jquery-ui-autocomplete.css', 'source/css/*.css'],
        sourceSass: ['source/scss/ala-styles.scss'],
        compiledSass: 'intermediate/',
        dest: 'build/css/'
    },
    testHtml: {
        src: ['source/html/testPage.html', 'source/html/testHome.html', 'source/html/patternLibrary*.html'],
        dest: 'build/'
    },
    html: {
        src: ['source/html/banner.mustache', 'source/html/footer.mustache', 'source/html/head.mustache'],
        dest: 'build/'
    },
    images: {
        src: ['source/img/*.*'],
        dest: 'build/img/'
    },
    js: {
        combinedJSSources: ['source/vendor/jquery/jquery-3.7.1.js', 'source/vendor/jquery/jquery-ui-autocomplete.js', 'source/vendor/bootstrap/dist/js/bootstrap.bundle.js', 'source/js/application.js'],
        src: [
            'source/js/application.js'
        ],
        dest: 'build/js/',
        jquery: 'source/vendor/jquery/jquery-3.7.1.js',
        bootstrap: 'source/vendor/bootstrap/dist/js/bootstrap.bundle.js',
        jqueryui: 'source/vendor/jquery/jquery-ui-autocomplete.js'
    }
};

function testHTMLPage() {
    var header = fs.readFileSync('source/html/banner.mustache');
    var footer = fs.readFileSync('source/html/footer.mustache');
    return src(paths.testHtml.src)
        .pipe(replace('HEADER_HERE', header))
        .pipe(replace('FOOTER_HERE', footer))
        .pipe(replace(/{{loginStatus}}/g, 'signedOut'))
        .pipe(replace(/{{loginURL}}/g, 'https://auth.ala.org.au/cas/login'))
        .pipe(replace(/{{logoutURL}}/g, 'https://auth.ala.org.au/cas/logout'))
        .pipe(replace(/{{searchServer}}/g, 'https://bie.ala.org.au'))
        .pipe(replace(/{{homeDomain}}/g, buildvars.homeDomain))
        .pipe(replace(/{{signUpURL}}/g, buildvars.signUpURL))
        .pipe(replace(/{{profileURL}}/g, buildvars.profileURL))
        .pipe(replace(/{{fathomID}}/g, buildvars.fathomID))
        .pipe(dest(paths.html.dest));
};

function generateHandlebars(cb) {
    src(paths.html.src)
        .pipe(replace(/{{loginStatus}}/g, 'signedOut'))
        .pipe(replace(/{{homeDomain}}/g, '{{ homeDomain }}'))
        .pipe(replace(/{{signUpURL}}/g, '{{ signUpURL }}'))
        .pipe(replace(/{{profileURL}}/g, '{{ profileURL }}'))
        .pipe(replace(/{{fathomID}}/g, '{{ fathomID }}'))
        .pipe(rename({extname: '.hbs'}))
        .pipe(dest(paths.html.dest));
    cb();
}

function html(cb) {
    src(paths.html.src)
        .pipe(replace(/{{homeDomain}}/g, buildvars.homeDomain))
        .pipe(replace(/{{signUpURL}}/g, buildvars.signUpURL))
        .pipe(replace(/{{profileURL}}/g, buildvars.profileURL))
        .pipe(replace(/{{fathomID}}/g, buildvars.fathomID))
        .pipe(dest(paths.html.dest));
    cb();
};

function images(cb) {
    src(paths.images.src, {encoding: false})
        .pipe(dest(paths.images.dest));
    cb();
}

function jQuery(cb) {
    src(paths.js.jquery)
        .pipe(uglify({output: {comments: '/^!/'}}))
        .pipe(rename('jquery.min.js'))
        .pipe(dest(paths.js.dest));
    cb();
}

function bootstrapJS() {
    return src(paths.js.bootstrap)
        .pipe(uglify({output: {comments: '/^!/'}}))
        .pipe(rename('bootstrap.min.js'))
        .pipe(dest(paths.js.dest));
}

function autocompleteJS() {
    return src(paths.js.jqueryui)
        .pipe(uglify({output: {comments: '/^!/'}}))
        .pipe(rename('autocomplete.min.js'))
        .pipe(dest(paths.js.dest));
}

function otherJsFiles() {
    return src(paths.js.src)
        .pipe(dest(paths.js.dest))
        .pipe(babel({presets: ['@babel/preset-env']}))
        .pipe(uglify({output: {comments: '/^!/'}}))
        .pipe(rename({extname: '.min.js'}))
        .pipe(dest(paths.js.dest));
}

function combinedJS(cb) {
    src(paths.js.combinedJSSources)
        .pipe(concat('ala-combined.js', {newLine:'\n'}))
        .pipe(dest(paths.js.dest))
        .pipe(uglify({output: {comments: '/^!/'}}))
        .pipe(rename('ala-combined.min.js'))
        .pipe(dest(paths.js.dest));
    cb();
}

function buildCSS(cb) {
    var sassStream,
        cssStream;
    sassStream = gulp.src(paths.styles.sourceSass)
        .pipe(gulpSass.sync().on('error', gulpSass.logError));
    cssStream = gulp.src(paths.styles.src);
    //combine the two streams and concatenate their contents into a single file
    streamSeries(sassStream, cssStream)
        .pipe(concat('ala-combined.css', {newLine:'\n;'}))
        .pipe(dest(paths.styles.dest))
        .pipe(cleanCSS())
        .pipe(rename({extname: '.min.css'}))
        .pipe(dest(paths.styles.dest));
    cb();
}

function delCSS() {
    return del(['build/css/*.css']);
}

var oldjs = parallel(jQuery, bootstrapJS, autocompleteJS, otherJsFiles);

var css = series(delCSS, buildCSS);

var build = parallel(css, testHTMLPage, html, generateHandlebars, combinedJS, images);

exports.default = build;
exports.delCSS = delCSS;
exports.css = css;
exports.html = series([testHTMLPage, html]);
exports.images = images;
exports.hbs = generateHandlebars;
exports.oldjs = oldjs;
exports.js = combinedJS;
exports.combinedJS = combinedJS;
exports.build = build;
