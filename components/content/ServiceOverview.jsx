import RichText from './RichText';
import ScrollReveal from '../ui/ScrollReveal';
import './service-overview.css';

export default function ServiceOverview({ html }) {
  if (!html) return null;
  return <section className="service-overview" id="about"><ScrollReveal className="service-overview__container" selector=".service_title, .service_text"><RichText html={html} className="site-prose site-prose--single-column" /></ScrollReveal></section>;
}
