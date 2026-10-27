'use client';

import { Children, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { internalHref, withBase } from '../../lib/public-urls.mjs';
import Button from '../ui/Button';
import './carousel.css';

export function CarouselLink({ href, children, ...props }) {
  return <Link {...props} href={internalHref(href)} prefetch={false} onNavigate={event => {
    // Let Embla reject drag-clicks before Next handles a real link navigation.
    const navigation = new CustomEvent('site:navigate', { cancelable: true, detail: { href: withBase(internalHref(href)) } });
    if (!window.dispatchEvent(navigation)) event.preventDefault();
  }}>{children}</Link>;
}

export default function Carousel({ id, label, autoplay = false, children }) {
  const plugins = useMemo(() => autoplay ? [Autoplay({
    delay: 9000,
    stopOnInteraction: true,
    stopOnMouseEnter: true,
    stopOnLastSnap: true,
    rootNode: viewport => viewport.parentElement,
    breakpoints: { '(prefers-reduced-motion: reduce)': { active: false } },
  })] : [], [autoplay]);
  const [viewportRef, api] = useEmblaCarousel({
    align: 'start', loop: false, duration: 28,
    breakpoints: { '(prefers-reduced-motion: reduce)': { duration: 0 } },
  }, plugins);
  const [canPrevious, setCanPrevious] = useState(false);
  const [canNext, setCanNext] = useState(false);
  useEffect(() => {
    if (!api) return;
    const updateControls = () => {
      setCanPrevious(api.canScrollPrev());
      setCanNext(api.canScrollNext());
      if (!api.canScrollNext()) api.plugins().autoplay?.stop();
    };
    updateControls();
    api.on('select', updateControls).on('reInit', updateControls);
    return () => { api.off('select', updateControls).off('reInit', updateControls); };
  }, [api]);
  return <div className="react-carousel" id={id} data-embla-carousel data-embla-ready={Boolean(api)} role="region" aria-roledescription="карусель" aria-label={label}>
    <div className="react-carousel__viewport" id={`${id}-viewport`} ref={viewportRef}>
      <div className="react-carousel__track">{Children.map(children, child => <div className="react-carousel__slide">{child}</div>)}</div>
    </div>
    {Children.count(children) > 1 && <div className="react-carousel__controls">
      <Button type="button" variant="outline" aria-label="Предыдущие карточки" aria-controls={`${id}-viewport`} disabled={!canPrevious} onClick={() => { api?.scrollPrev(); api?.plugins().autoplay?.reset(); }}><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m14 6-6 6 6 6" /></svg></Button>
      <Button type="button" variant="outline" aria-label="Следующие карточки" aria-controls={`${id}-viewport`} disabled={!canNext} onClick={() => { api?.scrollNext(); api?.plugins().autoplay?.reset(); }}><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m10 6 6 6-6 6" /></svg></Button>
    </div>}
  </div>;
}
