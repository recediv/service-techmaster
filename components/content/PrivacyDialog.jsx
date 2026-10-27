'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Button from '../ui/Button';
import './privacy-content.css';
import './privacy-dialog.css';

function usePrivacyScrollLock(open) {
  const current = useRef(null);
  useLayoutEffect(() => {
    if (!open) return;
    if (!current.current) {
      const root = document.documentElement;
      const body = document.body;
      // clientWidth can include a reserved gutter with overlay scrollbars.
      const gap = Math.max(0, window.innerWidth - root.getBoundingClientRect().width);
      const attribute = root.getAttribute('data-privacy-scroll-lock');
      const value = root.style.getPropertyValue('--privacy-page-gap');
      const priority = root.style.getPropertyPriority('--privacy-page-gap');
      const lock = { active: true, release: null };
      const observer = new MutationObserver(() => lock.release());
      lock.release = () => {
        // Radix keeps the scroll lock during the closing animation as well.
        if (lock.active || body.hasAttribute('data-scroll-locked')) return;
        observer.disconnect();
        if (attribute === null) root.removeAttribute('data-privacy-scroll-lock');
        else root.setAttribute('data-privacy-scroll-lock', attribute);
        if (value) root.style.setProperty('--privacy-page-gap', value, priority);
        else root.style.removeProperty('--privacy-page-gap');
        if (current.current === lock) current.current = null;
      };
      current.current = lock;
      observer.observe(body, { attributes: true, attributeFilter: ['data-scroll-locked'] });
      root.style.setProperty('--privacy-page-gap', `${gap}px`);
      root.setAttribute('data-privacy-scroll-lock', '');
    }
    const lock = current.current;
    lock.active = true;
    return () => { lock.active = false; lock.release(); };
  }, [open]);
}

function documentContent(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const content = parsed.querySelector('[data-privacy-content]');
  if (!content) throw new Error('Privacy content is unavailable');
  const ids = new Map();
  content.querySelectorAll('[id]').forEach(element => {
    const original = element.id;
    const replacement = `dialog-${original}`;
    ids.set(original, replacement);
    element.id = replacement;
  });
  content.querySelectorAll('a[href^="#"]').forEach(link => {
    const id = ids.get(link.getAttribute('href').slice(1));
    if (id) link.setAttribute('href', `#${id}`);
  });
  // The page retains its original H1; the modal has its own accessible title.
  content.querySelectorAll('h1').forEach(heading => {
    const replacement = parsed.createElement('h2');
    for (const attribute of heading.attributes) replacement.setAttribute(attribute.name, attribute.value);
    replacement.innerHTML = heading.innerHTML;
    heading.replaceWith(replacement);
  });
  const navigation = content.querySelector('.privacy-document__toc');
  if (navigation) {
    const list = parsed.createElement('ol');
    navigation.querySelectorAll('a').forEach(link => {
      const label = parsed.createElement('span');
      label.textContent = link.textContent;
      link.replaceChildren(label);
      const item = parsed.createElement('li');
      item.append(link);
      list.append(item);
    });
    navigation.replaceChildren(list);
  }
  const contents = navigation?.outerHTML || '';
  content.querySelector('.privacy-document__contents')?.remove();
  return { html: content.outerHTML, contents };
}

export default function PrivacyDialog({ href, open, onOpenChange, returnFocus }) {
  usePrivacyScrollLock(open);
  const title = useRef(null);
  const body = useRef(null);
  const [content, setContent] = useState(null);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open) return;
    const request = new AbortController();
    setStatus('loading');
    fetch(href, { signal: request.signal, cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error('Privacy page is unavailable');
        return response.text();
      })
      .then(response => { setContent(documentContent(response)); setStatus('ready'); })
      .catch(error => { if (error.name !== 'AbortError') setStatus('error'); });
    return () => request.abort();
  }, [open, href, attempt]);
  const navigateSection = event => {
    const link = event.target.closest('.privacy-document__toc a[href^="#"]');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const target = body.current?.querySelector(`#${CSS.escape(link.hash.slice(1))}`);
    if (!target) return;
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  };
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="privacy-dialog__overlay" />
      <Dialog.Content className="privacy-dialog" data-site-dialog="" aria-describedby={undefined}
        onOpenAutoFocus={event => { event.preventDefault(); title.current?.focus({ preventScroll: true }); }}
        onCloseAutoFocus={event => { event.preventDefault(); returnFocus(); }}>
        <header className="privacy-dialog__header">
          <Dialog.Title className="privacy-dialog__title" ref={title} tabIndex={-1}>Политика конфиденциальности</Dialog.Title>
          <Dialog.Close asChild><Button className="privacy-dialog__close" variant="outline" aria-label="Закрыть окно"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></Button></Dialog.Close>
        </header>
        <div className="privacy-dialog__layout" onClick={navigateSection}>
          <aside className="privacy-dialog__contents">
            <p className="privacy-dialog__contents-title">Содержание</p>
            {content?.contents && <div dangerouslySetInnerHTML={{ __html: content.contents }} />}
          </aside>
          <div className="privacy-dialog__scroll" ref={body} aria-busy={status === 'loading'}>
            {content && <div dangerouslySetInnerHTML={{ __html: content.html }} />}
            {!content && status === 'loading' && <div className="privacy-dialog__loading" role="status"><span className="privacy-dialog__spinner" aria-hidden="true" /><p>Загружаем документ…</p><div className="privacy-dialog__skeleton" aria-hidden="true"><i /><i /><i /><i /><i /></div></div>}
            {status === 'error' && <div className="privacy-dialog__error" role="alert"><p>Не удалось загрузить документ.</p><Button className="privacy-dialog__retry" variant="outline" onClick={() => setAttempt(value => value + 1)}>Повторить загрузку</Button></div>}
          </div>
        </div>
        <footer className="privacy-dialog__footer">
          <Dialog.Close asChild><Button className="privacy-dialog__done">Закрыть</Button></Dialog.Close>
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
