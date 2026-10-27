// Generated only for the temporary GitHub Pages preview; never used by next dev.
const VERSION = __PREVIEW_VERSION__;
const MANIFEST_PATH = __PREVIEW_MANIFEST__;
const SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = 'service-techmaster-preview:' + SCOPE.pathname + ':';
const CACHE = CACHE_PREFIX + VERSION;
let manifestPromise, lastUpdate = Date.now();

async function decodedBody(response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const stream = new Blob([bytes]).stream();
  // A host may already decode Content-Encoding; check the bytes, not the header.
  return bytes[0] === 0x1f && bytes[1] === 0x8b ? stream.pipeThrough(new DecompressionStream('gzip')) : stream;
}
async function cachedFile(relative) {
  const url = new URL(relative, SCOPE).href, cache = await caches.open(CACHE);
  let response = await cache.match(url);
  if (!response) {
    response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('Preview file is unavailable.');
    await cache.put(url, response.clone());
  }
  return response;
}
function manifest() {
  return manifestPromise ||= cachedFile(MANIFEST_PATH).then(async response => JSON.parse(await new Response(await decodedBody(response)).text())).catch(error => { manifestPromise = undefined; throw error; });
}
self.addEventListener('install', event => { event.waitUntil(manifest().then(() => self.skipWaiting())); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(CACHE_PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  if (request.mode !== 'navigate' && !/\.(?:html|txt)$/.test(url.pathname)) return;
  if (Date.now() - lastUpdate > 60000) { lastUpdate = Date.now(); event.waitUntil(self.registration.update().catch(() => {})); }
  event.respondWith((async () => {
    const data = await manifest();
    let relative;
    try { relative = decodeURIComponent(url.pathname.slice(SCOPE.pathname.length)); } catch { return fetch(request); }
    const name = !relative || relative.endsWith('/') ? relative + 'index.html' : relative;
    const entry = Object.hasOwn(data.files, name) ? data.files[name] : undefined;
    if (!entry) {
      if (!relative.endsWith('/') && data.files[relative + '/index.html']) { url.pathname += '/'; return Response.redirect(url.href, 301); }
      return fetch(request);
    }
    const ids = data.payloads[entry[0]], parts = new Array(ids.length), bundles = new Map(); let next = 0;
    const bundle = id => {
      if (!bundles.has(id)) bundles.set(id, cachedFile('__preview/objects/' + data.bundles[id] + '.gz').then(async response => new Response(await decodedBody(response)).arrayBuffer()));
      return bundles.get(id);
    };
    await Promise.all(Array.from({ length: Math.min(8, ids.length) }, async () => {
      while (next < ids.length) { const index = next++, [id, offset, length] = data.objects[ids[index]], bytes = await bundle(id); parts[index] = new Uint8Array(bytes, offset, length); }
    }));
    return new Response(new Blob(parts), { status: 200, headers: {
      'Content-Type': entry[1] === 1 ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache', 'X-Robots-Tag': 'noindex, nofollow',
    } });
  })().catch(() => fetch(request)));
});
