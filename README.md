# node-multi
基于gulp,管理多个node应用，typescript编译-》压缩-》上传-》服务器脚本。  
好处：节省磁盘空间，确保不同项目引用包的版本一致，提高代码复用率

# 全局安装
`npm i node-multi -g`  
使用 nodem 命令
```
nodem init
nodem run
nodem run -m build
nodem run -m batch
```
# 本地安装
`npm i node-multi -D`  
在package.json的script中
```
"scripts": {
    "init": "node_modules/.bin/nodem init",
    "dev": "node_modules/.bin/nodem run",
    "build": "node_modules/.bin/nodem run -m build",
    "batch": "node_modules/.bin/nodem run -m batch"
}
```
# 命令说明
1. init  
初始化项目，会在当前目录下生成projects.json文件和目录
2. run -m <mode>  
编译项目,-m为可选参数，有三个值可选  
dev 默认值，本地调试  
build 构建指定项目的指定环境  
batch 批量构建指定环境的多个项目  
# projects.json说明
该文件主要包含项目配置/环境配置/全局配置。  
1. 项目配置 
```
"root": "src/projects",
"projects": {
    "myproject": { 项目代码，用于唯一标识一个项目
        "dir": "项目目录(相对root目录)",
        "name": "项目名称",
        "entry": "项目启动文件,通常会是server.js或index.js",
        "envs": { 环境列表
            "prod": { 环境代码，用于唯一标识一个环境
                环境配置信息
            }
            ...
        }
    }
    ...
}
```
2. 环境配置  
分为三个级别，优先级为 项目自定义环境配置>全局指定环境配置>全局环境配置  

*项目自定义环境配置*
```
"root": "src/projects",
"projects": {
    "myproject": {
        ...
        "envs": {
            项目自定义环境配置
            "prod": { 环境代码
                "name": "环境名称",
                "dist": "发布文件的目录,相对projects.json所在的目录",
                "config": { 该环境自定义配置属性,比如数据库的连接信息
                    ...
                },
                "pm2": { pm2自动重启的配置
                    "name": "pm2 list 里应用的名称"
                },
                "git": { git自动提交代码配置
                    "url": "仓库的ssh地址"
                    "branch": "分支名称"
                }
            }
            ...
        }
    }
    ...
}
```
*全局指定环境配置*
```
"global": {
    "env": {
        "prod": {
            "name": "环境名称",
            "dist": "发布文件的目录,相对projects.json所在的目录",
            "config": {
                ...
            },
            "pm2": { 
                ...
            },
            "git": {
                ...
            }
        },
        ...
    }
}
```
*全局环境配置*
```
"global": {
    "env": {
        "config": {
            ...
        },
        "pm2": {
            ...
        },
        "git": {
            ...
        }
        ...
    }
}
```