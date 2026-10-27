import Link from 'next/link';
import { internalHref } from '../../lib/public-urls.mjs';
import './button.css';

const variants = new Set(['primary', 'accent', 'green', 'outline', 'muted']);

export default function Button({ href, variant = 'primary', className = '', type = 'button', prefetch = false, children, ...props }) {
  const palette = variants.has(variant) ? variant : 'primary';
  const classes = `site-button site-button--${palette}${className ? ` ${className}` : ' site-button--default-radius'}`;
  if (href !== undefined && href !== null) {
    const nativeLink = typeof href === 'string' && /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href);
    if (nativeLink) return <a {...props} href={href} className={classes}>{children}</a>;
    return <Link {...props} href={typeof href === 'string' ? internalHref(href) : href} className={classes} prefetch={prefetch}>{children}</Link>;
  }
  return <button {...props} type={type} className={classes}>{children}</button>;
}
