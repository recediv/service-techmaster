import { PageHero } from '../hero/HeroFrame';
import ReviewsSection from '../community/ReviewsSection';
import { defaultCity } from '../../lib/site-city.mjs';

export default function ReviewsTemplate({ model }) {
  return <main className="community-page">
    <PageHero model={model} title={`Сервисный центр «ТехМастер» в ${defaultCity.prepositional}: отзывы клиентов`} />
    <div className="center reviews-page__content">
    <ReviewsSection model={model} inline={false} />
  </div></main>;
}
