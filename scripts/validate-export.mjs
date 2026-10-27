import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { isPublicPageRoute, isPublicPageAlias } from '../lib/public-route-policy.mjs';

// Only local artifacts are read. Reports contain technical paths/IDs, never bodies,
// external URLs, query strings, credentials, or matched private source fragments.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const options = new Map(process.argv.slice(2).map((item) => {
  const split = item.indexOf('=');
  return split < 0 ? [item, true] : [item.slice(0, split), item.slice(split + 1)];
}));
for (const key of options.keys()) if (!['--output', '--base-path', '--scope', '--http-origin', '--report', '--route-paths-file'].includes(key)) throw new Error('Unknown export validation option.');
const output = path.resolve(root, options.get('--output') || process.env.SITE_OUTPUT_DIR || 'out');
if (!output.startsWith(root + path.sep)) throw new Error('Export output must be inside the project.');
const base = options.get('--base-path') ?? process.env.NEXT_PUBLIC_BASE_PATH ?? '';
if (base && !/^\/(?:[a-z0-9_-]+\/?)+$/i.test(base) || base.endsWith('/')) throw new Error('Invalid export base path.');
const scope = options.get('--scope') || 'full';
if (!['full', 'existing'].includes(scope)) throw new Error('Use full or existing scope.');
const reportFile = path.resolve(root, options.get('--report') || '.local/export-validation.json');
if (!reportFile.startsWith(path.join(root, '.local') + path.sep)) throw new Error('Reports must stay in .local.');
const caseInsensitiveAliases = new Set(['/services/remont-apple/', '/services/remont-iphone/iphone/', '/services/remont-avtoelektroniki/']);
const issues = new Map();
const report = { schemaVersion: 1, scope, complete: false, basePath: base, output: path.relative(root, output).split(path.sep).join('/'), statistics: {} };
const stats = report.statistics;
const fail = (code, owner = 'global') => {
  const item = issues.get(code) || { count: 0, examples: [] };
  item.count++;
  if (item.examples.length < 8 && !item.examples.includes(owner)) item.examples.push(owner);
  issues.set(code, item);
};
const backend = /<\?php\b|\b(?:CREATE\s+TABLE|INSERT\s+INTO|DROP\s+TABLE|LOCK\s+TABLES)\b|(?:api[_-]?key|database_password|client_secret|access_token)\s*[:=]\s*["'][^"']{5,}/i;
const fileSet = new Set();
const htmlFiles = [];
const cssFiles = [];
const textFiles = [];
const pageIds = new Map();
const fragmentRefs = new Map();
const checkedReferences = new Set();
const repeatedRootReferences = new Set();
const readJson = async (name) => JSON.parse(await fs.readFile(path.join(root, 'data/generated', name + '.json'), 'utf8'));
const relative = (value) => path.relative(output, value).split(path.sep).join('/');
const routeFile = (value) => value === '/' ? 'index.html' : value.slice(1) + 'index.html';
const routeFromFile = (value) => value === 'index.html' ? '/' : value.endsWith('/index.html') ? '/' + value.slice(0, -10) : '/' + value;
const portable = (value) => process.platform !== 'win32' || !/[<>:"\\|?*\u0000-\u001f]/.test(value);
const withBase = (value) => base + value;
const escapeRule = (value) => value.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
const origin = 'http://export.invalid';
const configuredOrigin = process.env.SITE_ORIGIN ? new URL(process.env.SITE_ORIGIN).origin : null;
let canonicalPaths, canonicalRoutes, aliasMap, auditedPaths, selectedPaths;
const payloadOwner = (name) => {
  const parts = name.split('/');
  const marker = parts.findIndex((part) => part.startsWith('__next.'));
  const directories = marker < 0 ? parts.slice(0, -1) : parts.slice(0, marker);
  return '/' + (directories.length ? directories.join('/') + '/' : '');
};

async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) { fail('symlink-in-export', relative(full)); continue; }
    if (entry.isDirectory()) { await walk(full); continue; }
    const name = relative(full);
    fileSet.add(name);
    stats.files++;
    const bytes = (await fs.stat(full)).size;
    stats.bytes += bytes;
    const ext = path.extname(name).toLowerCase();
    const groupKey = name.startsWith('media/') ? 'media' : name.startsWith('legacy/') ? 'legacy' : ext === '.html' ? 'html' : ext === '.txt' && name !== 'robots.txt' ? 'rsc' : ['.js','.mjs'].includes(ext) ? 'javascript' : ext === '.css' ? 'css' : 'other';
    const group = stats.fileGroups[groupKey] ||= { files: 0, bytes: 0 };
    group.files++; group.bytes += bytes;
    const allowed = new Set(['.html', '.txt', '.xml', '.css', '.js', '.mjs', '.json', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.bmp', '.hdr']);
    if (!['.htaccess', '.nojekyll'].includes(name) && (!allowed.has(ext) || name.split('/').some((part) => part.startsWith('.')))) fail('nonpublic-export-file', name);
    if (ext === '.hdr' && !/^#\?(?:RADIANCE|RGBE)\r?\n/.test((await fs.readFile(full)).subarray(0, 32).toString('ascii'))) fail('invalid-hdr-asset', name);
    if (/(?:^|\/)(?:core|manager|connectors|private|raw-export|data|node_modules|public_html|\.git|\.env)(?:\/|$)|(?:^|\/)(?:config\.(?:inc|core)\.php|composer\.lock|package-lock\.json)$/i.test(name)) fail('private-export-path', name);
    if (ext === '.html') htmlFiles.push(name);
    if (ext === '.css') cssFiles.push(name);
    if (['.js', '.mjs', '.json', '.txt', '.xml', '.svg'].includes(ext)) textFiles.push(name);
  }
}

function reference(value, owner, kind = 'link') {
  if (!value || value.startsWith('#') && kind !== 'link') return;
  // A root-relative reference has the same target on every page. Check it once;
  // shared menus otherwise repeat millions of identical URL parses in full QA.
  const rootRelative = value.startsWith('/') && !value.startsWith('//');
  if (rootRelative) {
    stats.references++;
    const key = kind + ':' + value;
    if (repeatedRootReferences.has(key)) return;
    repeatedRootReferences.add(key);
  }
  if (/^(?:data:|blob:)/i.test(value)) {
    if (kind === 'link') fail('active-link-protocol', owner);
    return;
  }
  if (/^(?:tel:|mailto:)/i.test(value) && kind === 'link') return;
  let url;
  try { url = new URL(value, origin + withBase(owner)); } catch { fail('invalid-reference', owner); return; }
  if (!['http:', 'https:'].includes(url.protocol)) { fail('active-reference-protocol', owner); return; }
  if (url.origin !== origin && url.origin !== configuredOrigin) {
    if (kind !== 'link') fail('external-runtime-reference', owner);
    stats.externalLinks++;
    return;
  }
  if (url.username || url.password || /[\\\u0000-\u001f]/.test(url.pathname)) { fail('unsafe-reference', owner); return; }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { fail('invalid-encoded-reference', owner); return; }
  if (base) {
    if (!pathname.startsWith(base + '/')) { fail('reference-missing-base-path', owner); return; }
    pathname = pathname.slice(base.length);
  }
  if (kind === 'link' && aliasMap.has(pathname)) fail('internal-link-uses-alias', owner);
  const lookup = pathname.endsWith('/') ? pathname.slice(1) + 'index.html' : pathname.slice(1);
  const exists = fileSet.has(lookup);
  const isExpectedMissing = scope === 'existing' && (canonicalPaths.has(pathname) || aliasMap.has(pathname)) && !auditedPaths.has(pathname);
  const key = kind + ':' + pathname;
  if (!rootRelative) stats.references++;
  if (!exists && !isExpectedMissing && !checkedReferences.has(key)) fail('missing-' + (kind === 'link' ? 'link-target' : 'runtime-asset'), owner + ' -> ' + pathname);
  checkedReferences.add(key);
  if (url.hash && kind === 'link' && exists && lookup.endsWith('.html')) {
    let id;
    try { id = decodeURIComponent(url.hash.slice(1)); } catch { fail('invalid-fragment', owner); return; }
    if (id) {
      const fragments = fragmentRefs.get(lookup) || new Map();
      if (!fragments.has(id)) fragments.set(id, owner);
      fragmentRefs.set(lookup, fragments);
    }
  }
}

function inspectCss(css, owner) {
  for (const match of css.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) reference(match[1], owner, 'asset');
  for (const match of css.matchAll(/@import\s+["']([^"']+)["']/g)) reference(match[1], owner, 'asset');
}

async function inspectHtml(name) {
  const html = await fs.readFile(path.join(output, name), 'utf8');
  const owner = routeFromFile(name);
  if (backend.test(html)) fail('backend-source-in-html', owner);
  const $ = cheerio.load(html);
  const canonical = canonicalPaths.has(owner);
  const alias = aliasMap.get(owner);
  if (canonical) {
    stats.canonicalHtml++;
    const pageType = canonicalRoutes.get(owner)?.type;
    if (pageType === 'order-status') {
      const widget = $('#livesklad-widget[data-status-widget-src]');
      if (widget.find('.site-status-widget__enhanced > iframe.site-status-widget__frame').length !== 1 || !/^https:\/\/my\.livesklad\.com\/static\/widget\.html\?/.test(widget.attr('data-status-widget-src') || '')) fail('missing-status-widget', owner);
    } else if ($('h1,[role="heading"][aria-level="1"]').length !== 1) fail('canonical-h1-count', owner);
    if (!$('title').text().trim()) fail('missing-page-title', owner);
    if (!$('main').length) fail('missing-main-content', owner);
    if (!fileSet.has(name.replace(/\.html$/, '.txt'))) fail('missing-client-route-payload', owner);
    const expected = withBase(owner);
    const canonicalLinks = $('link[rel="canonical"]');
    if (configuredOrigin && canonicalLinks.length !== 1) fail('missing-canonical', owner);
    canonicalLinks.each((_, element) => {
      try {
        const url = new URL($(element).attr('href'), origin);
        if (decodeURIComponent(url.pathname) !== expected || url.search || url.hash) fail('wrong-canonical-path', owner);
      } catch { fail('invalid-canonical', owner); }
    });
  } else if (alias) {
    stats.aliasHtml++;
    const refresh = $('meta[http-equiv="refresh" i]').attr('content') || '';
    if (refresh !== '0;url=' + withBase(alias)) fail('alias-fallback-target', owner);
    const destination = $('main.site-not-found a[href]').first().attr('href');
    if (destination !== withBase(alias)) fail('alias-fallback-link', owner);
  } else if (!['404.html', '404/index.html', '_not-found/index.html'].includes(name)) fail('unexpected-html-page', owner);
  if ($('textarea,frame,object,embed,base').length) fail('forbidden-markup', owner);
  $('form').each((_, element) => {
    const form = $(element), search = form.hasClass('consultation-explorer__search') && element.attribs.role === 'search' && form.closest('.consultation-explorer').length;
    const filters = element.attribs.id === 'form-filter' && form.hasClass('consultation-explorer__facet-fields');
    if ((!search && !filters) || element.attribs.action || form.find('textarea,input[type="email"],input[type="tel"],input[type="password"]').length) fail('unexpected-submission-form', owner);
  });
  $('input').each((_, element) => {
    const field = $(element), a = element.attribs;
    const query = a.name === 'query' && ['text','search'].includes(a.type) && field.closest('.search_consultations,.consultation-explorer__search').length;
    const select = field.closest('.consultation-facet').length && (a.type === 'text' && a.role === 'combobox' && field.hasClass('facet-select__input') || a.type === 'hidden' && ['type','vendor','model','serviceid','device-model'].includes(a.name));
    if (!query && !select) fail('unexpected-input', owner);
  });
  $('iframe').each((_, element) => {
    const frame = $(element), widget = frame.closest('#livesklad-widget[data-status-widget-src]');
    const pending = !element.attribs.src && !element.attribs.id && frame.hasClass('site-status-widget__frame') && frame.closest('.site-status-widget__enhanced').length;
    const loaded = element.attribs.id === 'widget_iframe' && element.attribs.src === widget.attr('data-status-widget-src');
    if (canonicalRoutes.get(owner)?.type !== 'order-status' || widget.length !== 1 || !/^https:\/\/my\.livesklad\.com\/static\/widget\.html\?/.test(widget.attr('data-status-widget-src') || '') || (!pending && !loaded)) fail('unexpected-frame', owner);
  });
  const visible = $.root().clone();
  visible.find('script,style').remove();
  const visibleText = visible.text();
  if (/демонстрационн|пример\s+отзыва|(?:^|\s)демо(?:\s|$)/iu.test(visibleText)) fail('demo-copy', owner);
  if (/\[\[[\s\S]*?\]\]/.test(visibleText)) fail('unresolved-modx-tag', owner);
  const ids = new Set();
  $('*').each((_, element) => {
    const attributes = element.attribs || {};
    if (attributes.id) {
      if (ids.has(attributes.id)) fail('duplicate-html-id', owner);
      ids.add(attributes.id);
    }
    for (const [attribute, value] of Object.entries(attributes)) {
      if (/^on/i.test(attribute) || ['srcdoc', 'formaction'].includes(attribute)) fail('active-html-attribute', owner);
      if (['src', 'poster'].includes(attribute) && !(element.name === 'iframe' && element.attribs.id === 'widget_iframe' && canonicalRoutes.get(owner)?.type === 'order-status' && /^https:\/\/my\.livesklad\.com\/static\/widget\.html\?/.test(value))) reference(value, owner, 'asset');
      if (attribute === 'href' && element.name !== 'link') reference(value, owner);
      if (attribute === 'href' && element.name === 'link' && ['preconnect', 'dns-prefetch'].includes(attributes.rel)) {
        // A connection hint addresses an origin, not an exported file. Next
        // emits href="/" for a relative assetPrefix even in a prefix build.
        try {
          const target = new URL(value, origin);
          if (target.origin !== origin && target.origin !== configuredOrigin) fail('external-runtime-reference', owner);
        } catch { fail('invalid-connection-hint', owner); }
      } else if (attribute === 'href' && element.name === 'link' && !['canonical', 'alternate'].includes(attributes.rel)) reference(value, owner, 'asset');
      if (attribute === 'srcset') for (const item of value.split(',')) reference(item.trim().split(/\s+/)[0], owner, 'asset');
      if (attribute === 'style') inspectCss(value, owner);
      if (attribute === 'data-src') fail('legacy-lazy-image', owner);
    }
    if (element.name === 'img' && (!attributes.src || /^data:image\/(?:gif|png);/i.test(attributes.src))) fail('missing-real-image-source', owner);
  });
  $('style').each((_, element) => inspectCss($(element).text(), owner));
  pageIds.set(name, ids);
  stats.html++;
  if (stats.html % 2000 === 0) console.log('Audited static HTML pages: ' + stats.html);
}

async function parallel(items, operation, concurrency = 4) {
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < items.length) await operation(items[next++]);
  }));
}

async function httpChecks(routes, aliases) {
  const target = new URL(options.get('--http-origin'));
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || target.pathname !== '/' || target.search || target.hash || target.username || target.password) throw new Error('HTTP probes require a loopback origin without a path.');
  const sample = [];
  const variants = new Set();
  for (const route of routes) {
    const key = route.type + ':' + route.templateId + ':' + (route.page > 1 ? 'paginated' : 'first');
    if (!variants.has(key) && auditedPaths.has(route.path) && (!selectedPaths || selectedPaths.has(route.path))) { sample.push(route.path); variants.add(key); }
  }
  const probes = sample.map((route) => ({ route, status: 200 }));
  for (const alias of aliases) {
    probes.push({ route: alias.from, status: 301, destination: alias.to });
    probes.push({ route: alias.from.slice(0, -1), status: 301, destination: alias.to });
    if (caseInsensitiveAliases.has(alias.from)) probes.push({ route: alias.from.toUpperCase(), status: 301, destination: alias.to });
  }
  probes.push({ route: '/__export_qa_missing_9d137e__/', status: 404 });
  probes.push({ route: '/.env', status: 404 });
  probes.push({ route: '/manager/', status: 404 });
  await parallel(probes, async ({ route, status, destination }) => {
    let response;
    try { response = await fetch(new URL(withBase(route), target), { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(10000) }); }
    catch { fail('http-probe-failed', route); return; }
    stats.httpProbes++;
    if (response.status !== status) fail('http-status-' + response.status + '-expected-' + status, route);
    if (destination && response.headers.get('location') !== withBase(destination)) fail('http-alias-location', route);
    if (status === 200 && !/text\/html/i.test(response.headers.get('content-type') || '')) fail('http-canonical-content-type', route);
  });
  // GET also verifies that a missing resource is the actual static 404 body.
  const missing = await fetch(new URL(withBase('/__export_qa_missing_9d137e__/'), target), { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  const body = Buffer.from(await missing.arrayBuffer());
  const expected = await fs.readFile(path.join(output, '404.html'));
  if (missing.status !== 404 || !body.equals(expected)) fail('http-404-body');
}

async function main() {
  const started = Date.now();
  Object.assign(stats, { files: 0, bytes: 0, fileGroups: {}, html: 0, canonicalHtml: 0, aliasHtml: 0, references: 0, externalLinks: 0, httpProbes: 0, verifiedAssets: 0 });
  const [routesData, assets] = await Promise.all([readJson('routes'), readJson('assets')]);
  const routes = routesData.routes.filter(isPublicPageRoute);
  const aliases = (routesData.aliases || []).filter(isPublicPageAlias);
  canonicalPaths = new Set(routes.map((item) => item.path));
  canonicalRoutes = new Map(routes.map(item => [item.path, item]));
  aliasMap = new Map(aliases.map((item) => [item.from, item.to]));
  if (options.has('--route-paths-file')) {
    const file = path.resolve(root, options.get('--route-paths-file'));
    if (!file.startsWith(path.join(root, '.local') + path.sep)) throw new Error('Route selection must be a local plan.');
    const selection = JSON.parse(await fs.readFile(file, 'utf8'));
    const paths = Array.isArray(selection) ? selection : selection.renderSet?.paths;
    if (!Array.isArray(paths) || paths.some((item) => typeof item !== 'string' || !canonicalPaths.has(item) && !aliasMap.has(item))) throw new Error('Route selection contains an unknown route.');
    selectedPaths = new Set(paths);
    report.inspectionScope = 'selected';
    stats.selectedRoutes = selectedPaths.size;
  } else report.inspectionScope = 'all';
  if ((await fs.lstat(output)).isSymbolicLink()) throw new Error('Export output cannot be a symlink.');
  await walk(output);
  auditedPaths = new Set([...canonicalPaths, ...aliasMap.keys()].filter((route) => portable(route) && fileSet.has(routeFile(route))));
  stats.expectedCanonical = routes.length;
  stats.expectedAliases = aliases.length;
  stats.missingCanonical = routes.filter((item) => !fileSet.has(routeFile(item.path))).length;
  stats.missingPortableAlias = aliases.filter((item) => portable(item.from) && !fileSet.has(routeFile(item.from))).length;
  report.complete = stats.missingCanonical === 0 && stats.missingPortableAlias === 0;
  if (scope === 'full') {
    for (const route of routes) if (!fileSet.has(routeFile(route.path))) fail('missing-canonical-page', route.path);
    for (const alias of aliases) if (portable(alias.from) && !fileSet.has(routeFile(alias.from))) fail('missing-alias-fallback', alias.from);
  }
  if (selectedPaths) for (const route of selectedPaths) if (portable(route) && !fileSet.has(routeFile(route))) fail('missing-selected-page', route);
  for (const name of ['404.html', 'robots.txt', 'sitemap.xml', '.htaccess', '.nojekyll']) if (!fileSet.has(name)) fail('missing-export-control-file', name);
  await parallel(selectedPaths ? htmlFiles.filter((name) => selectedPaths.has(routeFromFile(name)) || ['404.html', '404/index.html', '_not-found/index.html'].includes(name)) : htmlFiles, inspectHtml);
  for (const [name, fragments] of fragmentRefs) {
    // A new link may target an unchanged page. Read only that target's IDs,
    // rather than reparsing every unchanged HTML document during delta QA.
    if (!pageIds.has(name)) {
      const $ = cheerio.load(await fs.readFile(path.join(output, name), 'utf8'));
      pageIds.set(name, new Set($('[id]').toArray().map((element) => element.attribs.id)));
    }
    for (const [id, owner] of fragments) if (!pageIds.get(name)?.has(id)) fail('missing-link-fragment', owner + ' -> ' + routeFromFile(name));
  }
  await parallel(cssFiles, async (name) => inspectCss(await fs.readFile(path.join(output, name), 'utf8'), '/' + name));
  await parallel(textFiles, async (name) => {
    if (selectedPaths && name.endsWith('.txt') && name !== 'robots.txt' && !selectedPaths.has(payloadOwner(name)) && !['/404/', '/_not-found/'].includes(payloadOwner(name))) return;
    const text = await fs.readFile(path.join(output, name), 'utf8');
    if (backend.test(text)) fail('backend-source-in-text', name);
    if (/\.(?:js|css)\.map(?:\s|$)/.test(name)) fail('source-map-in-export', name);
    if (name.endsWith('.svg')) {
      const $ = cheerio.load(text, { xml: true });
      if ($('script,foreignObject,iframe,object,embed').length) fail('active-svg-markup', name);
      $('*').each((_, element) => {
        for (const [key, value] of Object.entries(element.attribs || {})) {
          if (/^on/i.test(key)) fail('active-svg-attribute', name);
          if (/^(?:href|xlink:href)$/i.test(key) && !/^(?:#|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(value)) fail('external-svg-reference', name);
          if (key === 'style') inspectCss(value, '/' + name);
        }
      });
      $('style').each((_, element) => inspectCss($(element).text(), '/' + name));
    }
  });
  await parallel(assets.assets, async (asset) => {
    const name = asset.url.slice(1);
    if (!fileSet.has(name)) { fail('missing-exported-media', asset.id); return; }
    const buffer = await fs.readFile(path.join(output, name));
    const digest = crypto.createHash('sha256').update(buffer).digest('hex');
    const fingerprint = path.posix.basename(asset.url, path.posix.extname(asset.url));
    if (buffer.length !== asset.bytes || digest.slice(0, 24) !== fingerprint || asset.sha256 && digest !== asset.sha256) fail('exported-media-integrity', asset.id);
    stats.verifiedAssets++;
  });
  if (fileSet.has('sitemap.xml')) {
    const $ = cheerio.load(await fs.readFile(path.join(output, 'sitemap.xml'), 'utf8'), { xml: true });
    const listed = new Set();
    $('url > loc').each((_, element) => {
      try {
        const url = new URL($(element).text());
        const route = decodeURIComponent(url.pathname).slice(base.length);
        if (!url.pathname.startsWith(base + '/') || !canonicalPaths.has(route) || url.search || url.hash) fail('invalid-sitemap-route');
        if (listed.has(route)) fail('duplicate-sitemap-route', route);
        listed.add(route);
      } catch { fail('invalid-sitemap-url'); }
    });
    stats.sitemapRoutes = listed.size;
    if (scope === 'full') for (const route of routes) if (!listed.has(route.path)) fail('missing-sitemap-route', route.path);
  }
  if (fileSet.has('.htaccess')) {
    const htaccess = await fs.readFile(path.join(output, '.htaccess'), 'utf8');
    if (!htaccess.split(/\r?\n/).includes('ErrorDocument 404 ' + withBase('/404.html'))) fail('apache-missing-404-rule');
    for (const alias of aliases) {
      const rule = 'RewriteRule ^' + escapeRule(alias.from.replace(/^\/|\/$/g, '')) + '/?$ ' + withBase(alias.to) + ' [R=301,L,NE' + (caseInsensitiveAliases.has(alias.from) ? ',NC' : '') + ']';
      if (!htaccess.split(/\r?\n/).includes(rule)) fail('apache-missing-alias-rule', alias.from);
    }
  }
  if (options.has('--http-origin')) await httpChecks(routes, aliases);
  report.result = issues.size ? 'failed' : report.complete ? 'passed' : 'partial';
  report.issues = Object.fromEntries(issues);
  report.finishedAt = new Date().toISOString();
  report.seconds = (Date.now() - started) / 1000;
  await fs.mkdir(path.dirname(reportFile), { recursive: true });
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  console.log('Static export validation: ' + JSON.stringify(report));
  if (issues.size) process.exitCode = 1;
}

main().catch(() => { console.error('Static export validation could not finish. No source data logged.'); process.exitCode = 1; });
