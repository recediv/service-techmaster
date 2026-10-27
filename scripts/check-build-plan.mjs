import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createBuildSnapshot, diffBuildSnapshots, planBuild, fingerprint } from './plan-build.mjs';

// Isolated, synthetic public DTOs. Never mutate live data/generated or baseline.
const project = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = path.join(project, '.local/planner-fixtures');
const generated = path.join(root, 'data/generated');
const json = async (name, value) => { const file = path.join(root, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(value)); };
const clone = (value) => structuredClone(value);
const resource = (id, parentId, type, templateId, slug, extra = {}) => ({ id, parentId, type, templateId, path: slug, title: 'Public ' + id, heading: 'Heading ' + id, childIds: [], breadcrumbIds: [], relatedIds: [], ...extra });
const assetA = { id: 'aaaaaaaaaaaaaaaaaaaaaaaa.jpg', url: '/media/aaaaaaaaaaaaaaaaaaaaaaaa.jpg', bytes: 100, width: 10, height: 10 };
const fixture = {
  resources: { records: [
    resource(1, 0, 'home', 2, '/'), resource(4, 1, 'category', 6, '/services/', { childIds: [10, 20, 30] }),
    resource(10, 4, 'category', 10, '/services/models/', { childIds: [101], priceKey: 'a' }),
    resource(20, 4, 'category', 10, '/services/other/', { childIds: [201], priceKey: 'b' }),
    resource(30, 4, 'category', 6, '/services/non-models/'),
    resource(101, 10, 'repair', 5, '/services/models/a/', { imageAssetId: assetA.id, priceKey: 'a' }),
    resource(201, 20, 'repair', 5, '/services/other/a/', { priceKey: 'b' }),
    resource(16, 1, 'editorial-index', 8, '/articles/', { childIds: [501] }),
    resource(501, 16, 'editorial', 9, '/articles/a/', { publishedAt: 1000, contentHtml: '<p>Public editorial.</p>' }),
  ] },
  routes: { routes: [], aliases: [{ from: '/old-model/', to: '/services/models/a/', status: 301 }] },
  assets: { assets: [assetA] }, prices: { tables: [{ key: 'a', tabs: [{ id: 'a', columns: ['A'], rows: [{ cells: ['100'] }] }] }, { key: 'b', tabs: [{ id: 'b', columns: ['B'], rows: [{ cells: ['200'] }] }] }] },
  blocks: { blocks: [] }, shell: { brand: { name: 'Public fixture' }, navigation: [], home: { recommendations: [] }, footer: {} },
};
fixture.routes.routes = fixture.resources.records.map((item) => ({ path: item.path, canonicalPath: item.path, resourceId: item.id, type: item.type, templateId: item.templateId }));
async function writeFixture(value) { await Promise.all(['resources', 'routes', 'assets', 'prices', 'blocks', 'community'].map((name) => json('data/generated/' + name + '.json', value[name] || {}))); await json('data/shell.json', value.shell); }
async function snapshot(value) { await writeFixture(value); return createBuildSnapshot({ projectRoot: root, dataDir: generated, env: {} }); }
const paths = (items) => items.map((item) => item.path).sort();
const checks = [];
function checked(name) { checks.push(name); console.log('Build planner fixture passed: ' + name); }
function added(value, item) { value.resources.records.push(item); value.routes.routes.push({ path: item.path, canonicalPath: item.path, resourceId: item.id, type: item.type, templateId: item.templateId }); const parent = value.resources.records.find((entry) => entry.id === item.parentId); if (parent) parent.childIds.push(item.id); }
await json('package.json', { dependencies: { next: 'fixture' } });
await json('data/default-city.json', { resourceId: 344, name: 'Томск', prepositional: 'Томске' });
await fs.mkdir(path.join(root, 'components/templates'), { recursive: true });
await fs.writeFile(path.join(root, 'components/templates/DeviceRepairTemplate.jsx'), 'export default function Repair(){ return null; }');
const logo = path.join(root, 'public/legacy/template/images/logotip.png');
await fs.mkdir(path.dirname(logo), { recursive: true });
await fs.writeFile(logo, 'synthetic logo v1');
const baseline = await snapshot(fixture);
let plan = diffBuildSnapshots(baseline, await snapshot(clone(fixture)));
assert.deepEqual(plan.counts, { new: 0, changed: 0, deleted: 0, unchanged: 10, render: 0 });
assert.equal(plan.requiresFullBuild, false); checked('no-op renders zero');

let next = clone(fixture);
added(next, resource(102, 10, 'repair', 5, '/services/models/b/'));
plan = diffBuildSnapshots(baseline, await snapshot(next));
assert.deepEqual(paths(plan.new), ['/services/models/b/']);
assert.deepEqual(paths(plan.changed), ['/services/models/']);
assert.equal(plan.rendererChanged, false); checked('new leaf changes only its visible parent list');

next = clone(fixture);
added(next, resource(302, 30, 'repair', 5, '/services/non-models/invisible-card/'));
plan = diffBuildSnapshots(baseline, await snapshot(next));
assert.equal(plan.changed.length, 0); assert.equal(plan.new.length, 1); checked('new non-rendered child does not change parent or unrelated pages');

next = clone(fixture);
next.resources.records.find((item) => item.id === 101).contentHtml = '<p>Stored copy unused by original template5.</p>';
plan = diffBuildSnapshots(baseline, await snapshot(next));
assert.deepEqual(paths(plan.changed), []); checked('unused repair copy does not trigger rendering');

next = clone(fixture);
next.resources.records.find((item) => item.id === 101).partsShopUrl = 'https://store.invalid/search/?query=Public+101';
plan = diffBuildSnapshots(baseline, await snapshot(next));
assert.deepEqual(paths(plan.changed), ['/services/models/a/']); checked('actual parts link changes only the repair page');

next = clone(fixture);
next.resources.records.find((item) => item.id === 10).contentHtml = '<p>Changed category copy.</p>';
plan = diffBuildSnapshots(baseline, await snapshot(next));
assert.deepEqual(paths(plan.changed), ['/services/models/']); checked('parent copy change does not invalidate descendants breadcrumbs');

next = clone(fixture);
next.prices.tables[0].tabs[0].rows[0].cells[0] = '150';
plan = diffBuildSnapshots(baseline, await snapshot(next));
assert.deepEqual(paths(plan.changed), ['/services/models/', '/services/models/a/']); checked('price change affects only its consumers');

next = clone(fixture);
next.assets.assets[0].url = '/media/bbbbbbbbbbbbbbbbbbbbbbbb.jpg';
plan = diffBuildSnapshots(baseline, await snapshot(next));
assert.deepEqual(paths(plan.changed), ['/services/models/', '/services/models/a/']); checked('asset change affects only gallery and visible card');

next = clone(fixture);
next.resources.records.find((item) => item.id === 10).priceHeading = 'Changed public price heading';
plan = diffBuildSnapshots(baseline, await snapshot(next));
assert.deepEqual(paths(plan.changed), ['/services/models/']); checked('category price heading is a rendered dependency');

let galleryFixture = clone(fixture);
galleryFixture.assets.assets.push({ ...assetA, id: 'bbbbbbbbbbbbbbbbbbbbbbbb.jpg', url: '/media/bbbbbbbbbbbbbbbbbbbbbbbb.jpg' }, { ...assetA, id: 'cccccccccccccccccccccccc.jpg', url: '/media/cccccccccccccccccccccccc.jpg' });
galleryFixture.resources.records.find((item) => item.id === 101).galleryAssetIds = ['bbbbbbbbbbbbbbbbbbbbbbbb.jpg', 'cccccccccccccccccccccccc.jpg'];
const galleryBaseline = await snapshot(galleryFixture);
galleryFixture.resources.records.find((item) => item.id === 101).galleryAssetIds.reverse();
plan = diffBuildSnapshots(galleryBaseline, await snapshot(galleryFixture));
assert.deepEqual(paths(plan.changed), ['/services/models/a/']); checked('gallery order changes detail without changing its parent thumbnail');

next = clone(fixture);
next.assets.assets.push({ id: 'unused.jpg', url: '/media/unused.jpg', bytes: 5 });
plan = diffBuildSnapshots(baseline, await snapshot(next));
assert.equal(plan.counts.render, 0); checked('unused new asset does not invalidate pages');
assert.deepEqual(plan.staticUpdates.paths, ['media/unused.jpg']); checked('unused new media is still copied as a static update');

next = clone(fixture);
next.resources.records = next.resources.records.filter((item) => item.id !== 101);
next.routes.routes = next.routes.routes.filter((item) => item.resourceId !== 101);
plan = diffBuildSnapshots(baseline, await snapshot(next));
assert.deepEqual(paths(plan.deleted), ['/services/models/a/']);
assert.deepEqual(paths(plan.changed), ['/services/models/']); checked('deleted leaf changes only former visible list');

next = clone(fixture);
next.resources.records.find((item) => item.id === 10).title = 'Changed parent label';
plan = diffBuildSnapshots(baseline, await snapshot(next));
assert.deepEqual(paths(plan.changed), ['/services/', '/services/models/', '/services/models/a/']); checked('parent label changes its card and descendant breadcrumb');

next = clone(fixture); next.shell.home.contactPrompt = { title: 'Contact', path: '/services/', label: 'Open' };
plan = diffBuildSnapshots(baseline, await snapshot(next));
assert.deepEqual(paths(plan.changed), ['/']); checked('home-only shell data stays local to home');

next = clone(fixture);
next.shell.navigation = [{ path: '/services/', label: 'Services', children: [{ path: '/services/models/', label: 'Models', children: [{ path: '/services/models/a/', label: 'Deep public item' }] }] }];
plan = diffBuildSnapshots(baseline, await snapshot(next));
assert.equal(plan.changed.length, fixture.resources.records.length + fixture.routes.aliases.length); checked('full SSR deep navigation stays a dependency of canonical and shared-shell alias pages');

await fs.writeFile(logo, 'synthetic logo v2');
plan = diffBuildSnapshots(baseline, await snapshot(fixture));
assert.equal(plan.counts.render, 0); assert.equal(plan.rendererChanged, false);
assert.deepEqual(plan.staticUpdates.paths, ['legacy/template/images/logotip.png']);
assert.equal(plan.artifacts.changed.length, 0); checked('fixed URL logo bytes change only static output without Next or HTML');
await fs.writeFile(logo, 'synthetic logo v1');

let paginated = clone(fixture);
for (let id = 502; id <= 513; id++) added(paginated, resource(id, 16, 'editorial', 9, '/articles/' + id + '/', { publishedAt: 1000 - id }));
Object.assign(paginated.routes.routes.find((item) => item.resourceId === 16), { page: 1, pageCount: 2 });
paginated.routes.routes.push({ path: '/articles/page-2/', canonicalPath: '/articles/page-2/', resourceId: 16, type: 'editorial-index', templateId: 8, page: 2, pageCount: 2 });
const paginationBaseline = await snapshot(paginated);
added(paginated, resource(514, 16, 'editorial', 9, '/articles/oldest/', { publishedAt: 1 }));
plan = diffBuildSnapshots(paginationBaseline, await snapshot(paginated));
assert.deepEqual(paths(plan.changed), ['/articles/', '/articles/page-2/']);
assert.deepEqual(paths(plan.new), ['/articles/oldest/']); checked('older editorial metadata updates its own index tag filter without unrelated pages');

const editorialBodyOnly = clone(paginated);
editorialBodyOnly.resources.records.find(item => item.id === 513).contentHtml = '<p>Changed article body, not its index card.</p>';
plan = diffBuildSnapshots(await snapshot(paginated), await snapshot(editorialBodyOnly));
assert.deepEqual(paths(plan.changed), ['/articles/513/']); checked('article body stays out of index tag-filter dependencies');

paginated = clone(fixture);
for (let id = 502; id <= 524; id++) added(paginated, resource(id, 16, 'editorial', 9, '/articles/' + id + '/', { publishedAt: 1000 - id }));
Object.assign(paginated.routes.routes.find((item) => item.resourceId === 16), { page: 1, pageCount: 2 });
paginated.routes.routes.push({ path: '/articles/page-2/', canonicalPath: '/articles/page-2/', resourceId: 16, type: 'editorial-index', templateId: 8, page: 2, pageCount: 2 });
const fullPagesBaseline = await snapshot(paginated);
added(paginated, resource(525, 16, 'editorial', 9, '/articles/new-page-leaf/', { publishedAt: 1 }));
for (const item of paginated.routes.routes) if (item.resourceId === 16) item.pageCount = 3;
paginated.routes.routes.push({ path: '/articles/page-3/', canonicalPath: '/articles/page-3/', resourceId: 16, type: 'editorial-index', templateId: 8, page: 3, pageCount: 3 });
plan = diffBuildSnapshots(fullPagesBaseline, await snapshot(paginated));
assert.deepEqual(paths(plan.changed), ['/articles/', '/articles/page-2/']);
assert.deepEqual(paths(plan.new), ['/articles/new-page-leaf/', '/articles/page-3/']); checked('new pagination page changes existing pagination controls, not unrelated pages');

const withCommunity = clone(fixture);
added(withCommunity, resource(15, 1, 'consultations-index', 11, '/consultations/'));
const question = (id, publishedAt) => ({ id, path:'/questions/' + id + '/', title:'Public question '+id, authorName:'Иван', publishedAt, questionHtml:'<p>Не работает экран.</p>', answerHtml:'<p>Исходный ответ.</p>', typeIds:[10],vendorIds:[],modelIds:[],comments:[] });
withCommunity.community={schemaVersion:1,consultations:[question(601,'2020-01-01T00:00:00.000Z')],reviews:[],filters:{types:[],vendors:[],models:[]},consultationsJsonUrl:'/community/consultations.json'};
added(withCommunity, resource(601,15,'consultation',13,'/questions/601/',{contentHtml:'<p>Не работает экран.</p>',answerHtml:'<p>Исходный ответ.</p>',consultationMeta:{typeIds:[10],vendorIds:[],modelIds:[]}}));
const communityBaseline=await snapshot(withCommunity);
const newer=clone(withCommunity);
newer.community.consultations.push(question(602,'2021-01-01T00:00:00.000Z'));
added(newer,resource(602,15,'consultation',13,'/questions/602/',{contentHtml:'<p>Не работает экран.</p>',answerHtml:'<p>Исходный ответ.</p>',consultationMeta:{typeIds:[10],vendorIds:[],modelIds:[]}}));
plan=diffBuildSnapshots(communityBaseline,await snapshot(newer));
assert(paths(plan.new).includes('/questions/602/'));
assert(paths(plan.changed).includes('/consultations/'));
assert(paths(plan.unchanged).includes('/questions/601/'));
assert.equal(plan.rendererChanged,false);
checked('new consultation updates its index but preserves the old detail with a stable lazy manifest');
const reply=clone(withCommunity);
reply.community.consultations[0].comments.push({id:91,parentId:0,authorName:'Пётр',publishedAt:'2020-02-01',textHtml:'<p>Уточнение по ремонту.</p>'});
plan=diffBuildSnapshots(communityBaseline,await snapshot(reply));
assert.deepEqual(paths(plan.changed),['/questions/601/']);
checked('a new question comment updates only its own detail');

await writeFixture(fixture);
plan = diffBuildSnapshots(baseline, await createBuildSnapshot({ projectRoot: root, dataDir: generated, env: { NEXT_PUBLIC_BASE_PATH: '/new-prefix' } }));
assert.equal(plan.requiresFullBuild, true); checked('base path changes renderer generation');

await writeFixture(fixture);
await planBuild({ projectRoot: root, env: {}, commitState: true });
const statePath = path.join(root, '.local/build-state.json'), planPath = path.join(root, '.local/build-plan.json');
const before = fingerprint(await fs.readFile(statePath, 'utf8')) + fingerprint(await fs.readFile(planPath, 'utf8'));
const result = await planBuild({ projectRoot: root, env: {}, dryRun: true });
const after = fingerprint(await fs.readFile(statePath, 'utf8')) + fingerprint(await fs.readFile(planPath, 'utf8'));
assert.equal(before, after); assert.equal(result.plan.counts.render, 0); checked('persisted baseline and dry-run make no writes');

await fs.writeFile(path.join(root, 'components/templates/DeviceRepairTemplate.jsx'), 'export default function Repair(){ return <main/>; }');
plan = diffBuildSnapshots(baseline, await createBuildSnapshot({ projectRoot: root, dataDir: generated, env: {} }));
assert.deepEqual(paths(plan.changed), ['/services/models/a/', '/services/other/a/']);
assert.equal(plan.rendererChanged, true); assert.equal(plan.requiresFullBuild, true); checked('family source edit has local reasons and requires safe renderer generation');
await json('data/default-city.json', { resourceId: 344, name: 'Томск', prepositional: 'Томске' });
await fs.writeFile(path.join(root, 'components/templates/DeviceRepairTemplate.jsx'), 'export default function Repair(){ return null; }');
await json('data/default-city.json', { resourceId: 344, name: 'Another public variant', prepositional: 'Variant' });
plan = diffBuildSnapshots(baseline, await createBuildSnapshot({ projectRoot: root, dataDir: generated, env: {} }));
assert.equal(plan.changed.length, fixture.resources.records.length); assert.equal(plan.unchanged.length, 1); checked('default city affects canonical pages and leaves redirect fallback unchanged');
await json('results.json', { passed: checks.length, checks });
console.log('Build planner fixtures: ' + JSON.stringify({ passed: checks.length }));
