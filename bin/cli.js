#!/usr/bin/env node
const program = require('commander'), fs = require('fs'), projectTool = require('../src/project.js');
// var pjson = require('./package.json');
// ,tool = require("../src/gulpfile");
const packageJson = JSON.parse(fs.readFileSync('./package.json'));

async function run() {
    program.version(packageJson.version)
        .option('-i, --init', '初始化项目,生成projects.json')
        .option('-m, --mode [value]', '指定运行模式,dev|build', 'dev')
        .option('-p, --project [value]', '指定运行项目,projects.json内配置的项目代码')
        .option('-e, --environment [value]', '指定运行环境配置ojects.json内配置的项目环境代码')
        .parse(process.argv);

    if (program.init) {
        fs.writeFileSync(process.cwd() + '/projects.json', fs.readFileSync(__dirname + '/../template/projects.json.sample'));
        fs.writeFileSync(process.cwd() + '/tsconfig.json', fs.readFileSync(__dirname + '/../template/tsconfig.json.sample'));
        fs.mkdirSync(process.cwd() + '/src/common', { recursive: true });
        fs.mkdirSync(process.cwd() + '/src/projects', { recursive: true });
        // console.log(__dirname,process.cwd())
        await projectTool.addProject();
    }
}
run().catch(console.error);