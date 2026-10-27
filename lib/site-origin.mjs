export function configuredSiteOrigin() {
  if (process.env.SITE_ORIGIN) return process.env.SITE_ORIGIN;
  // Next sets PORT to the actual listening port before rendering in dev.
  // Production still requires the explicitly configured public site origin.
  if (process.env.NODE_ENV === 'development' && /^\d{1,5}$/.test(process.env.PORT || '')) return 'http://localhost:' + process.env.PORT;
  return undefined;
}
