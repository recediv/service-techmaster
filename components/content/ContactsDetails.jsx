import { load } from 'cheerio';
import RichText from './RichText';
import SiteIcon from '../ui/SiteIcon';
import './contacts-details.css';

// Keep the exported contact copy and icons as the source of every visible field.
function contactSections(html) {
  const $ = load(html || '', null, false);
  const content = $('.contacts_page .contacts_text').first();
  if (!content.length) return null;
  const label = pattern => content.children('.strong_text').filter((_, node) => pattern.test($(node).text().trim())).first();
  const business = content.children('a[itemprop="url"]').first();
  const phone = content.find('[itemprop="telephone"]').first();
  const email = content.find('[itemprop="email"]').first();
  const hours = content.find('[itemprop="openingHours"]').first().closest('p');
  const chat = content.children('p').filter((_, node) => $(node).find('a[href]').length > 0).first();
  const address = content.children('[itemprop="address"]').first();
  const legalLabel = label(/^Реквизиты:/);
  const legal = legalLabel.add(legalLabel.nextAll());
  const phoneLabel = label(/^Телефон/);
  const emailLabel = label(/^E-mail:/);
  const hoursLabel = label(/^График работы:/);
  const holidays = label(/^Праздничные дни/);

  // Native actions retain the exact printed phone/email and their microdata.
  if (phone.length) phone.wrap($('<a>').attr('href', `tel:${phone.text().replace(/[^+\d]/g, '')}`));
  if (email.length) email.wrap($('<a>').attr('href', `mailto:${email.text().trim()}`));
  chat.find('a').each((_, node) => {
    const link = $(node);
    link.attr('aria-label', link.find('img').attr('alt') || link.attr('title') || 'Telegram');
    if (link.attr('target') === '_blank') link.attr('rel', 'noopener noreferrer');
  });
  chat.find('b').filter((_, node) => /^Чат:$/.test($(node).text().trim())).remove();

  const take = nodes => {
    const value = nodes.toArray().map(node => $.html(node)).join('');
    nodes.remove();
    return value;
  };
  // The icons identify these fields; keep the contact values without repeating labels.
  const addressLabel = address.find('.strong_text').filter((_, node) => /^Адрес:$/.test($(node).text().trim()));
  phoneLabel.add(emailLabel).add(hoursLabel).add(addressLabel).remove();
  const sections = {
    business: take(business),
    phone: take(phone.parent('a')),
    chat: take(chat),
    email: take(email.closest('p')),
    hours: take(hours.add(holidays)),
    address: take(address).replace(/<(\/?)adress\b/g, '<$1address'),
    legal: take(legal),
  };
  // Unknown future contact copy remains visible rather than disappearing.
  sections.extra = content.text().trim() || content.find('img, svg, iframe').length ? content.html() : '';
  return sections;
}

export default function ContactsDetails({ html }) {
  const sections = contactSections(html);
  if (!sections) return <RichText html={html} className="contacts-content site-prose site-prose--single-column" />;
  return <section className="contacts-details" itemScope itemType="//schema.org/LocalBusiness">
    <div className="contacts-details__container">
      <div className="contacts-details__heading">
        <RichText html={sections.business} className="contacts-details__business" />
        <RichText html={sections.chat} className="contacts-details__chat" />
      </div>
      <div className="contacts-details__grid">
        <div className="contacts-details__card contacts-details__card--reach">
          <div className="contacts-details__row contacts-details__phone">
            <span className="contacts-details__icon"><SiteIcon name="phone" size={25} /></span>
            <RichText html={sections.phone} />
          </div>
          <div className="contacts-details__row contacts-details__email">
            <span className="contacts-details__icon"><SiteIcon name="mail" size={23} /></span>
            <RichText html={sections.email} />
          </div>
        </div>
        <div className="contacts-details__card contacts-details__card--visit">
          <div className="contacts-details__row contacts-details__address">
            <span className="contacts-details__icon"><SiteIcon name="pin" size={25} /></span>
            <RichText html={sections.address} />
          </div>
          <div className="contacts-details__row contacts-details__hours">
            <span className="contacts-details__icon"><SiteIcon name="clock" size={24} /></span>
            <RichText html={sections.hours} />
          </div>
        </div>
      </div>
      <RichText html={sections.legal} className="contacts-details__legal" />
      <RichText html={sections.extra} className="contacts-details__extra site-prose site-prose--single-column" />
    </div>
  </section>;
}
