import { PageHero } from '../hero/HeroFrame';
import ConsultationExplorer from '../community/ConsultationExplorer';
import QuestionCard from '../community/QuestionCard';
import { consultationCardData } from '../../lib/community-data.mjs';

export default function ConsultationTemplate({ model }) {
  const { resource, community } = model;
  const question = community.question || {};
  const metadata = resource.consultationMeta || question;
  const card = consultationCardData({ ...question, ...metadata, id: resource.id, title: resource.title, questionHtml: resource.contentHtml || question.questionHtml, answerHtml: resource.answerHtml || question.answerHtml }, community.filters);
  return <main className="community-page">
    <PageHero model={model} title="Консультация" />
    <div className="center">
    <ConsultationExplorer renderHeading={false} initialTypes={community.filters.types} jsonUrl={community.consultationsJsonUrl} currentId={resource.id}>
      <QuestionCard item={card} headingTag="h2" />
    </ConsultationExplorer>
  </div></main>;
}
