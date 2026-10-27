import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as cheerio from 'cheerio';
import { readCommunitySnapshot } from './public-community-source.mjs';
import { redactCommunityContacts } from './public-community-privacy.mjs';
import { prepareCommunityMedia } from './public-community-media.mjs';
import { pruneCommunityPayloads, auditCommunityJsonPrivacy } from './public-community-files.mjs';

const PROJECT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TYPES = { 7: 'reviews-index', 11: 'consultations-index', 13: 'consultation', 14: 'order-status' };
const EMAIL = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const encoded = value => JSON.stringify(value, null, 2) + '\n';
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const ids = value => [...new Set(String(value || '').split(/[,|\s]+/).filter(value => /^[1-9]\d*$/.test(value)).map(Number))];
const rawPublicFields = ['id','parent','template','class_key','uri','pagetitle','longtitle','description','menutitle','menuindex','hidemenu','publishedon','createdon','content','introtext'];

export function cleanCommunityText(value, audit = {}) {
  const $ = cheerio.load(String(value || ''), null, false);
  return redactCommunityContacts($.root().text(), audit).replace(/\[\[[\s\S]*?\]\]/g, '').replace(/\0/g, '').trim();
}
export function cleanCommunityHtml(value, { audit = {}, publicPaths = new Set(), idPaths = new Map(), media = new Map() } = {}) {
  let source = String(value || '').replace(/<\?(?:php|=)[\s\S]*?(?:\?>|$)/gi, '').replace(/\[\[~(\d+)\]\]/g, (_, id) => idPaths.get(Number(id)) || '').replace(/\[\[[\s\S]*?\]\]/g, '');
  const $ = cheerio.load(source, null, false);
  $('script,style,form,input,textarea,button,select,iframe,object,embed,video,audio,source,link,meta').remove();
  const allowed = new Set(['p','br','strong','b','em','i','u','s','del','blockquote','ul','ol','li','a','h2','h3','h4','h5','h6','span','div','table','thead','tbody','tr','th','td','code','pre','hr','img']);
  for (const node of $('*').toArray()) {
    const element = $(node);
    if (!allowed.has(node.tagName)) { element.replaceWith(element.contents()); continue; }
    for (const name of Object.keys(node.attribs || {})) if (!['href','title','colspan','rowspan','src','alt'].includes(name)) element.removeAttr(name);
    if (node.tagName === 'img') {
      const asset = media.get(element.attr('src'));
      if (!asset) { audit.removedUnmappedImages = (audit.removedUnmappedImages || 0) + 1; element.remove(); continue; }
      element.attr('src', asset.url).attr('alt', cleanCommunityText(element.attr('alt'), audit));
      if (asset.width) element.attr('width', String(asset.width)); if (asset.height) element.attr('height', String(asset.height));
    }
    if (node.tagName === 'a') {
      const raw = element.attr('href') || ''; let href = null;
      try {
        const decoded = decodeURIComponent(raw);
        if (!/@|[\u0000-\u001f]/.test(decoded) && redactCommunityContacts(decoded) === decoded) {
          if (decoded.startsWith('#')) href = decoded;
          else if (decoded.startsWith('/') && !decoded.startsWith('//')) {
            const url = new URL(decoded, 'https://public.invalid');
            if (publicPaths.has(url.pathname)) href = url.pathname + url.search + url.hash;
          } else {
            const url = new URL(decoded);
            if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) href = url.href;
          }
        }
      } catch { /* An unrecognized source URL is omitted, never guessed. */ }
      if (href) element.attr('href', href); else element.removeAttr('href');
    }
    for (const name of ['title','alt']) if (element.attr(name)) element.attr(name, cleanCommunityText(element.attr(name), audit));
  }
  const redactNodes = node => {
    if (node.type === 'text') node.data = redactCommunityContacts(node.data, audit);
    for (const child of node.children || []) redactNodes(child);
  };
  redactNodes($.root()[0]);
  source = $.html().trim();
  if (source.match(EMAIL) || /\b(?:on[a-z]+)\s*=|<script\b|mailto:/i.test(source)) throw new Error('Unsafe public community content survived cleaning.');
  return source;
}
function sourcePath(value) {
  if (typeof value !== 'string' || !value || /[\0\\?#]/.test(value)) throw new Error('Invalid public community URI.');
  let result = value.startsWith('/') ? value : '/' + value;
  try { result = decodeURI(result); } catch { throw new Error('Invalid encoded public community URI.'); }
  if (result.includes('//') || result.split('/').some(part => part === '.' || part === '..' || part.startsWith('.'))) throw new Error('Unsafe public community URI.');
  return result.replace(/\/+$/, '') + '/';
}
function epochDate(value) { const number = numeric(value); return number ? new Date(number * 1000).toISOString() : null; }
function sourceDate(value) { return value && value !== '0000-00-00 00:00:00' ? String(value) : null; }
function widgetFromTemplate(content) {
  const key = content.match(/\bapi_key\s*:\s*(['"])([^'"]+)\1/);
  if (!key || !/^[A-Za-z0-9_-]{8,160}$/.test(key[2])) throw new Error('Unrecognized public widget identifier.');
  const options = {};
  for (const name of ['title','placeholder','name_placeholder','button_text','width','height','color','currency']) {
    const value = content.match(new RegExp('\\b' + name + '\\s*:\\s*([\x27\x22])([^\x27\x22]*)\\1'));
    if (value) options[name] = value[2];
  }
  const hidden = content.match(/\bhide_given\s*:\s*(true|false|[01])\b/); if (hidden) options.hide_given = hidden[1] === 'true' || hidden[1] === '1';
  const columns = content.match(/\bcolumns\s*:\s*\[([^\]]+)\]/)?.[1];
  if (columns) options.columns = [...columns.matchAll(/['"]([a-z_]+)['"]/g)].map(match => match[1]);
  return { provider: 'livesklad', publicEmbedId: key[2], embedUrl: 'https://my.livesklad.com/static/widget.html', options };
}
async function writeIfChanged(file, bytes) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  if (await fs.readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; }) === bytes) return false;
  const temporary = file + '.tmp-' + process.pid; await fs.writeFile(temporary, bytes); await fs.rename(temporary, file); return true;
}

export async function importPublicCommunity({ projectRoot = PROJECT, snapshotFile = path.resolve(PROJECT, '../bk/site/ch87453_service.sql'), apply = false } = {}) {
  const generated = path.join(projectRoot, 'data/generated'), resourceFile = path.join(generated, 'resources.json'), routeFile = path.join(generated, 'routes.json'), coverageFile = path.join(generated, 'coverage.json');
  const [resourceBytes, routeBytes, coverageBytes, assetBytes] = await Promise.all([resourceFile, routeFile, coverageFile, path.join(generated, 'assets.json')].map(file => fs.readFile(file, 'utf8')));
  const resources = JSON.parse(resourceBytes), routes = JSON.parse(routeBytes), coverage = JSON.parse(coverageBytes), assets = JSON.parse(assetBytes);
  const source = await readCommunitySnapshot(snapshotFile), { select } = source;
  const audit = { redactedEmails: 0, redactedPhones: 0, removedUnmappedImages: 0 };
  const policyFile = path.join(projectRoot, 'data/community-policy.json');
  const policy = await fs.readFile(policyFile, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return { schemaVersion: 1, resources: [], reviews: [], comments: [] }; throw error; });
  if (policy.schemaVersion !== 1 || ['resources','reviews','comments'].some(key => !Array.isArray(policy[key]) || policy[key].some(row => !Number.isSafeInteger(row.id) || !/^[a-z0-9-]+$/.test(row.reason)))) throw new Error('Invalid reviewed public community moderation policy.');
  const excludedResources = new Map(policy.resources.map(row => [row.id,row.reason])), excludedReviews = new Set(policy.reviews.map(row => row.id)), excludedComments = new Set(policy.comments.map(row => row.id));
  const grouped = new Set(select('modx_document_groups', () => true, ['document']).map(row => Number(row.document)));
  const publicFilter = get => get('published') === '1' && get('deleted') === '0' && get('context_key') === 'web' && get('privateweb') === '0' && !grouped.has(Number(get('id')));
  const creatorResources = new Map();
  const rawPublic = select('modx_site_content', get => {
    if (!publicFilter(get) || !TYPES[Number(get('template'))]) return false;
    if (Number(get('template')) === 13 && numeric(get('createdby'))) {
      const key = get('createdby'); if (!creatorResources.has(key)) creatorResources.set(key, []); creatorResources.get(key).push(Number(get('id')));
    }
    return true;
  }, rawPublicFields);
  const raw = rawPublic.filter(row => !excludedResources.has(Number(row.id)));
  const rawById = new Map(raw.map(row => [Number(row.id), row])), publicResources = select('modx_site_content', publicFilter, ['id','uri','parent','pagetitle']);
  const allPublicIds = new Set(publicResources.map(row => Number(row.id))), idPaths = new Map(publicResources.map(row => [Number(row.id), row.id === '1' ? '/' : '/' + row.uri.replace(/^\/+|\/+$/g, '') + '/']));
  const communityIds = new Set([...rawPublic.map(row => Number(row.id)), ...resources.records.filter(row => TYPES[row.templateId]).map(row => row.id)]), questionIds = new Set(raw.filter(row => Number(row.template) === 13).map(row => Number(row.id)));
  const names = new Map();
  // Join only names already used by the public consultation UI. Authentication
  // identifiers are lookup keys inside this adapter, never selected/output.
  select('modx_user_attributes', get => { const resourceIds = creatorResources.get(get('internalKey')); if (resourceIds) for (const id of resourceIds) names.set(id, cleanCommunityText(get('fullname'), audit)); return false; }, []);
  const publicPaths = new Set([...routes.routes.map(row => row.path), ...raw.map(row => sourcePath(row.uri))]);
  const media = new Map();
  for (const asset of Object.values(assets.assets || assets.records || assets.byId || {})) for (const key of [asset.sourcePath, asset.source, asset.originalUrl, asset.url]) if (key) media.set(key, asset);
  const inlineMedia = await prepareCommunityMedia({ projectRoot, sourceRoot: path.resolve(projectRoot, '../bk/site/public_html'), rows: raw.filter(row => Number(row.template) === 13), manifest: assets });
  for (const [key, value] of inlineMedia.map) media.set(key, value);
  const clean = value => cleanCommunityHtml(value, { audit, publicPaths, idPaths, media });
  const text = value => cleanCommunityText(value, audit);
  const tvRows = select('modx_site_tmplvar_contentvalues', get => questionIds.has(Number(get('contentid'))) && [11,12,13,14,16].includes(Number(get('tmplvarid'))), ['contentid','tmplvarid','value']);
  const tvs = new Map(); for (const row of tvRows) { const id = Number(row.contentid); if (!tvs.has(id)) tvs.set(id, {}); tvs.get(id)[Number(row.tmplvarid)] = row.value; }
  const publicThreads = select('modx_ec_threads', get => allPublicIds.has(Number(get('resource'))), ['id','resource','name']);
  const threadById = new Map(publicThreads.map(row => [Number(row.id), row]));
  const reviews = select('modx_ec_messages', get => get('published') === '1' && get('deleted') === '0' && threadById.has(Number(get('thread'))) && !excludedReviews.has(Number(get('id'))), ['id','thread','user_name','text','reply_text','date','rating','editedon','tags']).map(row => {
    const thread = threadById.get(Number(row.thread));
    return { id: Number(row.id), resourceId: Number(thread.resource), threadKey: text(thread.name), authorName: text(row.user_name), publishedAt: sourceDate(row.date), rating: numeric(row.rating), textHtml: clean(String(row.text || '').replace(/\r?\n/g, '<br>')), replyHtml: clean(String(row.reply_text || '').replace(/\r?\n/g, '<br>')), replyAt: row.reply_text ? sourceDate(row.editedon) : null, tags: String(row.tags || '').split(',').map(text).filter(Boolean) };
  }).sort((a,b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')) || b.id - a.id);
  const ticketThreads = select('modx_tickets_threads', get => get('deleted') === '0' && questionIds.has(Number(get('resource'))), ['id','resource']);
  const ticketById = new Map(ticketThreads.map(row => [Number(row.id), Number(row.resource)]));
  const commentsByQuestion = new Map();
  for (const row of select('modx_tickets_comments', get => get('published') === '1' && get('deleted') === '0' && ticketById.has(Number(get('thread'))) && !excludedComments.has(Number(get('id'))), ['id','thread','parent','name','text','createdon'])) {
    const questionId = ticketById.get(Number(row.thread)); if (!commentsByQuestion.has(questionId)) commentsByQuestion.set(questionId, []);
    commentsByQuestion.get(questionId).push({ id: Number(row.id), parentId: numeric(row.parent), authorName: text(row.name), publishedAt: sourceDate(row.createdon), textHtml: clean(row.text) });
  }
  const consultations = raw.filter(row => Number(row.template) === 13).map(row => {
    const id = Number(row.id), fields = tvs.get(id) || {};
    return { id, path: sourcePath(row.uri), title: text(row.pagetitle), authorName: names.get(id) || '', publishedAt: epochDate(row.publishedon), createdAt: epochDate(row.createdon), questionHtml: clean(row.content), answerHtml: clean(fields[16]), answerAt: null, typeIds: ids(fields[12]), vendorIds: ids(fields[11]), modelIds: ids(fields[13]), tags: String(fields[14] || '').split(',').map(text).filter(Boolean), comments: (commentsByQuestion.get(id) || []).sort((a,b) => String(a.publishedAt || '').localeCompare(String(b.publishedAt || '')) || a.id - b.id) };
  }).sort((a,b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')) || b.id - a.id);
  const existing = resources.records.filter(row => !TYPES[row.templateId]), existingById = new Map(existing.map(row => [row.id, row]));
  // These are the already-reviewed public catalog labels, not author fields.
  // A model number such as 852859.200-01 must never be mistaken for a phone.
  const options = rows => rows.map(row => ({ id: Number(row.id), title: existingById.get(Number(row.id)).title, path: idPaths.get(Number(row.id)), parentId: Number(row.parent) })).sort((a,b) => a.title.localeCompare(b.title, 'ru'));
  const types = options(publicResources.filter(row => Number(row.parent) === 4 && existingById.has(Number(row.id))));
  const typeIds = new Set(types.map(row => row.id)), vendors = options(publicResources.filter(row => typeIds.has(Number(row.parent)) && existingById.has(Number(row.id))));
  const vendorIds = new Set(vendors.map(row => row.id)), models = options(publicResources.filter(row => vendorIds.has(Number(row.parent)) && existingById.has(Number(row.id))));
  const filters = { types, vendors, models };
  const statusTemplate = select('modx_site_templates', get => Number(get('id')) === 14, ['content']);
  if (statusTemplate.length !== 1 || !rawById.has(3352) || !rawById.has(15) || !rawById.has(17)) throw new Error('Required public community shells are missing.');
  const status = { resourceId: 3352, path: sourcePath(rawById.get(3352).uri), aliases: ['/status/'], scriptUrl: 'https://my.livesklad.com/static/widget.js', widget: widgetFromTemplate(statusTemplate[0].content) };
  const community = { schemaVersion: 1, reviews, consultations, filters, status };
  const consultationsJson = encoded({ schemaVersion: 1, consultations, filters }), contentHash = sha(consultationsJson);
  community.consultationsJsonUrl = '/community/consultations.json';
  community.consultationsPayloadUrl = '/community/consultations-' + contentHash.slice(0, 20) + '.json';
  const consultationsManifest = encoded({ schemaVersion: 1, url: community.consultationsPayloadUrl });
  const byConsultation = new Map(consultations.map(row => [row.id, row]));
  const added = raw.map(row => {
    const id = Number(row.id), type = TYPES[Number(row.template)], consultation = byConsultation.get(id);
    const record = { id, parentId: Number(row.parent), templateId: Number(row.template), type, classKey: text(row.class_key), path: sourcePath(row.uri), title: text(row.pagetitle), longTitle: text(row.longtitle), description: text(row.description), menuTitle: text(row.menutitle), menuIndex: numeric(row.menuindex), hidemenu: !!numeric(row.hidemenu), publishedAt: epochDate(row.publishedon), heading: text(row.pagetitle), contentHtml: consultation ? consultation.questionHtml : '', introHtml: consultation ? clean(row.introtext) : '', tvs: {}, galleryAssetIds: [], childIds: id === 15 ? consultations.map(row => row.id) : [], breadcrumbIds: [1, ...(Number(row.parent) && Number(row.parent) !== 1 ? [Number(row.parent)] : [])] };
    record.seo = { title: record.longTitle || record.title, description: record.description };
    if (consultation) Object.assign(record, { authorName: consultation.authorName, createdAt: consultation.createdAt, answerHtml: consultation.answerHtml, answerAt: consultation.answerAt, consultationMeta: { typeIds: consultation.typeIds, vendorIds: consultation.vendorIds, modelIds: consultation.modelIds, tags: consultation.tags } });
    return record;
  }).sort((a,b) => a.id - b.id);
  const newRecords = [...existing, ...added];
  if (new Set(newRecords.map(row => row.id)).size !== newRecords.length || new Set(newRecords.map(row => row.path)).size !== newRecords.length) throw new Error('A restored public resource collides with an existing identity.');
  // Keep all pre-existing resource values, including original child arrays,
  // byte-identical. The restored index owns its new child relation itself.
  const addedRoutes = added.map(row => ({ path: row.path, resourceId: row.id, type: row.type, templateId: row.templateId, canonicalPath: row.path, page: 1, pageCount: 1 }));
  const oldRoutes = routes.routes.filter(row => !communityIds.has(row.resourceId));
  const moderationExcluded = rawPublic.filter(row => excludedResources.has(Number(row.id))).map(row => ({ resourceId: Number(row.id), templateId: Number(row.template), reason: 'community-' + excludedResources.get(Number(row.id)) }));
  const nextRoutes = { ...routes, routes: [...oldRoutes, ...addedRoutes], aliases: [...routes.aliases.filter(row => row.from !== '/status/'), { from: '/status/', to: status.path, status: 301 }], excluded: [...routes.excluded.filter(row => !communityIds.has(row.resourceId)), ...moderationExcluded] };
  if (new Set(nextRoutes.routes.map(row => row.path)).size !== nextRoutes.routes.length || nextRoutes.routes.some(row => row.path === '/status/')) throw new Error('A restored route or status alias collides.');
  const nextResources = { ...resources, records: newRecords };
  const byTemplate = {}; for (const row of newRecords) byTemplate[row.templateId] = (byTemplate[row.templateId] || 0) + 1;
  const nextCoverage = { ...coverage, counts: { ...coverage.counts, resources: newRecords.length, routes: nextRoutes.routes.length, aliases: nextRoutes.aliases.length, excluded: nextRoutes.excluded.length, assets: Object.values(inlineMedia.manifest.assets).length }, byTemplate, privacy: { ...coverage.privacy, ugc: true, authorEmails: false, authorPhones: false, orderRecords: false }, community: { schemaVersion: 1, source: 'reviewed-local-sql-snapshot', sourceSha256: source.sourceSha256, resources: added.length, consultations: consultations.length, reviews: reviews.length, comments: [...commentsByQuestion.values()].reduce((total, rows) => total + rows.length, 0), moderationExcluded: { resources: policy.resources, reviews: policy.reviews, comments: policy.comments }, inlineImageIssues: inlineMedia.issues, ...audit } };
  const before = new Map(resources.records.filter(row => !TYPES[row.templateId]).map(row => [row.id, sha(JSON.stringify(row))]));
  for (const row of existing) if (before.get(row.id) !== sha(JSON.stringify(row))) throw new Error('An existing resource changed during public community projection.');
  const proof = { schemaVersion: 1, source: 'exact-local-sql-snapshot', sourceSha256: source.sourceSha256, existingResourceCount: existing.length, existingResourceProjectionSha256: sha(JSON.stringify(existing)), existingResourcesUnchanged: true, existingRoutesUnchanged: JSON.stringify(oldRoutes) === JSON.stringify(routes.routes.filter(row => !communityIds.has(row.resourceId))), restoredResources: added.length, consultations: consultations.length, reviews: reviews.length, comments: nextCoverage.community.comments, moderationExcluded: nextCoverage.community.moderationExcluded, inlineImages: { added: inlineMedia.additions.map(({id,bytes,width,height,communityResourceId}) => ({id,bytes,width,height,resourceId:communityResourceId})), issues: inlineMedia.issues }, filters: { types: types.length, vendors: vendors.length, models: models.length }, contentJson: { manifestUrl: community.consultationsJsonUrl, url: community.consultationsPayloadUrl, bytes: Buffer.byteLength(consultationsJson), sha256: contentHash }, status: { path: status.path, alias: '/status/', publicWidgetIdentifierPresent: true, publicWidgetIdentifierSha256: sha(status.widget.publicEmbedId) }, sourceModified: false, ...audit, applied: false };
  const communityBytes = encoded(community), serialized = [encoded(nextResources), encoded(nextRoutes), encoded(nextCoverage)];
  if (communityBytes.match(EMAIL)) throw new Error('A public community email survived normalization.');
  if (apply) {
    const current = await Promise.all([resourceFile, routeFile, coverageFile, path.join(generated, 'assets.json')].map(file => fs.readFile(file, 'utf8')));
    if (current.some((value, index) => value !== [resourceBytes, routeBytes, coverageBytes, assetBytes][index])) throw new Error('Existing public inputs changed during projection; rerun after editing ends.');
    const backup = path.join(projectRoot, '.local/public-community-before-' + sha(resourceBytes + routeBytes + coverageBytes).slice(0, 20));
    await fs.mkdir(backup, { recursive: true });
    for (const [index, file] of [resourceFile, routeFile, coverageFile].entries()) await writeIfChanged(path.join(backup, path.basename(file)), [resourceBytes, routeBytes, coverageBytes][index]);
    await writeIfChanged(path.join(backup, 'assets.json'), assetBytes);
    for (const write of inlineMedia.writes) await fs.writeFile(path.join(projectRoot, write.relative), write.bytes, { flag: 'wx' }).catch(async error => { if (error.code !== 'EEXIST' || sha(await fs.readFile(path.join(projectRoot, write.relative))) !== sha(write.bytes)) throw error; });
    await writeIfChanged(path.join(generated, 'assets.json'), encoded(inlineMedia.manifest));
    await writeIfChanged(path.join(projectRoot, 'public', community.consultationsPayloadUrl), consultationsJson);
    await writeIfChanged(path.join(projectRoot, 'public', community.consultationsJsonUrl), consultationsManifest);
    await writeIfChanged(path.join(generated, 'community.json'), communityBytes);
    for (const [index, file] of [resourceFile, routeFile, coverageFile].entries()) await writeIfChanged(file, serialized[index]);
    proof.removedHistoricalPayloads = await pruneCommunityPayloads({ projectRoot, keepUrl: community.consultationsPayloadUrl, backupDirectory: path.join(backup, 'public-community') });
    proof.publicJsonPrivacyAudit = await auditCommunityJsonPrivacy({ projectRoot });
    proof.applied = true; proof.backup = path.relative(projectRoot, backup).split(path.sep).join('/');
  }
  await writeIfChanged(path.join(projectRoot, '.local/public-community-projection-proof.json'), encoded(proof));
  return { proof, community };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2); if (args.some(value => value !== '--apply')) throw new Error('Only --apply is supported. Without it, only the projection proof is written.');
  const { proof } = await importPublicCommunity({ apply: args.includes('--apply') });
  console.log(JSON.stringify(proof));
}
