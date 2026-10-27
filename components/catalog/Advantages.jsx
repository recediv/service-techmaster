import { catalogAsset } from './catalog-data.mjs';
import CatalogImage from './CatalogImage';
import HomeAdvantageIcon from '../hero/HomeAdvantageIcon';
import './catalog.css';

const homeValues = ['0 Р', '24/7', '30 минут', null, '10.821'];

function HomeAdvantageText({ text, index }) {
  const value = homeValues[index];
  const position = value ? text.indexOf(value) : -1;
  if (position < 0) return text;
  return <>{text.slice(0, position)}<strong className="site-home-hero__advantage-value">{value}</strong>{text.slice(position + value.length)}</>;
}

function HomeAdvantage({ item, index }) {
  return <li className="advantage">
    <span className="site-home-hero__advantage-icon" aria-hidden="true">
      <HomeAdvantageIcon index={index} />
    </span>
    {item.title && <p><HomeAdvantageText text={item.title} index={index} /></p>}
    {item.note && <span><HomeAdvantageText text={item.note} index={index} /></span>}
  </li>;
}

export default function Advantages({ items = [], model, critical = false, className = '', variant }) {
  if (!items.length) return null;
  if (variant === 'home') {
    return <section className={`advantage_width ${className}`.trim()}>
      <ul className="site-home-hero__conditions" role="list">
        {items.slice(0, 3).map((item, index) => <HomeAdvantage item={item} index={index} key={item.id || item.title || index} />)}
      </ul>
      {items.length > 3 && <ul className="site-home-hero__conditions site-home-hero__assurances" role="list">
        {items.slice(3).map((item, index) => <HomeAdvantage item={item} index={index + 3} key={item.id || item.title || index} />)}
      </ul>}
    </section>;
  }
  return (
    <ul className={`catalog-advantages ${className}`.trim()}>
      {items.map((item, index) => {
        const asset = catalogAsset(model, item.imageAssetId || item.imageUrl);
        return (
          <li className="catalog-advantages__item" key={item.id || item.title || index}>
            <CatalogImage asset={asset} alt="" critical={critical} className="catalog-advantages__icon" />
            <div className="catalog-advantages__copy">
              {item.title && <p className="catalog-advantages__title">{item.title}</p>}
              {item.note && <p className="catalog-advantages__note">{item.note}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

