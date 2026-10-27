// pdoPage buildClassicPagination with the original pageLimit=5.
export function classicPageWindow(current, total) {
  const page = Number(current) || 1, pages = Number(total) || 1;
  if (pages <= 1) return [];
  const first = pages < 5 ? 1 : Math.max(1, Math.min(page - 2, pages - 4));
  return Array.from({ length: Math.min(5, pages) }, (_, index) => first + index);
}

export function pdoPageEntries(pagination = {}) {
  const items = pagination.links || pagination.items || [];
  const current = pagination.current || pagination.page || items.find(item => item.current)?.page || 1;
  const total = pagination.pageCount || pagination.total || 1;
  if (total <= 1) return [];
  const path = page => items.find(item => item.page === page)?.path;
  return [
    { key: 'first', text: 'Первая', href: current > 1 ? path(1) : null },
    { key: 'prev', text: '«', href: current > 1 ? path(current - 1) : null },
    ...classicPageWindow(current, total).map(page => ({ key: 'page-' + page, text: String(page), href: path(page), current: page === current })),
    { key: 'next', text: '»', href: current < total ? path(current + 1) : null },
    { key: 'last', text: 'Последняя', href: current < total ? path(total) : null },
  ];
}
