import HomeTemplate from './templates/HomeTemplate';
import ContactsTemplate from './templates/ContactsTemplate';
import CategoryTemplate from './templates/CategoryTemplate';
import DeviceRepairTemplate from './templates/DeviceRepairTemplate';
import ServiceDetailTemplate from './templates/ServiceDetailTemplate';
import EditorialTemplate from './templates/EditorialTemplate';
import EditorialIndexTemplate from './templates/EditorialIndexTemplate';
import ConsultationsTemplate from './templates/ConsultationsTemplate';
import ConsultationTemplate from './templates/ConsultationTemplate';
import ReviewsTemplate from './templates/ReviewsTemplate';
import OrderStatusTemplate from './templates/OrderStatusTemplate';

const templates = {
  home: HomeTemplate, contacts: ContactsTemplate, category: CategoryTemplate,
  repair: DeviceRepairTemplate, service: ServiceDetailTemplate,
  editorial: EditorialTemplate, 'editorial-index': EditorialIndexTemplate,
  'consultations-index': ConsultationsTemplate, consultation: ConsultationTemplate,
  'reviews-index': ReviewsTemplate, 'order-status': OrderStatusTemplate,
};

export default function TemplateRenderer({ model }) {
  const Component = templates[model.resource.type];
  if (!Component) throw new Error('Unsupported public template: ' + model.resource.templateId);
  return <Component model={model} />;
}
