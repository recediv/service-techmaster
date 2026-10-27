import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const project = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const zip = promisify(gzip), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const PAGES_BUDGET = 950000000;
const attribution = 'assets/hero/ASSET-SOURCES.txt';
const within = (root, file) => file.startsWith(root + path.sep);
const gear = new Uint32Array(256);
let seed = 0x9e3779b9;
for (let i = 0; i < gear.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; gear[i] = seed >>> 0; }
function chunksOf(bytes) {
  const chunks = []; let start = 0, rolling = 0;
  for (let i = 0; i < bytes.length; i++) {
    rolling = ((rolling << 1) + gear[bytes[i]]) >>> 0;
    const size = i - start + 1;
    if (size >= 2048 && ((rolling & 8191) === 0 || size >= 16384)) { chunks.push(bytes.subarray(start, i + 1)); start = i + 1; rolling = 0; }
  }
  if (start < bytes.length || !chunks.length) chunks.push(bytes.subarray(start));
  return chunks;
}
async function filesAt(root, directory = '') {
  const files = [];
  for (const item of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
    const name = directory ? directory + '/' + item.name : item.name;
    if (item.isSymbolicLink()) throw new Error('Preview input must not contain symlinks.');
    if (item.isDirectory()) files.push(...await filesAt(root, name)); else files.push(name);
  }
  return files.sort();
}
async function parallel(items, work) {
  let next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => { while (next < items.length) { const index = next++; await work(items[index]); } }));
}
export async function packPages({ input, output, basePath = '', maxBytes = PAGES_BUDGET, onProgress = () => {} }) {
  input = path.resolve(project, input); output = path.resolve(project, output);
  if (!within(project, input) || !within(path.join(project, '.local'), output) || within(input, output) || within(output, input) || input === output) throw new Error('Use separate export and isolated .local output directories.');
  if (basePath && (!/^\/[a-z0-9_-]+$/i.test(basePath))) throw new Error('Use a single GitHub Pages repository prefix.');
  const names = await filesAt(input);
  if (!names.includes('index.html') || !names.includes('404.html')) throw new Error('A complete Next static export is required.');
  if (names.some(name => name.startsWith('__preview/') || ['preview-sw.js','preview-register.js'].includes(name))) throw new Error('Preview filenames collide with the source export.');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.mkdir(output);
  const objectRoot = path.join(output, '__preview/objects'); await fs.mkdir(objectRoot, { recursive: true });
  const [register, workerTemplate] = await Promise.all(['register.js','worker.js'].map(name => fs.readFile(path.join(project, 'scripts/pages-preview', name), 'utf8')));
  const registerUrl = basePath + '/preview-register.js?v=' + hash(register).slice(0, 16);
  const registration = '<script src="' + registerUrl + '" defer></script>';
  const bootstrap = '<!doctype html><html lang="ru" data-preview-bootstrap><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>ТехМастер</title><style>body{margin:0;min-height:100vh;display:grid;place-content:center;text-align:center;background:#f3f7f7;color:#26464a;font:16px/1.5 Arial,sans-serif}strong{color:#ff6753;font-size:28px}p{margin:12px 20px}</style><strong>ТехМастер</strong><p id="preview-message" role="status">Открываем сайт…</p><noscript><p>Для просмотра включите JavaScript.</p></noscript>' + registration + '</html>';
  const entries = new Map(), objects = new Map(), payloads = new Map(), payloadChunks = [], objectRanges = [], bundleHashes = [], pendingBundles = new Set();
  let bundleParts = [], bundleBytes = 0, bundleError;
  let bytes = 0, copied = 0, processed = 0, originalBytes = 0, html = 0, rsc = 0;
  const write = async (relative, data) => { const full = path.join(output, relative); await fs.mkdir(path.dirname(full), { recursive: true }); await fs.writeFile(full, data); bytes += Buffer.byteLength(data); };
  const flushBundle = () => {
    if (!bundleParts.length) return;
    const index = bundleHashes.length, data = Buffer.concat(bundleParts.map(part => part.data));
    bundleHashes.push(null); let offset = 0;
    for (const part of bundleParts) { objectRanges[part.index] = [index, offset, part.data.length]; offset += part.data.length; }
    bundleParts = []; bundleBytes = 0;
    const id = hash(data), ready = zip(data, { level: 9 }).then(buffer => write('__preview/objects/' + id + '.gz', buffer));
    bundleHashes[index] = id; pendingBundles.add(ready);
    ready.then(() => pendingBundles.delete(ready), error => { bundleError ||= error; pendingBundles.delete(ready); });
  };
  await parallel(names, async name => {
    if (bundleError) throw bundleError;
    const full = path.join(input, name), stat = await fs.stat(full); originalBytes += stat.size;
    if (name.endsWith('.map') || name === '.htaccess') return;
    const isHtml = name.endsWith('.html'), virtual = isHtml || name.endsWith('.txt') && name !== 'robots.txt' && name !== attribution;
    if (virtual) {
      let data = await fs.readFile(full);
      if (isHtml) { data = Buffer.from(data.toString('utf8').replace('</head>', registration + '</head>')); html++; } else rsc++;
      const id = hash(data);
      if (!payloads.has(id)) {
        const index = payloadChunks.length;
        const parts = chunksOf(data).map(chunk => {
          const chunkId = hash(chunk);
          if (!objects.has(chunkId)) {
            const part = { index: objects.size }; objects.set(chunkId, part);
            bundleParts.push({ index: part.index, data: chunk }); bundleBytes += chunk.length;
            if (bundleBytes >= 131072) flushBundle();
          }
          return objects.get(chunkId).index;
        });
        payloadChunks.push(parts); payloads.set(id, { index });
      }
      const payload = payloads.get(id); entries.set(name, [payload.index, isHtml ? 1 : 2]);
      if (pendingBundles.size >= 8) await Promise.race(pendingBundles);
      if (isHtml) await write(name, name === 'index.html' || ['404.html','404/index.html','_not-found/index.html'].includes(name) ? data : bootstrap);
    } else {
      const destination = path.join(output, name); await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.copyFile(full, destination); bytes += stat.size; copied++;
    }
    processed++; if (processed % 5000 === 0) onProgress({ processed, total: names.length, bytes, uniquePayloads: payloads.size, uniqueChunks: objects.size });
  });
  flushBundle(); await Promise.all(pendingBundles); if (bundleError) throw bundleError;
  const document = JSON.stringify({ schemaVersion: 3, basePath, runtime: hash(register + workerTemplate), bundles: bundleHashes, objects: objectRanges, payloads: payloadChunks, files: Object.fromEntries([...entries].sort(([a],[b]) => a.localeCompare(b))) });
  const version = hash(document), manifestName = '__preview/manifest-' + version + '.json.gz';
  await write(manifestName, await zip(document, { level: 9 }));
  await write('preview-register.js', register);
  await write('preview-sw.js', workerTemplate.replace('__PREVIEW_VERSION__', JSON.stringify(version)).replace('__PREVIEW_MANIFEST__', JSON.stringify(manifestName)));
  await write('.nojekyll', '');
  if (bytes > maxBytes) throw new Error('GitHub Pages package exceeds the ' + maxBytes + ' byte budget: ' + bytes);
  return { schemaVersion: 3, output: path.relative(project, output).split(path.sep).join('/'), basePath, bytes, originalBytes, html, rsc, virtualFiles: entries.size, uniquePayloads: payloads.size, uniqueChunks: objects.size, bundles: bundleHashes.length, staticFiles: copied, manifest: manifestName, version };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = Object.fromEntries(process.argv.slice(2).map(item => { const at = item.indexOf('='); return [item.slice(2, at), item.slice(at + 1)]; }));
  const report = await packPages({ input: options.input, output: options.output, basePath: options['base-path'] || '', onProgress: value => console.log(JSON.stringify(value)) });
  await fs.writeFile(path.join(project, '.local/pages-package-report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
}
