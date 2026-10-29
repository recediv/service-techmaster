import RichText from '../content/RichText';
import CommonProblems from '../content/CommonProblems';
import ServiceOverview from '../content/ServiceOverview';
import Advantages from '../catalog/Advantages';
import RepairDirections from '../catalog/RepairDirections';
import CommunityPanels from '../community/CommunityPanels';
import HeroFrame, { HeroTitle } from '../hero/HeroFrame';
import HeroTechBackdrop from '../hero/HeroTechBackdrop';
import '../hero/marketing-hero.css';
import '../hero/hero-tech-backdrop.css';

// Temporarily disabled for the demo; restore the board and its layout with this flag.
const showHeroBoard = false;

export default function HomeTemplate({ model }) {
  const { resource, site = {} } = model;
  const home = site.home || {};
  const title = home.title || resource.longTitle || resource.title;
  return <main className="site-home">
    <HeroFrame model={model} className={`site-hero--home${showHeroBoard ? '' : ' site-hero--home-without-scene'}`} breadcrumbs={false} background={showHeroBoard ? <HeroTechBackdrop /> : null}>
      <div className="site-home-hero__top">
        <div className="site-home-hero__copy">
          <HeroTitle>{title}</HeroTitle>
          <RichText html={home.introHtml || resource.introHtml} className="site-home-hero__intro" />
        </div>
        {showHeroBoard ? <div className="site-home-hero__scene-space" aria-hidden="true" data-page-reveal-skip /> : null}
      </div>
      <Advantages items={home.advantages || []} model={model} critical variant="home" className="site-home-hero__advantages" />
    </HeroFrame>
    <RepairDirections model={model} />
    <div data-page-reveal-skip><CommunityPanels model={model} /></div>
    <CommonProblems groups={home.carousels} />
    <ServiceOverview html={resource.contentHtml} />
  </main>;
}
