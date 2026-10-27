import CatalogImage from './CatalogImage';
import { catalogAsset, resourceHeading } from './catalog-data.mjs';
import { withBase } from '../../lib/public-urls.mjs';
import HeroFrame, { HeroTitle } from '../hero/HeroFrame';
import './catalog.css';
import '../hero/marketing-hero.css';

export default function CategoryHero({ model }) {
  const commonHero = model.site?.categoryHero || {};
  const hero = { ...commonHero, ...commonHero.variants?.[model.resource.templateId] };
  return (
    <HeroFrame model={model} className="site-hero--category">
      <div className="site-category-hero__top">
        <div className="site-category-hero__copy">
          <HeroTitle>{resourceHeading(model)}</HeroTitle>
          <div className="site-category-hero__benefits">
            {(hero.benefits || []).map((item, index) => <div className="site-category-hero__benefit" key={item.title || index}>
              {item.title && <p>{item.title}</p>}<div>{item.note}</div>
            </div>)}
          </div>
        </div>
        <div className="site-category-hero__visual"><img src={withBase('/media/f8b89cc86d3aa1cbd6fcd749.jpg')} alt="" width="1920" height="1280" loading="eager" fetchPriority="high" decoding="async" /></div>
      </div>
      <div className="site-category-hero__assurance">
        {hero.asideTitle && <div className="site-category-hero__assurance-title">{hero.asideTitle}</div>}
        <div className="site-category-hero__advantages">
          {(hero.advantages || []).map((item, index) => <div className="site-category-hero__advantage" key={item.title || index}>
            <CatalogImage asset={catalogAsset(model, item.imageAssetId || item.imageUrl)} alt="" critical />
            <div>{item.title && <p>{item.title}</p>}{item.note && <div className="site-category-hero__note">{item.note}</div>}</div>
          </div>)}
        </div>
      </div>
    </HeroFrame>
  );
}

