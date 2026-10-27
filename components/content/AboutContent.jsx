import { load } from 'cheerio';
import RichText from './RichText';
import ScrollReveal from '../ui/ScrollReveal';
import './about-content.css';

function sourceSections(html) {
  const $ = load(html || '', {}, false);
  const nodes = $.root().contents().toArray();
  if (nodes.some(node => node.type === 'text' ? node.data.trim() : node.tagName !== 'p')) return null;
  const paragraphs = $.root().children('p').toArray();
  if (paragraphs.length !== 19
    || $(paragraphs[1]).text().trim() !== 'Виды предоставляемых услуг'
    || $(paragraphs[10]).text().trim() !== 'Преимущества обращения в «Техмастер»'
    || [...paragraphs.slice(3, 9), ...paragraphs.slice(12, 18)].some(node => !/^•\s/.test($(node).text()))) return null;
  const block = index => $.html(paragraphs[index]);
  return {
    intro: block(0),
    sections: [
      { heading: $(paragraphs[1]).html(), lead: block(2), items: paragraphs.slice(3, 9).map(node => $.html(node)), after: block(9) },
      { heading: $(paragraphs[10]).html(), lead: block(11), items: paragraphs.slice(12, 18).map(node => $.html(node)) },
    ],
    closing: block(18),
  };
}

export default function AboutContent({ html = '' }) {
  const content = sourceSections(html);
  // Future source changes retain their entire text even if this structure changes.
  if (!content) return <article className="about-content about-content--plain site-prose site-prose--single-column"><RichText html={html} /></article>;
  return <ScrollReveal className="about-reveal" selector=".about-content > *" stagger={80} animateInitial><article className="about-content site-prose site-prose--single-column site-prose--literal-bullets">
    <RichText html={content.intro} className="about-content__intro" />
    {content.sections.map((section, index) => <section className={`about-content__section${index ? ' about-content__section--advantages' : ''}`} key={index}>
      <RichText html={section.heading} as="h2" className="about-content__heading" />
      <div className="about-content__section-copy">
        <RichText html={section.lead} className="about-content__lead" />
        <ul className="about-content__list">{section.items.map((item, itemIndex) => <li key={itemIndex}><RichText html={item} className="about-content__list-copy" /></li>)}</ul>
        {section.after && <RichText html={section.after} className="about-content__after" />}
      </div>
    </section>)}
    <RichText html={content.closing} className="about-content__closing" />
  </article></ScrollReveal>;
}
