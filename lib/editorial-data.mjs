export function editorialImageUrl(resource, assets = {}) {
  const id = resource.imageAssetId || resource.tvs?.articlePic;
  const entry = assets instanceof Map ? assets.get(String(id)) : Array.isArray(assets) ? assets.find(asset => asset.id === id) : assets[id];
  return entry?.url || resource.imageUrl || (typeof id === 'string' && id.startsWith('/') ? id : '');
}

// Only fields read by an index card are sent to the tag filter. Article bodies,
// the full asset manifest and unrelated public catalog never cross this boundary.
export function editorialCardData(resource, assets = {}) {
  return {
    id: resource.id, path: resource.path, title: resource.title || resource.longTitle,
    description: resource.description || '', publishedAt: resource.publishedAt,
    ...(resource.dateLabel ? { dateLabel: resource.dateLabel } : {}),
    imageUrl: editorialImageUrl(resource, assets), tvs: { tags: resource.tvs?.tags || '' },
  };
}

export function editorialTagIsActive(tag) {
  // MODX's :notempty uses PHP empty(), which also considers the string "0" empty.
  return String(tag || '') !== '' && String(tag) !== '0';
}

export function filterEditorialByTag(items, tag) {
  if (!editorialTagIsActive(tag)) return items;
  const query = String(tag).toLocaleLowerCase('ru');
  // The original tags==%query% filter maps to SQL LIKE, rather than an exact
  // comma-separated token. Escape other regexp syntax; retain LIKE wildcards.
  let pattern = '';
  for (let index = 0; index < query.length; index++) {
    const character = query[index];
    if (character === '\\' && index + 1 < query.length) pattern += query[++index].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (character === '%') pattern += '[\\s\\S]*';
    else if (character === '_') pattern += '[\\s\\S]';
    else pattern += character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  const expression = new RegExp(pattern, 'u');
  return items.filter(item => expression.test((Array.isArray(item.tvs?.tags) ? item.tvs.tags.join(',') : String(item.tvs?.tags || '')).toLocaleLowerCase('ru')));
}

export function editorialTagPage(items, tag, requestedPage = 1) {
  const filtered = filterEditorialByTag(items, tag);
  const requested = /^\d+$/.test(String(requestedPage)) && Number(requestedPage) > 0 ? Number(requestedPage) : 1;
  const total = Math.max(1, Math.ceil(filtered.length / 12));
  const outOfRange = requested > total, page = outOfRange ? 1 : requested;
  return { items: filtered.slice((page - 1) * 12, page * 12), page, total, count: filtered.length, outOfRange };
}

export function editorialTagHref(indexPath, tag, page = 1) {
  const query = new URLSearchParams(tag === null || tag === undefined ? {} : { tag: String(tag) });
  if (page > 1) query.set('page', String(page));
  return indexPath + (query.size ? '?' + query : '');
}
