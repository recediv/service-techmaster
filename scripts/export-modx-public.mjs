import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as cheerio from 'cheerio';
import { defaultCity, resolveCityText, withCityLocation } from '../lib/site-city.mjs';

const PROJECT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SOURCE=path.resolve(process.env.MODX_PUBLIC_ROOT||'Z:/Project/parser/bk/site/public_html');
const COMPOSE=path.resolve(process.env.MODX_COMPOSE_ROOT||'Z:/Project/parser/bk/site');
const GENERATED=path.join(PROJECT,'data','generated');
const MEDIA=path.join(PROJECT,'public','media');
const ALLOWED_TYPES={2:'home',4:'contacts',5:'repair',6:'category',8:'editorial-index',9:'editorial',10:'category',15:'service',16:'category',17:'editorial-index',18:'category'};
const EXTENSIONS=new Set(['.png','.jpg','.jpeg','.gif','.webp','.avif','.ico','.bmp','.svg','.woff','.woff2','.ttf','.otf','.eot','.css']);
const DENY_ROOTS=new Set(['core','admin','manager','connectors','api','imports','backup','backups','uploads-private','.git']);
const coverage={
 schemaVersion:1,counts:{},byTemplate:{},unknownModxTags:[],suppressedTags:{},missingAssets:[],
 removedLinks:{excluded:0,unknown:0,external:0,unsafe:0},unknownInternalPaths:[],
 sourceDefects:[],privacy:{users:false,orders:false,submissions:false,ugc:false,cities:false,phpSourceCopied:false},
};
const helperUnknownTags=new Map();
const unknownTags=new Map(),missingAssets=new Map(),unknownPaths=new Map();
const sourceAssetCache=new Map(),assetsById=new Map(),activeAssetPaths=new Set();
const aliasesByFrom=new Map(),rawById=new Map(),recordById=new Map(),byPath=new Map();
const chunksByName=new Map();
let SOURCE_REAL;

const COMMUNITY_TYPES=new Set(['consultations-index','consultation','reviews-index','order-status']);
const COMMUNITY_TEMPLATES=new Set([7,11,13,14]);
const COMMUNITY_IMPORT_BLOCKED='EPUBLICCOMMUNITYIMPORTBLOCKED';
const COMMUNITY_IMPORT_MESSAGE='Импорт остановлен: базовый MODX importer ещё не объединён с переносом консультаций, отзывов и статуса заказа. Он не может заменять восстановленный набор данных. Текущие данные сохранены; используйте их до интеграции полного импорта.';
function importGuardError(code,message){return Object.assign(new Error(message),{code});}

// The legacy importer replaces the whole generated directory. Never let it
// discard the separately restored public community, even if one file is lost.
export async function assertLegacyImportCanReplace(projectRoot){
 const generated=path.join(projectRoot,'data','generated');
 const blocked=()=>{throw importGuardError(COMMUNITY_IMPORT_BLOCKED,COMMUNITY_IMPORT_MESSAGE);};
 const unreadable=()=>{throw importGuardError('EIMPORTSTATEUNREADABLE','Импорт остановлен: невозможно безопасно проверить существующие публичные данные. Файлы не заменены.');};
 for(const file of [path.join(generated,'community.json'),path.join(projectRoot,'public','community','consultations.json')]){
  try{await fs.access(file);blocked();}catch(error){if(error.code!== 'ENOENT'){if(error.code===COMMUNITY_IMPORT_BLOCKED)throw error;unreadable();}}
 }
 const restored=rows=>rows.some(row=>COMMUNITY_TYPES.has(row?.type)||COMMUNITY_TEMPLATES.has(Number(row?.templateId)));
 for(const [name,key] of [['resources.json','records'],['routes.json','routes'],['coverage.json',null]]){
  let data;
  try{data=JSON.parse(await fs.readFile(path.join(generated,name),'utf8'));}catch(error){if(error.code==='ENOENT')continue;unreadable();}
  if(!data||data.schemaVersion!==1||key&&!Array.isArray(data[key]))unreadable();
  if(key?restored(data[key]):data.community||data.privacy?.ugc||Object.entries(data.byTemplate||{}).some(([id,count])=>COMMUNITY_TEMPLATES.has(Number(id))&&Number(count)>0))blocked();
 }
}

function escapeHtml(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function cleanText(value){return String(value??'').replace(/\0/g,'').replace(/<[^>]*>/g,' ').replace(/\[\[[\s\S]*?\]\]/g,'').replace(/\s+/g,' ').trim();}
function trimCityTail(value){return cleanText(resolveCityText(value)).replace(/\s+в\s*$/iu,'').trim();}
// Reviewed price_tab/chunk67:25 independent title branches, with no default
// branch and no city token. Interpret only this exact, known MODX grammar.
export function parseCategoryPriceHeadingRules(chunk){
 if(Number(chunk?.id)!==67||chunk?.name!=='price_tab'||typeof chunk.snippet!=='string')throw Error('Missing reviewed category price heading source.');
 const lines=chunk.snippet.split(/\r?\n/).map(line=>line.trim());
 if(lines[0]!=='<div class="ceni">'||lines[1]!=='<div class="title">'||lines[27]!=='</div>')throw Error('Unrecognized category price heading container.');
 const rules=[],ids=new Set();
 const branch=/^\[\[\*parent:isnot=`([1-9]\d*)`:then=`\[\[\*id:is=`\1`:then=`Цены на \[\[\*pagetitle\]\]`\]\]`:else=`([^`<>\[\]\r\n]+) \[\[\*pagetitle\]\]`\]\]$/u;
 for(const line of lines.slice(2,27)){
  const match=line.match(branch),categoryId=Number(match?.[1]),childPrefix=match?.[2];
  if(!match||!Number.isSafeInteger(categoryId)||ids.has(categoryId)||!childPrefix.startsWith('Цены на ')||cleanText(childPrefix)!==childPrefix)throw Error('Unrecognized category price heading branch.');
  ids.add(categoryId);rules.push({categoryId,ownPrefix:'Цены на',childPrefix});
 }
 if(rules.length!==25)throw Error('Incomplete reviewed category price heading rules.');
 return rules;
}
export function categoryPriceHeading(record,rules){
 if(record?.type!=='category'||!record.priceKey||!record.title)throw Error('Category price heading requires a priced category.');
 const matches=rules.filter(rule=>record.parentId===rule.categoryId||record.id===rule.categoryId);
 if(matches.length!==1)throw Error('A priced category has no unique reviewed price heading branch.');
 const rule=matches[0],prefix=record.parentId===rule.categoryId?rule.childPrefix:rule.ownPrefix;
 return cleanText(prefix+' '+record.title);
}
export function extractPricePresentation(snippet){
 const $=cheerio.load(snippet,null,false),navigation=$('.tabs_nav');
 return {showTabNavigation:navigation.length>0,tabNavigationCopies:navigation.length,tabs:$('table').toArray().map(table=>{
  const sourceTabId=$(table).closest('[id]').attr('id'),anchor=navigation.find('a').filter((_,a)=>$(a).attr('href')==='#'+sourceTabId).first(),iconClass=anchor.find('span').attr('class');
  if(sourceTabId&&!/^tab[1-9]\d*$/.test(sourceTabId))throw Error('Unrecognized public price panel identity.');
  if(iconClass&&!/^icon_tabs[12]$/.test(iconClass))throw Error('Unrecognized public price tab icon.');
  const rowBold=$(table).find('tr').toArray().slice(1).map(row=>{const style=$(row).attr('style')?.trim();if(style&&!/^font-weight:\s*bold;?$/i.test(style))throw Error('Unrecognized public price row style.');return Boolean(style);});
  return {...(sourceTabId?{sourceTabId}:{}),...(iconClass?{iconClass}:{}),rowBold};
 })};
}
export function publicPartsShopUrl(record,value=''){
 if(record.type!=='repair')throw Error('Parts shop URL requires a repair resource.');
 const base='https://techmasterpro.ru/'; // Reviewed Tomsk branch of templates5/15.
 const suffix=String(value||'').trim()||'search/?query='+encodeURIComponent(record.title).replace(/[!'()*~]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase()).replace(/%20/g,'+');
 if(/[\u0000-\u0020<>"\\]/.test(suffix)||/^(?:[a-z]+:|\/\/|\/)/i.test(suffix)||suffix.split(/[/?#]/).some(part=>part==='..'||part==='.'))throw Error('Unsafe public parts shop link.');
 const url=new URL(suffix,base);if(url.origin!==new URL(base).origin||url.username||url.password)throw Error('Unexpected public parts shop origin.');
 return url.href;
}
function safePath(value){
 if(typeof value!=='string'||!value||/[\0\\?#]/.test(value))return null;
 let v=value.startsWith('/')?value:'/'+value;
 try{v=decodeURI(v);}catch{return null;}
 if(v.includes('//')||v.split('/').some(p=>p==='..'||p==='.'||p.startsWith('.')))return null;
 if(!/^\/[\p{L}\p{N}\p{Pd}_./%~!*,()+-]*$/u.test(v))return null;
 return v==='/'?'/':v.replace(/\/+$/,'')+'/';
}
function canonical(value){let p=value;const seen=new Set();while(aliasesByFrom.has(p)&&!seen.has(p)){seen.add(p);p=aliasesByFrom.get(p).to;}return p;}
function countTag(name,owner,known=false){
 const safe=/^[!$+*#~%]?[A-Za-z0-9_.-]{1,90}$/.test(name)?name:'unparsed';
 if(known){coverage.suppressedTags[safe]=(coverage.suppressedTags[safe]||0)+1;return;}
 const registry=owner.startsWith('shell-')?helperUnknownTags:unknownTags;const key=owner+':'+safe;const item=registry.get(key)||{owner,tagName:safe,count:0};item.count++;registry.set(key,item);
}
function resolveModx(raw,context={},owner='shared',stack=[]){
 let html=resolveCityText(raw??'').replace(/<\?(?:php|=)[\s\S]*?(?:\?>|$)/gi,'');
 for(let depth=0;depth<20&&html.includes('[[');depth++){
  let changed=false;
  html=html.replace(/\[\[([^\[\]]*)\]\]/g,(whole,body)=>{
   changed=true;
   const token=body.trim(),head=(token.match(/^[^?:\s]+/)||[''])[0];
   if(owner.startsWith('shell-')&&(/^!?\+/.test(head)||head==='$breadcrumbs_mail')){countTag(head,owner,true);return '';}
   if(/^!?\$?city2$/.test(head)){return escapeHtml(defaultCity.prepositional);}
   if(/^!?city$/.test(head)){countTag(head,owner,true);return '';}
   if(head.startsWith('~')){
    const id=Number((head.match(/^~(\d+)/)||[])[1]);const target=recordById.get(id);
    return target?target.path:'';
   }
   if(head.startsWith('*')){
    const field=head.slice(1),mapping={id:'id',parent:'parentId',pagetitle:'title',longtitle:'longTitle',description:'description',menutitle:'menuTitle'};
    if(mapping[field])return escapeHtml(context[mapping[field]]??'');
   }
   const ancestor=head.match(/^#(\d+)\.(pagetitle|longtitle)$/);
   if(ancestor){const r=recordById.get(Number(ancestor[1]));return escapeHtml(r?.[ancestor[2]==='pagetitle'?'title':'longTitle']||'');}
   if(head.startsWith('$')&&chunksByName.has(head.slice(1))&&stack.length<4){
    const name=head.slice(1);
    if(/^Block_|^(?:utp|30)$/.test(name)&&!stack.includes(name))return resolveModx(chunksByName.get(name).snippet,context,owner,[...stack,name]);
   }
   if(/^(?:!?instagram|!?AjaxForm|!?TicketForm|!?ecForm|!?ecMessages|!?custom_faq|!?list-cons|!?starRating|!?pdoResources|!?pdoMenu|!?pdoPage|!?msProducts|!?TicketsLatest|!?reviews-services|!?city2|!?host|!?getPgnum)$/.test(head)){countTag(head,owner,true);return '';}
   countTag(head||'unparsed',owner);return '';
  });
  if(!changed)break;
 }
 if(html.includes('[[')){countTag('unparsed',owner);html=html.replace(/\[\[[\s\S]*?(?:\]\]|$)/g,'');}
 return html.replace(/\s+в(?=\s*(?:<\/[^>]+>|\r?\n|$))/giu,'');
}
function publicAssetPath(raw,base='/'){
 if(typeof raw!=='string'||!raw.trim()||/^(?:data|blob|javascript|vbscript|file):/i.test(raw))return null;
 let u;try{u=new URL(raw,'http://localhost:8088'+(base.startsWith('/')?base:'/'+base));}catch{return null;}
 if(!['http:','https:'].includes(u.protocol))return null;
 let pathname;try{pathname=decodeURIComponent(u.pathname);}catch{return null;}
 if(/[\0\\]/.test(pathname))return null;
 const parts=pathname.split('/').filter(Boolean);
 if(!parts.length||parts.some(p=>p==='..'||p==='.'||p.startsWith('.'))||DENY_ROOTS.has(parts[0].toLowerCase()))return null;
 const relative=parts.join('/');if(!EXTENSIONS.has(path.posix.extname(relative).toLowerCase()))return null;
 const absolute=path.resolve(SOURCE,...parts),outside=path.relative(SOURCE,absolute);
 if(outside.startsWith('..')||path.isAbsolute(outside))return null;
 return {relative,absolute};
}
function missing(relative,reason){if(relative&&!missingAssets.has(relative))missingAssets.set(relative,{sourcePath:relative,reason});}
function dimensions(data,extension){
 try{
  if(extension==='.png'&&data.length>=24)return{width:data.readUInt32BE(16),height:data.readUInt32BE(20)};
  if(extension==='.gif'&&data.length>=10)return{width:data.readUInt16LE(6),height:data.readUInt16LE(8)};
  if(['.jpg','.jpeg'].includes(extension)){
   let i=2;while(i<data.length-10){if(data[i]!==255){i++;continue;}let marker=data[i+1];i+=2;if(marker===216||marker===217)continue;const size=data.readUInt16BE(i);if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return{height:data.readUInt16BE(i+3),width:data.readUInt16BE(i+5)};if(size<2)break;i+=size;}
  }
  if(extension==='.webp'&&data.length>=30&&data.toString('ascii',12,16)==='VP8X')return{width:1+data.readUIntLE(24,3),height:1+data.readUIntLE(27,3)};
 }catch{}
 return {};
}
function validMagic(data,ext){
 if(data.length===0)return false;
 if(ext==='.png')return data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(['.jpg','.jpeg'].includes(ext))return data[0]===255&&data[1]===216;
 if(ext==='.gif')return /^GIF8[79]a/.test(data.toString('ascii',0,6));
 if(ext==='.webp')return data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP';
 if(ext==='.svg')return /<svg[\s>]/i.test(data.toString('utf8'));
 if(ext==='.woff2')return data.toString('ascii',0,4)==='wOF2';
 if(ext==='.woff')return data.toString('ascii',0,4)==='wOFF';
 if(ext==='.ico')return data.length>6&&data.readUInt16LE(0)===0&&data.readUInt16LE(2)===1;
 return true;
}
async function importAsset(raw,base='/'){
 const parsed=publicAssetPath(raw,base);if(!parsed)return null;
 if(activeAssetPaths.has(parsed.relative))return null;
 if(sourceAssetCache.has(parsed.relative))return sourceAssetCache.get(parsed.relative);
 const promise=(async()=>{
  try{
   const real=await fs.realpath(parsed.absolute),outside=path.relative(SOURCE_REAL,real);
   if(outside.startsWith('..')||path.isAbsolute(outside)){missing(parsed.relative,'outside-public-root');return null;}
   const stat=await fs.stat(real);if(!stat.isFile()||stat.size===0){missing(parsed.relative,stat.size===0?'empty':'not-file');return null;}
   if(stat.size>32*1024*1024){missing(parsed.relative,'oversized');return null;}
   let data=await fs.readFile(real);let extension=path.posix.extname(parsed.relative).toLowerCase();
   if(!validMagic(data,extension)){missing(parsed.relative,'invalid-format');return null;}
   if(/<\?php(?:\s|$)/i.test(data.toString('latin1'))||/<\?=[\x09\x0A\x0D\x20-\x7E]{8,128}/.test(data.toString('latin1'))){missing(parsed.relative,'embedded-executable');return null;}
   if(extension==='.svg'){
    const $=cheerio.load(data.toString('utf8'),{xml:true});
    $('script,foreignObject,iframe,object,embed').remove();$('*').each((_,el)=>{for(const [k,v] of Object.entries(el.attribs||{})){if(/^on/i.test(k)||/^(?:href|xlink:href)$/i.test(k)&&!/^(?:#|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(v))$(el).removeAttr(k);if(/url\s*\(\s*['"]?(?:https?:|\/\/)/i.test(v))$(el).removeAttr(k);}});
    data=Buffer.from($.xml().replace(/<!--[\s\S]*?-->/g,''),'utf8');
   }
   if(extension==='.css'){
    activeAssetPaths.add(parsed.relative);
    let css=data.toString('utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/(?:expression\s*\([^;]*|behavior\s*:[^;]*|-moz-binding\s*:[^;]*)[;]?/gi,'');
    const matches=[...css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]+))\s*\)/gi)];
    let output='',offset=0;
    for(const match of matches){output+=css.slice(offset,match.index);const dep=await importAsset(match[1]??match[2]??match[3]??'','/'+parsed.relative);output+='url("'+(dep?'./'+path.posix.basename(dep.url):'')+'")';offset=match.index+match[0].length;}
    css=output+css.slice(offset);css=css.replace(/@import\s+["'][^"']+["'][^;]*;/gi,'');
    data=Buffer.from(css,'utf8');activeAssetPaths.delete(parsed.relative);
   }
   const hash=crypto.createHash('sha256').update(data).digest('hex').slice(0,24),ext=extension==='.jpeg'?'.jpg':extension;
   const id=hash+ext,entry={id,url:'/media/'+id,bytes:data.length,format:ext.slice(1),...dimensions(data,ext)};
   if(!assetsById.has(id)){await fs.writeFile(path.join(MEDIA,id),data,{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});assetsById.set(id,entry);}
   return entry;
  }catch(e){missing(parsed.relative,e.code==='ENOENT'?'missing':'unreadable');return null;}
 })();
 sourceAssetCache.set(parsed.relative,promise);return promise;
}
function allowedLink(raw,contextPath,allowPublicContactLinks=false){
 if(!raw)return null;
 if(raw.startsWith('#'))return /^#[A-Za-z0-9_.:-]+$/.test(raw)?raw:null;
 if(/^(?:tel|mailto):/i.test(raw))return /^[^\r\n\0<>]+$/.test(raw)?raw:null;
 if(/^(?:javascript|vbscript|data|file|blob):/i.test(raw)){coverage.removedLinks.unsafe++;return null;}
 let url;try{url=new URL(raw,'http://localhost:8088'+contextPath);}catch{coverage.removedLinks.unsafe++;return null;}
 if(!['http:','https:'].includes(url.protocol)){coverage.removedLinks.unsafe++;return null;}
 if(allowPublicContactLinks&&url.origin!=='http://localhost:8088'&&!url.username&&!url.password&&!url.search&&!url.hash&&!/\.(?:php|asp|cgi|sh|exe|js|sql|env)$/i.test(url.pathname))return url.href;
 let p=safePath(url.pathname);if(!p){coverage.removedLinks.unsafe++;return null;}
 p=canonical(p);
 const target=byPath.get(p);
 if(target){
  const hash=/^#[A-Za-z0-9_.:-]+$/.test(url.hash)?url.hash:'';
  // Query variants become their declared pagination URI; private/query parameters never survive.
  const page=Number(url.searchParams.get('page')||1);
  const paginated=Number.isInteger(page)&&page>1?canonical(p+'page-'+page+'/'):p;
  return (byPath.has(paginated)?paginated:p)+hash;
 }
 if(url.origin!=='http://localhost:8088'){coverage.removedLinks.external++;return null;}
 if(/^\/(?:status|consultations|voprosyi|goroda|info\/(?:reviews|status|zayavka))(?:\/|$)/i.test(p)){coverage.removedLinks.excluded++;return null;}
 coverage.removedLinks.unknown++;unknownPaths.set(p,(unknownPaths.get(p)||0)+1);return null;
}
async function sanitizeHtml(raw,context={},owner='shared'){
 const resolved=resolveModx(raw,context,owner);
 const $=cheerio.load(resolved,null,false);
 $('script,style,iframe,object,embed,base,link,meta,form,input,textarea,select,button,.popup,.overlay,.modal,[data-demo-unavailable],[data-demo-form]').remove();
 $('*').contents().filter((_,node)=>node.type==='comment'||node.type==='directive').remove();
 for(const el of $('*').toArray()){
  const node=$(el);
  for(const [key,value] of Object.entries(el.attribs||{})){
   if(/^on/i.test(key)||/^(?:srcdoc|action|formaction|nonce|integrity|data-(?:csrf|token|key|secret|session|demo-))/i.test(key)||/\[\[|<\?(?:php|=)/i.test(value))node.removeAttr(key);
  }
  if(node.attr('style')){
   let style=node.attr('style').replace(/(?:expression|behavior|-moz-binding)\s*[^;]*(?:;|$)/gi,'');
   const matches=[...style.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]+))\s*\)/gi)];
   for(const match of matches){const a=await importAsset(match[1]??match[2]??match[3]??'','/');style=style.replace(match[0],a?'url("'+a.url+'")':'none');}
   node.attr('style',style);
  }
  if(el.tagName==='a'){
   const href=allowedLink(node.attr('href'),context.path||'/',context.id===2);
   if(href)node.attr('href',href);else{node.removeAttr('href');node.replaceWith(node.contents());continue;}
   node.removeAttr('ping').removeAttr('download');
   if(node.attr('target')&&!['_blank','_self','_parent','_top'].includes(node.attr('target')))node.removeAttr('target');
  }
  if(['img','source','video','audio'].includes(el.tagName)){
   if(el.tagName!=='img'){node.remove();continue;}
   const raw=node.attr('data-src')||node.attr('data-lazy-src')||node.attr('src');
   const a=await importAsset(raw,'/');
   if(!a){node.remove();continue;}
   node.attr('src',a.url).removeAttr('srcset').removeAttr('data-src').removeAttr('data-lazy-src');
   // Source display dimensions (for example the 25px MAX icon) are distinct
   // from the natural bitmap size and must survive a fresh import.
   if(!/^\d+(?:\.\d+)?%?$/.test(node.attr('width')||'')&&a.width)node.attr('width',String(a.width));
   if(!/^\d+(?:\.\d+)?%?$/.test(node.attr('height')||'')&&a.height)node.attr('height',String(a.height));
   if(!node.attr('alt'))node.attr('alt','');
  }
  for(const attr of ['background','poster'])if(node.attr(attr))node.removeAttr(attr);
 }
 return $.html().trim();
}
async function limited(items,fn,limit=20){
 let cursor=0;await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor<items.length){const item=items[cursor++];await fn(item);}}));
}
function numeric(v){return Number.isFinite(Number(v))?Number(v):0;}
function assertOwned(file,root){const rel=path.relative(root,file);if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw Error('Unsafe export target.');}
async function writeJson(file,value){await fs.writeFile(file,JSON.stringify(value,null,2)+'\n','utf8');}
async function main(){
 await assertLegacyImportCanReplace(PROJECT);
 SOURCE_REAL=await fs.realpath(SOURCE);await fs.mkdir(MEDIA,{recursive:true});
 const source=await fs.readFile(path.join(PROJECT,'scripts','read-modx-public.php'),'utf8');
 const result=spawnSync('docker',['compose','exec','-T','web','php','-d','display_errors=0'],{cwd:COMPOSE,input:source,encoding:'utf8',maxBuffer:128*1024*1024,windowsHide:true,timeout:180000});
 if(result.status!==0)throw Error('Local public database export failed.');
 let data;try{data=JSON.parse(result.stdout);}catch{throw Error('Invalid local public export response.');}
 if(Number(data.defaultCity?.id)!==defaultCity.resourceId||data.defaultCity?.name!==defaultCity.name||data.defaultCity?.slug!==defaultCity.slug||data.defaultCity?.prepositional!==defaultCity.prepositional)throw Error('Public default city does not match the reviewed MODX city.');
 coverage.defaultCity={...defaultCity};
 const formation=JSON.parse(await fs.readFile(path.join(PROJECT,'docs','template-map.json'),'utf8'));
 const categoryHeadingChunks=data.chunks.filter(chunk=>Number(chunk.id)===67||chunk.name==='price_tab');
 if(categoryHeadingChunks.length!==1)throw Error('Ambiguous reviewed category price heading source.');
 const categoryHeadingRules=parseCategoryPriceHeadingRules(categoryHeadingChunks[0]);
 for(const chunk of data.chunks)chunksByName.set(chunk.name,chunk);
 for(const r of data.records)rawById.set(numeric(r.id),r);
 if(process.argv.includes('--inspect')){
  const tags={};for(const c of data.chunks){const found=[...c.snippet.matchAll(/\[\[\s*([!$+*~%^]?)([A-Za-z_][A-Za-z0-9_.-]*)/g)].map(m=>m[1]+m[2]);tags[c.name]=[...new Set(found)];}
  console.log(JSON.stringify({invalidPaths:data.records.filter(r=>Number(r.id)!==1&&!safePath(r.uri)).map(r=>({id:Number(r.id),templateId:Number(r.template),unsupportedCharacters:[...new Set([...r.uri].filter(c=>!/[A-Za-z0-9_./%~-]/.test(c)))].map(c=>c.codePointAt(0))})),records:data.records.length,originalImages:data.images.length,chunks:data.chunks.length,pagination:data.pagination,resourceShapes:data.records.filter(r=>[1,2,23,12932].includes(Number(r.id))).map(r=>{const $=cheerio.load(r.content||'',null,false);return {id:Number(r.id),bytes:(r.content||'').length,topElements:$.root().children().toArray().map(el=>({tag:el.tagName,className:$(el).attr('class')||''}))};}),chunkTags:tags}));return;
 }
 const normalizedUriAliases=[];const reservedSourcePaths=new Map(data.records.map(raw=>[safePath(raw.uri),Number(raw.id)]));
 const records=data.records.map(raw=>{
  const id=numeric(raw.id),parentId=numeric(raw.parent),templateId=numeric(raw.template),type=ALLOWED_TYPES[templateId];
  let resourcePath=id===1?'/':safePath(raw.uri);if(!resourcePath||!type)throw Error('Invalid public resource identity.');
  if(resourcePath.includes('*')){if(![9493,9636,10057].includes(id))throw Error('Unexpected legacy URI normalization.');const from=resourcePath;resourcePath=resourcePath.replaceAll('*','-');if(reservedSourcePaths.has(resourcePath)&&reservedSourcePaths.get(resourcePath)!==id)resourcePath=resourcePath.slice(0,-1)+'-'+id+'/';normalizedUriAliases.push({from,to:resourcePath,status:301,resourceId:id});}
  const record={id,parentId,templateId,type,classKey:cleanText(raw.class_key),path:resourcePath,title:trimCityTail(raw.pagetitle),longTitle:trimCityTail(raw.longtitle),description:trimCityTail(raw.description),menuTitle:cleanText(raw.menutitle),menuIndex:numeric(raw.menuindex),hidemenu:Boolean(numeric(raw.hidemenu)),publishedAt:numeric(raw.publishedon)?new Date(numeric(raw.publishedon)*1000).toISOString():null,heading:'',contentHtml:'',introHtml:'',tvs:{},galleryAssetIds:[],childIds:[],breadcrumbIds:[]};
  if(id===13&&record.longTitle.startsWith('Ремонт бытовой техники '+defaultCity.prepositional)){
   record.longTitle=record.longTitle.replace('Ремонт бытовой техники '+defaultCity.prepositional,'Ремонт бытовой техники в '+defaultCity.prepositional);
   coverage.sourceDefects.push({source:'resource:13',field:'longtitle',reason:'missing-preposition-before-city'});
  }
  if(templateId===9)record.editorialKind=parentId===16?'article':parentId===3343?'news':'information';
  recordById.set(id,record);if(byPath.has(resourcePath))throw Error('Duplicate canonical public path.');byPath.set(resourcePath,record);
  return record;
 });
 for(const r of records){
  const parent=recordById.get(r.parentId);
  r.heading=trimCityTail(r.templateId===5?'Ремонт '+(r.parentId===4082?'':(parent?.title||''))+' '+r.title:r.templateId===10?(r.id===4082?'':(parent?.title||''))+' '+r.title:r.title);
  if([5,6,10,15,16,18].includes(r.templateId))r.heading=withCityLocation(r.heading);
  if(r.templateId===5){
   // headT: pdoField top=1 is the parent, top=2 is the grandparent.
   const grandparent=parent&&recordById.get(parent.parentId),iphone=r.parentId===4082;
   const categoryTitle=cleanText([!iphone&&grandparent?.title,parent?.title].filter(Boolean).join(' '));
   const deviceTitle=cleanText([!iphone&&parent?.title,r.title].filter(Boolean).join(' '));
   r.seo={title:withCityLocation(categoryTitle)+' – починить '+deviceTitle+' недорого в ТехМастер',description:withCityLocation(r.longTitle||'Советы по ремонту и эксплуатации '+cleanText([parent?.title,r.title].filter(Boolean).join(' ')))+'.'};
  }else{
   r.seo={title:r.longTitle||withCityLocation(r.title)+' – ТехМастер',description:r.description};
  }
  if(parent)parent.childIds.push(r.id);
  let ancestor=parent;const seen=new Set([r.id]),crumbs=[];while(ancestor&&!seen.has(ancestor.id)){seen.add(ancestor.id);crumbs.unshift(ancestor.id);ancestor=recordById.get(ancestor.parentId);}
  if(r.id!==1&&!crumbs.includes(1))crumbs.unshift(1);r.breadcrumbIds=crumbs;
 }
 const aliases=normalizedUriAliases.map(({from,to,status})=>({from,to,status}));for(const alias of aliases)aliasesByFrom.set(alias.from,alias);
 for(const a of formation.routePolicy.aliases||[]){const from=safePath(a.from),to=safePath(a.to);if(from&&to&&byPath.has(to)&&from!==to){const item={from,to,status:301};aliases.push(item);aliasesByFrom.set(from,item);}}
 let skippedRedirects=0;
 for(const raw of data.redirects){
  const from=safePath(raw.pattern);let target=raw.target;const idLink=String(target).match(/^\[\[~(\d+)(?:\?[^]*)?\]\]$/);
  if(idLink)target=recordById.get(Number(idLink[1]))?.path;
  const to=safePath(target);if(!from||!to||!byPath.has(canonical(to))||from===to||byPath.has(from)||aliasesByFrom.has(from)){skippedRedirects++;continue;}
  const a={from,to:canonical(to),status:301};aliases.push(a);aliasesByFrom.set(from,a);
 }
 const routes=records.map(r=>({path:r.path,resourceId:r.id,type:r.type,templateId:r.templateId,canonicalPath:r.path}));
 for(const r of records){
  if(![8,10,17].includes(r.templateId))continue;
  const children=r.childIds.map(id=>recordById.get(id)).filter(c=>c.type===(r.templateId===10?'repair':'editorial'));
  children.sort(r.templateId===10?(a,b)=>a.title.localeCompare(b.title,'ru',{numeric:true}):(a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||''))||b.id-a.id);
  const pageSize=r.templateId===10?20:12,pageCount=Math.max(1,Math.ceil(children.length/pageSize));
  r.childIds=children.map(c=>c.id);r.pageSize=pageSize;r.pageCount=pageCount;
  const first=routes.find(x=>x.resourceId===r.id);first.page=1;first.pageCount=pageCount;
  if(pageCount>1){const a={from:r.path+'page-1/',to:r.path,status:301};if(!byPath.has(a.from)&&!aliasesByFrom.has(a.from)){aliases.push(a);aliasesByFrom.set(a.from,a);}}
  for(let page=2;page<=pageCount;page++){const route={path:r.path+'page-'+page+'/',resourceId:r.id,type:r.type,templateId:r.templateId,page,pageCount,canonicalPath:r.path+'page-'+page+'/'};if(byPath.has(route.path))throw Error('Pagination path collision.');routes.push(route);byPath.set(route.path,route);}
 }
 const filesByProduct=new Map();
 for(const image of data.images){const id=numeric(image.product_id);if(!filesByProduct.has(id))filesByProduct.set(id,[]);filesByProduct.get(id).push(image);}
 const productImages=new Map(data.products.map(p=>[numeric(p.id),p.image]));
 const imageReferences=new Set();
 for(const f of data.images){const raw=f.url||String(f.path||'')+String(f.file||'');if(raw)imageReferences.add(raw);}
 for(const tv of data.tvs)if([2,3].includes(numeric(tv.tmplvarid))&&tv.value)imageReferences.add(tv.value);
 for(const r of records)if(!filesByProduct.has(r.id)&&productImages.get(r.id))imageReferences.add(productImages.get(r.id));
 await limited([...imageReferences],raw=>importAsset(raw),24);
 for(const tv of data.tvs){
  const r=recordById.get(numeric(tv.contentid));if(!r)continue;
  const kind=numeric(tv.tmplvarid);
  if([2,3].includes(kind)){const asset=await importAsset(tv.value);if(asset)r.tvs[kind===2?'categoryLogo':'articlePic']=asset.id;}
  if(kind===4)r.tvs.tags=cleanText(tv.value);
  if(kind===1)r.tvs.menuIcon=cleanText(tv.value).replace(/[^A-Za-z0-9 _-]/g,'');
  if(kind===5&&/^[+\d\s()\-–]{5,40}$/.test(tv.value))r.tvs.diagnosticPhone=cleanText(tv.value);
 }
 for(const r of records){
  for(const image of filesByProduct.get(r.id)||[]){const asset=await importAsset(image.url||String(image.path||'')+String(image.file||''));if(asset&&!r.galleryAssetIds.includes(asset.id))r.galleryAssetIds.push(asset.id);}
  let primary=r.galleryAssetIds[0];
  if(!primary&&productImages.get(r.id))primary=(await importAsset(productImages.get(r.id)))?.id;
  if(!primary)primary=r.tvs.categoryLogo||r.tvs.articlePic;if(primary)r.imageAssetId=primary;
  const raw=rawById.get(r.id);r.contentHtml=await sanitizeHtml(raw.content,r,'resource:'+r.id);r.introHtml=await sanitizeHtml(raw.introtext,r,'resource-intro:'+r.id);
 }
 for(const r of records.filter(r=>r.type==='repair')){
  const values=data.tvs.filter(tv=>numeric(tv.contentid)===r.id&&numeric(tv.tmplvarid)===4);
  if(values.length>1)throw Error('Ambiguous public parts shop field.');
  r.partsShopUrl=publicPartsShopUrl(r,values[0]?.value||'');
 }
 const tables=[];
 for(const chunk of data.chunks.filter(c=>/^price_/.test(c.name)&&!['price_tab','price_tab_inside'].includes(c.name))){
  const html=await sanitizeHtml(chunk.snippet,{},'chunk:'+chunk.id),$=cheerio.load(html,null,false),tabs=[],presentation=extractPricePresentation(chunk.snippet);
  $('table').each((index,el)=>{
   const table=$(el),container=table.closest('[id]'),containerId=container.attr('id');
   let label=containerId?$('a[href="#'+containerId+'"]').first().text().trim():'';
   if(!label)label=table.prevAll('h2,h3,h4,strong').first().text().trim()||'';
   const rows=[],columns=[],columnNotes=[];let firstRow=true;
   table.find('tr').each((_,tr)=>{
    const cells=$(tr).children('th,td').toArray();if(!cells.length)return;
    if(firstRow){columns.push(...cells.map(td=>{const sourceCell=$(td),cell=sourceCell.clone();columnNotes.push(cleanText(sourceCell.find('.quest_block,.tooltiptext,[role="tooltip"]').text()));cell.find('.quest_cont,.quest_click,.quest_block,.tooltip,.tooltiptext').remove();return cleanText(cell.text());}));firstRow=false;return;}
    const row={cells:cells.map(td=>$(td).html()?.trim()||'')};
    if(presentation.tabs[index]?.rowBold[rows.length])row.bold=true;
    const colSpans=cells.map(td=>Math.max(1,numeric($(td).attr('colspan'))||1)),rowSpans=cells.map(td=>Math.max(1,numeric($(td).attr('rowspan'))||1));
    if(colSpans.some(x=>x>1))row.colSpans=colSpans;if(rowSpans.some(x=>x>1))row.rowSpans=rowSpans;rows.push(row);firstRow=false;
   });
   if(!columns.length&&rows.length){const first=rows[0];if(first.cells.some(cell=>/Стоимость|Вид ремонта|Услуг|Наименование|Срок|Цена|Время|Гарантия/i.test(cheerio.load(cell,null,false).text()))&&!first.cells.some(cell=>/[0-9₽]/.test(cheerio.load(cell,null,false).text()))){columns.push(...first.cells.map(cell=>cleanText(cheerio.load(cell,null,false).text())));rows.shift();}}
   const introParts=[],noteParts=[];
   table.prevAll().toArray().reverse().forEach(node=>{if(['p','div'].includes(node.tagName)&&!$(node).find('table,ul,form').length)introParts.push($.html(node));});
   table.nextAll().toArray().forEach(node=>{if(['p','div'].includes(node.tagName)&&!$(node).find('table,ul,form').length)noteParts.push($.html(node));});
   const {rowBold,...tabPresentation}=presentation.tabs[index]||{};
   tabs.push({id:'tab-'+(index+1),label,columns,columnNotes,rows,...tabPresentation,...(introParts.length?{introHtml:introParts.join('')}:{}),...(noteParts.length?{noteHtml:noteParts.join('')}:{} )});
  });
  if(tabs.length)tables.push({key:chunk.name,tabs,showTabNavigation:presentation.showTabNavigation,tabNavigationCopies:presentation.tabNavigationCopies});else coverage.sourceDefects.push({source:'chunk:'+chunk.id,reason:'price-without-table'});
 }
 const priceKeys=new Set(tables.map(t=>t.key)),categoryRules=formation.priceSystem.categoryBranchRules;const inheritedServicePriceIds=new Set();
 function priceFor(r){
  if(r.type==='category'){const match=categoryRules.find(rule=>r.id===rule.categoryId||r.parentId===rule.categoryId);return match?.chunk;}
  if(!['repair','service'].includes(r.type))return null;
  const parent=recordById.get(r.parentId),grandparent=parent?.parentId;
  if(r.type==='repair'&&r.parentId===4082)return 'price_apple';
  if(r.type==='service'&&r.parentId===5)return 'price_tel';
  const own={12965:'price_print',4082:'price_apple',5:'price_tel',8:'price_plansh',6:'price_note',7:'price_pc',148:'price_console',9:'price_books',10:'price_tv',11:'price_screen',12:'price_photo',13:'price_byttech',14:'price_auto',17:'price_micro',178:'price_micro_pech',4222:'price_video',4232:'price_auto'};
  // The current auto branch4232 is resolved via its own real category below; do not use obsolete category14 as a fallback.
  if(own[grandparent]&&!(r.type==='service'&&grandparent===4232))return own[grandparent];
  if(r.type==='service'&&parent?.type==='category'){const inherited=priceFor(parent);if(inherited&&priceKeys.has(inherited)){inheritedServicePriceIds.add(r.id);return inherited;}}
  const seen=new Set();let ancestor=parent;while(ancestor&&!seen.has(ancestor.id)){seen.add(ancestor.id);const rule=categoryRules.find(x=>x.categoryId===ancestor.id&&x.categoryId>=7006&&x.categoryId<=7016);if(rule)return rule.chunk;ancestor=recordById.get(ancestor.parentId);}
  return null;
 }
 const blocks=[];
 for(const chunk of data.chunks.filter(c=>/^Block_/.test(c.name)||['utp','30'].includes(c.name))){
  const html=await sanitizeHtml(chunk.snippet,{},'chunk:'+chunk.id);
  if(html)blocks.push({key:chunk.name,html});
 }
 const blockKeys=new Set(blocks.map(b=>b.key));
 for(const r of records){
  const priceKey=priceFor(r);if(priceKey&&priceKeys.has(priceKey))r.priceKey=priceKey;
  if(r.type==='category'&&r.priceKey)r.priceHeading=categoryPriceHeading(r,categoryHeadingRules);
  if(r.type==='category'){const key='Block_'+r.id;if(blockKeys.has(key))r.blockKey=key;else if(blockKeys.has('Block_default'))r.blockKey='Block_default';}
 }
 const shellSource=[];
 for(const chunk of data.chunks.filter(c=>[27,28,33,34,125].includes(numeric(c.id))))shellSource.push({id:numeric(chunk.id),key:chunk.name,html:await sanitizeHtml(chunk.snippet,{},'shell-chunk:'+chunk.id)});
 const excluded=data.excluded.map(r=>({resourceId:numeric(r.id),templateId:numeric(r.template),reason:numeric(r.id)===3715?'technical-not-found':numeric(r.template)===12?'city-deferred':[7,11,13].includes(numeric(r.template))?'ugc-excluded':numeric(r.template)===14?'private-order-widget-excluded':numeric(r.template)===0?'technical-or-form-resource':'access-restricted'}));
 coverage.uriNormalizations=normalizedUriAliases.map(({resourceId,from,to})=>({resourceId,from,to,rule:'legacy-star-to-hyphen-portable-filename'}));
 coverage.unknownModxTags=[...unknownTags.values()];coverage.missingAssets=[...missingAssets.values()];coverage.unknownInternalPaths=[...unknownPaths].map(([path,count])=>({path,count}));
 for(const r of records)coverage.byTemplate[r.templateId]=(coverage.byTemplate[r.templateId]||0)+1;
 coverage.counts={resources:records.length,routes:routes.length,paginationRoutes:routes.length-records.length,aliases:aliases.length,excluded:excluded.length,originalImageRecords:data.images.length,assets:assetsById.size,missingAssets:missingAssets.size,prices:tables.length,priceTabs:tables.reduce((sum,t)=>sum+t.tabs.length,0),blocks:blocks.length,unknownTagGroups:unknownTags.size,unknownInternalPaths:unknownPaths.size,skippedUnsafeRedirects:skippedRedirects,repairWithoutImage:records.filter(r=>r.type==='repair'&&!r.imageAssetId).length};
 coverage.priceCoverage={repair:records.filter(r=>r.type==='repair').length,repairWithPrice:records.filter(r=>r.type==='repair'&&r.priceKey).length,service:records.filter(r=>r.type==='service').length,serviceWithPrice:records.filter(r=>r.type==='service'&&r.priceKey).length,serviceInheritedParentPrices:inheritedServicePriceIds.size,unpricedHeatingBranch:records.filter(r=>r.type==='repair'&&!r.priceKey&&r.path.startsWith('/services/remont-obogrevatelej/')).length,correction:'Existing category price chunks for appliance groups7006-7016 are reused by their device/service descendants. Service records with missing legacy depth rules inherit only their actual parent category priceKey. No new prices introduced.'};
 coverage.pagination={pageVariable:'page',canonicalPattern:'/resource-path/page-N/',categoryPageSize:20,editorialPageSize:12,source:'modx_site_plugins[id=15].plugincode'};
 const stage=path.join(PROJECT,'data','.generated-'+process.pid);assertOwned(stage,path.join(PROJECT,'data'));await fs.mkdir(stage);
 const outputs={'routes.json':{schemaVersion:1,routes,aliases,excluded},'resources.json':{schemaVersion:1,records},'prices.json':{schemaVersion:1,tables},'blocks.json':{schemaVersion:1,blocks},'assets.json':{schemaVersion:1,assets:[...assetsById.values()],missing:[...missingAssets.values()]},'coverage.json':coverage,};
 await fs.mkdir(path.join(PROJECT,'.local'),{recursive:true});await writeJson(path.join(PROJECT,'.local','shell-source.json'),{schemaVersion:1,chunks:shellSource,unknownModxTags:[...helperUnknownTags.values()]});
 for(const [name,value]of Object.entries(outputs))await writeJson(path.join(stage,name),value);
 await assertLegacyImportCanReplace(PROJECT);
 try{await fs.access(GENERATED);const backupRoot=path.join(PROJECT,'.local','export-backups');await fs.mkdir(backupRoot,{recursive:true});const backup=path.join(backupRoot,'generated-'+Date.now());assertOwned(GENERATED,path.join(PROJECT,'data'));assertOwned(backup,backupRoot);await fs.rename(GENERATED,backup);}catch(e){if(e.code!=='ENOENT')throw e;}
 await fs.rename(stage,GENERATED);
 console.log(JSON.stringify({ok:true,...coverage.counts}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{if([COMMUNITY_IMPORT_BLOCKED,'EIMPORTSTATEUNREADABLE'].includes(error.code)){console.error(JSON.stringify({error:'public-export-blocked',code:error.code,message:error.message}));process.exitCode=1;return;}const location=String(error.stack||'').match(/export-modx-public\.mjs:(\d+)/)?.[1];console.error(JSON.stringify({error:'public-export-failed',errorClass:error.constructor.name,line:location,code:/^E[A-Z]+$/.test(error.code||'')?error.code:undefined}));process.exitCode=1;});
