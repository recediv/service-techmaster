import { PageHero } from '../hero/HeroFrame';
import ConsultationExplorer from '../community/ConsultationExplorer';

export default function ConsultationsTemplate({ model }) {
  const community = model.community;
  return <main className="community-page">
    <PageHero model={model} title="Консультации" />
    <div className="center">
    <ConsultationExplorer renderHeading={false} initialItems={community.initialConsultations} initialTotal={community.consultationCount} initialTypes={community.filters.types} jsonUrl={community.consultationsJsonUrl} />
  </div></main>;
}
