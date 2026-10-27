import Link from 'next/link';
import { internalHref } from '../../lib/public-urls.mjs';
import { isNonNavigablePagePath } from '../../lib/public-route-policy.mjs';
import './breadcrumbs.css';

function Separator() {
  return <svg className="site-breadcrumbs__separator" aria-hidden="true" focusable="false" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 4 4 4-4 4" /></svg>;
}

function HomeIcon() {
  return <svg className="site-breadcrumbs__home-icon" aria-hidden="true" focusable="false" width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 7-5.5L17 8v8.5H12v-5H8v5H3Z" /></svg>;
}

export default function Breadcrumbs({ model, items = model?.breadcrumbs || [], resource = model?.resource, current }) {
  const chain = items.filter(item => item?.path && Number(item.id) !== 19 && !isNonNavigablePagePath(item.path) && item.id !== resource?.id && item.path !== '/');
  if (resource?.path === '/') return null;
  const title = current || resource?.title;
  if (!title) return null;
  return <nav className="site-breadcrumbs" aria-label="Хлебные крошки">
    <ol className="site-breadcrumbs__list">
      <li className="site-breadcrumbs__item"><Link className="site-breadcrumbs__link site-breadcrumbs__link--home" href={internalHref('/')} prefetch={false}><HomeIcon /><span className="site-breadcrumbs__text">Главная</span></Link></li>
      {chain.map(item => <li className="site-breadcrumbs__item" key={item.id || item.path}><Separator /><Link className="site-breadcrumbs__link" href={internalHref(item.path)} prefetch={false}><span className="site-breadcrumbs__text">{item.menuTitle || item.title}</span></Link></li>)}
      <li className="site-breadcrumbs__item"><Separator /><span className="site-breadcrumbs__current" aria-current="page">{title}</span></li>
    </ol>
  </nav>;
}
