'use client';

import { usePathname } from 'next/navigation';
import ScrollReveal from './ScrollReveal';
import './page-content-reveal.css';

// Keep independent motion, fixed controls and explicit opt-outs outside the page reveal.
const existingMotion = '.scroll-reveal, .parts-shop-dock, [data-page-reveal-skip]';
const ignored = 'script, style, link, meta, template, noscript, svg, source, br';
const structural = 'main, .editorial-article, .privacy-document, .contacts-details, .consultation-explorer, .reviews-explorer';
const blocks = [
  'section', 'article', 'nav', 'ul', 'ol', 'table', 'figure', 'blockquote',
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'details', 'img', 'iframe',
  '.catalog-prices', '.common-problems', '.community-panels__column',
  '.contacts-details__business', '.contacts-details__card', '.contacts-details__legal', '.contacts-details__extra',
  '.subcatogory', '.logos_respons', '.call', '.work_title', '.model-picker', '.completing_cont', '.price_info',
  '.consultation-explorer__search', '.consultation-explorer__filters', '.consultation-explorer__content',
  '.reviews-explorer__filter', '.reviews-explorer__results',
].join(', ');

function pageTargets(root) {
  const targets = [];
  const visit = element => {
    if (element.matches(existingMotion) || element.matches(ignored)) return;
    // Do not select a large wrapper around independently animated descendants.
    // Rich text is traversed in its original blocks, without rewriting its HTML.
    const children = [...element.children];
    if (element.matches(structural) || element.querySelector(existingMotion)) {
      children.forEach(visit);
      return;
    }
    if (element.matches(blocks)) {
      targets.push(element);
      return;
    }
    if (children.length) children.forEach(visit);
    else if (element.textContent.trim()) targets.push(element);
  };
  [...root.children].forEach(visit);
  return targets;
}

export default function PageContentReveal({ children }) {
  const pathname = usePathname();
  // Changing filters, tabs, skeletons or results within a page does not restart
  // its entrance. Only a new pathname collects a fresh set of content blocks.
  return <ScrollReveal className="site-page-content" selector={pageTargets} stagger={80} maxDelay={240} threshold={0} animateInitial revealKey={pathname} scope="page" watchChildren={false}>{children}</ScrollReveal>;
}
