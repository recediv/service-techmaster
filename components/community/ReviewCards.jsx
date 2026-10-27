import ReviewCard from './ReviewCard';

export default function ReviewCards({ items = [], compact = false }) {
  return items.map(item => <ReviewCard key={item.id} item={item} compact={compact} />);
}
