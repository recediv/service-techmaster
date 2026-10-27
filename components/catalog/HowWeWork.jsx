import { load } from 'cheerio';
import RichText from '../content/RichText';
import ScrollReveal from '../ui/ScrollReveal';
import WorkJourney from './WorkJourney';
import WorkStepIcon from './WorkStepIcon';
import './how-we-work.css';

function sourceSteps(html) {
  const $ = load(html, null, false);
  const block = $.root().children('.work_block');
  if (block.length !== 1 || $.root().children().length !== 1) return null;
  if ($.root().contents().toArray().some(node => node.type === 'text' && node.data.trim())) return null;
  const items = block.children('.work_respons');
  if (!items.length || items.length !== block.children().length) return null;
  if (block.contents().toArray().some(node => node.type === 'text' && node.data.trim())) return null;
  const steps = items.toArray().map(item => {
    const node = $(item);
    const number = node.children('.work_num');
    const copy = node.children('.work_text');
    if (node.children().length !== 2 || number.length !== 1 || copy.length !== 1) return null;
    if (node.contents().toArray().some(child => child.type === 'text' && child.data.trim())) return null;
    return { number: number.text().trim(), html: copy.html() };
  });
  return steps.every(step => step?.number && step.html?.trim()) ? steps : null;
}

export default function HowWeWork({ model }) {
  const block = model?.workBlock;
  if (!block?.html) return null;
  const steps = sourceSteps(block.html);
  return <section className="how-we-work" aria-labelledby="how-we-work-title" data-work-block={block.key}>
    <ScrollReveal className="how-we-work__container" selector=".how-we-work__title, .how-we-work__copy" stagger={80} maxDelay={400} animateInitial scope="work" revealKey={model?.resource?.id}>
      <h2 className="how-we-work__title" id="how-we-work-title">Как мы работаем</h2>
      {steps ? <WorkJourney revealKey={model?.resource?.id}><ol className="how-we-work__steps" role="list">
        {steps.map((step, index) => <li className="how-we-work__step" key={index}>
          <div className="how-we-work__node" aria-hidden="true">
            <span className="how-we-work__number">{step.number}</span>
            <WorkStepIcon index={index} html={step.html} />
          </div>
          <RichText html={step.html} className="how-we-work__copy" />
        </li>)}
      </ol></WorkJourney> : <RichText html={block.html} className="how-we-work__fallback" />}
    </ScrollReveal>
  </section>;
}
