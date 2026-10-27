(() => {
  const script = document.currentScript;
  const base = new URL('./', script.src);
  const bootstrap = document.documentElement.hasAttribute('data-preview-bootstrap');
  const message = text => { const node = document.getElementById('preview-message'); if (node) node.textContent = text; };
  if (!('serviceWorker' in navigator) || !('DecompressionStream' in window)) {
    if (bootstrap) message('Откройте страницу в актуальном браузере.');
    return;
  }
  let controlled = Boolean(navigator.serviceWorker.controller), reloading = false;
  const reload = () => {
    if (reloading) return;
    const key = 'techmaster-preview-reload:' + base.pathname + location.pathname;
    try {
      const previous = Number(sessionStorage.getItem(key) || 0);
      if (bootstrap && Date.now() - previous < 10000) { message('Не удалось открыть страницу. Обновите её ещё раз.'); return; }
      sessionStorage.setItem(key, String(Date.now()));
    } catch {}
    reloading = true; location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (bootstrap || controlled) reload();
    controlled = true;
  });
  navigator.serviceWorker.register(new URL('preview-sw.js', base), { scope: base.pathname, updateViaCache: 'none' })
    .then(async registration => {
      await navigator.serviceWorker.ready;
      if (bootstrap && navigator.serviceWorker.controller) reload();
      await registration.update();
    }).catch(() => { if (bootstrap) message('Не удалось открыть страницу. Обновите её ещё раз.'); });
})();
