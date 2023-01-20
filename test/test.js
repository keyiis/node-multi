const json = require('json5'),fs = require("fs");
let rs = json.parse(fs.readFileSync(process.cwd() + '/template/projects.json.sample').toString());
console.log(rs);