export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export function internalHref(value = '/') {
  const sourcePath = String(value || '/');
  const path = sourcePath === '/status/' ? '/info/status/' : sourcePath;
  return basePath && (path === basePath || path.startsWith(basePath + '/'))
    ? path.slice(basePath.length) || '/' : path;
}

export function withBase(value = '') {
  const url = String(value || '').split('__DEMO_BASE__').join(basePath);
  if (!url.startsWith('/') || url.startsWith('//') || !basePath) return url;
  return url === basePath || url.startsWith(basePath + '/') ? url : basePath + url;
}

export function richHtml(value = '') {
  let html = String(value || '').split('__DEMO_BASE__').join(basePath);
  if (!basePath) return html;
  html = html.replace(/\b(href|src|poster)=(["'])(\/(?!\/)[^"']*)\2/gi,
    (_, name, quote, url) => name + '=' + quote + withBase(url) + quote);
  return html.replace(/url\(\s*(["']?)(\/(?!\/)[^"')\s]+)\1\s*\)/gi,
    (_, quote, url) => 'url(' + quote + withBase(url) + quote + ')');
}

export function getAsset(model, value) {
  if (!value) return null;
  if (typeof value === 'object') {
    if (value.url || value.src) return { ...value, url: value.url || value.src };
    value = value.id || value.assetId;
  }
  const item = model?.assets instanceof Map ? model.assets.get(String(value)) : model?.assets?.[value];
  if (item) return item;
  return typeof value === 'string' && value.startsWith('/') ? { id: value, url: value } : null;
}
