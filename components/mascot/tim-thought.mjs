// The thought is a link in the UI; it never changes the robot's hands or rig.
export function createPartsThought({ element, wake, writeStyle }) {
  if (!element) return { get visible() { return false; }, update() {}, setAvailable() {}, suspend() {}, destroy() {} };
  let available = false, visible = false, paused = false, due = false;
  let hovered = false, focused = false, timer = null, width = 0, height = 0;
  const lifetime = new AbortController();
  const held = () => hovered || focused;
  const clear = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  function show(value) {
    if (visible === value) return;
    visible = value;
    element.dataset.visible = String(value);
    element.tabIndex = value ? 0 : -1;
    element.setAttribute('aria-hidden', String(!value));
  }
  function schedule(delay, action) {
    clear();
    if (!available || paused) return;
    timer = setTimeout(() => { timer = null; action(); wake(); }, delay);
  }
  function wait(delay = 22000) {
    due = false;
    show(false);
    schedule(delay, () => { due = true; });
  }
  function release() {
    if (visible && !held()) schedule(1800, () => { if (!held()) wait(); });
  }
  element.addEventListener('pointerenter', () => { hovered = true; }, { signal: lifetime.signal });
  element.addEventListener('pointerleave', () => { hovered = false; release(); }, { signal: lifetime.signal });
  element.addEventListener('focusin', () => { focused = true; }, { signal: lifetime.signal });
  element.addEventListener('focusout', () => { focused = false; release(); }, { signal: lifetime.signal });
  const observer = new ResizeObserver(entries => {
    const box = entries[0].borderBoxSize?.[0];
    width = Math.ceil(box?.inlineSize || element.offsetWidth);
    height = Math.ceil(box?.blockSize || element.offsetHeight);
    if (available) wake();
  });
  observer.observe(element);
  return {
    get visible() { return visible; },
    setAvailable(value) {
      value = Boolean(value);
      if (available === value) return;
      available = value;
      hovered = focused = false;
      wait(6000);
      wake();
    },
    suspend(value) {
      if (paused === value) return;
      paused = value;
      hovered = focused = false;
      wait(6000);
    },
    update({ x, headTop, viewportWidth, canShow }) {
      if (!available || paused) return;
      canShow = canShow && width > 0 && headTop > height + 32;
      if (visible && !canShow) { wait(6000); return; }
      if (!visible && !(due && canShow)) return;
      const preferred = x < viewportWidth / 2 ? x - 42 : x + 42 - width;
      const left = Math.max(12, Math.min(viewportWidth - width - 12, preferred));
      writeStyle(element, 'left', `${left}px`);
      writeStyle(element, 'top', `${headTop - height - 25}px`);
      writeStyle(element, '--tim-thought-tail', `${Math.max(22, Math.min(width - 22, x - left))}px`);
      if (!visible) {
        due = false;
        show(true);
        schedule(6500, () => { if (!held()) wait(); });
      }
    },
    destroy() { clear(); available = false; show(false); observer.disconnect(); lifetime.abort(); },
  };
}
