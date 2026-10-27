import { withBase } from '../../lib/public-urls.mjs';

// Reuse the original vector paths while exposing the two parts to link hover.
// A standalone SVG inside <img> cannot receive the parent link's hover state.
export default function BrandLogo({ label }) {
  const source = withBase('/legacy/template/images/logotip.svg');
  return <svg className="site-brand-svg" width="245" height="73" viewBox="0 0 245 73" fill="#ff614e" fillRule="evenodd" role="img" aria-label={label} focusable="false">
    <g className="site-brand-mark site-brand-mark-top"><use href={`${source}#logo-mark-top`} /></g>
    <g className="site-brand-mark site-brand-mark-bottom"><use href={`${source}#logo-mark-bottom`} /></g>
    <use href={`${source}#logo-wordmark`} />
  </svg>;
}
