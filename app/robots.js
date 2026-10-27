import { configuredSiteOrigin } from '../lib/site-origin.mjs';

export const dynamic = 'force-static';
export default function robots() {
  const origin = configuredSiteOrigin() || 'http://localhost:3000';
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return {
    rules: { userAgent: '*', ...(process.env.SITE_INDEXABLE === 'true' ? { allow: '/' } : { disallow: '/' }) },
    sitemap: new URL(base + '/sitemap.xml', origin).href,
  };
}
