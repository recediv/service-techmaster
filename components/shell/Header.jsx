import Link from 'next/link';
import { Fragment } from 'react';
import { internalHref, withBase } from '../../lib/public-urls.mjs';
import Navigation from './Navigation';
import BrandLogo from './BrandLogo';
import Button from '../ui/Button';
import SiteIcon from '../ui/SiteIcon';

export default function Header({ site = {} }) {
  const { brand = {}, navigation = [], informationNavigation = [], headerButtons = [], contacts = {} } = site;
  const time = contacts.headerTime;
  const originalLogo = brand.logoUrl || '/legacy/template/images/logotip.png';
  const vectorLogo = ['/legacy/template/images/logotip.png', '/legacy/template/images/logotip.svg'].includes(originalLogo);
  const logoLabel = brand.name || 'Сервисный центр';
  return <header className="header site-header" id="top">
    <div className="center site-header-inner">
      <div className="site-header-top">
        <div className="logo site-brand"><Link href={internalHref('/')} prefetch={false}>{vectorLogo
          ? <BrandLogo label={logoLabel} />
          : <img src={withBase(originalLogo)} alt={logoLabel} width="245" height="73" fetchPriority="high" />}</Link></div>
        {time && <div className="site-header-contact">
          {time.phone && <span className="site-header-contact-icon"><SiteIcon name="phone" size={20} /></span>}
          <div className="site-header-contact-copy">
            {time.phone && <a className="site-header-phone" href={time.phone.href}>{time.phone.label}</a>}
            {time.hours && <span className="site-header-hours"><SiteIcon name="clock" size={12} /><span>{time.hours}</span></span>}
          </div>
        </div>}
        {time?.messengers?.length > 0 && <div className="site-header-chat"><span>{time.chatLabel}</span>{time.messengers.map((link) => <Fragment key={link.url}>{link.svgHtml
            ? <a href={link.url} title={link.title} target={link.target} rel={link.rel} dangerouslySetInnerHTML={{ __html: link.svgHtml }} />
            : <a href={link.url} title={link.title} target={link.target} rel={link.rel}><img src={withBase(link.imageUrl)} alt={link.alt || ''} width={link.width} height={link.height} /></a>}</Fragment>)}</div>}
        {headerButtons.length > 0 && <div className="shop_cont site-header-actions">{headerButtons.map(button => {
          const status = /\b(?:site_status|status)\b/.test(button.className || '');
          return <Button key={button.path} variant={status ? 'accent' : 'primary'} className={['button', button.className].filter(Boolean).join(' ')} href={button.path} target={button.target} rel={button.rel} data-tim-order-link={status ? '' : undefined} data-site-dialog={status ? '' : undefined}><SiteIcon name={status ? 'repair' : 'cart'} size={18} /><span>{button.label}</span></Button>;
        })}</div>}
      </div>
      <Navigation items={navigation} informationItems={informationNavigation} />
    </div>
  </header>;
}
