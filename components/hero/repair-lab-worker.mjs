import { createRepairLabScene } from './repair-lab-scene.mjs';

let api = null;
let generation = null;
let attachment = 0;
let attached = false;
let visible = false;
let destroyed = false;
let captureQueue = Promise.resolve();
const viewport = { width: 0, height: 0, dpr: 1 };
const host = { getBoundingClientRect: () => viewport };

function measure(message) {
  if ('width' in message) viewport.width = Math.max(0, Number(message.width) || 0);
  if ('height' in message) viewport.height = Math.max(0, Number(message.height) || 0);
  if ('dpr' in message) viewport.dpr = Math.max(1, Number(message.dpr) || 1);
}

function stats() {
  return api?.getStats?.() || null;
}

function send(type, detail = {}, owner = attachment, session = generation) {
  if (destroyed || session !== generation) return;
  self.postMessage({ type, generation: session, attachment: owner, ...detail });
}

function report(error, owner = attachment, session = generation) {
  send('error', { message: String(error?.message || error || 'Repair lab worker failed.') }, owner, session);
}

function callbacks(owner, session = generation) {
  return {
    onReady: () => send('ready', { stats: stats() }, owner, session),
    onAssetReady: () => send('asset-ready', { stats: stats() }, owner, session),
    onError: error => report(error, owner, session),
  };
}

function initialize(message) {
  api?.destroy();
  generation = message.generation;
  attachment = message.attachment;
  destroyed = false;
  attached = true;
  visible = Boolean(message.visible);
  measure(message);
  if (!message.canvas?.getContext) throw new Error('Repair lab worker needs an OffscreenCanvas.');
  api = createRepairLabScene(host, {
    canvas: message.canvas,
    workerMode: true,
    pixelRatio: () => viewport.dpr,
    reducedMotion: Boolean(message.reducedMotion),
    environmentUrl: message.environmentUrl,
    environmentSource: message.environmentBuffer instanceof ArrayBuffer ? Promise.resolve(message.environmentBuffer) : undefined,
    ...callbacks(attachment),
  });
  if (api.isUsable()) api.setVisible(visible);
}

function current(message) {
  return !destroyed && message.generation === generation && message.attachment === attachment;
}

function capture(message) {
  const session = generation;
  const owner = message.attachment;
  captureQueue = captureQueue.catch(() => {}).then(async () => {
    let png = null;
    try {
      if (current(message) && attached && visible && api?.isUsable()) {
        const currentApi = api;
        png = await currentApi.captureFrameAsync(message.options || {});
        if (!current(message) || api !== currentApi || !attached || !visible) png = null;
      }
      send('capture', { requestId: message.requestId, png, stats: stats() }, owner, session);
    } catch {
      send('capture', { requestId: message.requestId, png: null, stats: stats() }, owner, session);
    }
  });
}

self.addEventListener('message', event => {
  const message = event.data;
  if (!message || typeof message.type !== 'string') return;
  try {
    if (message.type === 'init') { initialize(message); return; }
    if (destroyed || message.generation !== generation || !api) return;
    if (message.type === 'destroy') {
      destroyed = true;
      attached = visible = false;
      api.destroy();
      api = null;
      self.close();
      return;
    }
    if (message.type === 'attach') {
      if (message.attachment < attachment) return;
      attachment = message.attachment;
      attached = true;
      visible = Boolean(message.visible);
      measure(message);
      if (!api.attach(host, callbacks(attachment))) throw new Error('Repair lab worker cannot reattach.');
      api.setVisible(visible);
      return;
    }
    if (!current(message)) return;
    if (message.type === 'detach') {
      attached = visible = false;
      api.detach();
    } else if (message.type === 'visible') {
      visible = attached && Boolean(message.visible ?? message.value);
      if (visible) api.resize();
      api.setVisible(visible);
    } else if (message.type === 'resize') {
      measure(message);
      if (attached && visible) api.resize();
    } else if (message.type === 'pointer') {
      if (attached && visible) api.setPointer(message.x, message.y, message.active);
    } else if (message.type === 'scroll') {
      if (attached && visible) api.setScroll(message.value);
    } else if (message.type === 'stats') {
      send('stats', { stats: stats() });
    } else if (message.type === 'capture') {
      capture(message);
    }
  } catch (error) {
    report(error, message.attachment, message.generation);
  }
});

self.addEventListener('unhandledrejection', event => {
  event.preventDefault();
  report(event.reason);
});
