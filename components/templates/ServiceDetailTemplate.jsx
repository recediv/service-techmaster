import PriceSection from '../catalog/PriceSection';
import RepairDirections from '../catalog/RepairDirections';
import PartsShop, { PartsPriceNote } from '../catalog/PartsShop';
import { resourceImage } from '../catalog/catalog-data.mjs';
import { ContentBlock } from '../catalog/CatalogContent';
import ConsultationSidebar from '../community/ConsultationSidebar';
import SourceStarRating from '../catalog/SourceStarRating';
import DetailHero from '../hero/DetailHero';
import Button from '../ui/Button';
import HowWeWork from '../catalog/HowWeWork';
import '../catalog/catalog.css';

export default function ServiceDetailTemplate({ model }) {
  const { resource } = model;
  const image = resourceImage(model, resource);
  const hasConsultations = Boolean(model.community?.relatedConsultations?.length);
  return (
    <main className="catalog-source catalog-service-detail">
      <DetailHero model={model} assets={image ? [image] : []} imageAlt={resource.title}>
        <div className="site-detail-hero__actions">
          <Button href="#recom" variant="accent" className="button fix anchor">Починить устройство</Button>
          <div className="site-detail-hero__rating"><SourceStarRating /></div>
        </div>
      </DetailHero>
      <div className={`center site-detail-body${hasConsultations ? ' site-detail-body--with-sidebar' : ''}`}>
        <div className="center_marg" id="center_marg_product"><div className="center_col">
            <PartsShop model={model} />
            <div className="ceni"><PriceSection table={model.priceTable} bare /></div>
            <PartsPriceNote />
        </div></div>
        <ConsultationSidebar model={model} />
      </div>
      {resource.contentHtml && <div className="service_cont white_usluga site-prose-section"><div className="context_usluga site-prose-section__inner"><ContentBlock html={resource.contentHtml} className="site-prose" /></div></div>}
      <HowWeWork model={model} />
      <RepairDirections model={model} />
    </main>
  );
}

