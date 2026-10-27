import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assertLegacyImportCanReplace } from './export-modx-public.mjs';

const project=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const local=path.join(project,'.local');
const blocked=error=>error.code==='EPUBLICCOMMUNITYIMPORTBLOCKED'&&error.message.includes('ещё не объединён');
async function fixture(run){
 await fs.mkdir(local,{recursive:true});
 const root=await fs.mkdtemp(path.join(local,'legacy-import-guard-test-'));
 try{return await run(root);}finally{
  const relative=path.relative(local,path.resolve(root));
  assert(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
  await fs.rm(root,{recursive:true,force:true});
 }
}
async function write(root,file,contents){
 const target=path.join(root,file);await fs.mkdir(path.dirname(target),{recursive:true});
 const bytes=typeof contents==='string'?contents:JSON.stringify(contents);
 await fs.writeFile(target,bytes);return bytes;
}

test('legacy import allows a fresh or base-only generated set without writing files',async()=>fixture(async root=>{
 await assertLegacyImportCanReplace(root);
 await write(root,'data/generated/resources.json',{schemaVersion:1,records:[{templateId:2,type:'home'}]});
 await write(root,'data/generated/routes.json',{schemaVersion:1,routes:[{templateId:2,type:'home',path:'/'}]});
 await write(root,'data/generated/coverage.json',{schemaVersion:1,byTemplate:{2:1},privacy:{ugc:false}});
 const files=await fs.readdir(path.join(root,'data/generated'));
 await assertLegacyImportCanReplace(root);
 assert.deepEqual(await fs.readdir(path.join(root,'data/generated')),files);
}));

test('every restored community marker blocks replacement, including incomplete generated sets',async()=>fixture(async root=>{
 const cases=[
  ['data/generated/community.json','DO NOT PRINT PRIVATE FIXTURE'],
  ['public/community/consultations.json','DO NOT PRINT PRIVATE FIXTURE'],
  ['data/generated/resources.json',{schemaVersion:1,records:[{type:'consultation',templateId:0}]}],
  ['data/generated/resources.json',{schemaVersion:1,records:[{type:'editorial',templateId:13}]}],
  ['data/generated/routes.json',{schemaVersion:1,routes:[{type:'order-status',path:'/info/status/'}]}],
  ['data/generated/coverage.json',{schemaVersion:1,community:{consultations:1}}],
  ['data/generated/coverage.json',{schemaVersion:1,privacy:{ugc:true}}],
  ['data/generated/coverage.json',{schemaVersion:1,byTemplate:{14:1}}],
 ];
 for(let index=0;index<cases.length;index++){
  const target=path.join(root,String(index)),[file,contents]=cases[index];
  const bytes=await write(target,file,contents);
  await assert.rejects(assertLegacyImportCanReplace(target),blocked);
  assert.equal(await fs.readFile(path.join(target,file),'utf8'),bytes);
 }
}));

test('unreadable existing state fails closed without leaking its contents',async()=>fixture(async root=>{
 const bytes=await write(root,'data/generated/resources.json','DO NOT PRINT PRIVATE FIXTURE');
 await assert.rejects(assertLegacyImportCanReplace(root),error=>error.code==='EIMPORTSTATEUNREADABLE'&&!error.message.includes(bytes));
 assert.equal(await fs.readFile(path.join(root,'data/generated/resources.json'),'utf8'),bytes);
}));

test('synthetic CLI blocks before reading source, creating media or calling the database',async()=>fixture(async root=>{
 const marker=await write(root,'data/generated/community.json','DO NOT PRINT PRIVATE FIXTURE');
 await write(root,'scripts/export-modx-public.mjs',await fs.readFile(path.join(project,'scripts/export-modx-public.mjs'),'utf8'));
 await write(root,'lib/site-city.mjs','export const defaultCity={}; export const resolveCityText=value=>value; export const withCityLocation=value=>value;');
 const result=spawnSync(process.execPath,[path.join(root,'scripts/export-modx-public.mjs')],{
  cwd:root,encoding:'utf8',windowsHide:true,timeout:10000,
  env:{...process.env,MODX_PUBLIC_ROOT:path.join(root,'source-must-not-be-read'),MODX_COMPOSE_ROOT:path.join(root,'database-must-not-be-called')},
 });
 assert.ifError(result.error);assert.equal(result.status,1);assert.equal(result.stdout,'');
 const output=JSON.parse(result.stderr.trim());
 assert.equal(output.error,'public-export-blocked');assert.equal(output.code,'EPUBLICCOMMUNITYIMPORTBLOCKED');
 assert(output.message.includes('ещё не объединён'));assert(!result.stderr.includes(marker));
 assert.equal(await fs.readFile(path.join(root,'data/generated/community.json'),'utf8'),marker);
 await assert.rejects(fs.access(path.join(root,'public/media')),error=>error.code==='ENOENT');
}));
