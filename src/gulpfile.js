const gulp = require("gulp"), del = require("del"), ts = require("gulp-typescript"), nodemon = require('gulp-nodemon'), htmlmin = require('gulp-htmlmin'), jsbeautify = require('js-beautify').js, jeditor = require("gulp-json-editor"), babel = require('gulp-babel'), execSync = require('child_process').execSync,moment = require('moment'),fs = require("fs"),inq = require('inquirer'),_=require('lodash');
/**
 * typescript编辑配置
 */
let tsProject = ts.createProject("tsconfig.json");
/**
 * 项目配置列表
 */
let PROJECTS=require('./projects.json');
/**
 * 当前项目配置
 */
let PROJECT;
/**
 * 当前项目完整路径
 */
let PROJECT_PATH;
/**
 * 当前环境属性名
 */
let ENV_KEY;
/**
 * 当前环境配置
 */
let ENV;
/**
 * 发布目录
 */
let DIST_PATH = "dist";
/**
 * 当前日期
 */
let CUR_DATE = moment().format('YYYY年MM月DD日 HH时mm分ss秒');
/**
 * 版本
 */
let VERISON = moment().format('YYYYMMDD.HH.mm.ss');

/**
 * 设置运行参数
 * @param {*} cb 
 */
async function setEnv() {
    // 获得项目列表
    // let projectDirs = require('');
    let res1 = await inq.prompt({
        type: 'list',
        name: 'project',
        message: '请选择要构建的项目',
        choices: Object.keys(PROJECTS.projects)
    });
    PROJECT = PROJECTS.projects[res1.project];
    PROJECT_PATH = `${PROJECTS.root}/${PROJECT.dir}`;
    // 获得环境变量
    let envs = PROJECT.envs;
    if (!ENV_KEY) {
        let envNames = Object.keys(envs);
        let res2 = await inq.prompt({
            type: 'list',
            name: 'env',
            message: '请选择构建环境',
            choices: envNames
        });
        ENV_KEY = res2.env;
    }
    ENV = _.defaultsDeep(envs[ENV_KEY],PROJECTS.global.envs[ENV_KEY],PROJECTS.global.env);
    if(!ENV) throw `${res1.project}下的envs不存在环境[${ENV_KEY}]的配置`;
    DIST_PATH = `${ENV.dist || './dist'}/${PROJECT.dir}/${ENV_KEY}`;
}
/**
 * 清理发布目录
 */
async function clean() {
    await del([
        `${DIST_PATH}/**/*`, `!${DIST_PATH}/.git`, `!${DIST_PATH}/node_modules`
    ], { force: true });
}

/**
 * 编译x项目ts文件
 *
 * @returns
 */
function compileProject() {
    return gulp.src([`${PROJECT_PATH}/**/*.ts`], { base: `${PROJECT_PATH}` })
        .pipe(tsProject())
        .js
        // 处理路径别名，这里的配置要和tsconfig里paths对应
        .pipe(babel({
            // presets: ['@babel/env'],
            plugins: [
                ["module-resolver", {
                    "root": ["."],
                    "alias": {
                        "@common": `./${PROJECT_PATH}/common`
                    }
                }]
            ]
        }))
        .pipe(gulp.dest(DIST_PATH));
}
/**
 * 编译common的ts文件
 */
function compileCommon() {
    return gulp.src(["src/common/**/*.ts"], { base: `src` })
        .pipe(tsProject())
        .js
        .pipe(gulp.dest(DIST_PATH));
}
/**
 * 拷贝原生js文件
 */
function copyJs() {
    return gulp.src([`${PROJECT_PATH}/**/*.js`], { base: `${PROJECT_PATH}` }).pipe(gulp.dest(DIST_PATH));
}

/**
 * 压缩html
 *
 * @returns
 */
function minifyHtml() {
    return gulp.src([`${PROJECT_PATH}/views/**/*.ejs`, `${PROJECT_PATH}/views/**/*.html`])
        .pipe(htmlmin({ minifyCSS: true, minifyJS: true, removeComments: true, collapseWhitespace: true }))
        .pipe(gulp.dest(`${DIST_PATH}/views`));
}

/**
 * 拷贝静态目录的文件
 *
 * @returns
 */
function copyPublic() {
    return gulp.src(`${PROJECT_PATH}/public/**/*`).pipe(gulp.dest(`${DIST_PATH}/public`));
}

/**
 * 生成config.json
 */
async function createConfigJson() {
    let exist = fs.existsSync(DIST_PATH);
    if (!exist) fs.mkdirSync(DIST_PATH, { recursive: true });
    ENV.config.key = ENV_KEY;
    ENV.config.name=ENV.name;
    ENV.config.projectName=PROJECT.name;
    ENV.config.buildDate=CUR_DATE;
    fs.writeFileSync(DIST_PATH + '/config.json', jsbeautify(JSON.stringify(ENV.config)), 'utf8');
}
/**
 * 编辑package.json,去除开发依赖
 *
 * @returns
 */
function editPackageJson() {
    return gulp.src("./package.json").pipe(jeditor(function (json) {
        json.description=PROJECT.name;
        json.version=VERISON;
        delete json.devDependencies;
        delete json.scripts;
        return json;
    })).pipe(gulp.dest(DIST_PATH));
}
/**
 * 生成pm2启动文件
 */
async function createPm2Js() {
    if (ENV.pm2) {
        let pm2File = `module.exports = {
            apps: [
                ${JSON.stringify(ENV.pm2)}
            ]
        };`
        fs.writeFileSync(DIST_PATH + '/ecosystem.config.js', jsbeautify(pm2File));
    }
}
/**
 * 创建Readme到发布目录
 */
async function createReadme() {
    let text = `# ${PROJECT.name}  \n# ${ENV.name}  \n发布日期:${CUR_DATE}  \n`;
    fs.writeFileSync(DIST_PATH + '/README.md', text);
}
/**
 * 监听变化
 *
 */
async function startWatch() {
    // 监听ts文件变化
    gulp.watch([`${PROJECT_PATH}/**/*.ts`], compileProject).on('all', function (eventName, path) {
        console.log(`TypeScript 文件 ${path} 已被 ${eventName}. 开始重新编译.`);
    });
    gulp.watch(['src/common/**/*.ts'], compileCommon).on('all', function (eventName, path) {
        console.log(`TypeScript 文件 ${path} 已被 ${eventName}. 开始重新编译.`);
    });
    // 监听ejs变化
    gulp.watch([`${PROJECT_PATH}/views/**/*.ejs`, `${PROJECT_PATH}/views/**/*.html`], minifyHtml).on('all', function (eventName, path) {
        console.log(`ejs/html file ${path} has been ${eventName}. minify-html.`);
    });
    return;
}

// 启动开发服务
async function startDev() {
    return nodemon({
        script: `${DIST_PATH}/server.js`,
        watch: DIST_PATH,
        ext: 'js html',
        // 设置运行环境
        env: { 'NODE_ENV': 'development' }
    });
}

/**
 * 提交代码到git
 */
async function commitToGit() {
    if(!ENV.git) return;
    if (!fs.existsSync(`${DIST_PATH}/.git`)){
        execSync('git init', { cwd: DIST_PATH });
        execSync(`git remote add origin ${ENV.git.url}`, { cwd: DIST_PATH });
        execSync(`git fetch`, { cwd: DIST_PATH });
        execSync(`git checkout ${ENV.git.branch}`, { cwd: DIST_PATH });
    }
    let res = await inq.prompt({
        type: 'input',
        name: 'msg',
        message: '请输入提交信息'
    });
    execSync('git add .', { cwd: DIST_PATH });
    execSync(`git commit -m ${res.msg||'修改'}`, { cwd: DIST_PATH });
    execSync(`git push origin -f`, { cwd: DIST_PATH });
}

const common = gulp.series(setEnv,clean,compileProject, compileCommon, gulp.parallel(copyJs, minifyHtml, copyPublic,createConfigJson));

gulp.task('dev', gulp.series(
    async () => {
        ENV_KEY='development';
    }, common,startWatch,startDev
));
gulp.task('build', gulp.series(
    common, editPackageJson,createPm2Js,createReadme,commitToGit
));

const run = function(mode){
    gulp.start(mode);
}

module.exports = run;