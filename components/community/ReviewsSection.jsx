import ReviewsExplorer from './ReviewsExplorer';

export default function ReviewsSection({ model, serviceId, inline = true, children }) {
  const community = model.community || {};
  const sourceServiceId = model.resource.templateId === 18 ? model.resource.parentId : model.resource.id;
  return <div className="reviews reviews-section">{children}<ReviewsExplorer items={community.reviews} types={community.filters?.types} defaultServiceId={serviceId || (inline ? sourceServiceId : 5)} initialPage={model.route.page || 1} fallbackServiceId={inline ? 5 : undefined} /></div>;
}
