const idleTtl = 45_000;
let cached = null;
let pagehideTarget = null;

function clearExpiry(entry) {
  if (entry.timer !== null) clearTimeout(entry.timer);
  entry.timer = null;
}

function removeEmptyPagehideListener() {
  if (!cached && pagehideTarget) {
    pagehideTarget.removeEventListener('pagehide', onPagehide);
    pagehideTarget = null;
  }
}

function disposeEntry(entry, error, notify = false) {
  if (!entry) return;
  const onError = !entry.invalid && notify && entry.leased ? entry.options?.onError : null;
  entry.invalid = true;
  entry.error ??= error;
  entry.leased = false;
  entry.lease = null;
  entry.options = null;
  clearExpiry(entry);
  if (cached === entry) cached = null;
  removeEmptyPagehideListener();

  // A factory can report failure before returning its API. A second call after
  // that return must still destroy the newly available API, exactly once.
  if (entry.api && !entry.apiDestroyed) {
    entry.apiDestroyed = true;
    try { entry.api.destroy(); } catch { /* Pool ownership is already released. */ }
  }
  if (typeof onError === 'function') {
    try { onError(error); } catch { /* Cleanup must survive a caller callback. */ }
  }
}

function onPagehide() {
  disposeEntry(cached);
}

function watchPagehide() {
  if (!pagehideTarget && typeof window !== 'undefined') {
    pagehideTarget = window;
    pagehideTarget.addEventListener('pagehide', onPagehide);
  }
}

function isUsable(api) {
  try {
    return Boolean(api && typeof api.attach === 'function' &&
      typeof api.detach === 'function' && typeof api.destroy === 'function' &&
      typeof api.isUsable === 'function' && api.isUsable());
  } catch {
    return false;
  }
}

function sceneOptions(entry, lease, options) {
  const deliver = (name, args) => {
    if (cached !== entry || entry.invalid || !entry.leased || entry.lease !== lease) return;
    const callback = entry.options?.[name];
    if (typeof callback === 'function') callback(...args);
  };
  return {
    ...options,
    onReady: (...args) => deliver('onReady', args),
    onAssetReady: (...args) => deliver('onAssetReady', args),
    onError: error => {
      if (cached !== entry || entry.invalid) return;
      // Context failure belongs to this renderer, including while detached.
      // Notify only the currently active owner, never a previous attachment.
      disposeEntry(entry, error, true);
    },
  };
}

/**
 * Lease one renderer. A matching idle entry survives for 45 seconds after
 * release; attach() owns resetting its ready callback and animation timeline.
 * key must be stable and include the scene revision, environment and motion mode.
 */
export function acquireHeroScene({ host, key, factory, options = {} }) {
  if (!host || typeof host.appendChild !== 'function') throw new TypeError('Hero scene needs a host.');
  if (typeof factory !== 'function') throw new TypeError('Hero scene needs a factory.');

  let entry = cached;
  const resumed = Boolean(entry && !entry.invalid && !entry.leased &&
    Object.is(entry.key, key) && entry.factory === factory && isUsable(entry.api));
  if (!resumed) {
    disposeEntry(entry);
    entry = {
      key, factory, api: null, apiDestroyed: false, invalid: false,
      leased: false, lease: null, options: null, timer: null, error: null,
    };
    cached = entry;
    watchPagehide();
  }

  clearExpiry(entry);
  const lease = Symbol('hero-scene-lease');
  entry.leased = true;
  entry.lease = lease;
  entry.options = options;
  const callbacks = sceneOptions(entry, lease, options);

  try {
    if (resumed) entry.api.attach(host, callbacks);
    else entry.api = factory(host, callbacks);

    if (entry.invalid || cached !== entry || !isUsable(entry.api)) {
      throw entry.error || new Error('Hero scene is unavailable.');
    }
  } catch (error) {
    disposeEntry(entry, error, true);
    throw error;
  }

  return {
    api: entry.api,
    resumed,
    release() {
      if (cached !== entry || entry.invalid || !entry.leased || entry.lease !== lease) return;
      // Drop component callbacks before detach can synchronously report failure.
      entry.leased = false;
      entry.lease = null;
      entry.options = null;
      try { entry.api.detach(); }
      catch (error) { disposeEntry(entry, error); return; }
      if (cached !== entry || entry.invalid) return;
      entry.timer = setTimeout(() => {
        if (cached === entry && !entry.leased) disposeEntry(entry);
      }, idleTtl);
    },
  };
}
