import fs from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const source=path.join(root,'public/legacy/template/style.css');
let css=(await fs.readFile(source,'utf8')).replace(/\/\*[\s\S]*?\*\//g,'');
css=css.replace(/@font-face\s*\{[^}]*\}/g,rule=>rule.replace(/src\s*:[^;]+;/g,declaration=>{
 const match=declaration.match(/url\((["']?)([^"')]+\.woff2)\1\)\s*format\(["']?woff2["']?\)/);
 return match?'src:url("'+match[2]+'") format("woff2");':declaration;
}));
css=css.replace(/^\s*[*_][\w-]+\s*:[^;}\r\n]+;?\s*$/gm,'');
css=css.replace(/url\(\s*(["'])\s*\1\s*\)/g,'url("./images/tap_act.png")');
let assets=0;
css=css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g,(match,quote,value)=>{
 if(value.startsWith('data:')||value.startsWith('#'))return match;
 if(/^(?:https?:)?\/\//i.test(value))throw new Error('Unexpected external CSS dependency.');
 const dependency=path.resolve(path.dirname(source),value);
 if(!dependency.startsWith(path.join(root,'public')+path.sep))throw new Error('CSS dependency escapes public.');
 assets++;
 return 'url("'+path.relative(path.join(root,'app'),dependency).split(path.sep).join('/')+'")';
});
await fs.writeFile(path.join(root,'app/legacy.css'),css);
console.log('Prepared shared CSS without IE hacks; WOFF2 only; local assets: '+assets);
