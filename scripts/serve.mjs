import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { contentSecurityPolicy } from '../lib/content-security-policy.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputRoot=path.resolve(root,process.env.STATIC_OUTPUT_DIR||'out');
if(!outputRoot.startsWith(root+path.sep)) throw new Error('Preview output must be inside the project.');
const port=Number(process.env.PORT||3000), base=process.env.NEXT_PUBLIC_BASE_PATH||'';
const routeData=JSON.parse(await readFile(path.join(root,'data/generated/routes.json'),'utf8').catch(()=>'{"aliases":[]}'));
const aliases=new Map((routeData.aliases||[]).map(item=>[item.from,item.to]));
// Only these three historical Apache rules had [NC]. Other paths keep their
// original case semantics, including page-1 and portable-filename aliases.
const insensitiveAliases=new Map((routeData.aliases||[])
 .filter(item=>['/services/remont-apple/','/services/remont-iphone/iphone/','/services/remont-avtoelektroniki/'].includes(item.from))
 .map(item=>[item.from.toLowerCase(),item.to]));
const cache=new Map();
const transactionJournal=path.join(root,'.local/build-transaction.json');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.txt':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.avif':'image/avif','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.ico':'image/x-icon'};
const policy=contentSecurityPolicy;
async function content(file,info,gzip){
 const key=file+':'+info.mtimeMs+':'+gzip;
 if(cache.has(key))return cache.get(key);
 let body=await readFile(file); if(gzip)body=gzipSync(body);
 cache.set(key,body); if(cache.size>128)cache.delete(cache.keys().next().value); return body;
}
http.createServer(async(request,response)=>{
 response.setHeader('Referrer-Policy','no-referrer'); response.setHeader('X-Content-Type-Options','nosniff'); response.setHeader('Content-Security-Policy',policy);
 try{
  // File commits preserve old inodes but are not a directory swap. Do not serve
  // a mixture while one is active; unrelated isolated previews remain usable.
  let transaction;
  try{transaction=JSON.parse(await readFile(transactionJournal,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(transaction?.mode==='files'&&transaction.phase!=='committed'&&path.resolve(transaction.target)===outputRoot){response.writeHead(503,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Retry-After':'1'});response.end(request.method==='HEAD'?undefined:'Сайт обновляется.');return;}
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{Allow:'GET, HEAD'});response.end();return;}
  const url=new URL(request.url,'http://localhost'); let route=decodeURIComponent(url.pathname);
  if(base){if(!route.startsWith(base+'/')&&route!==base)throw new Error('Not found');route=route.slice(base.length)||'/';}
  if(route.split('/').some(part=>part.startsWith('.'))||route.includes('\\')||/[\u0000-\u001f]/.test(route))throw new Error('Not found');
  const aliasPath=route.endsWith('/')?route:route+'/';
  const alias=aliases.get(aliasPath)||insensitiveAliases.get(aliasPath.toLowerCase());
  if(alias){response.writeHead(301,{Location:base+alias+url.search});response.end();return;}
  let file=path.resolve(outputRoot,'.'+route);if(file!==outputRoot&&!file.startsWith(outputRoot+path.sep))throw new Error('Not found');
  let info=await stat(file);
  if(info.isDirectory()){if(!route.endsWith('/')){response.writeHead(308,{Location:base+route+'/'+url.search});response.end();return;}file=path.join(file,'index.html');info=await stat(file);}
  const type=types[path.extname(file)]||'application/octet-stream';
  const gzip=info.size>1024&&/^(?:text\/|application\/(?:json|xml)|image\/svg)/.test(type)&&/\bgzip\b/.test(request.headers['accept-encoding']||'');
  const body=await content(file,info,gzip);
  response.setHeader('Content-Type',type);response.setHeader('Content-Length',body.length);
  response.setHeader('Cache-Control',/\/(?:_next\/static|media)\//.test(route)?'public, max-age=31536000, immutable':'no-cache');
  if(gzip){response.setHeader('Content-Encoding','gzip');response.setHeader('Vary','Accept-Encoding');}
  response.writeHead(200);response.end(request.method==='HEAD'?undefined:body);
 }catch{
  const body=await readFile(path.join(outputRoot,'404.html')).catch(()=>Buffer.from('Page not found'));
  response.writeHead(404,{'Content-Type':'text/html; charset=utf-8','Content-Length':body.length});response.end(request.method==='HEAD'?undefined:body);
 }
}).listen(port,'127.0.0.1',()=>console.log('Site: http://localhost:'+port+base+'/'));
