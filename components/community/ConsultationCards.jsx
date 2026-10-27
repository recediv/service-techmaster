import QuestionCard from './QuestionCard';

export default function ConsultationCards({ items = [] }) {
  return items.map(item => <QuestionCard key={item.id} item={item} headingTag="h2" />);
}
