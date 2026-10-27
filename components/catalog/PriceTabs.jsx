'use client';

import { Children, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import PriceTabIcon from './PriceTabIcon';
import PriceSkeleton from './PriceSkeleton';
import usePriceTooltip from './PriceTooltip';

// Read only geometry: the decorative layer never duplicates service names or prices.
function textLines(element) {
  if (!element) return [];
  const origin = element.getBoundingClientRect();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const lines = [];
  let node;
  while ((node = walker.nextNode())) {
    if (!node.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (!rect.width || !rect.height) continue;
      const top = rect.top - origin.top;
      const left = rect.left - origin.left;
      const existing = lines.find(line => Math.abs(line.top - top) < 2);
      if (existing) {
        const right = Math.max(existing.left + existing.width, left + rect.width);
        existing.left = Math.min(existing.left, left);
        existing.width = right - existing.left;
      } else lines.push({ top, left, width: rect.width, height: rect.height });
    }
  }
  return lines.sort((a, b) => a.top - b.top);
}

function skeletonLayout(panel) {
  const block = selector => {
    const element = panel.querySelector(selector);
    return element ? { height: element.getBoundingClientRect().height, lines: textLines(element) } : null;
  };
  return {
    cards: panel.querySelector('table')?.classList.contains('catalog-price__table--cards'),
    intro: block('.catalog-price__intro'),
    note: block('.catalog-price__note'),
    rows: Array.from(panel.querySelectorAll('tbody tr'), row => ({
      height: row.getBoundingClientRect().height,
      heading: row.classList.contains('catalog-price__row--heading'),
      bold: row.classList.contains('catalog-price__row--bold'),
      cells: Array.from(row.cells, cell => {
        const value = cell.querySelector('.catalog-price__value');
        const width = value?.getBoundingClientRect().width || 1;
        return {
          colSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
          rowSpan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
          lineHeight: value ? parseFloat(window.getComputedStyle(value).lineHeight) : 22,
          widths: textLines(value).map(line => Math.min(1, Math.max(0.08, line.width / width))),
        };
      }),
    })),
  };
}

export default function PriceTabs({ tabs, showNavigation = tabs.length > 1, navigationCopies = 1, children }) {
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState(0);
  const [phase, setPhase] = useState('idle');
  const [skeletonRows, setSkeletonRows] = useState(6);
  const [skeleton, setSkeleton] = useState(null);
  const requested = useRef(0);
  const transitionTimer = useRef(0);
  const surface = useRef(null);
  const panelElements = useRef([]);
  const tooltip = usePriceTooltip();
  const id = useId();
  const buttons = useRef([]);
  const panels = Children.toArray(children);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const settle = () => {
      if (!motion.matches) return;
      window.clearTimeout(transitionTimer.current);
      surface.current?.style.removeProperty('height');
      surface.current?.style.removeProperty('--price-height-duration');
      setActive(requested.current);
      setPhase('idle');
    };
    motion.addEventListener('change', settle);
    return () => { window.clearTimeout(transitionTimer.current); motion.removeEventListener('change', settle); };
  }, []);
  useLayoutEffect(() => {
    if (phase !== 'skeleton') return;
    const box = surface.current;
    const panel = panelElements.current[active];
    if (!box || !panel) return;
    let target = -1;
    let finished = false;
    const measure = () => {
      const styles = window.getComputedStyle(box);
      return panel.getBoundingClientRect().height + parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
    };
    const reveal = () => {
      if (finished) return;
      if (Math.abs(measure() - target) >= 0.5) { resize(); return; }
      if (Math.abs(box.getBoundingClientRect().height - target) >= 0.5) {
        window.clearTimeout(transitionTimer.current);
        transitionTimer.current = window.setTimeout(reveal, 16);
        return;
      }
      finished = true;
      window.clearTimeout(transitionTimer.current);
      box.style.removeProperty('height');
      box.style.removeProperty('--price-height-duration');
      setPhase('idle');
    };
    const resize = () => {
      if (finished) return;
      const height = measure();
      setSkeleton(skeletonLayout(panel));
      if (Math.abs(height - target) < 0.5) return;
      target = height;
      window.clearTimeout(transitionTimer.current);
      const difference = Math.abs(box.getBoundingClientRect().height - target);
      if (difference < 0.5) { reveal(); return; }
      const duration = Math.round(Math.min(850, Math.max(500, difference * 0.6)));
      box.style.setProperty('--price-height-duration', `${duration}ms`);
      box.style.height = `${target}px`;
      // Fallback for environments that omit transitionend; no additional hold.
      transitionTimer.current = window.setTimeout(reveal, duration);
    };
    const onTransitionEnd = event => {
      if (event.target === box && event.propertyName === 'height') reveal();
    };
    box.addEventListener('transitionend', onTransitionEnd);
    resize();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(panel);
    return () => {
      window.clearTimeout(transitionTimer.current);
      box.removeEventListener('transitionend', onTransitionEnd);
      observer?.disconnect();
    };
  }, [active, phase]);
  function select(index, copy = 0) {
    tooltip.close();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (copy > 0) {
      surface.current?.closest('.catalog-prices')?.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' });
      buttons.current['0:' + index]?.focus({ preventScroll: true });
    }
    if (index === requested.current) return;
    requested.current = index;
    setSelected(index);
    const sourceRows = panelElements.current[index]?.querySelectorAll('tbody tr').length || 6;
    const rowHeight = (surface.current?.getBoundingClientRect().width || 0) <= 650 ? 126 : 54;
    const occupiedRows = Math.ceil((surface.current?.getBoundingClientRect().height || 0) / rowHeight);
    setSkeletonRows(Math.min(40, Math.max(6, sourceRows, occupiedRows)));
    window.clearTimeout(transitionTimer.current);
    if (reduced) {
      surface.current?.style.removeProperty('height');
      surface.current?.style.removeProperty('--price-height-duration');
      setActive(index);
      setPhase('idle');
      return;
    }
    if (surface.current) {
      const height = surface.current.getBoundingClientRect().height;
      surface.current.style.transition = 'none';
      surface.current.style.height = `${height}px`;
      void surface.current.offsetHeight;
      surface.current.style.removeProperty('transition');
    }
    if (phase === 'skeleton') {
      setActive(index);
      return;
    }
    setPhase('out');
    transitionTimer.current = window.setTimeout(() => {
      setActive(requested.current);
      setPhase('skeleton');
    }, 150);
  }
  function onKeyDown(event, index, copy) {
    const last = tabs.length - 1;
    let next;
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else return;
    event.preventDefault();
    select(next, copy);
    buttons.current['0:' + next]?.focus({ preventScroll: true });
  }
  const panelId = index => tabs[index]?.sourceTabId || `${id}-panel-${index}`;
  const navigation = copy => showNavigation && <ul className="tabs_nav" role="tablist" aria-label="Виды ремонта" key={copy}>
        {tabs.map((tab, index) => (
          <li key={tab.id || index} role="presentation"><a
            href={'#' + panelId(index)}
            role="tab"
            id={`${id}-tab-${copy}-${index}`}
            aria-controls={panelId(index)}
            aria-selected={selected === index}
            tabIndex={selected === index ? 0 : -1}
            ref={(element) => { buttons.current[copy + ':' + index] = element; }}
            onClick={(event) => { event.preventDefault(); select(index, copy); }}
            onKeyDown={(event) => onKeyDown(event, index, copy)}
            className={selected === index ? 'current' : undefined}
          >
            <PriceTabIcon label={tab.label} /><span className="catalog-price-tab-label">{tab.label}</span>
          </a></li>
        ))}
      </ul>;
  return (
    <div id="tabs" className="catalog-price-tabs" {...tooltip.events}>
      {navigation(0)}
      <div className="list-wrap" ref={surface} data-phase={phase} aria-busy={phase !== 'idle' || undefined}><div className="list_padd">
      {panels.map((panel, index) => (
        <div
          key={tabs[index]?.id || index}
          ref={element => { panelElements.current[index] = element; }}
          className={`table${active === index && phase === 'out' ? ' catalog-price-panel--out' : ''}${active === index && phase === 'skeleton' ? ' catalog-price-panel--masked' : ''}`}
          id={panelId(index)}
          role={showNavigation ? 'tabpanel' : undefined}
          aria-labelledby={showNavigation ? `${id}-tab-0-${index}` : undefined}
          hidden={showNavigation && active !== index}
          inert={active === index && (phase === 'skeleton' || phase === 'out') ? true : undefined}
          aria-hidden={active === index && phase === 'skeleton' ? true : undefined}
          tabIndex={active === index ? 0 : -1}
        >
          {panel}
        </div>
      ))}
      </div>{phase === 'skeleton' && <PriceSkeleton columns={tabs[active]?.columns} hints={tabs[active]?.hints} layout={skeleton} rows={skeletonRows} />}</div>
      {showNavigation && navigationCopies > 1 && navigation(1)}
      {tooltip.portal}
    </div>
  );
}

