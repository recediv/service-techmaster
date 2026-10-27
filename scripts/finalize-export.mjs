import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isPublicPageAlias } from '../lib/public-route-policy.mjs';

const caseInsensitiveAliases = new Set(['/services/remont-apple/', '/services/remont-iphone/iphone/', '/services/remont-avtoelektroniki/']);
const escapeRule = (value) => value.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
export function hostingConfig({ aliases = [], base = '' } = {}) {
 return [
  'Options -MultiViews', 'DirectoryIndex index.html', 'ErrorDocument 404 ' + base + '/404.html',
  '<IfModule mod_rewrite.c>', 'RewriteEngine On',
  ...aliases.filter(isPublicPageAlias).map((item) => 'RewriteRule ^' + escapeRule(item.from.replace(/^\/|\/$/g,'')) + '/?$ ' + base + item.to + ' [R=301,L,NE' + (caseInsensitiveAliases.has(item.from) ? ',NC' : '') + ']'),
  '</IfModule>', '<IfModule mod_deflate.c>',
  'AddOutputFilterByType DEFLATE text/html text/plain text/css text/javascript application/javascript application/json application/xml image/svg+xml',
  '</IfModule>', 'AddType text/plain .txt',
 ].join('\n') + '\n';
}

async function main() {
const root = process.cwd();
const output = path.join(root, process.env.SITE_OUTPUT_DIR || 'out');
const { aliases = [] } = JSON.parse(await fs.readFile(path.join(root,'data/generated/routes.json'),'utf8'));
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
await fs.writeFile(path.join(output,'.htaccess'), hostingConfig({ aliases, base }));
await fs.writeFile(path.join(output,'.nojekyll'), '');
let count=0, bytes=0, html=0;
async function scan(directory) {
  for (const entry of await fs.readdir(directory,{withFileTypes:true})) {
    const full=path.join(directory,entry.name);
    if(entry.isDirectory()) await scan(full);
    else { count++; bytes+=(await fs.stat(full)).size; if(entry.name.endsWith('.html')) html++; }
  }
}
await scan(output);
await fs.mkdir(path.join(root,'.local'),{recursive:true});
await fs.writeFile(path.join(root,'.local/export-size.json'),JSON.stringify({files:count,html,bytes},null,2));
console.log('Static export: '+JSON.stringify({files:count,html,bytes}));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
