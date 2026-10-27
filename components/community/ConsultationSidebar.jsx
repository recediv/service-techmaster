import ConsultationLinks from './ConsultationLinks';
import './consultation-sidebar.css';

export default function ConsultationSidebar({ model }) {
  const hasLinks = Boolean(model.community?.relatedConsultations?.length);
  if (!hasLinks) return null;
  return <aside className="consultation-sidebar" id="device-solutions" aria-labelledby="device-solutions-title">
    <section className="consultation-sidebar__solutions" aria-labelledby="device-solutions-title">
      <h2 className="consultation-sidebar__title" id="device-solutions-title">Решение проблем</h2>
      <nav className="consultation-sidebar__links" aria-labelledby="device-solutions-title"><ConsultationLinks model={model} /></nav>
    </section>
  </aside>;
}
