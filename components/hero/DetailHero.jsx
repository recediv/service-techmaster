import CatalogImage from '../catalog/CatalogImage';
import { resourceHeading } from '../catalog/catalog-data.mjs';
import HeroFrame, { HeroTitle } from './HeroFrame';
import './detail-hero.css';

export default function DetailHero({ model, assets = [], imageAlt = '', className = '', children }) {
  return <HeroFrame model={model} className={`site-hero--detail${assets.length ? ' site-hero--detail-with-image' : ''}${className ? ` ${className}` : ''}`}>
    <div className="site-detail-hero__layout">
      <div className="site-detail-hero__copy">
        <HeroTitle>{resourceHeading(model)}</HeroTitle>
        {children}
      </div>
      {assets.length > 0 && <div className="site-detail-hero__media">
        <div className="site-detail-hero__images">
          {assets.map(asset => <CatalogImage key={asset.id || asset.url} asset={asset} alt={imageAlt} critical />)}
        </div>
      </div>}
    </div>
  </HeroFrame>;
}
