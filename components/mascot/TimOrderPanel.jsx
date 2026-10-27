'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import StatusWidget, { StatusWidgetPlaceholder } from '../community/StatusWidget';
import Button from '../ui/Button';
import './tim-order-panel.css';

function useOrderScrollLock() {
  const current = useRef(null);
  useLayoutEffect(() => {
    if (!current.current) {
      const root = document.documentElement, body = document.body;
      const gap = Math.max(0, window.innerWidth - root.getBoundingClientRect().width);
      const attribute = root.getAttribute('data-tim-order-lock');
      const value = root.style.getPropertyValue('--tim-order-page-gap');
      const priority = root.style.getPropertyPriority('--tim-order-page-gap');
      const lock = { active: true, release: null };
      const observer = new MutationObserver(() => lock.release());
      lock.release = () => {
        // Match Radix's real lifetime, including its closing/scroll-lock cleanup.
        if (lock.active || body.hasAttribute('data-scroll-locked')) return;
        observer.disconnect();
        if (attribute === null) root.removeAttribute('data-tim-order-lock');
        else root.setAttribute('data-tim-order-lock', attribute);
        if (value) root.style.setProperty('--tim-order-page-gap', value, priority);
        else root.style.removeProperty('--tim-order-page-gap');
        if (current.current === lock) current.current = null;
      };
      current.current = lock;
      observer.observe(body, { attributes: true, attributeFilter: ['data-scroll-locked'] });
      root.style.setProperty('--tim-order-page-gap', `${gap}px`);
      root.setAttribute('data-tim-order-lock', '');
    }
    const lock = current.current;
    lock.active = true;
    return () => { lock.active = false; lock.release(); };
  }, []);
}

function readWidget(root) {
  const source = root.querySelector('[data-status-widget-src]');
  if (!source) throw new Error('Status form is unavailable');
  const src = new URL(source.dataset.statusWidgetSrc);
  if (src.origin !== 'https://my.livesklad.com' || src.pathname !== '/static/widget.html') throw new Error('Unexpected status provider');
  return { src: src.href, title: source.dataset.statusWidgetTitle, width: source.dataset.statusWidgetWidth, height: source.dataset.statusWidgetHeight };
}

export default function TimOrderPanel({ href, container, api, onClosed, returnFocus }) {
  useOrderScrollLock();
  const title = useRef(null);
  const autoFocusFrame = useRef(0);
  const [widget, setWidget] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const [closing, setClosing] = useState(false);
  const widgetId = useId();
  const attach = useCallback(node => {
    if (node) api.openOrderPanel(node, onClosed);
  }, [api, onClosed]);
  const loadPhase = useCallback(value => { setPhase(value); api.setOrderLoadState(value); }, [api]);
  const focusTitle = useCallback(() => {
    const focusWhenPositioned = () => {
      autoFocusFrame.current = 0;
      const heading = title.current, panel = heading?.closest('.tim-order');
      if (!panel?.isConnected) return;
      if (panel.dataset.positioned === 'true') heading.focus({ preventScroll: true });
      else autoFocusFrame.current = requestAnimationFrame(focusWhenPositioned);
    };
    cancelAnimationFrame(autoFocusFrame.current);
    focusWhenPositioned();
  }, []);
  const close = () => {
    if (closing) return;
    setClosing(true);
    api.closeOrderPanel();
  };

  useEffect(() => {
    let cancelled = false;
    const request = new AbortController();
    const timer = setTimeout(() => request.abort(), 15000);
    loadPhase('loading');
    const load = async () => {
      try {
        // The direct page remains the single source of the public widget settings.
        const existing = document.querySelector('.site-page-content [data-status-widget-src]');
        let config;
        if (existing) config = readWidget(existing.parentElement);
        else {
          const response = await fetch(href, { signal: request.signal });
          if (!response.ok) throw new Error('Status page is unavailable');
          config = readWidget(new DOMParser().parseFromString(await response.text(), 'text/html'));
        }
        if (!cancelled) setWidget(config);
      } catch {
        if (!cancelled) loadPhase('error');
      } finally { clearTimeout(timer); }
    };
    load();
    return () => { cancelled = true; clearTimeout(timer); request.abort(); };
  }, [href, attempt, loadPhase]);
  useEffect(() => () => {
    cancelAnimationFrame(autoFocusFrame.current);
    api.cancelOrderPanel();
  }, [api]);

  return <Dialog.Root open onOpenChange={value => { if (!value) close(); }}>
    <Dialog.Portal container={container}>
      <Dialog.Overlay className="tim-order__overlay" />
      <Dialog.Content ref={attach} className="tim-order" data-site-dialog="" data-tim-controls="" aria-describedby={undefined}
        onOpenAutoFocus={event => { event.preventDefault(); focusTitle(); }}
        onCloseAutoFocus={event => { event.preventDefault(); returnFocus(); }}>
        <span className="tim-order__handle" aria-hidden="true"><i /><i /></span>
        <header className="tim-order__header">
          <div className="tim-order__heading">
            <Dialog.Title className="tim-order__title" ref={title} tabIndex={-1}>Проверить заказ</Dialog.Title>
          </div>
          <Button className="tim-order__close" variant="outline" aria-label="Закрыть проверку заказа" onClick={close} disabled={closing}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </Button>
        </header>
        <div className="tim-order__body" aria-busy={phase === 'loading'}>
          {widget ? <StatusWidget {...widget} id={`tim-order-${widgetId}`} onPhaseChange={loadPhase} />
            : <div className="site-status-widget"><div className="site-status-widget__enhanced"><StatusWidgetPlaceholder phase={phase} onRetry={() => setAttempt(value => value + 1)} /></div></div>}
        </div>
        <footer className="tim-order__footer"><a href={href}>Открыть страницу статуса</a></footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
