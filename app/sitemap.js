import { getRoutes } from '../lib/public-data.mjs';
import { configuredSiteOrigin } from '../lib/site-origin.mjs';
export const dynamic = 'force-static';
export default function sitemap() {
  const origin = configuredSiteOrigin() || 'http://localhost:3000';
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return getRoutes({ includeAliases: false }).map((route) => ({ url: new URL(base + route.path, origin).href }));
}
