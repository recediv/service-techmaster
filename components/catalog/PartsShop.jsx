import { withBase } from '../../lib/public-urls.mjs';
import Button from '../ui/Button';
import SiteIcon from '../ui/SiteIcon';
import ArrowIcon from '../ui/ArrowIcon';

// Static public copy and classes from MODX templates5/15. The repair-specific
// URL is exported from the reviewed TV/link rule, never guessed in the UI.
export default function PartsShop({ model, variant = 'default' }) {
  const repair = model.resource.type === 'repair';
  const dock = variant === 'dock';
  const card = variant === 'card' || dock;
  const url = repair ? model.resource.partsShopUrl : model.site.headerButtons?.find(item => item.className === 'in_shop')?.path;
  if (!url) return null;
  return <div className={`completing_cont${card ? ' completing_cont--card' : ''}${dock ? ' parts-shop-dock' : ''}`}>
    {!dock && <p>{repair ? <>Вы можете подобрать комплектующие<br />для {model.resource.title} в нашем магазине</> : <>Кстати, для того, чтобы починить свою технику самостоятельно<br />вы можете подобрать комплектующие в нашем интернет-магазине</>}</p>}
    {repair && !card && <span className="completing_arrow" />}
    <Button href={url} variant={card ? 'accent' : 'primary'} className={`button spare${card ? ' parts-shop-card__link' : ''}`} data-tim-parts={repair && !dock ? withBase(model.resource.path) : undefined} data-tim-parts-title={repair && !dock ? model.resource.title : undefined} target="_blank" rel="noopener noreferrer">{card && <SiteIcon name="cart" />}{card ? <span>{repair ? `Запчасти для ${model.resource.title}` : 'Запчасти'}</span> : repair ? `Запчасти для ${model.resource.title}` : 'Запчасти'}{card && <ArrowIcon size={18} />}</Button>
  </div>;
}

export function PartsPriceNote({ prominent = false }) {
  return <div className={`price_info${prominent ? ' price_info--important' : ''}`}>{prominent ? <SiteIcon name="info" size={24} /> : <img src={withBase('/legacy/template/images/feedback.png')} alt="" loading="lazy" />}{' '}Цены указаны без учета стоимости запчастей</div>;
}
