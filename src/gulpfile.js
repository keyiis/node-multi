const gulp = require("gulp"), del = require("del"), ts = require("gulp-typescript"), nodemon = require('gulp-nodemon'), htmlmin = require('gulp-htmlmin'), jsbeautify = require('js-beautify').js, jeditor = require("gulp-json-editor"), babel = require('gulp-babel'), execSync = require('child_process').execSync, moment = require('moment'), fs = require("fs"), inq = require('inquirer'), _ = require('lodash'), GulpSSH = require('gulp-ssh'), zip = require('gulp-zip'),webpack = require('webpack-stream'), cached = require('gulp-cached'),TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
/**
 * typescript编辑配置
 */
let tsProject = ts.createProject("tsconfig.json");
/**
 * 项目配置列表
 */
// throw new Error(222+'  '+process.cwd()+'  '+__dirname);
// let PROJECTS={}
let PROJECTS = JSON.parse(fs.readFileSync(process.cwd() + '/projects.json'));
// let PROJECTS=require('./projects.json');
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
    let projectKeys = Object.entries(PROJECTS.projects).reduce((pre, cur) => {
        if (cur[1].disable != true) pre.push(cur[0]);
        return pre;
    }, []);
    if (projectKeys.length == 0) throw `projects.json中没有可用项目`;

    if (projectKeys.length == 1) {
        PROJECT = PROJECTS.projects[projectKeys[0]];
    } else {
        let res1 = await inq.prompt({
            type: 'list',
            name: 'project',
            message: '请选择要构建的项目',
            choices: projectKeys
        });
        PROJECT = PROJECTS.projects[res1.project];
    }
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
    ENV = _.defaultsDeep(envs[ENV_KEY], PROJECT.env, PROJECTS.global.envs[ENV_KEY], PROJECTS.global.env);
    if (!ENV) throw `${res1.project}下的envs不存在环境[${ENV_KEY}]的配置`;
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
        .pipe(cached('compileProject'))    
        .pipe(tsProject())
        .js
        // 处理路径别名，这里的配置要和tsconfig里paths对应
        .pipe(babel({
            // presets: ['@babel/env'],
            plugins: [
                [require.resolve('babel-plugin-module-resolver'), {
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
        .pipe(cached('compileCommon'))
        .pipe(tsProject())
        .js
        // 处理路径别名，这里的配置要和tsconfig里paths对应
        .pipe(babel({
            // presets: ['@babel/env'],
            plugins: [
                [require.resolve('babel-plugin-module-resolver'), {
                    "root": ["."],
                    "alias": {
                        "@common": `./src/common`
                    }
                }]
            ]
        }))
        .pipe(gulp.dest(DIST_PATH));
}

const tsconfigPath = process.cwd()+'/tsconfig.json';
// 打包成一个文件
function compileBundle(){
    let allModules = fs.readdirSync("node_modules");
    let noBinModules = allModules.filter(function (x) {
        return [".bin"].indexOf(x) === -1;
    });
    let externals = {};
    for(let mod of noBinModules){
        externals[mod] = "commonjs " + mod;
    }
    if(ENV.bundle.externals) Object.assign(externals,ENV.bundle.externals);
    
    return gulp.src(`${PROJECT_PATH}/${ENV.bundle.entry}`).pipe(webpack({
        mode: 'production',
        module: {
            rules: [
              {
                  test: /\.tsx?$/,
                  use: require.resolve('ts-loader'),
                //   options: {
                //     configFile: path.join(__dirname, 'tsconfig.json')
                //   },
                  exclude: /node_modules/,
              },
            ],
        },
        resolve: {
          extensions: [ '.tsx', '.ts', '.js' ],
          plugins: [new TsconfigPathsPlugin({ configFile: tsconfigPath })]
        },
        output: {
            //  path: path.resolve(__dirname, "dist"),
             filename: PROJECT.entry,
            // chunkFilename: "[name].chunk.js",
            // chunkFilename: "run.js",
            libraryTarget: "commonjs"
        },
        node: {
            fs: 'empty',
            child_process: 'empty',
            tls: 'empty',
            net: 'empty',
            __dirname: false
        },
        target: "node",
        externals: externals,
    })).pipe(gulp.dest(DIST_PATH));
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
        .pipe(cached('minifyHtml'))
        .pipe(htmlmin({ minifyCSS: true, minifyJS: true, removeComments: true, collapseWhitespace: true }))
        .pipe(gulp.dest(`${DIST_PATH}/views`));
}

/**
 * 拷贝静态目录的文件
 *
 * @returns
 */
function copyPublic() {
    let staticsPaths = (PROJECT.statics || []).map(r => {
        return `${PROJECT_PATH}/${r}`;
    });
    if (staticsPaths.length == 0) staticsPaths.push(`${PROJECT_PATH}/public/**/*`);
    return gulp.src(staticsPaths, { base: `${PROJECT_PATH}` }).pipe(gulp.dest(DIST_PATH));
}

/**
 * 生成config.json
 */
async function createConfigJson() {
    let exist = fs.existsSync(DIST_PATH);
    if (!exist) fs.mkdirSync(DIST_PATH, { recursive: true });
    ENV.config.key = ENV_KEY;
    ENV.config.name = ENV.name;
    ENV.config.projectName = PROJECT.name;
    ENV.config.buildDate = CUR_DATE;
    fs.writeFileSync(DIST_PATH + '/config.json', jsbeautify(JSON.stringify(ENV.config)), 'utf8');
}
/**
 * 编辑package.json,去除开发依赖
 *
 * @returns
 */
function editPackageJson() {
    return gulp.src("./package.json").pipe(jeditor(function (json) {
        json.description = PROJECT.name;
        json.version = VERISON;
        delete json.devDependencies;
        delete json.scripts;
        if (_.isArray(PROJECT.dependencies)){
            for(let key of Object.keys(json.dependencies)){
                if(PROJECT.dependencies.indexOf(key)<0){
                    delete json.dependencies[key]
                }
            }
        }
        if(_.isObject(PROJECT.dependencies)){
            if(PROJECT.dependencies.include){
                for(let key of Object.keys(json.dependencies)){
                    if(PROJECT.dependencies.include.indexOf(key)<0){
                        delete json.dependencies[key]
                    }
                }
            }
            if(PROJECT.dependencies.exclude){
                for(let key of Object.keys(json.dependencies)){
                    if(PROJECT.dependencies.exclude.indexOf(key)>=0){
                        delete json.dependencies[key]
                    }
                }
            }
        }
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
 * 使用ssh上传到服务器
 */
function uploadSSH(cb) {
    if (!ENV.ssh) return cb();
    var gulpSSH;
    gulp.series(
        async () => {
            gulpSSH = new GulpSSH({
                ignoreErrors: false,
                sshConfig: ENV.ssh.config
            });
        }, () => {
            if (!ENV.ssh.preShell) return;
            return gulpSSH.shell(ENV.ssh.preShell).pipe(gulp.dest('gulplogs/preShell.log'))
            // .on("ssh2Data",data=>{
            //     console.log(data.toString())
            // });
        }, () => {
            return gulp.src([`${DIST_PATH}/**/*`, `!${DIST_PATH}/node_modules`, `!${DIST_PATH}/.git`], { base: DIST_PATH })
                .pipe(zip('dist.zip'))
                .pipe(gulpSSH.dest(ENV.ssh.remotePath));
        }, () => {
            if (!ENV.ssh.afterShell) return;
            return gulpSSH.shell(ENV.ssh.afterShell).pipe(gulp.dest('gulplogs/afterShell.log'))
            // .on("ssh2Data",data=>{
            //     console.log(data.toString())
            // });
        }
    )(cb);
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
        console.log(`ejs/html 文件 ${path} 已被 ${eventName}. minify-html.`);
    });
    return;
}
// 这段代码可以防止ctrl-c无法一次结束nodemon启动的调试状态
process.once('SIGINT', function () {
    process.exit(0);
});
// 启动开发服务
async function startDev() {
    return nodemon({
        script: `${DIST_PATH}/${PROJECT.entry}`,
        "delay": 1000,
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
    if (!(ENV.git && ENV.git.url && ENV.git.branch)) return;
    if (!fs.existsSync(`${DIST_PATH}/.git`)) {
        execSync('git init', { cwd: DIST_PATH });
        execSync(`git remote add origin ${ENV.git.url}`, { cwd: DIST_PATH });
        // execSync(`git fetch`, { cwd: DIST_PATH });
        // execSync(`git checkout ${ENV.git.branch}`, { cwd: DIST_PATH });
    }
    let res = await inq.prompt({
        type: 'input',
        name: 'msg',
        message: `请输入${ENV.git.branch}提交信息`
    });
    execSync('git add .', { cwd: DIST_PATH });
    execSync(`git commit -m ${res.msg || '修改'}`, { cwd: DIST_PATH });
    // execSync(`git push origin -f`, { cwd: DIST_PATH });
    execSync(`git push origin -f master:${ENV.git.branch}`, { cwd: DIST_PATH });
}
function compile(cb){
    if(ENV.bundle){
        return compileBundle();
    }else{
        gulp.series(compileProject, compileCommon)(cb)
    }
}
const common = gulp.series(clean, compile, gulp.parallel(copyJs, minifyHtml, copyPublic, createConfigJson));


const devSeries = gulp.series(
    async () => {
        ENV_KEY = 'development';
    }, setEnv, common, startWatch, startDev
);
gulp.task('dev', devSeries);

const buildSeries = gulp.series(
    setEnv, common, editPackageJson, createPm2Js, createReadme, commitToGit, uploadSSH
);
gulp.task('build', buildSeries);
/**
 * 将gulp返回的stream转换为promise
 * @param {*} stream 
 */
function toPromise(stream) {
    return new Promise((resolve, reject) => {
        stream(resolve);
    });

}
/**
 * 批量编译项目
 */
async function batch() {
    let options = Object.entries(PROJECTS.projects).filter(r => {
        return !r[1].disable;
    }).map(r => {
        return { name: `[${r[0]}]${r[1].name}`, value: r[0] };
    });
    let projectKeys = await inq.prompt({
        type: 'checkbox',
        name: 'projects',
        message: '请选择要构建的项目',
        choices: options//Object.keys(PROJECTS.projects)
    });
    // 获得环境变量
    let envs = PROJECTS.global.envs;
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
    for (let projectKey of projectKeys.projects) {
        PROJECT = PROJECTS.projects[projectKey];
        PROJECT_PATH = `${PROJECTS.root}/${PROJECT.dir}`;
        ENV = _.defaultsDeep(PROJECT.envs[ENV_KEY], PROJECTS.global.envs[ENV_KEY], PROJECTS.global.env);
        if (!ENV) throw `${projectKey}下的envs不存在环境[${ENV_KEY}]的配置`;
        DIST_PATH = `${ENV.dist || './dist'}/${PROJECT.dir}/${ENV_KEY}`;
        await toPromise(
            gulp.series(
                common, editPackageJson, createPm2Js, createReadme, commitToGit, uploadSSH
            )
        );
    }
}
gulp.task('batch', batch);

// module.exports.asyncRun = async function(mode){
//     // gulp.start(mode);
//     if(mode=='dev'){
//         await toPromise(devSeries);
//     }
//     if(mode=='build'){
//         await toPromise(buildSeries);
//     }
//     if(mode=='batch'){
//         await batch();
//     }
// }