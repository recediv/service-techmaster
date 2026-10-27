import { PageHero } from '../hero/HeroFrame';
import ContactsDetails from '../content/ContactsDetails';
import RepairDirections from '../catalog/RepairDirections';

export default function ContactsTemplate({ model }) {
  const { resource } = model;
  return <>
    <main className="site-editorial site-contacts">
      <PageHero model={model} />
      <ContactsDetails html={resource.contentHtml} />
    </main>
    <RepairDirections model={model} />
  </>;
}
