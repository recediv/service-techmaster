// The information container remains in the resource tree, without a public page.
export function isNonNavigablePagePath(value) {
  const pathname = String(value || '').split(/[?#]/, 1)[0];
  return pathname === '/info/' || pathname === '/info';
}

export function isPublicPageRoute(route) {
  return Number(route.resourceId) !== 19 && !isNonNavigablePagePath(route.path);
}

export function isPublicPageAlias(alias) {
  return !isNonNavigablePagePath(alias.from) && !isNonNavigablePagePath(alias.to);
}
