const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
let sequence = 0;

// One live transition; no screenshots, cloned page trees or paused WebGL frames.
export function createPageProjection(content) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (!content || motion.matches || document.hidden) {
    return { cover: async () => {}, reveal: async () => {}, destroy() {} };
  }
  const original = { opacity: content.style.opacity, clipPath: content.style.clipPath };
  const light = { power: 0, origin: null, finish: null, cancel: null };
  const start = new CustomEvent('site:projection-start', { detail: light, cancelable: true });
  window.dispatchEvent(start);
  const projecting = start.defaultPrevented && typeof light.origin === 'function';
  let stopped = false, frame = 0, phase = null, aperture = 0, intensity = 0, reveal = null;
  let overlay, beam, core, glow, gradient, clip;
  if (projecting) {
    const id = `page-projector-${++sequence}`;
    overlay = document.createElement('div');
    overlay.className = 'site-projector';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${id}-light" gradientUnits="userSpaceOnUse"><stop stop-color="#f0fffa" stop-opacity=".65"/><stop offset=".22" stop-color="#97e7dc" stop-opacity=".3"/><stop offset="1" stop-color="#bceee7" stop-opacity=".1"/></linearGradient>
        <clipPath id="${id}-clip"><rect/></clipPath>
      </defs>
      <g clip-path="url(#${id}-clip)"><path fill="url(#${id}-light)" style="filter:blur(9px)"/><path fill="#f2fffb" opacity=".18" style="filter:blur(4px)"/></g>
    </svg>`;
    [beam, core] = overlay.querySelectorAll('path');
    glow = document.createElement('div');
    glow.className = 'site-projector-source';
    glow.setAttribute('aria-hidden', 'true');
    gradient = overlay.querySelector('linearGradient');
    clip = overlay.querySelector('rect');
    document.body.append(overlay, glow);
  }
  function paint() {
    if (!projecting) return;
    const source = light.origin();
    if (!source) { destroy(); return; }
    const box = content.getBoundingClientRect();
    const width = document.documentElement.clientWidth, height = innerHeight;
    const top = Math.max(0, box.top), bottom = Math.min(height, box.bottom);
    const x = source.x, y = source.y;
    const spread = width * .85 * aperture;
    const target = x + (width / 2 - x) * aperture;
    const widening = reveal === null ? 0 : ease(reveal);
    const foot = 3 + (Math.max(x, width - x) + 40) * widening;
    const base = y + (height + 40 - y) * widening;
    const points = [[x - foot, base], [target - spread, top - 40], [target + spread, top - 40], [x + foot, base]];
    beam.setAttribute('d', `M ${points.map(point => point.join(' ')).join(' L ')} Z`);
    core.setAttribute('d', `M ${x} ${y} L ${target - spread * .3} ${top - 40} L ${target + spread * .3} ${top - 40} Z`);
    gradient.setAttribute('x1', x); gradient.setAttribute('y1', y);
    gradient.setAttribute('x2', target); gradient.setAttribute('y2', top);
    clip.setAttribute('x', box.left); clip.setAttribute('y', top);
    clip.setAttribute('width', box.width); clip.setAttribute('height', Math.max(0, bottom - top));
    glow.style.left = `${x}px`; glow.style.top = `${y}px`;
    glow.style.width = glow.style.height = `${source.size * .5}px`;
    glow.style.opacity = String(intensity);
    overlay.style.opacity = String(intensity);
    if (reveal !== null) {
      content.style.clipPath = reveal >= 1 ? original.clipPath : `polygon(${points.map(([px, py]) => `${px - box.left}px ${py - box.top}px`).join(',')})`;
    }
  }
  function tick(now) {
    if (stopped) return;
    const current = phase;
    if (current) {
      const progress = clamp((now - current.start) / current.duration);
      current.update(progress);
      if (progress === 1) { phase = null; current.resolve(); }
    }
    paint();
    if (!stopped) frame = requestAnimationFrame(tick);
  }
  function animate(duration, update) {
    if (stopped) return Promise.resolve();
    return new Promise(resolve => { phase = { start: performance.now(), duration, update, resolve }; });
  }
  function destroy() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    motion.removeEventListener('change', onMotion);
    document.removeEventListener('visibilitychange', onVisibility);
    phase?.resolve(); phase = null;
    light.power = 0;
    light.finish?.();
    overlay?.remove();
    glow?.remove();
    content.style.opacity = original.opacity;
    content.style.clipPath = original.clipPath;
    delete content.dataset.pageProjection;
  }
  const onMotion = () => { if (motion.matches) destroy(); };
  const onVisibility = () => { if (document.hidden) destroy(); };
  light.cancel = destroy;
  motion.addEventListener('change', onMotion);
  document.addEventListener('visibilitychange', onVisibility);
  frame = requestAnimationFrame(tick);
  return {
    async cover() {
      if (stopped) return;
      content.dataset.pageProjection = 'cover';
      await animate(projecting ? 340 : 130, t => {
        light.power = ease((t - .18) / .6);
        aperture = ease((t - .22) / .78);
        intensity = ease((t - .18) / .62);
        content.style.opacity = String(1 - .94 * ease((t - .42) / .58));
      });
    },
    async reveal() {
      if (stopped) return;
      content.dataset.pageProjection = 'reveal';
      if (projecting) {
        reveal = 0;
        paint();
        content.style.opacity = '0';
      }
      await animate(projecting ? 500 : 180, t => {
        if (projecting) {
          reveal = 1 - Math.pow(1 - clamp(t / .78), 3);
          content.style.opacity = String(ease(t / .24));
          intensity = 1 - ease((t - .45) / .55);
          light.power = intensity;
        } else content.style.opacity = String(ease(t));
      });
    },
    destroy,
  };
}
