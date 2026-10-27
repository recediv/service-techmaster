import { withBase } from '../../lib/public-urls.mjs';
import { ContentBlock } from './CatalogContent';
import SiteIcon from '../ui/SiteIcon';
import './category-details.css';

export function CatalogHelp({ phone }) {
  if (!phone?.label) return null;
  return <div className="call_cont catalog-help">
    <section className="catalog-help__card" aria-labelledby="catalog-help-title">
      <div className="catalog-help__media"><img src={withBase('/images/catalog-help-repair-v1.webp')} alt="" width="720" height="480" loading="lazy" decoding="async" /></div>
      <p className="catalog-help__title" id="catalog-help-title">Не нашли в списке компанию производителя Вашего устройства?</p>
      <p className="catalog-help__text">Позвоните по телефону {phone.href ? <a className="catalog-help__phone" href={phone.href}><SiteIcon name="phone" size={20} />{phone.label}</a> : <span className="catalog-help__phone"><SiteIcon name="phone" size={20} />{phone.label}</span>} и опытный специалист ответит на все Ваши вопросы.</p>
    </section>
  </div>;
}

export function CatalogDescription({ html }) {
  if (!html) return null;
  return <div className="service-cont white clearfix catalog-description"><ContentBlock html={html} className="site-prose" /></div>;
}
