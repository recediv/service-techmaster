'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { basePath } from '../lib/public-urls.mjs';
import { createPageProjection } from '../lib/page-projection.mjs';

function closeNavigation() {
  document.body.classList.remove('hidden');
  window.dispatchEvent(new Event('site:navigation-close'));
}

export default function SiteRuntime() {
  const router = useRouter();
  const pathname = usePathname();
  const pending = useRef(null);
  const queued = useRef(null);
  useLayoutEffect(() => {
    closeNavigation();
    window.dispatchEvent(new CustomEvent('site:route-ready', { detail: location.pathname }));
  }, [pathname]);
  useEffect(() => {
    const timers = new Set();
    const cleanups = new Set();
    let disposed = false;
    const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pathKey = value => {
      try { return decodeURIComponent(value).replace(/\/$/, '') || '/'; } catch { return value; }
    };
    const navigate = (url) => {
      if (pending.current) { queued.current = url; return; }
      const fromPath = location.pathname;
      const localPath = (basePath && url.pathname.startsWith(basePath + '/') ? url.pathname.slice(basePath.length) : url.pathname) + url.search + url.hash;
      if (url.pathname === location.pathname) { router.push(localPath); return; }
      const token = { projection: null };
      pending.current = token;
      closeNavigation();
      token.projection = createPageProjection(document.querySelector('.site-page-content'));
      const release = () => {
        token.projection.destroy();
        if (pending.current !== token) return;
        pending.current = null;
        if (queued.current) {
          const next = queued.current; queued.current = null;
          if (next.href !== location.href) navigate(next);
        }
      };
      const commit = () => new Promise((resolve) => {
        let timeout;
        let complete = false;
        const finish = () => {
          if (complete) return;
          complete = true;
          clearTimeout(timeout); timers.delete(timeout);
          removeEventListener('site:route-ready', ready);
          cleanups.delete(finish);
          resolve();
        };
        const ready = (event) => { if (pathKey(event.detail) === pathKey(url.pathname) || pathKey(event.detail) !== pathKey(fromPath)) finish(); };
        cleanups.add(finish);
        addEventListener('site:route-ready', ready);
        timeout = setTimeout(finish, 3500); timers.add(timeout);
        router.push(localPath);
      });
      const transition = async () => {
        router.prefetch(localPath);
        await token.projection.cover();
        if (disposed || pending.current !== token) return;
        await commit();
        if (!disposed && pending.current === token) await token.projection.reveal();
      };
      transition().catch(error => console.error('Page navigation failed', error)).finally(release);
    };
    const onNavigate = event => {
      if (typeof event.detail?.href !== 'string') return;
      const url = new URL(event.detail.href, location.href);
      if (url.origin !== location.origin || basePath && !url.pathname.startsWith(basePath + '/') && url.pathname !== basePath) return;
      event.preventDefault();
      navigate(url);
    };
    const onClick = (event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (element.closest('[data-site-dialog]')) return;
      if (element.closest('[data-embla-carousel]')) return;
      const link = element.closest('a[href]');
      if (!link || link.hasAttribute('download') || link.target && link.target !== '_self') return;
      if (link.hasAttribute('data-community-pagination')) return;
      if (link.getAttribute('role') === 'tab') return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || basePath && !url.pathname.startsWith(basePath + '/') && url.pathname !== basePath) return;
      if (/\/(?:_next|media|legacy)\//.test(url.pathname) || /\.[a-z0-9]{2,5}$/i.test(url.pathname)) return;
      if (!pending.current && url.pathname === location.pathname && url.search === location.search) {
        if (url.hash) {
          const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
          if (target) { event.preventDefault(); target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); }
        } else { event.preventDefault(); scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); }
        return;
      }
      event.preventDefault();
      navigate(url);
    };
    const onHistory = () => {
      queued.current = null;
      pending.current?.projection.destroy();
      pending.current = null;
      cleanups.forEach(cleanup => cleanup());
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('site:navigate', onNavigate);
    window.addEventListener('popstate', onHistory);
    return () => {
      disposed = true;
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('site:navigate', onNavigate);
      window.removeEventListener('popstate', onHistory);
      pending.current?.projection.destroy();
      timers.forEach(clearTimeout);
      cleanups.forEach(cleanup => cleanup());
      pending.current = null;
      queued.current = null;
    };
  }, [router]);
  return null;
}
