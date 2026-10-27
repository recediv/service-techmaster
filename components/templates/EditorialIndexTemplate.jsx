import { Suspense } from 'react';
import { PageHero } from '../hero/HeroFrame';
import EditorialCard from '../content/EditorialCard';
import EditorialPagination from '../content/EditorialPagination';
import EditorialTagFilter from '../content/EditorialTagFilter';
import RichText from '../content/RichText';
import '../content/editorial.css';

export default function EditorialIndexTemplate({ model }) {
  const { resource, assets, editorialItems = [], editorialFilterItems = [], pagination } = model;
  const initial = <>
    <div className="editorial-list"><div className="editorial-list__grid">{editorialItems.map((item, index) => <EditorialCard key={item.id} resource={item} assets={assets} priority={index === 0} />)}</div><EditorialPagination pagination={pagination} /></div>
  </>;
  return <main className="site-editorial site-editorial-index">
    <PageHero model={model} />
    <div className="center editorial-page__container">
    {resource.contentHtml && <RichText html={resource.contentHtml} className="site-prose" />}
    <Suspense fallback={initial}><EditorialTagFilter items={editorialFilterItems} indexPath={resource.path} initialPage={pagination.current}>{initial}</EditorialTagFilter></Suspense>
  </div></main>;
}
