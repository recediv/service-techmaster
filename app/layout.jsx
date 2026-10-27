import SiteRuntime from '../components/SiteRuntime';
import TimMascot from '../components/mascot/TimMascot';
import SiteShell from '../components/shell/SiteShell';
import { getShellModel } from '../lib/public-data.mjs';
import { withBase } from '../lib/public-urls.mjs';
import { contentSecurityPolicy } from '../lib/content-security-policy.mjs';
import './legacy.css';
import './site.css';
import '../components/content/site-prose.css';
import './site-spacing.css';

export const metadata = {
  title: 'Тех Мастер',
  description: 'Ремонт техники в сервисном центре Тех Мастер.',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }) {
  if (process.env.NODE_ENV === 'development') await import('../lib/dev-data-watch.mjs');
  return <html lang="ru">
    <head>
      <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy} />
      <meta name="referrer" content="no-referrer" />
      <link rel="icon" href={withBase('/legacy/favicon.ico')} />
    </head>
    <body><SiteShell model={getShellModel()}>{children}</SiteShell><SiteRuntime /><TimMascot /></body>
  </html>;
}
