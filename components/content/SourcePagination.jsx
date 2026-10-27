import Link from 'next/link';
import { internalHref } from '../../lib/public-urls.mjs';
import { pdoPageEntries } from '../../lib/pagination-data.mjs';

// Original pdoPage default inline chunks and Russian lexicon. Its appearance is
// provided by the unmodified source stylesheet, not a newly designed pager.
export default function SourcePagination({ pagination, label = 'Страницы списка' }) {
  return <ul className="pagination" role="navigation" aria-label={label}>
    {pdoPageEntries(pagination).map(item => <li key={item.key} className={'page-item' + (item.current ? ' active' : !item.href ? ' disabled' : '')}>
      {item.href ? <Link className="page-link" href={internalHref(item.href)} prefetch={false} aria-current={item.current ? 'page' : undefined}>{item.text}</Link> : <span className="page-link">{item.text}</span>}
    </li>)}
  </ul>;
}
