import { richHtml } from '../../lib/public-urls.mjs';

// Only allowlisted editorial content from the public exporter reaches this boundary.
export default function RichText({ html = '', className = '', as: Element = 'div' }) {
  if (!html) return null;
  return <Element className={['site-rich-text', className].filter(Boolean).join(' ')} dangerouslySetInnerHTML={{ __html: richHtml(html) }} />;
}
