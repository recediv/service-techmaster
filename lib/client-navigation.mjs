import { internalHref, withBase } from './public-urls.mjs';

export function navigateOnSite(href, router) {
  const request = new CustomEvent('site:navigate', { detail: { href: withBase(href) }, cancelable: true });
  window.dispatchEvent(request);
  if (!request.defaultPrevented) router.push(internalHref(href));
}
