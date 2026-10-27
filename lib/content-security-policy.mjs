// The status page uses the same public Livesklad frame as MODX. All other
// runtime assets and connections remain local; no original PHP is exported.
const development = process.env.NODE_ENV === 'development';
export const contentSecurityPolicy = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'" + (development ? " 'unsafe-eval'" : '') + "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'" + (development ? ' ws://localhost:* ws://127.0.0.1:*' : '') + "; frame-src https://my.livesklad.com; form-action 'self'; base-uri 'self'; object-src 'none'";
