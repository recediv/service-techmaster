import Link from 'next/link';
import { internalHref } from '../../lib/public-urls.mjs';
import SectionIcon from '../shell/SectionIcon';
import ArrowIcon from '../ui/ArrowIcon';
import ScrollReveal from '../ui/ScrollReveal';
import './repair-directions.css';

export default function RepairDirections({ model }) {
  const recommendations = model?.site?.home?.recommendations || [];
  if (!recommendations.length) return null;
  const services = model.site.navigation?.find(item => item.path === '/services/');
  const paths = new Set(recommendations.map(item => item.path));
  const items = [...recommendations, ...(services?.children || []).filter(item => !paths.has(item.path)).map(({ label, path }) => ({ label, path }))];
  return (
    <section className="repair-directions" id="recom" aria-labelledby="repair-directions-title">
      <ScrollReveal className="repair-directions__container" selector=".repair-directions__grid > li" stagger={60}>
        <h2 className="repair-directions__title" id="repair-directions-title">{model.site.home.recommendationsTitle || 'Что мы ремонтируем'}</h2>
        <ul className="repair-directions__grid">{items.map(item => <li key={item.path}>
          <Link className="repair-directions__link" href={internalHref(item.path)} prefetch={false}>
            <span className="repair-directions__icon" aria-hidden="true"><SectionIcon path={item.path} motionParts /></span>
            <span className="repair-directions__label">{item.label || `${item.prefix || 'Ремонт '}${item.emphasis || ''}`}</span>
            <ArrowIcon size={18} className="repair-directions__arrow" />
          </Link>
        </li>)}</ul>
      </ScrollReveal>
    </section>
  );
}
