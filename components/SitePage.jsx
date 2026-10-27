import Link from 'next/link';
import TemplateRenderer from './TemplateRenderer';
import { withBase } from '../lib/public-urls.mjs';

export default function SitePage({ model }) {
  if (model.route.type === 'redirect') {
    return <>
      <meta httpEquiv="refresh" content={'0;url=' + withBase(model.route.redirectTo)} />
      <main className="site-not-found wrapper"><h1>Страница перемещена</h1><Link href={model.route.redirectTo} prefetch={false}>Открыть страницу</Link></main>
    </>;
  }
  return <TemplateRenderer model={model} />;
}
