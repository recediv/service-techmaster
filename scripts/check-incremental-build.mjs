import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Reversible local integration check. The fixture is removed before completion.
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const directory = path.join(root, '.local/qa-incremental');
const resourceFile = path.join(root, 'data/generated/resources.json');
const routeFile = path.join(root, 'data/generated/routes.json');
const fixturePath = '/__qa-incremental-page__/';
const restoreFile = path.join(directory, 'restore.json');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const saveJson = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
const report = { success: false, checks: [] };
await fs.mkdir(directory, { recursive: true });

async function replace(file, buffer) {
  const temporary = file + '.qa-' + process.pid;
  await fs.writeFile(temporary, buffer);
  await fs.rename(temporary, file);
}
async function restoreSources(saved) {
  for (const name of ['resources', 'routes']) {
    const file = path.resolve(root, saved[name]);
    assert(file.startsWith(directory + path.sep), 'Backup escaped the QA directory.');
    await replace(name === 'resources' ? resourceFile : routeFile, await fs.readFile(file));
  }
}
async function build(label) {
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/build.mjs'], {
      cwd: root, windowsHide: true, stdio: 'inherit',
      env: { ...process.env, SITE_BUILD_SCOPE: 'full', NEXT_TELEMETRY_DISABLED: '1' },
    });
    child.on('error', reject);
    child.on('exit', value => resolve(value ?? 1));
  });
  assert.equal(exitCode, 0, label + ' build failed.');
  const result = await readJson(path.join(root, '.local/build-report.json'));
  assert(result.success, label + ' reported failure.');
  await saveJson(path.join(directory, label + '-build.json'), result);
  report.checks.push({ label, mode: result.mode, nextInvocations: result.nextInvocations,
    actualRenderedPaths: result.actualRenderedPaths, planCounts: result.planCounts });
  return result;
}
async function canonicalSnapshot(routes) {
  const files = new Map();
  let cursor = 0;
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (cursor < routes.length) {
      const route = routes[cursor++];
      const folder = path.join(root, 'out', ...route.path.split('/').filter(Boolean));
      const remember = async file => {
        const info = await fs.stat(file);
        files.set(path.relative(path.join(root, 'out'), file).split(path.sep).join('/'),
          { size: info.size, mtime: info.mtimeMs, ino: info.ino });
      };
      const payloads = async directory => {
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) await payloads(file);
          else if (entry.isFile()) await remember(file);
          else throw new Error('Unexpected symbolic link in page payload.');
        }
      };
      for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name.startsWith('__next.')) { await payloads(path.join(folder, entry.name)); continue; }
        if (!entry.isFile() || !/^(?:index\.(?:html|txt)|__next.*\.txt)$/.test(entry.name)) continue;
        await remember(path.join(folder, entry.name));
      }
    }
  }));
  return files;
}
async function assertUnchanged(snapshot) {
  let sameInode = 0;
  const entries = [...snapshot];
  let cursor = 0;
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (cursor < entries.length) {
      const [name, expected] = entries[cursor++];
      const info = await fs.stat(path.join(root, 'out', name));
      assert.equal(info.size, expected.size, 'An old artifact changed size: ' + name);
      assert(Math.abs(info.mtimeMs - expected.mtime) < 1, 'An old artifact was rewritten: ' + name);
      if (info.ino === expected.ino) sameInode++;
    }
  }));
  return { checkedFiles: entries.length, sameInode };
}
async function browserCheck() {
  const target = new URL(process.env.QA_ORIGIN || 'http://127.0.0.1:3000');
  assert(target.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(target.hostname), 'Use a local preview.');
  const require = createRequire(import.meta.url), puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: 'new',
    executablePath: process.env.QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run'] });
  try {
    const page = await browser.newPage();
    let documents = 0;
    const errors = [];
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (['data:', 'blob:'].includes(url.protocol) || url.origin === target.origin) {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++;
        request.continue();
      } else { errors.push('external-request'); request.abort(); }
    });
    page.on('pageerror', () => errors.push('page-error'));
    await page.goto(target.origin + '/', { waitUntil: 'networkidle0' });
    await page.evaluate(() => { window.__incrementalMarker = Math.random(); });
    const marker = await page.evaluate(() => window.__incrementalMarker);
    const initialDocuments = documents;
    // Exercise the site's actual anchor handler without adding a UI dependency.
    await page.evaluate(route => {
      const anchor = document.createElement('a'); anchor.href = route;
      anchor.textContent = 'Перейти'; document.body.append(anchor); anchor.click();
    }, fixturePath);
    await page.waitForFunction(route => location.pathname === route, {}, fixturePath);
    await page.waitForSelector('main h1');
    assert.equal(await page.evaluate(() => window.__incrementalMarker), marker);
    await page.goBack({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => location.pathname === '/');
    assert.equal(await page.evaluate(() => window.__incrementalMarker), marker);
    assert.equal(documents, initialDocuments, 'Old/new navigation reloaded the document.');
    assert.equal(errors.length, 0, 'Browser errors in old/new navigation.');
    return { newDocumentRequests: documents - initialDocuments, windowPreserved: true };
  } finally { await browser.close(); }
}

if (process.argv.includes('--restore')) {
  await restoreSources(await readJson(restoreFile));
  await build('recovery-cleanup');
  await fs.unlink(restoreFile);
  console.log('Incremental QA source restored; temporary route removed.');
} else {
  assert(!process.env.NEXT_PUBLIC_BASE_PATH && !process.env.SITE_OUTPUT_DIR, 'Acceptance check requires the root out.');
  const originalResources = await fs.readFile(resourceFile), originalRoutes = await fs.readFile(routeFile);
  const resources = JSON.parse(originalResources), routes = JSON.parse(originalRoutes);
  assert(!routes.routes.some(item => item.path === fixturePath), 'QA route already exists; restore first.');
  const backup = path.join(directory, 'original-' + Date.now());
  await fs.mkdir(backup);
  await fs.writeFile(path.join(backup, 'resources.json'), originalResources);
  await fs.writeFile(path.join(backup, 'routes.json'), originalRoutes);
  const saved = { resources: path.relative(root, path.join(backup, 'resources.json')), routes: path.relative(root, path.join(backup, 'routes.json')) };
  await saveJson(restoreFile, saved);
  const before = await canonicalSnapshot(routes.routes);
  const sampleNames = ['index.html', 'services/remont-iphone/iphone-16/index.html', 'private-policy/index.html'];
  const sampleHashes = new Map(await Promise.all(sampleNames.map(async name => [name, digest(await fs.readFile(path.join(root, 'out', name)))])));
  let failure;
  try {
    const noop = await build('noop');
    assert.equal(noop.nextInvocations, 0); assert.deepEqual(noop.actualRenderedPaths, []);
    const source = resources.records.find(item => item.type === 'editorial' && item.editorialKind === 'information');
    assert(source, 'Public information page fixture source missing.');
    const fixture = { ...structuredClone(source), id: Math.max(...resources.records.map(item => item.id)) + 1000,
      parentId: 0, path: fixturePath, childIds: [], breadcrumbIds: [1], relatedIds: [] };
    resources.records.push(fixture);
    routes.routes.push({ path: fixturePath, canonicalPath: fixturePath, resourceId: fixture.id,
      type: 'editorial', templateId: fixture.templateId, page: 1, pageCount: 1 });
    await replace(resourceFile, JSON.stringify(resources, null, 2) + '\n');
    await replace(routeFile, JSON.stringify(routes, null, 2) + '\n');
    const added = await build('new-only');
    assert.equal(added.nextInvocations, 1); assert.deepEqual(added.actualRenderedPaths, [fixturePath]);
    assert.equal(added.planCounts.new, 1); assert.equal(added.planCounts.changed, 0);
    const addedHtml = await fs.readFile(path.join(root, 'out', fixturePath.slice(1), 'index.html'), 'utf8');
    const addedHtmlHash = digest(addedHtml);
    report.newOnlyPreserved = await assertUnchanged(before);
    report.browser = await browserCheck();
    fixture.contentHtml += '<span hidden data-incremental-check="changed"></span>';
    await replace(resourceFile, JSON.stringify(resources, null, 2) + '\n');
    const changed = await build('changed-only');
    assert.equal(changed.nextInvocations, 1); assert.deepEqual(changed.actualRenderedPaths, [fixturePath]);
    assert.equal(changed.planCounts.new, 0); assert.equal(changed.planCounts.changed, 1);
    const changedHtml = await fs.readFile(path.join(root, 'out', fixturePath.slice(1), 'index.html'), 'utf8');
    assert.notEqual(digest(changedHtml), addedHtmlHash, 'The selected page did not change its HTML.');
    assert(changedHtml.includes('data-incremental-check="changed"'), 'The changed source did not reach HTML.');
    report.changedContentVerified = true;
    report.changedOnlyPreserved = await assertUnchanged(before);
  } catch (error) { failure = error; }
  finally {
    await restoreSources(saved);
    try {
      const cleaned = await build('deleted-only');
      assert.equal(cleaned.nextInvocations, 0); assert.deepEqual(cleaned.actualRenderedPaths, []);
      assert.equal(cleaned.planCounts.deleted, 1);
      await assert.rejects(fs.access(path.join(root, 'out', fixturePath.slice(1), 'index.html')));
      report.cleanupPreserved = await assertUnchanged(before);
      for (const [name, expected] of sampleHashes) assert.equal(digest(await fs.readFile(path.join(root, 'out', name))), expected);
      assert.equal(digest(await fs.readFile(resourceFile)), digest(originalResources));
      assert.equal(digest(await fs.readFile(routeFile)), digest(originalRoutes));
    } catch (error) { failure ||= error; }
    report.success = !failure;
    report.finishedAt = new Date().toISOString();
    if (failure) report.error = failure.message;
    await saveJson(path.join(directory, 'results.json'), report);
    if (report.success) await fs.unlink(restoreFile);
  }
  if (failure) throw failure;
  console.log('Incremental main-site acceptance passed: ' + JSON.stringify(report));
}
