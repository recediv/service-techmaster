import Button from '../ui/Button';
import ArrowIcon from '../ui/ArrowIcon';
import QuestionCard from './QuestionCard';
import ReviewCards from './ReviewCards';
import './community-panels.css';

function PanelLink({ href }) {
  return <Button href={href} variant="outline" className="community-panels__all" rel="nofollow">Смотреть все<ArrowIcon size={18} /></Button>;
}

export default function CommunityPanels({ model, showConsultations = true }) {
  const { homeConsultations = [], homeReviews = [] } = model.community || {};
  const reviewHeading = <div className="community-panels__heading"><h2 id="community-reviews-title">Отзывы</h2><PanelLink href="/info/reviews/" /></div>;
  return <div className={`community-panels${showConsultations ? '' : ' community-panels--reviews-only'}`} id="community"><div className="community-panels__container">
    {showConsultations && <section className="community-panels__column" aria-labelledby="community-questions-title">
      <div className="community-panels__heading"><h2 id="community-questions-title">Консультации</h2><PanelLink href="/consultations/" /></div>
      <div className="community-panels__list">{homeConsultations.map(item => <QuestionCard key={item.id} item={item} />)}</div>
    </section>}
    <section className="community-panels__column" aria-labelledby="community-reviews-title">
      {reviewHeading}
      <div className="community-panels__list"><ReviewCards items={homeReviews} compact /></div>
    </section>
  </div></div>;
}
