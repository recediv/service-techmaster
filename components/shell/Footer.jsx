import Link from 'next/link';
import { internalHref, withBase } from '../../lib/public-urls.mjs';
import { editorialImageUrl } from '../../lib/editorial-data.mjs';
import { communityDate } from '../../lib/community-data.mjs';
import SiteIcon from '../ui/SiteIcon';
import Button from '../ui/Button';
import ArrowIcon from '../ui/ArrowIcon';
import ScrollReveal from '../ui/ScrollReveal';
import PrivacyLink from '../content/PrivacyLink';
import './footer.css';

function EditorialColumn({ title, items = [], path, label, assets, showImage }) {
  if (!items.length) return null;
  return <section className={`site-footer__column site-footer__column--${showImage ? 'articles' : 'news'}`}>
    <h2 className="site-footer__heading">{title}</h2>
    <ul className="site-footer__editorial-list">{items.map(item => {
      const image = showImage ? editorialImageUrl(item, assets) : '';
      const date = communityDate(item.dateLabel || item.publishedAt);
      return <li className="site-footer__editorial-item" key={item.id || item.path}>
        <Link className={`site-footer__editorial-link${image ? ' site-footer__editorial-link--image' : ''}`} href={internalHref(item.path)} prefetch={false}>
          {image && <img className="site-footer__editorial-image" src={withBase(image)} alt="" loading="lazy" decoding="async" />}
          <span className="site-footer__editorial-copy">
            <span className="site-footer__editorial-title">{item.title || item.longTitle}</span>
            {date && <span className="site-footer__date">{date}</span>}
          </span>
        </Link>
      </li>;
    })}</ul>
    <Button className="site-footer__all" href={path} variant="muted">{label}<ArrowIcon size={18} /></Button>
  </section>;
}

export default function Footer({ model }) {
  const { site = {}, assets = {} } = model;
  const { footer = {}, contacts = {}, brand = {} } = site;
  return <>
    <div className="info_cont site-footer-info"><ScrollReveal className="site-footer__container site-footer__grid">
      <EditorialColumn title="Новые статьи" items={footer.articleItems} path="/info/articles/" label="Все статьи" assets={assets} showImage />
      <EditorialColumn title="Новости" items={footer.newsItems} path="/info/news/" label="Все новости" assets={assets} showImage={false} />
      <section className="site-footer__column site-footer__contacts vcard" id="contacts">
        <h2 className="site-footer__heading">Свяжитесь с нами</h2>
        <div className="site-footer__organization"><span className="category">Сервисный Центр </span><span className="fn org">{contacts.organization || brand.name}</span></div>
        <div className="site-footer__contact-list">
          {contacts.address && <div className="site-footer__contact-row adr"><span className="site-footer__contact-symbol" aria-hidden="true"><SiteIcon name="pin" /></span><p>{contacts.address}</p></div>}
          {contacts.phone && <div className="site-footer__contact-row"><span className="site-footer__contact-symbol" aria-hidden="true"><SiteIcon name="phone" /></span><p className="tel"><a href={contacts.phone.href}>{contacts.phone.label}</a></p></div>}
          {contacts.email && <div className="site-footer__contact-row"><span className="site-footer__contact-symbol" aria-hidden="true"><SiteIcon name="mail" /></span><p><a className="email" href={'mailto:' + contacts.email}>{contacts.email}</a></p></div>}
          {contacts.hours?.length > 0 && <div className="site-footer__contact-row"><span className="site-footer__contact-symbol" aria-hidden="true"><SiteIcon name="clock" /></span><p><span className="site-footer__hours-label">Время работы:</span><span className="workhours">{contacts.hours.map(line => <span className="site-hours-line" key={line}>{line}</span>)}</span></p></div>}
        </div>
        {contacts.privacyPath && <PrivacyLink href={contacts.privacyPath}>Политика конфиденциальности</PrivacyLink>}
        {contacts.socialLinks?.length > 0 && <div className="site-footer__social-block"><div className="site-footer__social-title">Мы в социальных сетях</div><div className="sety site-footer__socials">{contacts.socialLinks.map(link => <a key={link.url} href={link.url} className={link.iconClass} title={link.label} aria-label={link.label} target={link.target || '_blank'} rel={link.rel || 'nofollow noopener noreferrer'} />)}</div></div>}
      </section>
    </ScrollReveal></div>
    <footer className="footer site-footer"><ScrollReveal className="site-footer__container site-footer__bottom">
      <p className="site-footer__legal"><span>{footer.copyright}</span><span>{footer.legalName}</span></p>
      {footer.paymentImages?.length > 0 && <div className="site-footer__payments">{footer.paymentImages.map(image => <img key={image.url || image} src={withBase(image.url || image)} alt={image.alt || ''} loading="lazy" decoding="async" />)}</div>}
    </ScrollReveal></footer>
  </>;
}
