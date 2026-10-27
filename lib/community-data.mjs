const time = item => {
  const value = item?.publishedAt;
  return typeof value === 'number' ? value * (value < 1e12 ? 1000 : 1) : Date.parse(value || '') || 0;
};
export const latestCommunity = items => [...(items || [])].sort((a, b) => time(b) - time(a) || b.id - a.id);
export const latestConsultations = items => [...(items || [])].sort((a,b) => b.id - a.id);
export function consultationCardData(item, filters = {}) {
  const labels = [['vendors', 'vendorIds'], ['models', 'modelIds'], ['types', 'typeIds']].flatMap(([name, idsKey]) => {
    const selected = new Set((item[idsKey] || []).map(Number));
    return (filters[name] || []).filter(option => selected.has(Number(option.id))).map(option => option.title).filter(Boolean);
  });
  return {
    ...Object.fromEntries(['id','path','title','authorName','publishedAt','dateLabel','questionHtml','answerHtml','answerAt'].filter(key => item[key] !== undefined).map(key => [key,item[key]])),
    deviceContext: [...new Set(labels)].join(' · '),
    comments: (item.comments || []).map(comment => Object.fromEntries(['id','parentId','authorName','publishedAt','dateLabel','textHtml'].filter(key => comment[key] !== undefined).map(key => [key,comment[key]]))),
  };
}

// Original getParentCategory examines three ancestors. The two special groups
// override the usual grandparent (the furthest matching ancestor wins).
export function sourceConsultationType(resource, byId) {
  if (resource.type === 'home') return null;
  if (resource.type === 'category' && resource.templateId === 10) return resource.parentId;
  const ancestors = [];
  const seen = new Set([resource.id]);
  let current = resource;
  for (let index = 0; index < 3; index++) {
    current = byId.get(current.parentId);
    if (!current || seen.has(current.id)) break;
    seen.add(current.id); ancestors.push(current.id);
  }
  return ancestors.filter(id => id === 13 || id === 10227).at(-1) ?? ancestors[1] ?? 5;
}

export function communityContext(community = {}, resource = {}, byId = new Map()) {
  const consultations = latestConsultations(community.consultations);
  const reviews = latestCommunity(community.reviews);
  const question = consultations.find(item => item.id === resource.id);
  const typeId = sourceConsultationType(resource, byId);
  const related = typeId ? consultations.filter(item => (item.typeIds || []).includes(typeId)) : consultations;
  const sidebarId = resource.type === 'service' ? resource.id : resource.parentId;
  const solutions = consultations.filter(item => !byId.get(item.id)?.hidemenu && [...(item.typeIds || []),...(item.vendorIds || []),...(item.modelIds || [])].includes(sidebarId))
    .sort((a,b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '') || b.id - a.id);
  const matchingReviews = reviews.filter(item => item.threadKey === 'service_' + typeId);
  const donorReviews = reviews.filter(item => item.threadKey === 'service_' + resource.id);
  const fallbackReviews = reviews.filter(item => item.threadKey === 'service_5');
  const contextualReviews = donorReviews.length ? donorReviews : matchingReviews.length ? matchingReviews : fallbackReviews;
  return {
    consultationCount: consultations.length,
    initialConsultations: consultations.slice(0, 20).map(item => consultationCardData(item, community.filters)),
    otherConsultations: consultations.filter(item => item.id !== resource.id).slice(0, 20).map(item => consultationCardData(item, community.filters)),
    homeConsultations: related.slice(0, resource.type === 'home' ? 5 : 4).map(item => consultationCardData(item, community.filters)),
    homeReviews: contextualReviews.slice(0, 4),
    relatedConsultations: solutions,
    reviews,
    defaultReviewTypeId: 5,
    question,
    filters: community.filters || { types: [], vendors: [], models: [] },
    consultationsJsonUrl: community.consultationsJsonUrl,
    status: community.status,
  };
}

export function consultationMatches(item, { type = 0, vendor = 0, model = 0, query = '' } = {}) {
  if (Number(type) && !(item.typeIds || []).includes(Number(type))) return false;
  if (Number(vendor) && !(item.vendorIds || []).includes(Number(vendor))) return false;
  if (Number(model) && !(item.modelIds || []).includes(Number(model))) return false;
  const plain = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').toLocaleLowerCase('ru').replace(/ё/g, 'е').trim();
  const needle = plain(query);
  return !needle || plain(item.title).includes(needle) || plain(item.questionHtml).includes(needle);
}

export function communityDate(value) {
  if (typeof value === 'number' || /(?:Z|[+-]\d\d:\d\d)$/.test(String(value || ''))) {
    const date = new Date(typeof value === 'number' ? value * (value < 1e12 ? 1000 : 1) : value);
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat('ru-RU', { day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Moscow' }).format(date);
  }
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return match[3] + '.' + match[2] + '.' + match[1];
  const display = String(value || '').match(/^(\d{2})[ .-](\d{2})[ .-](\d{4})/);
  return display ? display[1] + '.' + display[2] + '.' + display[3] : String(value || '');
}

// tickets_search trims this exact PHP character set around the public content.
export const compactCommunityHtml = value => String(value || '').trim().replace(/^[<p>\/\t\n\r ]+|[<p>\/\t\n\r ]+$/g, '');
