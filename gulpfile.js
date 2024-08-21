var gulp = require('gulp'),
    gulpSass = require('gulp-sass')(require('sass')),
    cleanCSS = require('gulp-clean-css'),
    rename = require('gulp-rename'),
    replace = require('gulp-replace'),
    uglify = require('gulp-uglify'),
    babel = require('gulp-babel'),
    fs = require('fs'),
    gulpClean = require('gulp-clean'),
    buildvars = require('./buildvars.js');

const {src, dest, series, parallel} = gulp;

var paths = {
    styles: {
        'boostrap-ala': 'source/scss/bootstrap-ala.scss',
        'ala-styles': 'source/scss/ala-styles.scss',
        dest: 'build/css/',
        jqueryui: 'source/vendor/jquery/jquery-ui-autocomplete.css',
        dependencycss: ['source/css/*.css']
    },
    testHtml: {
        src: ['source/html/testPage.html', 'source/html/testHome.html'],
        dest: 'build/'
    },
    html: {
        src: ['source/html/banner.html', 'source/html/footer.html', 'source/html/head.html'],
        dest: 'build/'
    },
    images: {
        src: ['source/img/*.*'],
        dest: 'build/img/'
    },
    js: {
        src: [
            'source/js/application.js'
        ],
        dest: 'build/js/',
        jquery: 'source/vendor/jquery/jquery-3.7.1.js',
        bootstrap: 'source/vendor/bootstrap/dist/js/bootstrap.bundle.js',
        jqueryui: 'source/vendor/jquery/jquery-ui-autocomplete.js'
    }
};

function bootstrapCSS(cb) {
    const bootstrapCSSSource = paths.styles["ala-styles"];
    const bootstrapCSSDest = paths.styles.dest;
    //console.log('src: ' + bootstrapCSSSource);
    //console.log('dest: ' + bootstrapCSSDest);
    src(bootstrapCSSSource)
        .pipe(gulpSass({precision: 9}).on('error', gulpSass.logError))
        .pipe(rename('ala-bootstrap.css'))
        .pipe(dest(bootstrapCSSDest))
        .pipe(cleanCSS())
        .pipe(rename('ala-bootstrap.min.css'))
        .pipe(dest(bootstrapCSSDest));
    cb();
}

function autocompleteCSS(cb) {
    src(paths.styles.jqueryui)
        .pipe(rename('autocomplete.css'))
        .pipe(dest(paths.styles.dest))
        .pipe(cleanCSS())
        .pipe(rename('autocomplete.min.css'))
        .pipe(dest(paths.styles.dest));
    cb();
}

function otherCSSFiles(cb) {
    src(paths.styles.dependencycss)
        .pipe(dest(paths.styles.dest))
        .pipe(cleanCSS())
        .pipe(rename({extname: '.min.css'}))
        .pipe(dest(paths.styles.dest));
    cb();
}

function testHTMLPage() {
    var header = fs.readFileSync('source/html/banner.html');
    var footer = fs.readFileSync('source/html/footer.html');
    return src(paths.testHtml.src)
        .pipe(replace('HEADER_HERE', header))
        .pipe(replace('FOOTER_HERE', footer))
        .pipe(replace(/::containerClass::/g, 'container-fluid'))
        .pipe(replace(/::headerFooterServer::/g, 'https://www-test.ala.org.au/commonui-bs5-2019/'))
        .pipe(replace(/::loginStatus::/g, 'signedOut'))
        .pipe(replace(/::loginURL::/g, 'https://auth.ala.org.au/cas/login'))
        .pipe(replace(/::logoutURL::/g, 'https://auth.ala.org.au/cas/logout'))
        .pipe(replace(/::searchServer::/g, 'https://bie.ala.org.au'))
        .pipe(replace(/::searchPath::/g, '/search'))
        .pipe(replace(/==homeDomain==/g, buildvars.homeDomain))
        .pipe(replace(/==signUpURL==/g, buildvars.signUpURL))
        .pipe(replace(/==profileURL==/g, buildvars.profileURL))
        .pipe(replace(/==fathomID==/g, buildvars.fathomID))
        .pipe(dest(paths.html.dest));
};

function html(cb) {
    src(paths.html.src)
        .pipe(replace(/==homeDomain==/g, buildvars.homeDomain))
        .pipe(replace(/==signUpURL==/g, buildvars.signUpURL))
        .pipe(replace(/==profileURL==/g, buildvars.profileURL))
        .pipe(replace(/==fathomID==/g, buildvars.fathomID))
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

var css = parallel(bootstrapCSS, autocompleteCSS, otherCSSFiles);

var js = parallel(jQuery, bootstrapJS, autocompleteJS, otherJsFiles);

var build = parallel(css, testHTMLPage, html, js, images);

exports.otherCSSFiles = otherCSSFiles;
  
exports.default = build;
exports.css = css;
exports.html = series([testHTMLPage, html]);
exports.images = images;
exports.js = js;
exports.build = build;
