#!/usr/bin/env node
const program = require('commander'),fs=require('fs');
// var pjson = require('./package.json');
// ,tool = require("../src/gulpfile");
const packageJson = JSON.parse(fs.readFileSync('./package.json'));
program
    .version(packageJson.version)
    .option('-i, --init', '初始化项目,生成projects.json')
    .option('-m, --mode [value]', '指定运行模式,dev|build', 'dev')
    .option('-p, --project [value]', '指定运行项目,projects.json内配置的项目代码')
    .option('-e, --environment [value]', '指定运行环境配置ojects.json内配置的项目环境代码')
    .parse(process.argv);

// function run (argv) {
//     console.log(argv);
//     // if (argv[0] === '-v' || argv[0] === '--version') {
//     //     console.log('  version is 0.0.1');
//     // } else if (argv[0] === '-h' || argv[0] === '--help') {
//     //     console.log('  usage:\n');
//     //     console.log('  -v --version [show version]');
//     // }
// }
// run(process.argv.slice(2));
console.log(program.init);
if(program.init){
    fs.writeFileSync(process.cwd()+'/projects.json', fs.readFileSync(__dirname+'/../template/projects.json'));
    console.log(__dirname,process.cwd())
}
// tool.run(program.mode);