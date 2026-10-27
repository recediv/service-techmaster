import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { communityContext } from '../lib/community-data.mjs';
import { editorialCardData } from '../lib/editorial-data.mjs';
import { isPublicPageRoute, isPublicPageAlias } from '../lib/public-route-policy.mjs';
import { resolveWorkBlock } from '../lib/work-block.mjs';

const PROJECT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VERSION = 1;
const families = {
  home: 'HomeTemplate', contacts: 'ContactsTemplate', editorial: 'EditorialTemplate',
  'editorial-index': 'EditorialIndexTemplate', category: 'CategoryTemplate',
  repair: 'DeviceRepairTemplate', service: 'ServiceDetailTemplate',
  'consultations-index': 'ConsultationsTemplate', consultation: 'ConsultationTemplate',
  'reviews-index': 'ReviewsTemplate', 'order-status': 'OrderStatusTemplate',
};
const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });
const canonical = (value) => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
export const fingerprint = (value) => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex');
const pick = (value, keys) => Object.fromEntries(keys.filter((key) => value?.[key] !== undefined).map((key) => [key, value[key]]));
const list = (value, key) => Array.isArray(value) ? value : value?.[key] || [];
const imageId = (value, editorial = false) => value?.imageAssetId || value?.tvs?.[editorial ? 'articlePic' : 'categoryLogo'];
const link = (item) => item && ({ ...pick(item, ['id', 'path']), label: item.menuTitle || item.title });
const versionLink = (item) => pick(item, ['id', 'path', 'title']);
const device = (item) => ({ ...pick(item, ['id', 'path', 'title']), image: imageId(item) });
const category = (item) => ({ ...link(item), image: imageId(item) });
const editorial = (item, compact = false, showImage = true) => ({
  ...pick(item, ['id', 'path']), title: item.title || item.longTitle,
  date: item.dateLabel || item.publishedAt,
  ...(showImage ? { image: imageId(item, true), imageUrl: item.imageUrl } : {}),
  ...(!compact ? { description: item.description, tags: item.tvs?.tags } : {}),
});
const publishedTime = (item) => typeof item.publishedAt === 'number' ? item.publishedAt * (item.publishedAt < 1e12 ? 1000 : 1) : Date.parse(item.publishedAt || '') || 0;
const portable = (value) => process.platform !== 'win32' || !/[<>:"\\|?*\u0000-\u001f]/.test(value);
const inside = (root, value) => value === root || value.startsWith(root + path.sep);
const readJson = async (file, fallback) => {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
};

async function sourceDependencies(root, entries) {
  const files = new Map(), staticFiles = new Set();
  async function visit(name) {
    const absolute = path.resolve(root, name);
    if (!inside(root, absolute)) throw new Error('Source dependency escaped project.');
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (files.has(relative)) return;
    let text;
    try { text = await fs.readFile(absolute, 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    // The default variant has its own reason group, not a duplicated source hash.
    if (relative === 'data/default-city.json') return;
    files.set(relative, fingerprint(text));
    if (relative.endsWith('.css') && relative !== 'public/legacy/template/style.css') {
      for (const match of text.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) {
        const value = match[1];
        if (/^(?:data:|#|https?:|\/\/)/i.test(value)) continue;
        const dependency = value.startsWith('/') ? path.join(root, 'public', value.slice(1)) : path.resolve(path.dirname(absolute), value);
        if (inside(path.join(root, 'public'), dependency)) staticFiles.add('/' + path.relative(path.join(root, 'public'), dependency).split(path.sep).join('/'));
      }
    }
    // SitePage dispatches eleven families. Traversing all of them here would
    // incorrectly make a family-only edit a shared source dependency.
    if (relative === 'components/TemplateRenderer.jsx' || relative === 'lib/dev-data-watch.mjs') return;
    const imports = [
      ...text.matchAll(/\b(?:import|export)\s+(?:[^;'"\n]*?\sfrom\s*)?["'](\.[^"']+)["']/g),
      ...text.matchAll(/\bimport\s*\(\s*["'](\.[^"']+)["']\s*\)/g),
      ...text.matchAll(/@import\s+["'](\.[^"']+)["']/g),
    ];
    for (const match of imports) {
      const reference = path.resolve(path.dirname(absolute), match[1]);
      const candidates = path.extname(reference) ? [reference] : ['.jsx', '.js', '.mjs', '.css', '.json'].map((ext) => reference + ext);
      for (const candidate of candidates) {
        try { if (!(await fs.stat(candidate)).isFile()) continue; }
        catch { continue; }
        await visit(path.relative(root, candidate)); break;
      }
    }
  }
  for (const name of entries) await visit(name);
  return { files: [...files].sort(([a], [b]) => a.localeCompare(b)), staticFiles: [...staticFiles].sort() };
}

function commonShell(site) {
  const footer = site.footer || {};
  return {
    brand: pick(site.brand, ['name', 'logoUrl']),
    navigation: site.navigation || [], informationNavigation: site.informationNavigation || [],
    headerButtons: (site.headerButtons || []).map((item) => pick(item, ['path', 'className', 'label', 'target', 'rel'])),
    contacts: pick(site.contacts, ['organization', 'address', 'email', 'hours', 'privacyPath', 'socialLinks', 'phone', 'headerTime']),
    footer: {
      ...pick(footer, ['copyright', 'legalName', 'paymentImages']),
      articleItems: (footer.articleItems || []).map((item) => editorial(item, true, true)),
      newsItems: (footer.newsItems || []).map((item) => editorial(item, true, false)),
    },
  };
}

function heading(resource, parent) {
  if (resource.heading) return resource.heading;
  if (resource.templateId === 5) return ['Ремонт', parent?.id === 4082 ? '' : parent?.title || '', resource.title].filter(Boolean).join(' ');
  if (resource.templateId === 10 && resource.id !== 4082) return [parent?.title, resource.title].filter(Boolean).join(' ');
  return resource.title;
}

export async function createBuildSnapshot({ projectRoot = PROJECT, dataDir = path.join(projectRoot, 'data/generated'), shellFile = path.join(projectRoot, 'data/shell.json'), env = process.env } = {}) {
  const root = path.resolve(projectRoot);
  const [resourceData, routeData, priceData, blockData, assetData, site, city, pkg, communityData] = await Promise.all([
    ...['resources', 'routes', 'prices', 'blocks', 'assets'].map((name) => readJson(path.join(dataDir, name + '.json'))),
    readJson(shellFile), readJson(path.join(root, 'data/default-city.json'), null), readJson(path.join(root, 'package.json'), {}),
    readJson(path.join(dataDir,'community.json'), {}),
  ]);
  const records = list(resourceData, 'records'), routes = list(routeData, 'routes').filter(isPublicPageRoute);
  const aliases = (routeData.aliases || []).filter(isPublicPageAlias);
  const byId = new Map(records.map((item) => [item.id, item]));
  const byParent = new Map(), routesById = new Map();
  const prices = new Map(list(priceData, 'tables').map((item) => [item.key, item]));
  const blocks = new Map(list(blockData, 'blocks').map((item) => [item.key, item]));
  const assets = new Map(list(assetData, 'assets').map((item) => [item.id, item]));
  const assetsByUrl = new Map([...assets.values()].map((item) => [item.url, item]));
  for (const record of records) { const children = byParent.get(record.parentId) || []; children.push(record); byParent.set(record.parentId, children); }
  for (const children of byParent.values()) children.sort((a, b) => (a.menuIndex || 0) - (b.menuIndex || 0) || collator.compare(a.title, b.title));
  for (const route of routes) { const pages = routesById.get(route.resourceId) || []; pages.push(route); routesById.set(route.resourceId, pages); }
  for (const pages of routesById.values()) pages.sort((a, b) => (a.page || 1) - (b.page || 1));
  const sharedSources = await sourceDependencies(root, ['app/layout.jsx', 'components/SitePage.jsx', 'components/shell/SiteShell.jsx', 'lib/public-data.mjs', 'lib/public-urls.mjs', 'lib/site-city.mjs', 'scripts/prepare-styles.mjs', 'public/legacy/template/style.css']);
  const familySources = Object.fromEntries(await Promise.all(Object.entries(families).map(async ([type, name]) => [type, await sourceDependencies(root, ['components/templates/' + name + '.jsx'])])));
  const entrySources = await sourceDependencies(root, ['app/page.jsx', 'app/[...slug]/page.jsx', 'app/[[...slug]]/page.jsx']);
  const configSources = await sourceDependencies(root, ['next.config.mjs', 'package-lock.json']);
  const environment = { basePath: env.NEXT_PUBLIC_BASE_PATH || '', origin: env.SITE_ORIGIN || '', indexable: env.SITE_INDEXABLE === 'true', mode: env.NODE_ENV || 'production' };
  const base = env.NEXT_PUBLIC_BASE_PATH || '';
  const fileHashes = new Map();
  async function staticAsset(url) {
    if (fileHashes.has(url)) return fileHashes.get(url);
    let local = url.split(/[?#]/)[0];
    if (base && local.startsWith(base + '/')) local = local.slice(base.length);
    const file = path.resolve(root, 'public', '.' + local);
    if (!inside(path.join(root, 'public'), file)) throw new Error('Static asset escaped public.');
    let result;
    try { const bytes = await fs.readFile(file); result = { url, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }; }
    catch (error) { if (error.code !== 'ENOENT') throw error; result = { url, missing: true }; }
    fileHashes.set(url, result); return result;
  }
  async function assetProjection(value, extraUrls = []) {
    const found = new Map(), urls = new Set(extraUrls);
    function inspect(item) {
      if (typeof item === 'string') {
        const asset = assets.get(item) || assetsByUrl.get(item);
        if (asset) { found.set(asset.id, asset); return; }
        if (/^\/legacy\//.test(item)) urls.add(item);
        for (const match of item.matchAll(/\/(?:media|legacy)\/[^\s"'<>);]+/g)) {
          const url = match[0].replace(/[?#].*$/, '');
          const linked = assetsByUrl.get(url);
          if (linked) found.set(linked.id, linked); else if (url.startsWith('/legacy/')) urls.add(url);
        }
      } else if (Array.isArray(item)) item.forEach(inspect);
      else if (item && typeof item === 'object') Object.values(item).forEach(inspect);
    }
    inspect(value);
    return { media: [...found.values()].sort((a, b) => a.id.localeCompare(b.id)), static: await Promise.all([...urls].sort().map(staticAsset)) };
  }
  const htmlAssets = (projection) => ({ media: projection.media, static: projection.static.map((item) => ({ url: item.url })) });
  const sharedShell = commonShell(site);
  const sharedAssetState = await assetProjection(sharedShell, ['/legacy/favicon.ico', '/legacy/template/images/logotip.png', '/legacy/template/images/logotip.svg', ...sharedSources.staticFiles]);
  const sourceState = { common: sharedSources.files, entries: entrySources.files, config: configSources.files, dependencies: pick(pkg, ['dependencies', 'engines']) };
  const sourceHash = fingerprint(sourceState), envHash = fingerprint(environment), cityHash = fingerprint(city);
  const sharedAssetHash = fingerprint(htmlAssets(sharedAssetState));
  const familyHashes = Object.fromEntries(Object.entries(familySources).map(([type, value]) => [type, fingerprint(value.files)]));
  const priceHashes = new Map([...prices].map(([key, value]) => [key, fingerprint(value)]));
  const blockHashes = new Map([...blocks].map(([key, value]) => [key, fingerprint(value)]));
  const shellVariants = new Map();
  const allCssAssets = await assetProjection(null, [...sharedSources.staticFiles, ...Object.values(familySources).flatMap((item) => item.staticFiles)]);
  const rendererGeneration = fingerprint({ version: VERSION, ...sourceState, families: Object.fromEntries(Object.entries(familySources).map(([type, value]) => [type, value.files])), cssAssets: allCssAssets, basePath: base, compiler: { node: process.version, platform: process.platform, arch: process.arch } });
  const state = { schemaVersion: VERSION, rendererGeneration, routes: {}, artifacts: {}, sharedAssets: {} };
  const sortedLists = new Map();
  for (const resource of records) {
    const children = byParent.get(resource.id) || [];
    sortedLists.set(resource.id, resource.templateId === 10 ? children.filter((item) => item.type === 'repair').sort((a, b) => collator.compare(a.title, b.title))
      : [8, 17].includes(resource.templateId) ? children.filter((item) => item.type === 'editorial').sort((a, b) => publishedTime(b) - publishedTime(a) || a.id - b.id) : children);
  }
  for (const route of routes) {
    const resource = byId.get(route.resourceId);
    if (!resource || !families[resource.type]) throw new Error('Invalid public route/resource contract.');
    const type = resource.type, parent = byId.get(resource.parentId);
    const isCatalog = ['category', 'repair', 'service'].includes(type);
    const usesDirections = isCatalog || ['home', 'contacts'].includes(type);
    const ancestors = [], seen = new Set([resource.id]);
    let ancestor = parent;
    while (ancestor && !seen.has(ancestor.id)) { seen.add(ancestor.id); ancestors.unshift(ancestor); ancestor = byId.get(ancestor.parentId); }
    const own = {
      ...pick(resource, ['id', 'path', 'type', 'templateId', 'title']),
      metadata: { title: resource.seo?.title || resource.longTitle || resource.title, description: resource.seo?.description || resource.description },
      ...(type !== 'repair' ? { contentHtml: resource.contentHtml } : {}),
      ...(type === 'editorial' ? { editorialKind: resource.editorialKind } : {}),
      ...(isCatalog ? { heading: heading(resource, parent) } : {}),
      ...(type === 'repair' ? { partsShopUrl: resource.partsShopUrl } : {}),
      ...(type === 'consultation' ? pick(resource, ['authorName','publishedAt','dateLabel','answerHtml','consultationMeta']) : {}),
      ...(type === 'category' ? { priceHeading: resource.priceHeading || 'Цены на ' + heading(resource, parent) } : {}),
      ...(type === 'home' ? { title: site.home?.title || resource.longTitle || resource.title, introHtml: site.home?.introHtml || resource.introHtml } : {}),
    };
    const allChildren = byParent.get(resource.id) || [], ordered = sortedLists.get(resource.id) || [];
    const page = route.page || 1, pageSize = resource.templateId === 10 ? 20 : [8, 17].includes(resource.templateId) ? 12 : 0;
    const visible = pageSize ? ordered.slice((page - 1) * pageSize, page * pageSize) : ordered;
    const pages = routesById.get(resource.id) || [];
    const pagination = pageSize ? { current: page, total: Math.max(route.pageCount || 1, pages.length, Math.ceil(ordered.length / pageSize)), items: pages.map((item) => pick(item, ['path', 'page'])) } : null;
    const lists = {
      ...(type === 'category' ? {
        categories: visible.filter((item) => item.templateId !== 5 && item.type !== 'repair').map(category),
        ...(resource.templateId === 10 ? { versions: allChildren.filter((item) => item.templateId === 5 || item.type === 'repair').map(versionLink), devices: visible.filter((item) => item.templateId === 5 || item.type === 'repair').map(device), pagination } : {}),
      } : {}),
      ...(type === 'editorial-index' ? { editorials: visible.map((item) => editorial(item)), tagFilterItems: ordered.map(item => editorialCardData(item, assets)), pagination } : {}),
      ...(isCatalog ? { related: (resource.relatedIds || []).map((id) => byId.get(id)).filter(Boolean).map(link) } : {}),
    };
    const context = communityContext(communityData, resource, byId);
    const panels = ['home','repair'].includes(type) || type === 'category' && resource.templateId === 10;
    const community = {
      ...(panels ? {
        consultations: context.homeConsultations.map(item => pick(item,['id','title','authorName','publishedAt','dateLabel','questionHtml','deviceContext','answerHtml','answerAt','comments'])),
        reviews: context.homeReviews.map(item => pick(item,['id','textHtml','authorName','publishedAt','dateLabel'])),
      } : {}),
      ...(['repair','service'].includes(type) ? { solutions: context.relatedConsultations.map(item => pick(item,['id','path','title'])) } : {}),
      ...(type === 'category' && resource.templateId !== 10 || type === 'reviews-index' ? { reviews: context.reviews, types: context.filters.types } : {}),
      ...(type === 'consultations-index' ? { initial: context.initialConsultations, total: context.consultationCount, types: context.filters.types, jsonUrl: context.consultationsJsonUrl } : {}),
      ...(type === 'consultation' ? { metadata: context.question?.metadataHtml, question: {
        ...pick(context.question,['title','authorName','publishedAt','dateLabel','questionHtml','answerHtml','typeIds','vendorIds','modelIds']),
        comments: (context.question?.comments || []).map(item => pick(item,['id','parentId','authorName','publishedAt','dateLabel','textHtml'])),
      }, labels: {
        types: context.filters.types.filter(item => (context.question?.typeIds || []).includes(item.id)),
        vendors: context.filters.vendors.filter(item => (context.question?.vendorIds || []).includes(item.id)),
        models: context.filters.models.filter(item => (context.question?.modelIds || []).includes(item.id)),
      }, types: context.filters.types, jsonUrl: context.consultationsJsonUrl } : {}),
      ...(type === 'order-status' ? { status: context.status } : {}),
    };
    const images = type === 'repair' ? [...new Set([resource.imageAssetId, ...(resource.galleryAssetIds || [])].filter(Boolean))] : type === 'service' ? [imageId(resource)].filter(Boolean) : [];
    const shellKey = type + ':' + resource.templateId;
    let shellVariant = shellVariants.get(shellKey);
    if (!shellVariant) {
      const shell = {
      ...(usesDirections ? { directions: pick(site.home, ['recommendationsTitle', 'recommendations']) } : {}),
      ...(type === 'home' ? { home: pick(site.home, ['advantages', 'contactPrompt', 'carousels']) } : {}),
      ...(isCatalog ? { serviceIntro: site.serviceIntro } : {}),
      ...(type === 'category' ? { hero: { ...site.categoryHero, ...site.categoryHero?.variants?.[resource.templateId], variants: undefined } } : {}),
      };
      shellVariant = { hash: fingerprint({ common: sharedShell, ...shell }), assets: await assetProjection(shell) };
      shellVariants.set(shellKey, shellVariant);
    }
    const price = isCatalog ? prices.get(resource.priceKey) || null : null;
    const block = resolveWorkBlock(resource, ancestors, blocks);
    const family = familySources[type];
    const localAssets = await assetProjection({ own, images, lists, price, block, community }, family.staticFiles);
    const groups = {
      route: fingerprint(pick(route, ['path', 'resourceId', 'type', 'templateId', 'page', 'pageCount', 'canonicalPath'])),
      resource: fingerprint(own), ancestry: fingerprint(type === 'home' ? [] : ancestors.filter((item) => item.path !== '/').map(link)),
      lists: fingerprint(lists), price: price ? priceHashes.get(resource.priceKey) : fingerprint(null), block: block ? blockHashes.get(block.key) : fingerprint(null),
      community: fingerprint(community),
      assets: fingerprint({ shared: sharedAssetHash, shell: htmlAssets(shellVariant.assets), local: htmlAssets(localAssets), imageOrder: images.filter((id) => assets.has(id) || typeof id === 'string' && id.startsWith('/')) }),
      shell: shellVariant.hash, city: cityHash, environment: envHash,
      sharedSources: sourceHash, familySources: familyHashes[type],
    };
    if (state.routes[route.path]) throw new Error('Duplicate public route.');
    state.routes[route.path] = { path: route.path, resourceId: resource.id, type, groups, fingerprint: fingerprint(groups) };
  }
  for (const alias of aliases) {
    if (!portable(alias.from) || state.routes[alias.from]) continue;
    const groups = { route: fingerprint(alias), environment: envHash, sharedSources: sourceHash, shell: fingerprint(sharedShell), assets: sharedAssetHash };
    state.routes[alias.from] = { path: alias.from, type: 'redirect', groups, fingerprint: fingerprint(groups) };
  }
  // Static file updates are independent of HTML rendering. An unused new media
  // file or a fixed-URL logo edit must be copied without rendering every page.
  for (const asset of assets.values()) {
    const hash = fingerprint({ url: asset.url, bytes: asset.bytes, contentHash: asset.sha256 || path.posix.basename(asset.url, path.posix.extname(asset.url)) });
    state.sharedAssets[asset.url] = { path: asset.url.slice(1), url: asset.url, bytes: asset.bytes, groups: { content: hash }, fingerprint: hash };
  }
  async function publicStatics(directory) {
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) throw new Error('Public static symlinks are not allowed.');
      const full = path.join(directory, entry.name);
      const url = '/' + path.relative(path.join(root, 'public'), full).split(path.sep).join('/');
      if (entry.isDirectory()) { if (url !== '/media') await publicStatics(full); continue; }
      if (!/\.(?:css|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|eot|bmp|json|hdr)$/i.test(entry.name) && url !== '/assets/hero/ASSET-SOURCES.txt') throw new Error('Unexpected public static file type: ' + url);
      const asset = await staticAsset(url);
      state.sharedAssets[url] = { path: url.slice(1), url, bytes: asset.bytes, groups: { content: asset.sha256 }, fingerprint: asset.sha256 };
    }
  }
  await publicStatics(path.join(root, 'public'));
  const artifactGroups = {
    'sitemap.xml': { routes: fingerprint(routes.map((item) => item.path).sort()), environment: fingerprint(pick(environment, ['origin', 'basePath'])), source: fingerprint((await sourceDependencies(root, ['app/sitemap.js'])).files) },
    'robots.txt': { environment: envHash, source: fingerprint((await sourceDependencies(root, ['app/robots.js'])).files) },
    '.htaccess': { aliases: fingerprint(aliases), base: fingerprint(base), source: fingerprint((await sourceDependencies(root, ['scripts/finalize-export.mjs'])).files) },
    '404.html': { shell: fingerprint(sharedShell), sources: fingerprint((await sourceDependencies(root, ['app/not-found.jsx', 'app/layout.jsx'])).files), assets: fingerprint(htmlAssets(sharedAssetState)), city: cityHash, environment: envHash },
  };
  for (const [name, groups] of Object.entries(artifactGroups)) state.artifacts[name] = { path: name, groups, fingerprint: fingerprint(groups) };
  return state;
}

export function diffBuildSnapshots(previous, next) {
  const plan = { schemaVersion: VERSION, baselineAvailable: !!previous, rendererGeneration: next.rendererGeneration, previousRendererGeneration: previous?.rendererGeneration || null, rendererChanged: !!previous && previous.rendererGeneration !== next.rendererGeneration, counts: {}, reasonCounts: {}, new: [], changed: [], deleted: [], unchanged: [], renderSet: { paths: [] }, artifacts: { new: [], changed: [], deleted: [], unchanged: [] }, staticUpdates: { new: [], changed: [], deleted: [], unchanged: [] } };
  const reason = (code) => { plan.reasonCounts[code] = (plan.reasonCounts[code] || 0) + 1; };
  const classify = (before, after, target, countReasons) => {
    for (const key of Object.keys(after).sort()) {
      const item = after[key], old = before?.[key];
      const entry = pick(item, ['path', 'resourceId', 'type', 'url', 'bytes']);
      if (!old) { target.new.push({ ...entry, reasons: ['new'] }); if (countReasons) reason('new'); }
      else if (old.fingerprint === item.fingerprint && previous.schemaVersion === VERSION) target.unchanged.push(entry);
      else {
        const reasons = previous.schemaVersion !== VERSION ? ['fingerprint-version'] : Object.keys(item.groups).filter((group) => old.groups?.[group] !== item.groups[group]);
        target.changed.push({ ...entry, reasons }); if (countReasons) reasons.forEach(reason);
      }
    }
    for (const key of Object.keys(before || {}).sort()) if (!after[key]) { target.deleted.push({ ...pick(before[key], ['path', 'resourceId', 'type']), reasons: ['deleted'] }); if (countReasons) reason('deleted'); }
  };
  classify(previous?.routes, next.routes, plan, true);
  classify(previous?.artifacts, next.artifacts, plan.artifacts, false);
  classify(previous?.sharedAssets, next.sharedAssets || {}, plan.staticUpdates, false);
  plan.staticUpdates.paths = [...plan.staticUpdates.new, ...plan.staticUpdates.changed].map((item) => item.path).sort();
  plan.staticUpdates.deletedPaths = plan.staticUpdates.deleted.map((item) => item.path).sort();
  plan.renderSet.paths = [...plan.new, ...plan.changed].map((item) => item.path).sort();
  plan.counts = { new: plan.new.length, changed: plan.changed.length, deleted: plan.deleted.length, unchanged: plan.unchanged.length, render: plan.renderSet.paths.length };
  plan.requiresFullBuild = !previous || plan.rendererChanged;
  plan.nextStateFingerprint = fingerprint(next);
  return plan;
}

async function atomicJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + '.tmp-' + process.pid;
  await fs.writeFile(temp, JSON.stringify(value, null, 2) + '\n');
  await fs.rename(temp, file);
}

export async function commitBuildState(state, { projectRoot = PROJECT, stateFile, expectedFingerprint } = {}) {
  const root = path.resolve(projectRoot);
  const file = path.resolve(root, stateFile || '.local/build-state.json');
  if (!inside(path.join(root, '.local'), file)) throw new Error('Build state must stay in .local.');
  if (state.schemaVersion !== VERSION || !state.rendererGeneration || !state.routes) throw new Error('Cannot commit an invalid build state.');
  if (expectedFingerprint && fingerprint(state) !== expectedFingerprint) throw new Error('Planned state fingerprint changed.');
  await atomicJson(file, state);
}

export async function planBuild({ projectRoot = PROJECT, dataDir, shellFile, stateFile, planFile, dryRun = false, commitState = false, env = process.env } = {}) {
  const root = path.resolve(projectRoot);
  stateFile = path.resolve(root, stateFile || '.local/build-state.json');
  planFile = path.resolve(root, planFile || '.local/build-plan.json');
  for (const file of [stateFile, planFile]) if (!inside(path.join(root, '.local'), file)) throw new Error('Build state and plans must stay in .local.');
  if (dryRun && commitState) throw new Error('Dry-run cannot commit build state.');
  if (commitState && env.SITE_BUILD_SCOPE && env.SITE_BUILD_SCOPE !== 'full') throw new Error('A partial build cannot become the full build baseline.');
  const [previous, next] = await Promise.all([readJson(stateFile, null), createBuildSnapshot({ projectRoot: root, dataDir, shellFile, env })]);
  if (previous && (typeof previous.routes !== 'object' || !previous.rendererGeneration)) throw new Error('Build baseline is invalid.');
  const plan = diffBuildSnapshots(previous, next);
  if (!dryRun) {
    await atomicJson(planFile, plan);
    // Call only after output generation, merge, client inventory and QA succeed.
    if (commitState) await commitBuildState(next, { projectRoot: root, stateFile, expectedFingerprint: plan.nextStateFingerprint });
  }
  return { plan, state: next };
}

async function main() {
  const args = new Map(process.argv.slice(2).map((value) => { const index = value.indexOf('='); return index < 0 ? [value, true] : [value.slice(0, index), value.slice(index + 1)]; }));
  for (const key of args.keys()) if (!['--dry-run', '--commit-state', '--data-dir', '--shell', '--state', '--plan'].includes(key)) throw new Error('Unknown build planning option.');
  const { plan } = await planBuild({ dryRun: args.has('--dry-run'), commitState: args.has('--commit-state'), dataDir: args.get('--data-dir') ? path.resolve(PROJECT, args.get('--data-dir')) : undefined, shellFile: args.get('--shell') ? path.resolve(PROJECT, args.get('--shell')) : undefined, stateFile: args.get('--state'), planFile: args.get('--plan') });
  console.log('Build plan: ' + JSON.stringify({ ...pick(plan, ['baselineAvailable', 'rendererGeneration', 'rendererChanged', 'requiresFullBuild', 'counts', 'reasonCounts']), dryRun: args.has('--dry-run') }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(() => { console.error('Build planning failed. No source data logged.'); process.exitCode = 1; });
