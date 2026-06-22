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

var cssHash = '', jsHash = '';
/** Don't kill any existing hashed files immediately, we need to keep them around in case clients have cached an old version of assets.mustache */
const rawDays = parseInt(process.env.CACHE_BUST_CLEAN_DAYS, 10);
const cleanDaysThreshold = isNaN(rawDays) || rawDays <= 0 ? 7 : rawDays;

const {src, dest, series, parallel} = gulp;

var paths = {
    styles: {
        src: ['source/vendor/jquery/jquery-ui-autocomplete.css', 'source/css/*.css'],
        sourceSass: ['source/scss/ala-styles.scss'],
        dest: 'build/css/'
    },
    testHtml: {
        src: ['source/html/testPage.html', 'source/html/testHome.html', 'source/html/patternLibrary*.html'],
        dest: 'build/'
    },
    html: {
        src: ['source/html/banner.mustache', 'source/html/footer.mustache', 'source/html/head.mustache', "source/html/assets.mustache"],
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

function ensureHashes() {
    if (!cssHash || !jsHash) {
        const crypto = require('crypto');
        const cssPath = 'build/css/ala-combined.css';
        const jsPath = 'build/js/ala-combined.js';
        
        if (!fs.existsSync(cssPath) || !fs.existsSync(jsPath)) {
            throw new Error("Asset hashing failed: standard compiled files 'ala-combined.css' or 'ala-combined.js' are missing from the build directory. Please run the asset compilation tasks first.");
        }
        
        const cssContent = fs.readFileSync(cssPath);
        cssHash = crypto.createHash('sha256').update(cssContent).digest('hex');
        
        const jsContent = fs.readFileSync(jsPath);
        jsHash = crypto.createHash('sha256').update(jsContent).digest('hex');
    }
}

function hashAssets(cb) {
    ensureHashes();
    
    // Fail Fast: Validate existence of minified assets and their sourcemaps first
    const cssMinPath = 'build/css/ala-combined.min.css';
    const cssMapPath = 'build/css/ala-combined.min.css.map';
    const jsMinPath = 'build/js/ala-combined.min.js';
    const jsMapPath = 'build/js/ala-combined.min.js.map';

    if (!fs.existsSync(cssMinPath) || !fs.existsSync(cssMapPath)) {
        throw new Error(`Asset hashing failed: Minified CSS asset or its sourcemap is missing from 'build/css'. Please check compilation.`);
    }
    if (!fs.existsSync(jsMinPath) || !fs.existsSync(jsMapPath)) {
        throw new Error(`Asset hashing failed: Minified JS asset or its sourcemap is missing from 'build/js'. Please check compilation.`);
    }

    if (cssHash) {
        const cssContent = fs.readFileSync('build/css/ala-combined.css');
        fs.writeFileSync(`build/css/ala-combined.${cssHash}.css`, cssContent);
        
        let cssMinContent = fs.readFileSync(cssMinPath, 'utf8');
        cssMinContent = cssMinContent.replace('sourceMappingURL=ala-combined.min.css.map', `sourceMappingURL=ala-combined.${cssHash}.min.css.map`);
        fs.writeFileSync(`build/css/ala-combined.${cssHash}.min.css`, cssMinContent, 'utf8');
        
        const cssMapContent = fs.readFileSync(cssMapPath);
        fs.writeFileSync(`build/css/ala-combined.${cssHash}.min.css.map`, cssMapContent);
    }
    
    if (jsHash) {
        const jsContent = fs.readFileSync('build/js/ala-combined.js');
        fs.writeFileSync(`build/js/ala-combined.${jsHash}.js`, jsContent);
        
        let jsMinContent = fs.readFileSync(jsMinPath, 'utf8');
        jsMinContent = jsMinContent.replace('sourceMappingURL=ala-combined.min.js.map', `sourceMappingURL=ala-combined.${jsHash}.min.js.map`);
        fs.writeFileSync(`build/js/ala-combined.${jsHash}.min.js`, jsMinContent, 'utf8');
        
        const jsMapContent = fs.readFileSync(jsMapPath);
        fs.writeFileSync(`build/js/ala-combined.${jsHash}.min.js.map`, jsMapContent);
    }
    
    cb();
}

function cleanOldAssets(cb) {
    const path = require('path');
    
    const now = Date.now();
    const thresholdMs = cleanDaysThreshold * 24 * 60 * 60 * 1000;
    const cacheBustPattern = /^ala-combined(\.[a-f0-9]{64}|-[0-9]{14})(\.min)?\.(js|css|js\.map|css\.map)$/;
    
    const cleanDir = (dir) => {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            if (cacheBustPattern.test(file)) {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                const ageMs = now - stats.mtimeMs;
                if (ageMs > thresholdMs) {
                    fs.unlinkSync(filePath);
                    console.log(`[Clean] Deleted old cache-busted file: ${file} (Age: ${(ageMs / (24*60*60*1000)).toFixed(1)} days)`);
                }
            }
        });
    };
    
    cleanDir('build/css');
    cleanDir('build/js');
    cb();
}

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

function generateHandlebars() {
    ensureHashes();
    return src(paths.html.src)
        .pipe(replace(/{{loginStatus}}/g, 'signedOut'))
        .pipe(replace(/{{homeDomain}}/g, '{{ homeDomain }}'))
        .pipe(replace(/{{signUpURL}}/g, '{{ signUpURL }}'))
        .pipe(replace(/{{profileURL}}/g, '{{ profileURL }}'))
        .pipe(replace(/{{fathomID}}/g, '{{ fathomID }}'))
        .pipe(replace(/{{cssCacheBuster}}/g, cssHash))
        .pipe(replace(/{{jsCacheBuster}}/g, jsHash))
        .pipe(rename({extname: '.hbs'}))
        .pipe(dest(paths.html.dest));
}

function html() {
    ensureHashes();
    return src(paths.html.src)
        .pipe(replace(/{{homeDomain}}/g, buildvars.homeDomain))
        .pipe(replace(/{{signUpURL}}/g, buildvars.signUpURL))
        .pipe(replace(/{{profileURL}}/g, buildvars.profileURL))
        .pipe(replace(/{{fathomID}}/g, buildvars.fathomID))
        .pipe(replace(/{{cssCacheBuster}}/g, cssHash))
        .pipe(replace(/{{jsCacheBuster}}/g, jsHash))
        .pipe(dest(paths.html.dest));
}

function images() {
    return src(paths.images.src, {encoding: false})
        .pipe(dest(paths.images.dest));
}

function jQuery() {
    return src(paths.js.jquery, { sourcemaps: true })
        .pipe(uglify({output: {comments: '/^!/'}}))
        .pipe(rename('jquery.min.js'))
        .pipe(dest(paths.js.dest, { sourcemaps: '.' }));
}

function bootstrapJS() {
    return src(paths.js.bootstrap, { sourcemaps: true })
        .pipe(uglify({output: {comments: '/^!/'}}))
        .pipe(rename('bootstrap.min.js'))
        .pipe(dest(paths.js.dest, { sourcemaps: '.' }));
}

function autocompleteJS() {
    return src(paths.js.jqueryui, { sourcemaps: true })
        .pipe(uglify({output: {comments: '/^!/'}}))
        .pipe(rename('autocomplete.min.js'))
        .pipe(dest(paths.js.dest, { sourcemaps: '.' }));
}

function otherJsFiles() {
    return src(paths.js.src, { sourcemaps: true })
        .pipe(dest(paths.js.dest))
        .pipe(babel({presets: ['@babel/preset-env']}))
        .pipe(uglify({output: {comments: '/^!/'}}))
        .pipe(rename({extname: '.min.js'}))
        .pipe(dest(paths.js.dest, { sourcemaps: '.' }));
}

function combinedJS() {
    const { finished } = require('stream/promises');

    // Standard un-minified
    const stream1 = src(paths.js.combinedJSSources)
        .pipe(concat('ala-combined.js', {newLine:'\n'}))
        .pipe(dest(paths.js.dest));

    // Standard minified
    const stream2 = src(paths.js.combinedJSSources, { sourcemaps: true })
        .pipe(concat('ala-combined.js', {newLine:'\n'}))
        .pipe(uglify({output: {comments: '/^!/'}}))
        .pipe(rename('ala-combined.min.js'))
        .pipe(dest(paths.js.dest, { sourcemaps: '.' }));

    return Promise.all([finished(stream1), finished(stream2)]);
}

function buildCSS() {
    const { finished } = require('stream/promises');

    // Standard un-minified
    var sassStream1 = gulp.src(paths.styles.sourceSass)
        .pipe(gulpSass.sync().on('error', gulpSass.logError));
    var cssStream1 = gulp.src(paths.styles.src);
    
    const stream1 = streamSeries(sassStream1, cssStream1)
        .pipe(concat('ala-combined.css', {newLine:'\n;'}))
        .pipe(dest(paths.styles.dest));

    // Standard minified
    var sassStream2 = gulp.src(paths.styles.sourceSass, { sourcemaps: true })
        .pipe(gulpSass.sync().on('error', gulpSass.logError));
    var cssStream2 = gulp.src(paths.styles.src, { sourcemaps: true });

    const stream2 = streamSeries(sassStream2, cssStream2)
        .pipe(concat('ala-combined.css', {newLine:'\n;'}))
        .pipe(cleanCSS())
        .pipe(rename({extname: '.min.css'}))
        .pipe(dest(paths.styles.dest, { sourcemaps: '.' }));
        
    return Promise.all([finished(stream1), finished(stream2)]);
}

function delCSS() {
    return del([
        'build/css/ala-combined.css', 
        'build/css/ala-combined.min.css',
        'build/css/ala-combined.min.css.map'
    ]);
}

var oldjs = parallel(jQuery, bootstrapJS, autocompleteJS, otherJsFiles);

var js = combinedJS;

var css = series(delCSS, buildCSS);

var assets = parallel(css, js);

var postAssets = series(hashAssets, parallel(testHTMLPage, html, generateHandlebars, images));

var build = series(cleanOldAssets, assets, postAssets);

exports.default = build;
exports.cleanOldAssets = cleanOldAssets;
exports.delCSS = delCSS;
exports.hashAssets = hashAssets;
exports.css = css;
exports.html = series([testHTMLPage, html]);
exports.images = images;
exports.hbs = generateHandlebars;
exports.oldjs = oldjs;
exports.js = js;
exports.combinedJS = js;
exports.build = build;
