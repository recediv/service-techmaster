'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { editorialTagIsActive, editorialTagPage, editorialTagHref } from '../../lib/editorial-data.mjs';
import EditorialCard from './EditorialCard';
import EditorialPagination from './EditorialPagination';

export default function EditorialTagFilter({ items, indexPath, initialPage = 1, children }) {
  const query = useSearchParams();
  const router = useRouter();
  const tag = query.get('tag');
  const active = editorialTagIsActive(tag) || query.has('page');
  const result = active ? editorialTagPage(items, tag, query.get('page') || initialPage) : null;
  useEffect(() => {
    if (result?.outOfRange) router.replace(editorialTagHref(indexPath, tag), { scroll: false });
  }, [result?.outOfRange, indexPath, tag, router]);
  if (!active) return children;
  const pageHref = page => editorialTagHref(indexPath, tag, page);
  const pagination = {
    total: result.total,
    items: Array.from({ length: result.total }, (_, index) => ({ page: index + 1, current: index + 1 === result.page, path: pageHref(index + 1) })),
    prev: result.page > 1 ? pageHref(result.page - 1) : null,
    next: result.page < result.total ? pageHref(result.page + 1) : null,
  };
  return <>
    <div className="editorial-list"><div className="editorial-list__grid">{result.items.map((item, index) => <EditorialCard key={item.id} resource={item} priority={index === 0} />)}</div><EditorialPagination pagination={pagination} /></div>
  </>;
}
