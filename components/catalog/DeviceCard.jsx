import Link from 'next/link';
import { internalHref } from '../../lib/public-urls.mjs';
import { resourceImage } from './catalog-data.mjs';
import CatalogImage from './CatalogImage';
import CatalogImagePlaceholder from './CatalogImagePlaceholder';

export default function DeviceCard({ resource, model, critical = false, imageAlt = resource.title, imageTitle = resource.title, ariaLabel, placeholder = false }) {
  const image = resourceImage(model, resource);
  const showPlaceholder = !image && placeholder;
  const hasMedia = Boolean(image || showPlaceholder);
  return (
    <div className={`subcatogory model-card${hasMedia ? '' : ' model-card--text'}`}>
      <Link href={internalHref(resource.path)} prefetch={false} className="subcatogory__link model-card__link" aria-label={ariaLabel}>
        {hasMedia && <div className={`subcatogory__img model-card__media${showPlaceholder ? ' model-card__media--placeholder' : ''}`}>
          {image ? <CatalogImage asset={image} alt={imageAlt} title={imageTitle} critical={critical} /> : <CatalogImagePlaceholder />}
        </div>}
        <div className="model-card__body">
          <p className="subcatogory__title model-card__title">{resource.title}</p>
        </div>
      </Link>
    </div>
  );
}

