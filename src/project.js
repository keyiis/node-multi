const inq = require('inquirer'),fs=require('fs'),jsbeautify = require('js-beautify').js;

async function addEnv(projectJson,envName){
    if(envName){
        projectJson.envs[envName]={
            "name": envName,
            "config":{},
            "git":{}
        }
    }else{
        let res = await inq.prompt({
            type: 'input',
            name: 'envname',
            message: '请输入自定义环境名称(字母开头,长度5-20位)',
            validate: (val) => {
                if (/^[a-zA-Z]{1}[a-zA-Z0-9]{4,19}$/.test(val)) {
                  return '必须字母开头,长度5-20位';
                }
                if(projectJson.envs && projectJson.envs[val]){
                    return '['+val+']已存在,请更换其它名称';
                }
                return true;
            }
        });
        addEnv(projectJson,res.envname);
    }
}
module.exports.addProject = async function(){
    let projectJsonPath = process.cwd()+'/projects.json';
    const projectJson = JSON.parse(fs.readFileSync(projectJsonPath));
    let res = await inq.prompt({
        type: 'input',
        name: 'pname',
        message: '请输入项目名称(字母开头,长度5-20位)',
        validate: (val) => {
            if (/^[a-zA-Z]{1}[a-zA-Z0-9]{4,19}$/.test(val)) {
              return '必须字母开头,长度5-20位';
            }
            if(projectJson.projects && projectJson.projects[val]){
                return '['+val+']已存在,请更换其它名称';
            }
            return true;
        }
    });
    let newProject = {
        dir:res.pname,
        name:res.pname,
        envs:{}
    };
    projectJson.projects[res.pname]=newProject;
    
    let res1 = await inq.prompt({
        type: 'confirm',
        name: 'env',
        message: '是否添加环境'
    });
    if(res1.env){
        let envNames = ['development','test','product','自定义环境'];
        let res2 = await inq.prompt({
            type: 'checkbox',
            name: 'env',
            message: '请选择构建环境',
            choices: envNames
        });
        let selectEnvs=[];
        let custEnvIdx = res2.env.indexOf('自定义环境');
        if(custEnvIdx>=0){
            selectEnvs = res2.env.splice(custEnvIdx,1);
            await addEnv(newProject);
        }else{
            selectEnvs=res2.env;
        }
        if(selectEnvs.length>0){
            for(let key of selectEnvs){
                await addEnv(newProject,key);
            }
        }
        console.log(res2.env);
    }
    fs.writeFileSync(projectJsonPath,jsbeautify(JSON.stringify(projectJson)), 'utf8');
    fs.mkdirSync(process.cwd() + '/src/projects/'+res.pname);
}