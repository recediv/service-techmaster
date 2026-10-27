import '../../public/legacy/assets/components/star_rating/themes/default/star.css';

// Original template 15: none of its public resources has any recorded votes.
export default function SourceStarRating() {
  return <>
    <ul className="star-rating-default" style={{ width: '125px' }}>
      <li className="current-rating" style={{ width: '0%' }}><span itemProp="ratingValue">0</span></li>
      {[1, 2, 3, 4, 5].map(star => <li className="star" key={star}><span>{star}</span></li>)}
    </ul>
    <span className="totalvotes">Votes: 0</span>
  </>;
}
