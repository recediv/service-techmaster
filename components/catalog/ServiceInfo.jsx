import { richHtml } from '../../lib/public-urls.mjs';
import { catalogAsset } from './catalog-data.mjs';
import './catalog.css';

export default function ServiceInfo({ model }) {
  const info = model?.site?.serviceIntro;
  if (!info || (!info.title && !info.contentHtml)) return null;
  const image = catalogAsset(model, info.imageAssetId || info.imageUrl);
  return (
    <section className="catalog-service-info" style={image ? { '--catalog-service-image': `url("${image.url}")` } : undefined}>
      <div className="catalog-container">
        <div className="catalog-service-info__copy">
          {info.title && <h2>{info.title}</h2>}
          {info.contentHtml && <div className="catalog-rich" dangerouslySetInnerHTML={{ __html: richHtml(info.contentHtml) }} />}
        </div>
      </div>
    </section>
  );
}

