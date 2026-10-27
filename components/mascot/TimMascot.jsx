'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { withBase } from '../../lib/public-urls.mjs';
import Button from '../ui/Button';
import CatalogImagePlaceholder from '../catalog/CatalogImagePlaceholder';
import './tim-mascot.css';

const modelRevision = 'round-car-42';
const introductionKey = 'techmaster-tim-introduced-v1';
let orderPanelModule;
function loadOrderPanel() {
  if (!orderPanelModule) orderPanelModule = import('./TimOrderPanel').catch(error => { orderPanelModule = null; throw error; });
  return orderPanelModule;
}

export default function TimMascot() {
  const stageRef = useRef(null);
  const actorRef = useRef(null);
  const shadowRef = useRef(null);
  const partsThoughtRef = useRef(null);
  const orderRef = useRef(null);
  const orderReturnRef = useRef(null);
  const orderFocusFrameRef = useRef(0);
  const orderRequestRef = useRef(0);
  const apiRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [OrderPanel, setOrderPanel] = useState(null);
  const [orderSession, setOrderSession] = useState(null);
  const [orderPreparing, setOrderPreparing] = useState(false);
  const [partsTarget, setPartsTarget] = useState(null);
  const pathname = usePathname();
  const currentPage = withBase(pathname || '/');
  const currentParts = partsTarget?.page === currentPage ? partsTarget : null;
  const descriptionId = useId();
  const orderHref = withBase('/info/status/');
  const closeOrder = useCallback(() => setOrderSession(null), []);
  const returnOrderFocus = useCallback(() => {
    cancelAnimationFrame(orderFocusFrameRef.current);
    const request = orderRequestRef.current;
    let remaining = 120;
    const restore = () => {
      orderFocusFrameRef.current = 0;
      const stage = stageRef.current;
      if (!stage?.isConnected || document.hidden || request !== orderRequestRef.current) return;
      // The body lock can outlive the drawer's DOM by a frame. A suspended
      // mascot is not focusable; restore as soon as Radix actually releases it.
      if (stage.dataset.orderOpen === 'true' || stage.dataset.suspended === 'true') {
        if (remaining-- > 0) orderFocusFrameRef.current = requestAnimationFrame(restore);
        return;
      }
      const target = orderReturnRef.current?.isConnected ? orderReturnRef.current : orderRef.current;
      const ownTrigger = target === orderRef.current;
      // Radix removes the drawer before React clears data-order-open. Wait for
      // that commit and reveal the hover-only trigger before restoring focus.
      if (ownTrigger) {
        apiRef.current?.setOrderTriggerAttention(true);
        const style = getComputedStyle(target);
        if (style.visibility !== 'visible' || style.display === 'none') {
          if (remaining-- > 0) orderFocusFrameRef.current = requestAnimationFrame(restore);
          else apiRef.current?.setOrderTriggerAttention(false);
          return;
        }
      }
      target?.focus({ preventScroll: true });
      if (ownTrigger && document.activeElement !== target) {
        apiRef.current?.setOrderTriggerAttention(false);
        actorRef.current?.focus({ preventScroll: true });
      }
    };
    orderFocusFrameRef.current = requestAnimationFrame(restore);
  }, []);

  useEffect(() => {
    const show = async event => {
      const link = event.target instanceof Element ? event.target.closest('a[data-tim-order-link]') : null;
      if (!link || !ready || !apiRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target && link.target !== '_self') return;
      event.preventDefault();
      event.stopPropagation();
      if (orderSession || orderPreparing) return;
      const request = ++orderRequestRef.current;
      const api = apiRef.current;
      orderReturnRef.current = link;
      setOrderPreparing(true);
      try {
        const component = (await loadOrderPanel()).default;
        if (request !== orderRequestRef.current || api !== apiRef.current) return;
        setOrderPanel(() => component);
        setOrderSession({ href: link.href, api });
      } catch {
        if (request === orderRequestRef.current) location.assign(link.href);
      } finally {
        if (request === orderRequestRef.current) setOrderPreparing(false);
      }
    };
    document.addEventListener('click', show, true);
    return () => document.removeEventListener('click', show, true);
  }, [ready, orderSession, orderPreparing]);

  useEffect(() => {
    orderRequestRef.current++;
    setOrderSession(null);
    setOrderPreparing(false);
  }, [pathname]);

  useEffect(() => {
    const sync = () => {
      const normalize = value => value.replace(/\/$/, '');
      const source = [...document.querySelectorAll('a[data-tim-parts]')].find(link => normalize(link.dataset.timParts) === normalize(currentPage));
      const photo = source?.closest('.site-detail-hero__layout')?.querySelector('.site-detail-hero__images img[src]');
      const next = source ? {
        page: currentPage, href: source.href, target: source.target,
        title: source.dataset.timPartsTitle || source.textContent.trim().replace(/^Запчасти для\s+/u, ''),
        image: photo?.getAttribute('src') || null,
      } : null;
      setPartsTarget(previous => previous?.page === next?.page && previous?.href === next?.href && previous?.title === next?.title && previous?.image === next?.image ? previous : next);
    };
    sync();
    const frame = requestAnimationFrame(sync);
    window.addEventListener('site:route-ready', sync);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('site:route-ready', sync); };
  }, [currentPage]);

  useEffect(() => {
    const api = apiRef.current;
    api?.setPartsThoughtAvailable(Boolean(currentParts?.href));
    return () => api?.setPartsThoughtAvailable(false);
  }, [ready, currentPage, currentParts?.href, currentParts?.title]);

  useEffect(() => {
    let cancelled = false;
    let idle = null;
    let timer = null;
    let runtime = null;
    const load = async () => {
      try {
        const { createTimMascot } = await import('./tim-runtime.mjs');
        if (cancelled || !stageRef.current) return;
        let firstVisitAttention = true;
        try { firstVisitAttention = localStorage.getItem(introductionKey) !== '1'; } catch {}
        runtime = createTimMascot({
          stage: stageRef.current, host: actorRef.current, shadow: shadowRef.current,
          thoughtBubble: partsThoughtRef.current,
          height: 125, walking: true,
          firstVisitAttention,
          onFirstAttention: () => { try { localStorage.setItem(introductionKey, '1'); } catch {} },
        });
        apiRef.current = runtime;
        setReady(true);
      } catch (error) {
        if (!cancelled) {
          console.warn('Tim could not start:', error);
        }
      }
    };
    const syncIntroduction = event => {
      if (event.key === introductionKey && event.newValue === '1') runtime?.acknowledgeIntroduction();
    };
    window.addEventListener('storage', syncIntroduction);
    const schedule = () => {
      if ('requestIdleCallback' in window) idle = requestIdleCallback(load, { timeout: 1800 });
      else timer = setTimeout(load, 250);
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', schedule);
      window.removeEventListener('storage', syncIntroduction);
      cancelAnimationFrame(orderFocusFrameRef.current);
      if (idle !== null) cancelIdleCallback(idle);
      if (timer !== null) clearTimeout(timer);
      runtime?.destroy();
      orderRequestRef.current++;
      setOrderSession(null);
      if (apiRef.current === runtime) apiRef.current = null;
      setReady(false);
    };
  }, []);
  return <div
    ref={stageRef}
    className="tim-mascot"
    data-ready={ready}
    data-model-revision={modelRevision}
    data-order-open={Boolean(orderSession)}
    data-tim-controls-root=""
  >
    <div ref={shadowRef} className="tim-mascot__shadow" aria-hidden="true" />
    <div ref={actorRef} className="tim-mascot__actor" role="button" tabIndex={ready && !orderSession ? 0 : -1}
      aria-label="Тим — робот-помощник" aria-describedby={descriptionId} />
    <span id={descriptionId} className="tim-mascot__sr">Робота можно погладить, поднять и отпустить. Enter — прикоснуться. Кнопка рядом открывает проверку заказа.</span>
    <a ref={partsThoughtRef} href={currentParts?.href} target={currentParts?.target || '_blank'} rel="noopener noreferrer"
      className="tim-mascot__thought" data-tim-controls="" data-visible="false" tabIndex={-1} aria-hidden="true"
      aria-label={currentParts ? `Купить запчасти для ${currentParts.title}` : undefined}>
      <svg className="tim-mascot__thought-cloud" viewBox="0 0 240 96" preserveAspectRatio="none" aria-hidden="true"><path d="M30 13C38 1 60 1 72 9C84-1 106-1 119 8C133-1 156-1 168 9C184-1 211 0 220 13C237 13 243 29 235 41C246 55 239 75 224 77C224 93 199 99 184 88C169 99 146 96 135 88C118 99 94 97 82 87C66 97 43 91 40 80C20 84 5 69 13 56C0 42 8 20 24 19C25 17 27 15 30 13Z" vectorEffect="non-scaling-stroke" /></svg>
      <span className="tim-mascot__thought-action">Запчасти для</span>
      <span className="tim-mascot__thought-image">{currentParts?.image ? <img src={currentParts.image} alt={currentParts.title} width="80" height="80" decoding="async" /> : <CatalogImagePlaceholder />}</span>
    </a>
    {ready && <Button ref={orderRef} href={orderHref} variant="outline" className="tim-mascot__order"
      data-tim-controls="" data-tim-order-link="" data-site-dialog="" aria-haspopup="dialog" aria-expanded={Boolean(orderSession)} aria-busy={orderPreparing || undefined}
      onPointerEnter={() => { apiRef.current?.setOrderTriggerAttention(true); loadOrderPanel().catch(() => {}); }} onPointerLeave={() => apiRef.current?.setOrderTriggerAttention(false)}
      onFocus={() => { apiRef.current?.setOrderTriggerAttention(true); loadOrderPanel().catch(() => {}); }} onBlur={() => apiRef.current?.setOrderTriggerAttention(false)}>
      <span className="tim-mascot__order-icon" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M19 27H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M11 5V3h8v5h-8zM10 13h9m-9 5h5m-5 5h3" /><circle cx="23" cy="22" r="5" /><path d="m27 26 3 3" /></svg></span>
      <span className="tim-mascot__order-copy"><strong>{orderPreparing ? 'Открываем…' : 'Проверить заказ'}</strong><span>Узнать статус ремонта</span></span>
    </Button>}
    {OrderPanel && orderSession && <OrderPanel href={orderSession.href} api={orderSession.api} container={stageRef.current} onClosed={closeOrder} returnFocus={returnOrderFocus} />}
  </div>;
}

