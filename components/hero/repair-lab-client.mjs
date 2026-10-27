import { repairLabWindow, positionRepairCanvas } from './repair-lab-layout.mjs';

let fallbackModule = null;

function loadFallback() {
  if (!fallbackModule) fallbackModule = import('./repair-lab-scene.mjs').catch(error => { fallbackModule = null; throw error; });
  return fallbackModule;
}

const asError = value => value instanceof Error ? value : new Error(String(value?.message || value || 'Repair lab could not start.'));

// This module intentionally imports no Three.js code on the window thread.
export function createRepairLabScene(initialHost, initialOptions = {}) {
  const started = performance.now();
  if (!initialHost?.appendChild || typeof document === 'undefined') throw new Error('Repair lab needs a browser host.');
  const workerSupported = typeof Worker === 'function' && typeof OffscreenCanvas === 'function' &&
    typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function';
  let mode = workerSupported ? 'worker' : 'main';
  let fallbackReason = workerSupported ? '' : 'OffscreenCanvas transfer is unavailable.';
  let host = null, options = null, attachment = 0, generation = 0;
  let destroyed = false, failed = false, visible = true, ready = false, readyDelivered = false, assetDelivered = false;
  let worker = null, canvas = null, offscreen = null, workerStarted = false, workerStarting = false;
  let mainApi = null, mainFactory = null, fallbackLoading = false;
  let idle = null, frame = null, task = null, constructorMs = 0;
  let size = { width: 0, height: 0, dpr: 1 }, pointer = { x: 0, y: 0, active: false }, scroll = 0;
  let stats = { ready: false, loaded: false };
  let sourcePromise = null, captureSequence = 0;
  const captures = new Map();
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
  const active = () => !destroyed && !failed && host && visible && !document.hidden && size.width > 0 && size.height > 0;

  function updateStats(value) { if (value && typeof value === 'object') stats = { ...stats, ...value }; }
  function call(name, value) {
    const callback = host && options?.[name];
    if (typeof callback === 'function') { try { callback(value); } catch { /* A UI callback cannot invalidate a renderer. */ } }
  }
  function notifyReady() {
    if (!ready || readyDelivered || !active()) return;
    readyDelivered = true;
    call('onReady');
  }
  function safeMainStats() { try { return mainApi?.getStats?.(); } catch { return null; } }
  function resolveCaptures() { for (const resolve of captures.values()) resolve(null); captures.clear(); }
  function cancelMainStart() {
    if (idle !== null) window.cancelIdleCallback?.(idle);
    if (frame !== null) cancelAnimationFrame(frame);
    if (task !== null) clearTimeout(task);
    idle = frame = task = null;
  }
  function stopWorker() {
    const previous = worker;
    const previousGeneration = generation;
    worker = null;
    generation++;
    workerStarted = workerStarting = false;
    if (previous) {
      previous.onmessage = previous.onerror = previous.onmessageerror = null;
      try { previous.postMessage({ type: 'destroy', generation: previousGeneration, attachment }); } catch { /* Termination also releases transferred resources. */ }
      previous.terminate();
    }
    canvas?.remove();
    canvas = offscreen = null;
    resolveCaptures();
  }
  function finalError(error) {
    if (destroyed || failed) return;
    failed = true;
    ready = false;
    cancelMainStart();
    stopWorker();
    const previous = mainApi;
    mainApi = null;
    try { previous?.destroy(); } catch { /* The public API is already unusable. */ }
    call('onError', asError(error));
  }
  function useFallback(error) {
    if (destroyed || failed || mode === 'main') return;
    fallbackReason = asError(error).message;
    mode = 'main';
    ready = readyDelivered = assetDelivered = false;
    stats = { ready: false, loaded: false };
    stopWorker();
    ensureMain();
  }
  function send(type, extra = {}) {
    if (!worker || !workerStarted) return;
    try { worker.postMessage({ type, generation, attachment, ...extra }); }
    catch (error) { useFallback(error); }
  }
  function workerMessage(event, ownWorker, ownGeneration) {
    if (destroyed || failed || worker !== ownWorker || generation !== ownGeneration) return;
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    // A fatal error invalidates this worker's renderer even if the owner moved.
    if (message.type === 'error') { useFallback(message.message || 'Repair lab worker failed.'); return; }
    if (message.generation !== generation || message.attachment !== attachment || !host) return;
    updateStats(message.stats);
    if (message.type === 'ready') { ready = true; notifyReady(); }
    else if (message.type === 'asset-ready' && !assetDelivered) { assetDelivered = true; call('onAssetReady'); }
    else if (message.type === 'capture') {
      const resolve = captures.get(message.requestId);
      if (resolve) { captures.delete(message.requestId); resolve(typeof message.png === 'string' ? message.png : null); }
    }
  }
  async function initializeWorker() {
    if (!active() || mode !== 'worker' || !worker || workerStarted || workerStarting) return;
    workerStarting = true;
    const ownWorker = worker, ownGeneration = generation;
    try {
      if (!sourcePromise) sourcePromise = Promise.resolve(initialOptions.environmentSource || null);
      const source = await sourcePromise;
      if (destroyed || worker !== ownWorker || generation !== ownGeneration || !active()) return;
      if (source !== null && !(source instanceof ArrayBuffer)) throw new Error('Repair lab environment requires an ArrayBuffer.');
      // Transfer a copy; the shared preload promise must retain its buffer.
      const environmentBuffer = source ? source.slice(0) : null;
      const transferable = [offscreen];
      if (environmentBuffer) transferable.push(environmentBuffer);
      workerStarted = true;
      ownWorker.postMessage({
        type: 'init', generation, attachment, canvas: offscreen, ...size, visible: Boolean(active()),
        reducedMotion: Boolean(initialOptions.reducedMotion), environmentUrl: initialOptions.environmentUrl,
        environmentBuffer,
      }, transferable);
      offscreen = null;
      send('pointer', pointer);
      send('scroll', { value: scroll });
    } catch (error) {
      if (!destroyed && worker === ownWorker && generation === ownGeneration) useFallback(error);
    } finally {
      if (worker === ownWorker && generation === ownGeneration) workerStarting = false;
    }
  }
  function ensureWorker() {
    if (!active() || mode !== 'worker') return;
    if (!worker) {
      try {
        canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.tabIndex = -1;
        canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
        positionRepairCanvas(canvas,repairLabWindow(size.width,size.height));
        host.appendChild(canvas);
        offscreen = canvas.transferControlToOffscreen();
        const ownGeneration = ++generation;
        const ownWorker = new Worker(new URL('./repair-lab-worker.mjs', import.meta.url), { type: 'module' });
        worker = ownWorker;
        ownWorker.onmessage = event => workerMessage(event, ownWorker, ownGeneration);
        ownWorker.onerror = event => {
          event.preventDefault();
          if (worker === ownWorker && generation === ownGeneration) useFallback(event.message || 'Repair lab worker failed to load.');
        };
        ownWorker.onmessageerror = () => { if (worker === ownWorker && generation === ownGeneration) useFallback('Repair lab worker message could not be decoded.'); };
      } catch (error) { useFallback(error); return; }
    }
    void initializeWorker();
  }
  function mainOptions(ownAttachment) {
    return {
      ...initialOptions, ...options,
      onReady: () => {
        if (destroyed || failed || attachment !== ownAttachment || !host) return;
        updateStats(safeMainStats());
        ready = true;
        notifyReady();
      },
      onAssetReady: () => {
        if (destroyed || failed || attachment !== ownAttachment || !host || assetDelivered) return;
        assetDelivered = true;
        updateStats(safeMainStats());
        call('onAssetReady');
      },
      onError: error => { if (!destroyed && !failed) finalError(error); },
    };
  }
  function scheduleMain() {
    if (!active() || mode !== 'main' || mainApi || !mainFactory || idle !== null || frame !== null || task !== null) return;
    const ownAttachment = attachment;
    const construct = () => {
      idle = frame = task = null;
      if (!active() || attachment !== ownAttachment || mainApi) return;
      try {
        const created = mainFactory(host, mainOptions(ownAttachment));
        if (destroyed || failed || attachment !== ownAttachment || !host) { created?.destroy(); return; }
        mainApi = created;
        if (!mainApi?.isUsable()) throw new Error('Repair lab fallback is unavailable.');
        mainApi.setVisible(Boolean(active()));
      } catch (error) { finalError(error); }
    };
    if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(construct, { timeout: 1200 });
    else frame = requestAnimationFrame(() => { frame = null; task = setTimeout(construct, 0); });
  }
  function ensureMain() {
    if (!active() || mode !== 'main' || mainApi) return;
    if (mainFactory) { scheduleMain(); return; }
    if (fallbackLoading) return;
    fallbackLoading = true;
    loadFallback().then(module => {
      fallbackLoading = false;
      if (destroyed || failed) return;
      mainFactory = module.createRepairLabScene;
      scheduleMain();
    }, error => { fallbackLoading = false; finalError(error); });
  }
  function syncVisible() {
    const running = Boolean(active());
    if (!running) cancelMainStart();
    mainApi?.setVisible(running);
    send('visible', { visible: running });
    if (running) { if (mode === 'worker') ensureWorker(); else ensureMain(); notifyReady(); }
  }
  function resize() {
    if (destroyed || !host) return;
    const rect = host.getBoundingClientRect();
    size = { width: Math.max(0, Math.round(rect.width)), height: Math.max(0, Math.round(rect.height)), dpr: Math.max(1, window.devicePixelRatio || 1) };
    positionRepairCanvas(canvas,repairLabWindow(size.width,size.height));
    mainApi?.resize();
    send('resize', size);
    syncVisible();
  }
  function detach() {
    if (destroyed) return;
    cancelMainStart();
    resolveCaptures();
    observer?.disconnect();
    visible = false;
    ready = readyDelivered = assetDelivered = false;
    options = null;
    send('detach');
    mainApi?.detach();
    canvas?.remove();
    host = null;
  }
  function attach(nextHost, nextOptions = {}) {
    if (destroyed || failed || !nextHost?.appendChild) return false;
    detach();
    host = nextHost;
    options = nextOptions;
    attachment++;
    visible = true;
    pointer = { x: 0, y: 0, active: false };
    scroll = 0;
    stats = { ...stats, ready: false };
    const rect = host.getBoundingClientRect();
    size = { width: Math.max(0, Math.round(rect.width)), height: Math.max(0, Math.round(rect.height)), dpr: Math.max(1, window.devicePixelRatio || 1) };
    if (mainApi && !mainApi.attach(host, mainOptions(attachment))) { finalError('Repair lab fallback could not attach.'); return false; }
    if (canvas) host.appendChild(canvas);
    positionRepairCanvas(canvas,repairLabWindow(size.width,size.height));
    if (workerStarted) send('attach', { ...size, visible: Boolean(active()) });
    observer?.observe(host);
    syncVisible();
    return !failed && !destroyed;
  }
  function captureFrame(captureOptions = {}) {
    if (!active() || !ready) return Promise.resolve(null);
    if (mainApi) {
      try { return Promise.resolve(mainApi.captureFrameAsync ? mainApi.captureFrameAsync(captureOptions) : mainApi.captureFrame(captureOptions)); }
      catch { return Promise.resolve(null); }
    }
    if (!worker || !workerStarted) return Promise.resolve(null);
    return new Promise(resolve => {
      const requestId = ++captureSequence;
      captures.set(requestId, resolve);
      send('capture', { requestId, options: captureOptions });
    });
  }
  function destroy() {
    if (destroyed) return;
    detach();
    destroyed = true;
    cancelMainStart();
    observer?.disconnect();
    document.removeEventListener('visibilitychange', syncVisible);
    window.removeEventListener('resize', resize);
    stopWorker();
    const previous = mainApi;
    mainApi = null;
    try { previous?.destroy(); } catch { /* All external ownership has already been removed. */ }
  }
  const api = {
    attach, detach, resize, destroy, captureFrame, captureFrameAsync: captureFrame,
    isUsable() { return !destroyed && !failed && (!mainApi || mainApi.isUsable()); },
    setVisible(value) { if (destroyed) return; visible = Boolean(value); syncVisible(); },
    setPointer(x, y, value = true) {
      if (!active()) return;
      pointer = { x: Number(x) || 0, y: Number(y) || 0, active: Boolean(value) };
      mainApi?.setPointer(pointer.x, pointer.y, pointer.active);
      send('pointer', pointer);
    },
    setScroll(value) { scroll = Number(value) || 0; mainApi?.setScroll(scroll); send('scroll', { value: scroll }); },
    getStats() {
      updateStats(safeMainStats());
      if (workerStarted) send('stats');
      return { ...stats, ready, executionThread: mode, workerFallbackReason: fallbackReason || undefined, adapterConstructorMs: constructorMs };
    },
  };
  document.addEventListener('visibilitychange', syncVisible);
  window.addEventListener('resize', resize);
  attach(initialHost, initialOptions);
  constructorMs = performance.now() - started;
  return api;
}
