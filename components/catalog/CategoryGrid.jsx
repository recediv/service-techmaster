import Link from 'next/link';
import { internalHref } from '../../lib/public-urls.mjs';
import { resourceImage } from './catalog-data.mjs';
import CatalogImage from './CatalogImage';
import DeviceCard from './DeviceCard';
import './catalog.css';
import './subcategory-grid.css';

export default function CategoryGrid({ items = [], model, variant = 'brands', title }) {
  if (!items.length) return null;
  const sortedItems = [...items].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  if (variant === 'brands') return (
    <div className="subcatogorys model-selection__grid">
      {sortedItems.map(resource => <DeviceCard key={resource.id} resource={resource} model={model} imageAlt={resource.longTitle || resource.title} imageTitle={null} ariaLabel={resource.title} placeholder />)}
    </div>
  );
  const subcategories = variant === 'subcategories';
  return (
    <div className={variant === 'logos' ? 'logos_cont' : `subcatogorys${subcategories ? ' subcategory-grid' : ''}`}>
        {sortedItems.map((resource) => {
          const image = resourceImage(model, resource);
          const visibleTitle = variant !== 'brands' || !image;
          return (
            <div className={variant === 'logos' ? 'logos_respons' : `subcatogory${subcategories && !image ? ' subcatogory--text' : ''}`} key={resource.id}>
              <Link href={internalHref(resource.path)} prefetch={false} className={variant === 'logos' ? undefined : 'subcatogory__link'} aria-label={resource.title}>
                {image && (variant === 'logos' ? <CatalogImage asset={image} alt={resource.longTitle || resource.title} /> : <div className="subcatogory__img"><CatalogImage asset={image} alt={resource.longTitle || resource.title} /></div>)}
                {visibleTitle && variant !== 'logos' && (subcategories ? <div className="subcategory-grid__caption">
                  <div className="subcatogory__title">{resource.title}</div>
                </div> : <div className="subcatogory__title">{resource.title}</div>)}
              </Link>
            </div>
          );
        })}
    </div>
  );
}

