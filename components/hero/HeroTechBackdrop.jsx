'use client';

import { useEffect, useRef, useState } from 'react';
import { withBase } from '../../lib/public-urls.mjs';
import { readGraphicsSupport } from '../../lib/graphics-support.mjs';
import { acquireHeroScene } from './hero-scene-pool.mjs';
import './hero-tech-backdrop.css';

const sceneRevision = 'site-diagnostic-30';
const environmentUrl = withBase('/assets/hero/studio-small-09-1k.hdr');

export default function HeroTechBackdrop() {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const [staticScene, setStaticScene] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const host = canvasRef.current;
    const hero = root?.closest('.site-hero');
    const content = root?.closest('.site-page-content');
    if (!root || !host || !hero) return;
    if (readGraphicsSupport().mode === 'static') {
      setStaticScene(true);
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let api = null;
    let lease = null;
    let disposed = false;
    let loading = false;
    let failed = false;
    let visible = false;
    let request = 0;
    let idle = null;
    let frame = null;
    let task = null;
    let settleIdle = null;

    const projecting = () => Boolean(content?.hasAttribute('data-page-projection'));
    const active = () => !disposed && visible && !document.hidden && !projecting();
    const cancelStart = () => {
      if (idle !== null) window.cancelIdleCallback?.(idle);
      if (frame !== null) cancelAnimationFrame(frame);
      if (task !== null) clearTimeout(task);
      idle = frame = task = null;
      const settle = settleIdle;
      settleIdle = null;
      settle?.(false);
    };
    const waitForConstructorIdle = () => new Promise(resolve => {
      settleIdle = resolve;
      const finish = () => {
        idle = frame = task = null;
        settleIdle = null;
        resolve(active());
      };
      if (typeof window.requestIdleCallback === 'function') {
        idle = window.requestIdleCallback(finish, { timeout: 1200 });
      } else {
        frame = requestAnimationFrame(() => {
          frame = null;
          task = setTimeout(finish, 0);
        });
      }
    });
    const load = async () => {
      idle = frame = task = null;
      if (!active() || api || loading || failed) return;
      const ownRequest = ++request;
      loading = true;
      try {
        const { createRepairLabScene } = await import('./repair-lab-client.mjs');
        if (disposed || ownRequest !== request || !active()) return;
        if (!await waitForConstructorIdle() || disposed || ownRequest !== request || !active()) return;
        lease = acquireHeroScene({
          host,
          key: sceneRevision + '|' + Number(reduced.matches),
          factory: createRepairLabScene,
          options: {
            environmentUrl,
            reducedMotion: reduced.matches,
            onReady: () => {
              if (disposed || ownRequest !== request) return;
              root.dataset.techReady = 'true';
            },
            onError: () => {
              if (disposed || ownRequest !== request) return;
              failed = true;
              cancelStart();
              delete root.dataset.techReady;
              api?.setVisible(false);
              setStaticScene(true);
            },
          },
        });
        api = lease.api;
        api.setVisible(active() && !failed);
      } catch {
        if (!disposed && ownRequest === request) {
          failed = true;
          delete root.dataset.techReady;
          setStaticScene(true);
        }
      } finally {
        if (ownRequest === request) {
          loading = false;
          if (!api && active() && !failed) scheduleStart();
        }
      }
    };
    const scheduleStart = () => {
      if (!active() || failed || api || loading || idle !== null || frame !== null || task !== null) return;
      if (typeof window.requestIdleCallback === 'function') {
        idle = window.requestIdleCallback(() => { void load(); }, { timeout: 1200 });
      } else {
        frame = requestAnimationFrame(() => {
          frame = null;
          if (!active()) return;
          task = setTimeout(() => { void load(); }, 0);
        });
      }
    };
    const syncVisibility = () => {
      if (disposed) return;
      const running = active() && !failed;
      api?.setVisible(running);
      if (running) scheduleStart();
      else cancelStart();
    };
    const pointer = event => {
      if (!api || reduced.matches || !active() || event.pointerType !== 'mouse') return;
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const overScene = x >= 0 && x <= 1 && y >= 0 && y <= 1 && !event.target.closest('a,button');
      api.setPointer(overScene ? Math.max(-1, Math.min(1, x * 2 - 1)) : 0, overScene ? Math.max(-1, Math.min(1, 1 - y * 2)) : 0, overScene);
    };
    const leave = () => api?.setPointer(0, 0, false);
    const reset = () => {
      request++;
      loading = false;
      failed = false;
      cancelStart();
      lease?.release();
      lease = api = null;
      delete root.dataset.techReady;
      syncVisibility();
    };
    const restorePage = event => {
      if (event.persisted && api && !api.isUsable()) reset();
    };
    // Observe before the first state read: mounts during and after reveal are safe.
    const projectionObserver = content && typeof MutationObserver === 'function' ? new MutationObserver(syncVisibility) : null;
    projectionObserver?.observe(content, { attributes: true, attributeFilter: ['data-page-projection'] });
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      syncVisibility();
    }, { rootMargin: '100px', threshold: 0 }) : null;
    if (observer) observer.observe(host);
    else { visible = true; syncVisibility(); }
    hero.addEventListener('pointermove', pointer, { passive: true });
    hero.addEventListener('pointerleave', leave);
    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('pageshow', restorePage);
    reduced.addEventListener('change', reset);
    return () => {
      disposed = true;
      request++;
      cancelStart();
      observer?.disconnect();
      projectionObserver?.disconnect();
      hero.removeEventListener('pointermove', pointer);
      hero.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('pageshow', restorePage);
      reduced.removeEventListener('change', reset);
      lease?.release();
      delete root.dataset.techReady;
    };
  }, [sceneRevision]);

  return <div className="tech-hero" ref={rootRef} aria-hidden="true" data-page-reveal-skip data-tech-mode={staticScene ? 'static' : 'webgl'}>
    {staticScene && <picture className="tech-hero__poster">
      <source media="(max-width: 730px)" srcSet={withBase('/assets/hero/repair-lab-mobile.webp')} />
      <img src={withBase('/assets/hero/repair-lab-desktop.webp')} alt="" width="2160" height="1020" decoding="async" />
    </picture>}
    <div className="tech-hero__canvas" ref={canvasRef} />
  </div>;
}
