import RichText from '../content/RichText';
import SourceTags from '../content/SourceTags';
import { communityDate } from '../../lib/community-data.mjs';
import CommunityIcon from './CommunityIcon';
import './review-card.css';

export default function ReviewCard({ item, compact = false }) {
  const date = communityDate(item.dateLabel || item.publishedAt);
  const rating = Number(item.rating);
  return <article className="review-card" data-review-id={item.id}>
    <div className="review-card__paper">
      <span className="review-card__quote" aria-hidden="true"><CommunityIcon review /></span>
      {!compact && rating >= 1 && rating <= 5 && <span className={`review-card__rating${rating === 5 ? ' review-card__rating--positive' : rating <= 2 ? ' review-card__rating--negative' : ''}`} aria-label={`Оценка: ${rating} из 5`}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="currentColor"><path d="m12 3 2.78 5.63L21 9.54l-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91Z" /></svg><span>{rating} / 5</span>
      </span>}
      <RichText html={item.textHtml} className="review-card__text" />
      {!compact && item.tags?.length > 0 && <div className="review-card__tags"><SourceTags tags={item.tags} /></div>}
      {(item.authorName || date) && <footer className="review-card__byline">
        <div className="review-card__identity">
          {item.authorName && <span className="review-card__author">{item.authorName}</span>}
          {date && <span className="review-card__date">{date}</span>}
        </div>
      </footer>}
    </div>
    {!compact && item.replyHtml && <section className="review-card__reply" aria-label="Ответ сервисного центра">
      <div className="review-card__reply-header"><span>СЦ Техмастер</span><span className="review-card__date">{communityDate(item.replyDateLabel || item.replyAt)}</span></div>
      <RichText html={item.replyHtml} className="review-card__text" />
    </section>}
  </article>;
}
