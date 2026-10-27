// One immutable source asset. Fetch can overlap route reveal; GPU work cannot.
let cached = null;

export function preloadHeroEnvironment(url) {
  if (cached?.url === url) return cached.promise;
  const entry = { url, promise: null };
  entry.promise = fetch(url, { cache: 'force-cache' }).then(response => {
    if (!response.ok) throw new Error(`Hero environment HTTP ${response.status}`);
    return response.arrayBuffer();
  }).catch(error => {
    if (cached === entry) cached = null;
    throw error;
  });
  cached = entry;
  // A route can disappear while the source is loading; future owners still reuse it.
  void entry.promise.catch(() => {});
  return entry.promise;
}
