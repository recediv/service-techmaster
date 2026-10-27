import RichText from '../content/RichText';
import { communityDate } from '../../lib/community-data.mjs';
import CommunityIcon from './CommunityIcon';
import './question-card.css';

export default function QuestionCard({ item, headingTag: Heading = 'h3' }) {
  const date = communityDate(item.dateLabel || item.publishedAt);
  const comments = item.comments || [];
  return <article className="question-card" id={`question-${item.id}`} data-consultation-id={item.id}>
    <header className="question-card__header">
      <div className="question-card__byline">
        <span className="question-card__icon"><CommunityIcon /></span>
        <div className="question-card__identity">
          {item.authorName && <span className="question-card__author">{item.authorName}</span>}
          {date && <span className="question-card__date">{date}</span>}
        </div>
      </div>
      {item.deviceContext && <div className="question-card__device" aria-label="Устройство">{item.deviceContext.split(' · ').map(value => <span key={value}>{value}</span>)}</div>}
    </header>
    <div className="question-card__body">
      {item.title && <Heading className="question-card__title">{item.title}</Heading>}
      <RichText html={item.questionHtml} className="question-card__text" />
      {(item.answerHtml || comments.length > 0) && <details className="question-card__answer">
        <summary><span>{comments.length > 0 ? 'Ответы и комментарии' : 'Ответ сервисного центра'}</span><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></summary>
        <RichText html={item.answerHtml} className="question-card__answer-text" />
        {comments.length > 0 && <div className="question-card__comments">{comments.map(comment => <div className={`question-card__comment${comment.parentId ? ' question-card__comment--reply' : ''}`} key={comment.id} data-comment-id={comment.id}>
          <div className="question-card__comment-meta"><span>{comment.authorName}</span><span>{communityDate(comment.dateLabel || comment.publishedAt)}</span></div>
          <RichText html={comment.textHtml} className="question-card__comment-text" />
        </div>)}</div>}
      </details>}
    </div>
  </article>;
}
