import Link from 'next/link';
import { internalHref, richHtml } from '../../lib/public-urls.mjs';
import SourcePagination from '../content/SourcePagination';

export function ContentBlock({ html, className = '' }) {
  return html ? <div className={className || undefined} dangerouslySetInnerHTML={{ __html: richHtml(html) }} /> : null;
}

export function RelatedLinks({ items = [], title = 'Смотрите также' }) {
  if (!items.length) return null;
  return (
    <section className="catalog-related">
      <h2>{title}</h2>
      <ul>{items.map((resource) => <li key={resource.id}><Link href={internalHref(resource.path)} prefetch={false}>{resource.menuTitle || resource.title}</Link></li>)}</ul>
    </section>
  );
}

export function CatalogPagination({ pagination }) {
  return <SourcePagination pagination={pagination} label="Страницы каталога" />;
}

