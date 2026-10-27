import { load } from 'cheerio';
import RichText from './RichText';
import './privacy-content.css';

export default function PrivacyContent({ html = '' }) {
  const $ = load(html, {}, false);
  const headings = $('h1, h2').toArray().map((node, index) => {
    const id = `privacy-section-${index + 1}`;
    $(node).attr('id', id).attr('tabindex', '-1');
    if (node.tagName === 'h1') $(node).addClass('privacy-document__title site-prose__heading');
    return { id, title: $(node).text() };
  });
  return <article className="privacy-document" data-privacy-content="">
    {headings.length > 0 && <details className="privacy-document__contents">
      <summary>Содержание</summary>
      <nav className="privacy-document__toc" aria-label="Разделы политики конфиденциальности">
        {headings.map(heading => <a href={`#${heading.id}`} key={heading.id}>{heading.title}</a>)}
      </nav>
    </details>}
    <RichText className="privacy-document__body site-prose site-prose--single-column" html={$.root().html()} />
  </article>;
}
