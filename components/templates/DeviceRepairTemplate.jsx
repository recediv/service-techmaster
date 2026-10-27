import PriceSection from '../catalog/PriceSection';
import RepairDirections from '../catalog/RepairDirections';
import PartsShop, { PartsPriceNote } from '../catalog/PartsShop';
import PartsShopDock from '../catalog/PartsShopDock';
import { catalogAsset } from '../catalog/catalog-data.mjs';
import CommunityPanels from '../community/CommunityPanels';
import ConsultationSidebar from '../community/ConsultationSidebar';
import DetailHero from '../hero/DetailHero';
import ArrowIcon from '../ui/ArrowIcon';
import HowWeWork from '../catalog/HowWeWork';
import '../catalog/catalog.css';
import '../catalog/device-detail.css';

export default function DeviceRepairTemplate({ model }) {
  const { resource } = model;
  const hasSolutions = Boolean(model.community?.relatedConsultations?.length);
  const hasPrices = Boolean(model.priceTable);
  const ids = [...new Set([resource.imageAssetId, ...(resource.galleryAssetIds || [])].filter(Boolean))];
  const gallery = ids.map((id) => catalogAsset(model, id)).filter(Boolean);
  return (
    <main className="catalog-source catalog-device-detail catalog-device-detail--refined">
      <DetailHero model={model} assets={gallery} imageAlt={resource.title} className={`site-hero--device-refined${gallery.length > 1 ? ' site-hero--device-gallery' : ''}`}>
        <PartsShop model={model} variant="card" />
        <div className="device-detail__actions">
          {hasPrices && <a href="#device-prices" className="device-detail__price-link">Цены на ремонт<ArrowIcon size={18} /></a>}
          {hasSolutions && <a href="#device-solutions" className="device-detail__solutions-link">Решение проблем<ArrowIcon size={18} /></a>}
        </div>
      </DetailHero>
      <div className={`center site-detail-body${hasSolutions ? ' site-detail-body--with-sidebar' : ''}`}>
        <div className="center_marg" id="center_marg_product">
          <div className="center_col">
            <div className="ceni" id="device-prices">
              {hasPrices && <h2 className="device-detail__section-title">Цены на ремонт</h2>}
              <PartsPriceNote prominent />
              <PriceSection table={model.priceTable} bare />
            </div>
          </div>
        </div>
        <ConsultationSidebar model={model} />
      </div>
      <HowWeWork model={model} />
      <RepairDirections model={model} />
      <CommunityPanels model={model} showConsultations={false} />
      <PartsShopDock><PartsShop model={model} variant="dock" /></PartsShopDock>
    </main>
  );
}

