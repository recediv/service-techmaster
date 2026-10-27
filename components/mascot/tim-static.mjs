import { withBase } from '../../lib/public-urls.mjs';
import { measureTimTerritory } from './tim-placement.mjs';
import { createPartsThought } from './tim-thought.mjs';

// Keep the helper and the existing order dialog usable without a WebGL renderer.
// This runtime has no animation loop: only input, layout events and thought timers.
export function createTimMascot({ stage, host, shadow, thoughtBubble, height = 125, firstVisitAttention = false, onFirstAttention = () => {} }) {
  const lifetime = new AbortController();
  const listen = (target, event, callback, options = {}) => target.addEventListener(event, callback, { ...options, signal: lifetime.signal });
  const compact = matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)');
  let disposed = false, panel = null, frame = 0, graceTimer = null;
  let introducing = firstVisitAttention, hovered = false, focused = false, trigger = false, grace = false;
  let size = Math.max(75, Math.min(125, Number(height) || 125));
  let x = 0, top = 0, width = 0, blocked = false;
  const writeStyle = (element, key, value) => {
    if (key.startsWith('--')) element.style.setProperty(key, value);
    else element.style[key] = value;
  };
  const thought = createPartsThought({ element: thoughtBubble, wake: schedule, writeStyle });
  const image = document.createElement('img');
  image.src = withBase('/assets/mascot/tim-rest.webp');
  image.alt = ''; image.width = image.height = 125; image.draggable = false;
  image.className = 'tim-mascot__static-image';
  host.replaceChildren(image);
  stage.dataset.renderMode = 'static';
  stage.dataset.introducing = String(introducing);
  stage.dataset.side = 'right';

  function acknowledgeIntroduction() {
    if (!introducing) return;
    introducing = false;
    stage.dataset.introducing = 'false';
    onFirstAttention();
  }
  function syncOffer() {
    stage.dataset.orderOffer = String(!blocked && !panel && (hovered || focused || trigger || grace));
    stage.dataset.controlsVisible = stage.dataset.orderOffer;
    schedule();
  }
  function release() {
    clearTimeout(graceTimer);
    grace = true;
    graceTimer = setTimeout(() => { grace = false; syncOffer(); }, 1250);
    syncOffer();
  }
  function schedule() {
    if (!disposed && !frame) frame = requestAnimationFrame(sync);
  }
  function sync() {
    frame = 0;
    if (disposed) return;
    blocked = document.hidden || !panel && document.body.hasAttribute('data-scroll-locked');
    stage.dataset.suspended = String(blocked);
    thought.suspend(blocked || Boolean(panel));
    if (blocked) {
      hovered = focused = trigger = grace = false;
      stage.dataset.orderOffer = stage.dataset.controlsVisible = 'false';
      return;
    }
    const box = stage.getBoundingClientRect();
    const territory = measureTimTerritory(stage, size, compact.matches);
    width = box.width; x = territory.home;
    const floor = box.height - Math.max(territory.reserved, parseFloat(getComputedStyle(stage).paddingBottom) || 0) - 4;
    top = floor - size;
    stage.style.setProperty('--tim-x', `${x}px`);
    stage.style.setProperty('--tim-top', `${top}px`);
    stage.style.setProperty('--tim-size', `${size}px`);
    thought.update({ x, headTop: top, viewportWidth: width, canShow: !panel && stage.dataset.orderOffer !== 'true' });
  }
  listen(host, 'pointerenter', () => { acknowledgeIntroduction(); hovered = true; syncOffer(); });
  listen(host, 'pointerleave', () => { hovered = false; release(); });
  listen(host, 'focus', () => { acknowledgeIntroduction(); focused = true; syncOffer(); });
  listen(host, 'blur', () => { focused = false; release(); });
  listen(host, 'pointerup', () => { acknowledgeIntroduction(); release(); });
  listen(host, 'keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); acknowledgeIntroduction(); release(); }
  });
  listen(document, 'visibilitychange', schedule);
  listen(window, 'resize', schedule, { passive: true });
  listen(window, 'site:route-ready', schedule);
  const observer = new ResizeObserver(schedule);
  observer.observe(stage);
  const lockObserver = new MutationObserver(schedule);
  lockObserver.observe(document.body, { attributes: true, attributeFilter: ['data-scroll-locked'] });
  sync();

  return {
    acknowledgeIntroduction,
    setOrderTriggerAttention(value) { trigger = Boolean(value); if (trigger) acknowledgeIntroduction(); syncOffer(); },
    setPartsThoughtAvailable(value) { thought.setAvailable(Boolean(value)); },
    setPartsAvailable() { schedule(); },
    setHeight(value) { size = Math.max(75, Math.min(125, Number(value) || 125)); schedule(); },
    setWalking() {}, setMenuOpen() {}, setOrderLoadState() {}, play() { return false; },
    openOrderPanel(element, onClosed) {
      if (panel?.element === element) return;
      panel = { element, onClosed };
      acknowledgeIntroduction();
      element.dataset.positioned = 'true';
      element.dataset.side = 'right';
      const overlay = stage.querySelector('.tim-order__overlay');
      if (overlay) overlay.style.opacity = '1';
      syncOffer(); sync();
    },
    closeOrderPanel() {
      const done = panel?.onClosed;
      panel = null;
      syncOffer();
      done?.();
    },
    cancelOrderPanel() { panel = null; schedule(); },
    destroy() {
      disposed = true;
      cancelAnimationFrame(frame); clearTimeout(graceTimer);
      lifetime.abort(); observer.disconnect(); lockObserver.disconnect(); thought.destroy();
      host.replaceChildren();
      shadow.removeAttribute('style');
    },
  };
}
