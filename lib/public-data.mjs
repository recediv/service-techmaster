import fs from 'node:fs';
import path from 'node:path';
import { basePath, getAsset } from './public-urls.mjs';
import { communityContext } from './community-data.mjs';
import { editorialCardData } from './editorial-data.mjs';
import { configuredSiteOrigin } from './site-origin.mjs';
import { isPublicPageRoute, isPublicPageAlias } from './public-route-policy.mjs';
import { resolveWorkBlock } from './work-block.mjs';

const root = process.cwd();
let cached;
let developmentStamp;
const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, 'data', 'generated', name + '.json'), 'utf8'));
const asArray = (data, key) => Array.isArray(data) ? data : data[key] || [];

export { getAsset };

function state() {
  if (process.env.NODE_ENV === 'development') {
    const files = ['resources','routes','prices','blocks','assets','community'].map(name => path.join(root,'data/generated',name+'.json')).concat(path.join(root,'data/shell.json'));
    const stamp = files.map(file => { try { const info=fs.statSync(file); return info.mtimeMs + ':' + info.size; } catch { return ''; } }).join('|');
    if (stamp !== developmentStamp) { cached = undefined; developmentStamp = stamp; }
  }
  if (cached) return cached;
  const routeData = read('routes');
  const records = asArray(read('resources'), 'records');
  const routes = asArray(routeData, 'routes').filter(isPublicPageRoute);
  const aliases = (routeData.aliases || []).filter(isPublicPageAlias);
  const routesByResource = new Map();
  for (const route of routes) { const list = routesByResource.get(route.resourceId) || []; list.push(route); routesByResource.set(route.resourceId, list); }
  for (const list of routesByResource.values()) list.sort((a,b)=>(a.page||1)-(b.page||1));
  const byId = new Map(records.map((item) => [Number(item.id), item]));
  const byPath = new Map(routes.map((item) => [item.path, item]));
  const children = new Map();
  for (const item of records) {
    const siblings = children.get(Number(item.parentId)) || [];
    siblings.push(item);
    children.set(Number(item.parentId), siblings);
  }
  for (const siblings of children.values()) siblings.sort((a, b) =>
    (a.menuIndex || 0) - (b.menuIndex || 0) || collator.compare(a.title, b.title));
  const prices = Object.fromEntries(asArray(read('prices'), 'tables').map((item) => [item.key, item]));
  const blockData = read('blocks');
  const blocks = Object.fromEntries(asArray(blockData, 'blocks').map((item) => [item.key, item]));
  const assets = Object.fromEntries(asArray(read('assets'), 'assets').map((item) => [item.id, item]));
  const site = JSON.parse(fs.readFileSync(path.join(root, 'data', 'shell.json'), 'utf8'));
  let community = {};
  try { community = read('community'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const alias of aliases) {
    if (!byPath.has(alias.from)) byPath.set(alias.from, {
      path: alias.from, type: 'redirect', redirectTo: alias.to, canonicalPath: alias.to,
    });
  }
  const editorials = records.filter((item)=>item.type === 'editorial' && [16,3343].includes(item.parentId)).sort((a,b)=>publishedTime(b)-publishedTime(a)||a.id-b.id);
  cached = { editorials, routesByResource, records, routes, aliases, byId, byPath, children, prices, blocks, assets, site, community, shared: blockData.shared || {} };
  return cached;
}

export function getRoutes({ includeAliases = true } = {}) {
  const data = state();
  const result = [...data.routes];
  const portableAlias = (value) => process.platform !== 'win32' || !/[<>:"\\|?*\u0000-\u001f]/.test(value);
  if (includeAliases) {
    for (const alias of data.aliases) if (portableAlias(alias.from) && !data.routes.some((route) => route.path === alias.from)) {
      result.push(data.byPath.get(alias.from));
    }
  }
  if (process.env.SITE_BUILD_SCOPE === 'representative') {
    const ids = new Set([1, 2, 4, 5, 6, 8, 13, 16, 18, 20, 21, 23, 148, 178, 620, 682, 686, 2985, 3012, 3343, 3445, 3875, 4082, 4232, 5521, 5531, 5938, 7755, 9261, 9264, 10227, 10563, 10756, 10764, 12932, 12965]);
    const consultationIds = new Set(data.records.filter(item => item.type === 'consultation').slice(0, 3).map(item => item.id));
    return result.filter((route) => ids.has(route.resourceId) || ['reviews-index','consultations-index','order-status'].includes(route.type) || consultationIds.has(route.resourceId) || route.page === 2 && [16, 21, 4082].includes(route.resourceId));
  }
  return result;
}

export function getResource(id) { return state().byId.get(Number(id)); }
export function getSite() { return state().site; }
export function getShellModel() {
  const { site, assets } = state();
  return { site, assets };
}

// Selection affects only static rendering. Sitemap and relation resolution keep
// the complete public inventory, including unchanged routes from the baseline.
export function getRenderRoutes() {
  const routes = getRoutes();
  if (!process.env.SITE_RENDER_PATHS_FILE) return routes;
  const file = path.resolve(root, process.env.SITE_RENDER_PATHS_FILE);
  if (!file.startsWith(path.join(root, '.local') + path.sep)) throw new Error('Render selection must stay in .local.');
  const paths = new Set(JSON.parse(fs.readFileSync(file, 'utf8')).paths);
  const selected = routes.filter(route => paths.has(route.path));
  if (selected.length !== paths.size) throw new Error('A selected render route is missing from the public inventory.');
  return selected;
}

export function recordPageRender(route) {
  if (!process.env.SITE_RENDER_AUDIT_FILE) return;
  const file = path.resolve(root, process.env.SITE_RENDER_AUDIT_FILE);
  if (!file.startsWith(path.join(root, '.local') + path.sep)) throw new Error('Render audit must stay in .local.');
  fs.appendFileSync(file, JSON.stringify({ path: route.path, type: route.type }) + '\n');
}

function publishedTime(item) {
  const value = item.publishedAt;
  return typeof value === 'number' ? value * (value < 1e12 ? 1000 : 1) : Date.parse(value || '') || 0;
}
function ancestorsOf(resource, data) {
  const chain = [];
  const seen = new Set([resource.id]);
  let item = data.byId.get(Number(resource.parentId));
  while (item && !seen.has(item.id)) {
    seen.add(item.id); chain.unshift(item);
    item = data.byId.get(Number(item.parentId));
  }
  return chain;
}
function pageLinks(resourceId, data) {
  return data.routesByResource.get(resourceId) || [];
}

export function getPageModel(pathname) {
  const data = state();
  let route = data.byPath.get(pathname);
  // Static generation can provide URI-encoded catchall segments (commas and
  // Unicode in legacy slugs). Match the public manifest before rendering 404.
  if (!route) {
    try { route = data.byPath.get(decodeURIComponent(pathname)); } catch { /* Invalid URI stays not found. */ }
  }
  if (!route) return null;
  if (route.type === 'redirect') return { route, site: data.site, assets: data.assets };
  const resource = data.byId.get(Number(route.resourceId));
  if (!resource) return null;
  const ancestors = ancestorsOf(resource, data);
  const allChildren = [...(data.children.get(resource.id) || [])];
  const home = data.byId.get(1);
  const breadcrumbs = ancestors.filter((item) => item.id !== 1);
  if (home && resource.id !== 1) breadcrumbs.unshift(home);
  let list = allChildren;
  let size = 0;
  if (resource.templateId === 10) {
    list = allChildren.filter((item) => item.type === 'repair').sort((a, b) => collator.compare(a.title, b.title));
    size = 20;
  } else if ([8, 17].includes(resource.templateId)) {
    list = allChildren.filter((item) => item.type === 'editorial').sort((a, b) => publishedTime(b) - publishedTime(a) || a.id - b.id);
    size = 12;
  }
  const current = route.page || 1;
  const pageRoutes = pageLinks(resource.id, data);
  const total = Math.max(route.pageCount || 1, pageRoutes.length, size ? Math.ceil(list.length / size) : 1);
  const items = pageRoutes.map((item) => ({ page: item.page || 1, path: item.path, current: (item.page || 1) === current }));
  const pagination = { current, total, page: current, pageCount: total, items, links: items,
    prev: items.find((item) => item.page === current - 1)?.path || null,
    next: items.find((item) => item.page === current + 1)?.path || null };
  const children = size ? list.slice((current - 1) * size, current * size) : list;
  const editorials = data.editorials;
  const related = (resource.relatedIds || []).map((id) => data.byId.get(Number(id))).filter(Boolean);
  const galleryIds = [...new Set([resource.imageAssetId, ...(resource.galleryAssetIds || [])].filter(Boolean))];
  return {
    resource, route, site: data.site, assets: data.assets, parent: data.byId.get(Number(resource.parentId)),
    ancestors, breadcrumbs, allChildren, children, versionLinks: allChildren.filter((item) => item.type === 'repair'),
    serviceCategories: data.children.get(4) || [],
    priceTable: data.prices[resource.priceKey] || null,
    workBlock: resolveWorkBlock(resource, ancestors, data.blocks),
    shared: data.shared,
    editorialItems: resource.type === 'editorial-index' ? children : editorials.slice(0, 6),
    ...(resource.type === 'editorial-index' ? { editorialFilterItems: list.map(item => editorialCardData(item, data.assets)) } : {}),
    related, pagination,
    community: communityContext(data.community, resource, data.byId),
    gallery: galleryIds.map((id) => getAsset({ assets: data.assets }, id)).filter(Boolean),
  };
}

export function getPageMetadata(model) {
  if (!model) return {};
  const origin = configuredSiteOrigin();
  const canonicalPath = model.route.canonicalPath || model.route.path;
  const canonical = origin ? new URL(basePath + canonicalPath, origin).href : undefined;
  const resource = model.resource;
  return {
    title: resource ? resource.seo?.title || resource.longTitle || resource.title : 'Переход на страницу',
    description: resource?.seo?.description || resource?.description || undefined,
    alternates: canonical ? { canonical } : undefined,
    robots: { index: process.env.SITE_INDEXABLE === 'true' && model.route.type !== 'redirect', follow: process.env.SITE_INDEXABLE === 'true' },
  };
}
