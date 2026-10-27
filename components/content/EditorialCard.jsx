import Link from 'next/link';
import { internalHref, withBase } from '../../lib/public-urls.mjs';
import SourceTags from './SourceTags';
import SiteIcon from '../ui/SiteIcon';
import { editorialImageUrl } from '../../lib/editorial-data.mjs';

export function publicDate(value) {
  if (!value) return '';
  const date = new Date(typeof value === 'number' ? value * 1000 : value);
  if (Number.isNaN(date.getTime())) return '';
  // The original cached public dates use UTC+3 (five independently matched
  // resource timestamps), regardless of the city shown in the page copy.
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(date).replace(',', '');
}

export function resourceImage(resource, assets = {}) {
  return editorialImageUrl(resource, assets);
}

export default function EditorialCard({ resource, assets, compact = false, showImage = true, priority = false }) {
  if (!resource?.path) return null;
  const image = showImage ? resourceImage(resource, assets) : '';
  const title = resource.title || resource.longTitle;
  const date = (resource.dateLabel || publicDate(resource.publishedAt)).replace(/^(\d{2}) (\d{2}) (\d{4})(?=\s|$)/, '$1.$2.$3');
  const tags = Array.isArray(resource.tvs?.tags) ? resource.tvs.tags : String(resource.tvs?.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
  if (compact) return <div className="info_block">
    {image && <div className="info_img"><img src={withBase(image)} alt="" loading="lazy" decoding="async" /></div>}
    {!showImage && date && <span>{date}</span>}
    <Link href={internalHref(resource.path)} prefetch={false}>{title}</Link>
    {showImage && date && <span>{date}</span>}
  </div>;
  return <article className={`editorial-card${image ? '' : ' editorial-card--text'}`}>
    <Link className="editorial-card__image" href={internalHref(resource.path)} prefetch={false} tabIndex={-1} aria-hidden="true">{image
      ? <img src={withBase(image)} alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" />
      : <span className="editorial-card__placeholder"><SiteIcon name="article" size={64} /></span>}</Link>
    <div className="editorial-card__content">
      <h2 className="editorial-card__title"><Link href={internalHref(resource.path)} prefetch={false}>{title}</Link></h2>
      {resource.description && <p className="editorial-card__description">{resource.description}</p>}
      <div className="editorial-card__meta">
        {date && <time className="editorial-card__date" dateTime={resource.publishedAt || undefined}>{date}</time>}
        <div className="editorial-card__tags"><SourceTags tags={tags} /></div>
      </div>
    </div>
  </article>;
}
