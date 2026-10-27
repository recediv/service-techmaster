import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as cheerio from 'cheerio';

const root = process.cwd();
const read = async (name) => JSON.parse(await fs.readFile(path.join(root, 'data/generated', name + '.json'), 'utf8'));
const issues = new Map();
const fail = (code, id = 'global') => {
  const entry = issues.get(code) || { count: 0, ids: [] };
  entry.count++; if (entry.ids.length < 8) entry.ids.push(id);
  issues.set(code, entry);
};
const allowedTypes = new Set(['home','contacts','repair','category','service','editorial','editorial-index','reviews-index','consultations-index','consultation','order-status']);
const safePath = (value) => typeof value === 'string' && /^\/(?:[^?#\\\s]+\/)?$/.test(value)
  && !value.includes('//') && !value.split('/').some((part) => part === '..' || part === '.')
  && !/[\u0000-\u001f]/.test(value);
const backend = /<\?php\b|\b(?:CREATE\s+TABLE|INSERT\s+INTO|DROP\s+TABLE|LOCK\s+TABLES)\b|(?:api[_-]?key|database_password|client_secret|access_token)\s*[:=]\s*["'][^"']{5,}/i;
const pagePaths = new Set();
const assetPaths = new Set();
const ids = new Set();
const statistics = { resources: 0, routes: 0, aliases: 0, assets: 0, localLinks: 0, richFragments: 0 };

function inspectHtml(html, owner) {
  if (!html) return;
  statistics.richFragments++;
  if (backend.test(html) || /\[\[[\s\S]*?\]\]/.test(html)) fail('backend-or-unresolved-tag', owner);
  const $ = cheerio.load(html, null, false);
  if ($('script,iframe,frame,object,embed,form,input,textarea,select,base').length) fail('active-markup', owner);
  if (/демонстрационн|пример\s+отзыва|(?:^|\s)демо(?:\s|$)/iu.test($.text())) fail('demo-copy', owner);
  $('*').each((_, element) => {
    for (const [attribute, value] of Object.entries(element.attribs || {})) {
      if (/^on/i.test(attribute) || /^(?:srcdoc|formaction|nonce)$/i.test(attribute)) fail('active-attribute', owner);
      if (/^(?:src|poster)$/.test(attribute) && !value.startsWith('data:') && !assetPaths.has(value)) fail('missing-runtime-asset', owner);
      if (attribute === 'href') {
        if (/^(?:https?:|tel:|mailto:|#)/i.test(value)) continue;
        const target = value.split(/[?#]/)[0];
        if (target && !pagePaths.has(target) && !assetPaths.has(target)) fail('missing-internal-link', owner);
        statistics.localLinks++;
      }
      if (attribute === 'style') {
        for (const match of value.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
          if (!match[1].startsWith('data:') && !assetPaths.has(match[1])) fail('missing-style-asset', owner);
        }
      }
    }
  });
}
function inspectObject(value, owner) {
  if (typeof value === 'string') {
    if (backend.test(value)) fail('backend-source', owner);
    if (/<[a-z][\s\S]*>/i.test(value)) inspectHtml(value, owner);
  } else if (Array.isArray(value)) value.forEach((item) => inspectObject(item, owner));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => inspectObject(item, owner));
}
async function filesUnder(directory) {
  const files = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, item.name);
    if (item.isSymbolicLink()) { fail('symlink-public'); continue; }
    if (item.isDirectory()) files.push(...await filesUnder(full)); else files.push(full);
  }
  return files;
}
async function main() {
  const [resources, routes, assets, prices, blocks, coverage] = await Promise.all(['resources','routes','assets','prices','blocks','coverage'].map(read));
  const records = resources.records;
  const recordsById = new Map(records.map(item => [item.id, item]));
  const routeList = routes.routes;
  if (!Array.isArray(records) || !Array.isArray(routeList) || !Array.isArray(assets.assets)) throw new Error('Invalid public contract.');
  statistics.resources = records.length; statistics.routes = routeList.length;
  statistics.aliases = (routes.aliases || []).length; statistics.assets = assets.assets.length;
  for (const item of routeList) {
    if (!safePath(item.path) || pagePaths.has(item.path)) fail('duplicate-or-invalid-route', item.resourceId);
    pagePaths.add(item.path);
  }
  for (const item of routes.aliases || []) {
    if (!safePath(item.from) || !safePath(item.to) || !pagePaths.has(item.to)) fail('invalid-alias');
    pagePaths.add(item.from);
  }
  for (const asset of assets.assets) {
    if (!/^\/media\/[a-z0-9._-]+$/i.test(asset.url || '')) { fail('invalid-media-path', asset.id); continue; }
    assetPaths.add(asset.url);
    try {
      const buffer = await fs.readFile(path.join(root, 'public', asset.url.slice(1)));
      if (!buffer.length || buffer.length !== asset.bytes) fail('invalid-asset-bytes', asset.id);
      const digest = crypto.createHash('sha256').update(buffer).digest('hex');
      const fingerprint = path.posix.basename(asset.url, path.posix.extname(asset.url));
      if (!/^[a-f0-9]{24}$/.test(fingerprint) || digest.slice(0, 24) !== fingerprint
        || asset.sha256 && digest !== asset.sha256) fail('asset-hash', asset.id);
    } catch { fail('missing-asset', asset.id); }
  }
  const publicFiles = await filesUnder(path.join(root, 'public'));
  const allowedExtensions = new Set(['.css','.svg','.png','.jpg','.jpeg','.webp','.avif','.gif','.ico','.woff','.woff2','.ttf','.otf','.eot','.bmp','.json','.hdr']);
  const publicAttributions = new Set(['/assets/hero/ASSET-SOURCES.txt']);
  for (const file of publicFiles) {
    const url = '/' + path.relative(path.join(root,'public'),file).split(path.sep).join('/');
    assetPaths.add(url);
    const extension = path.extname(file).toLowerCase();
    if ((!allowedExtensions.has(extension) && !publicAttributions.has(url)) || backend.test(path.basename(file))) fail('nonpublic-file');
    if (extension === '.hdr' && !/^#\?(?:RADIANCE|RGBE)\r?\n/.test((await fs.readFile(file)).subarray(0, 32).toString('ascii'))) fail('invalid-hdr-asset');
  }
  const priceKeys = new Set((prices.tables || []).map((item) => item.key));
  const blockKeys = new Set((blocks.blocks || []).map((item) => item.key));
  for (const resource of records) {
    if (!Number.isSafeInteger(resource.id) || ids.has(resource.id) || !safePath(resource.path) || !allowedTypes.has(resource.type) || !resource.title) fail('invalid-resource', resource.id);
    ids.add(resource.id);
    if ('bodyHtml' in resource || 'password' in resource || 'token' in resource || 'email' in resource) fail('nonpublic-resource-field', resource.id);
    if (resource.priceKey && !priceKeys.has(resource.priceKey)) fail('missing-price-table', resource.id);
    if (resource.blockKey && !blockKeys.has(resource.blockKey)) fail('missing-content-block', resource.id);
    inspectObject(resource, resource.id);
  }
  for (const route of routeList) if (!ids.has(route.resourceId)) fail('route-resource-missing', route.resourceId);
  for (const resource of records) {
    for (const id of [...(resource.childIds || []), ...(resource.breadcrumbIds || [])]) if (!ids.has(id)) fail('resource-relation-missing', resource.id);
    for (const id of [resource.imageAssetId,...(resource.galleryAssetIds||[])].filter(Boolean)) if (!assets.assets.some((asset) => asset.id === id)) fail('resource-asset-missing', resource.id);
  }
  inspectObject(prices, 'prices'); inspectObject(blocks, 'blocks');
  const shell = JSON.parse(await fs.readFile(path.join(root,'data/shell.json'),'utf8'));
  inspectObject(shell, 'shell');
  let community;
  try { community = JSON.parse(await fs.readFile(path.join(root,'data/generated/community.json'),'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (community) {
    inspectObject(community, 'community');
    const privateKey = /^(?:email|user_email|user_contacts|phone|telephone|ip|ip_address|user_id|createdby|internalKey|password|token|access_token|api_key|consult_answer_sent)$/i;
    const email = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}/i;
    const inspectFilters = filters => {
      if (!filters || Object.keys(filters).some(key => !['types','vendors','models'].includes(key))) { fail('community-filter-contract'); return; }
      for (const group of ['types','vendors','models']) {
        if (!Array.isArray(filters[group])) { fail('community-filter-contract'); continue; }
        for (const row of filters[group]) {
          const source = recordsById.get(row.id);
          // Catalog model numbers can resemble telephone numbers. Exempt only
          // an exact allowlisted public catalog projection, never author text.
          if (!source || Object.keys(row).sort().join(',') !== 'id,parentId,path,title'
            || row.title !== source.title || row.path !== source.path || row.parentId !== source.parentId) fail('community-filter-contract', row.id);
        }
      }
    };
    const inspectCommunity = (value, key = '') => {
      if (typeof value === 'string') {
        const $ = cheerio.load(value, null, false);
        const decoded = [$.root().text(), ...$('*').toArray().flatMap(node => Object.values(node.attribs || {}))].join(' ');
        if (email.test(value) || email.test(decoded)) fail('community-email', 'community');
        const phone = /(?<![\p{L}\p{N}])(?:\+(?:[\s().-]*\d){8,15}|[78](?:[\s().-]*\d){10}|9(?:[\s().-]*\d){9}|\d{3}[ -]\d{2}[ -]\d{2})(?!\d)/u;
        if (phone.test(value) || phone.test(decoded)) fail('community-phone', 'community');
      }
      else if (Array.isArray(value)) value.forEach(item => inspectCommunity(item));
      else if (value && typeof value === 'object') for (const [name, item] of Object.entries(value)) {
        if (privateKey.test(name)) fail('community-private-field', 'community');
        if (name === 'filters') inspectFilters(item);
        else inspectCommunity(item, name);
      }
    };
    inspectCommunity(community);
    records.filter(item => item.type === 'consultation').forEach(item => inspectCommunity(item));
    // Every file under public is exported, including an obsolete payload that
    // is no longer linked by the manifest. Audit those files as well.
    for (const file of publicFiles.filter(file => path.relative(path.join(root,'public'),file).split(path.sep).join('/').startsWith('community/') && path.extname(file) === '.json')) {
      const payload = JSON.parse(await fs.readFile(file, 'utf8'));
      inspectCommunity(payload);
      inspectObject(payload, 'community-json');
    }
    for (const item of community.consultations || []) {
      if (!ids.has(item.id) || !pagePaths.has(item.path)) fail('community-question-route', item.id);
    }
    if (community.consultationsJsonUrl) {
      if (!/^\/community\/consultations(?:-[a-f0-9]{12,64})?\.json$/.test(community.consultationsJsonUrl) || !assetPaths.has(community.consultationsJsonUrl)) fail('community-json-path');
      else {
        let payload = JSON.parse(await fs.readFile(path.join(root,'public',community.consultationsJsonUrl.slice(1)),'utf8'));
        if (payload.url) {
          if (!/^\/community\/consultations-[a-f0-9]{12,64}\.json$/.test(payload.url) || !assetPaths.has(payload.url)) fail('community-payload-path');
          else {
            const bytes = await fs.readFile(path.join(root,'public',payload.url.slice(1)));
            const hash = payload.url.match(/-([a-f0-9]+)\.json$/)[1];
            if (!crypto.createHash('sha256').update(bytes).digest('hex').startsWith(hash)) fail('community-payload-hash');
            payload = JSON.parse(bytes);
          }
        }
        inspectCommunity(payload);
        inspectObject(payload, 'community-json');
      }
    }
  }
  function inspectShellLinks(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key,item] of Object.entries(value)) {
      if (key === 'path' && typeof item === 'string' && !/^(?:https?:|tel:|mailto:)/i.test(item) && !pagePaths.has(item)) fail('shell-link-missing');
      if (key === 'imageUrl' || key === 'logoUrl') if (item && !assetPaths.has(item)) fail('shell-image-missing');
      if (typeof item === 'object') inspectShellLinks(item);
    }
  }
  inspectShellLinks(shell);
  if (coverage.unknownTags?.length || coverage.unresolvedTags?.length || coverage.unknownModxTags?.length) fail('unresolved-export-tags');
  console.log('Public data validation: ' + JSON.stringify(statistics));
  if (issues.size) {
    console.error('Validation issues: ' + JSON.stringify(Object.fromEntries(issues)));
    process.exitCode = 1;
  }
}
main().catch(() => { console.error('Public data unreadable or contract invalid. No source data logged.'); process.exitCode = 1; });
