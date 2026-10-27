import { withBase } from '../../lib/public-urls.mjs';
import Carousel, { CarouselLink } from '../interactive/Carousel';
import ArrowIcon from '../ui/ArrowIcon';
import './common-problems.css';

export default function CommonProblems({ groups = [] }) {
  const group = groups.find(group => group.id === 'slider_slave');
  if (!group?.items?.length) return null;
  const title = groups.find(group => group.title)?.title;
  return <section className="common-problems" id="common-problems"><div className="common-problems__container">
    {title && <h2 className="common-problems__title">{title}</h2>}
    <div className="common-problems__group common-problems__group--articles">
      <Carousel id={group.id} label="Статьи о ремонте">
        {group.items.map(item => <CarouselLink className={`common-problems__card${item.imageUrl ? '' : ' common-problems__card--text'}`} key={item.path + item.label} href={item.path}>
          {item.imageUrl && <div className="common-problems__media"><img src={withBase(item.imageUrl)} alt="" loading="lazy" decoding="async" /></div>}
          <div className="common-problems__caption"><span>{item.label}</span><ArrowIcon size={18} /></div>
        </CarouselLink>)}
      </Carousel>
    </div>
  </div></section>;
}
