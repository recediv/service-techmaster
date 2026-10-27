import { statusWidgetUrl } from '../../lib/status-widget.mjs';
import { PageHero } from '../hero/HeroFrame';
import StatusWidget from '../community/StatusWidget';
import '../community/community.css';

export default function OrderStatusTemplate({ model }) {
  const widget = model.community.status.widget;
  return <main>
    <PageHero model={model} />
    <div className="center"><div className="work_title">
      <StatusWidget src={statusWidgetUrl(widget)} title={widget.options.title} width={widget.options.width} height={widget.options.height} />
    </div></div></main>;
}
