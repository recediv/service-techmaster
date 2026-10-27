import CategoryHero from '../catalog/CategoryHero';
import CategoryGrid from '../catalog/CategoryGrid';
import DeviceCard from '../catalog/DeviceCard';
import PriceSection from '../catalog/PriceSection';
import ModelPicker from '../catalog/ModelPicker';
import { CatalogHelp, CatalogDescription } from '../catalog/CategoryDetails';
import RepairDirections from '../catalog/RepairDirections';
import CommunityPanels from '../community/CommunityPanels';
import ReviewsSection from '../community/ReviewsSection';
import { defaultCity } from '../../lib/site-city.mjs';
import { CatalogPagination, ContentBlock } from '../catalog/CatalogContent';
import HowWeWork from '../catalog/HowWeWork';
import '../catalog/catalog.css';
import '../catalog/model-selection.css';

export default function CategoryTemplate({ model }) {
  const { resource, children = [], allChildren = children } = model;
  const models = resource.templateId === 10;
  const versions = allChildren.filter((item) => item.templateId === 5 || item.type === 'repair');
  const categoryItems = children.filter((item) => item.templateId !== 5 && item.type !== 'repair');
  const devices = children.filter((item) => item.templateId === 5 || item.type === 'repair');
  const variant = resource.templateId === 16 ? 'subcategories' : resource.id === 4 ? 'directions' : 'brands';
  const choicesClass = variant === 'subcategories' ? ' catalog-category-choices' : '';
  return (
    <main className={`catalog-source catalog-category--${resource.templateId}`}>
      <CategoryHero model={model} />
      <PriceSection table={model.priceTable} title={resource.priceHeading} />
      {models ? <>
        <section className="model-selection" aria-label="Выбор модели устройства">
          <div className="model-selection__container">
            <div className="model-selection__toolbar"><ModelPicker key={resource.id} items={versions} /></div>
            <div className="subcatogorys model-selection__grid">{devices.map(item => <DeviceCard key={item.id} resource={item} model={model} />)}</div>
            <CatalogPagination pagination={model.pagination} />
          </div>
        </section>
        <CatalogHelp phone={model.site.contacts?.phone} />
        <CatalogDescription html={resource.contentHtml} />
        <HowWeWork model={model} />
        <RepairDirections model={model} />
        <CommunityPanels model={model} />
      </> : <>
        <RepairDirections model={model} />
        {resource.contentHtml && <div className={`${resource.templateId === 16 ? 'service_cont white' : 'service-desc white clearfix'} site-prose-section`}><ContentBlock html={resource.contentHtml} className="site-prose" /></div>}
        <HowWeWork model={model} />
        {resource.id !== 4 && (variant === 'brands' ? <section className="model-selection brand-selection">
          <div className="model-selection__container"><CategoryGrid items={categoryItems} model={model} variant={variant} /></div>
        </section> : <div className={`center${choicesClass}`}><div className="choice_cont"><div className="center"><CategoryGrid items={categoryItems} model={model} variant={variant} /></div></div></div>)}
        <div className="center catalog-category-reviews"><h2 className="produkt_title">Сервисный центр «ТехМастер» в {defaultCity.prepositional}: {resource.templateId === 6 ? 'отзывы заказчиков' : 'Частые вопросы'}</h2><ReviewsSection model={model} /></div>
      </>}
    </main>
  );
}

