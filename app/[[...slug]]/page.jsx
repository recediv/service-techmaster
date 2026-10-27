import { notFound } from 'next/navigation';
import SitePage from '../../components/SitePage';
import { getRenderRoutes, getPageModel, getPageMetadata, recordPageRender } from '../../lib/public-data.mjs';

export const dynamicParams = false;
export function generateStaticParams() {
  return getRenderRoutes().map(route => ({ slug: route.path.split('/').filter(Boolean) }));
}
const requestedPath = (slug = []) => '/' + slug.join('/') + (slug.length ? '/' : '');
export async function generateMetadata({ params }) {
  const { slug } = await params;
  return getPageMetadata(getPageModel(requestedPath(slug)));
}
export default async function PublicPage({ params }) {
  const { slug } = await params;
  const model = getPageModel(requestedPath(slug));
  if (!model) notFound();
  recordPageRender(model.route);
  return <SitePage model={model} />;
}
