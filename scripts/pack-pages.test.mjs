import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { packPages } from './pack-pages.mjs';
const project = path.dirname(path.dirname(fileURLToPath(import.meta.url))), local = path.join(project, '.local');
async function fixture(work) {
  await fs.mkdir(local, { recursive: true });
  const root = await fs.mkdtemp(path.join(local, 'build-pack-test-')), input = path.join(root, 'input'), output = path.join(root, 'output');
  await fs.mkdir(path.join(input, 'services/device'), { recursive: true });
  const html = '<!doctype html><html><head><title>Томск</title></head><body><main><h1>Ремонт в Томске</h1></main></body></html>';
  const payload = '1:["Томск",{"route":"/services/device/"}]';
  await Promise.all([fs.writeFile(path.join(input, 'index.html'), html), fs.writeFile(path.join(input, '404.html'), '<html><head></head><body>404</body></html>'), fs.writeFile(path.join(input, 'services/device/index.html'), html), ...['index.txt','services/device/index.txt','services/device/__next._full.txt'].map(name => fs.writeFile(path.join(input, name), payload)), fs.writeFile(path.join(input, 'robots.txt'), 'User-Agent: *\nDisallow: /\n'), fs.writeFile(path.join(input, 'image.png'), Buffer.from([0, 1, 2, 255])), fs.writeFile(path.join(input, 'orphan.js.map'), '{"sourcesContent":["private debug source"]}')]);
  try { await work({ input, output, html, payload }); }
  finally { assert.ok(root.startsWith(local + path.sep) && path.basename(root).startsWith('build-pack-test-')); await fs.rm(root, { recursive: true }); }
}
test('all route payloads survive deduplication and decode exactly', () => fixture(async ({ input, output, html, payload }) => {
  const report = await packPages({ input, output, basePath: '/service-techmaster' });
  const manifest = JSON.parse(gunzipSync(await fs.readFile(path.join(output, report.manifest))).toString());
  assert.equal(report.html, 3); assert.equal(report.rsc, 3); assert.equal(report.virtualFiles, 6); assert.equal(report.uniquePayloads, 3);
  for (const name of ['index.txt','services/device/index.txt','services/device/__next._full.txt']) {
    const entry = manifest.files[name]; assert.equal(entry[1], 2);
    const parts = await Promise.all(manifest.payloads[entry[0]].map(async id => { const [bundle, offset, length] = manifest.objects[id]; return gunzipSync(await fs.readFile(path.join(output, '__preview/objects', manifest.bundles[bundle] + '.gz'))).subarray(offset, offset + length); }));
    assert.equal(Buffer.concat(parts).toString(), payload);
  }
  assert.equal(await fs.readFile(path.join(input, 'index.html'), 'utf8'), html);
  assert.match(await fs.readFile(path.join(output, 'services/device/index.html'), 'utf8'), /data-preview-bootstrap/);
  assert.match(await fs.readFile(path.join(output, 'index.html'), 'utf8'), /<h1>Ремонт в Томске<\/h1>/);
  assert.match(await fs.readFile(path.join(output, 'preview-sw.js'), 'utf8'), new RegExp(report.version));
}));
test('static assets stay byte-identical and debug maps are excluded', () => fixture(async ({ input, output }) => {
  await packPages({ input, output });
  assert.deepEqual(await fs.readFile(path.join(output, 'image.png')), await fs.readFile(path.join(input, 'image.png')));
  await assert.rejects(fs.access(path.join(output, 'orphan.js.map')));
  assert.equal(await fs.readFile(path.join(output, 'robots.txt'), 'utf8'), 'User-Agent: *\nDisallow: /\n');
}));
test('an existing output and overlapping source are protected', () => fixture(async ({ input, output }) => {
  await fs.mkdir(output); await fs.writeFile(path.join(output, 'keep.txt'), 'original');
  await assert.rejects(packPages({ input, output }), /EEXIST/);
  assert.equal(await fs.readFile(path.join(output, 'keep.txt'), 'utf8'), 'original');
  await assert.rejects(packPages({ input, output: path.join(input, 'nested') }), /separate/);
}));
test('the package cannot silently exceed the Pages budget', () => fixture(async ({ input, output }) => {
  await assert.rejects(packPages({ input, output, maxBytes: 1 }), /exceeds/);
}));
test('shared blocks with different offsets reconstruct across multiple bundles', () => fixture(async ({ input, output }) => {
  const shared = randomBytes(320000), expected = new Map();
  for (let i = 0; i < 20; i++) {
    const name = 'payload-' + i + '.txt', bytes = Buffer.concat([Buffer.from('route-' + i + ':'.repeat(i * 17)), shared, Buffer.from(':end-' + i)]);
    expected.set(name, bytes); await fs.writeFile(path.join(input, name), bytes);
  }
  const report = await packPages({ input, output }), manifest = JSON.parse(gunzipSync(await fs.readFile(path.join(output, report.manifest))).toString());
  assert.ok(report.bundles > 1); assert.ok(report.bytes < 20 * shared.length * .4);
  const bundles = new Map();
  for (const [name, bytes] of expected) {
    const parts = [];
    for (const id of manifest.payloads[manifest.files[name][0]]) {
      const [bundle, offset, length] = manifest.objects[id];
      if (!bundles.has(bundle)) bundles.set(bundle, gunzipSync(await fs.readFile(path.join(output, '__preview/objects', manifest.bundles[bundle] + '.gz'))));
      parts.push(bundles.get(bundle).subarray(offset, offset + length));
    }
    assert.deepEqual(Buffer.concat(parts), bytes);
  }
}));
