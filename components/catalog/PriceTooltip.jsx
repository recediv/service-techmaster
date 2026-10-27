'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// One floating hint per price module, shared by header and mobile row buttons.
export default function usePriceTooltip() {
  const [hint, setHint] = useState(null);
  const [position, setPosition] = useState(null);
  const bubble = useRef(null);
  const timer = useRef(0);
  const cancel = () => window.clearTimeout(timer.current);
  const close = () => { cancel(); setHint(null); setPosition(null); };
  const leave = () => { cancel(); timer.current = window.setTimeout(close, 140); };
  const target = event => event.target.closest?.('button[data-price-hint]');
  const show = button => {
    const text = document.getElementById(button.dataset.priceHint)?.textContent;
    if (!text) return;
    cancel();
    setPosition(null);
    setHint({ button, text });
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (!hint || !bubble.current) return;
    const update = () => {
      if (!bubble.current) return;
      if (!hint.button.isConnected) { close(); return; }
      const anchor = hint.button.getBoundingClientRect();
      if (anchor.bottom < 0 || anchor.top > window.innerHeight) { close(); return; }
      const box = bubble.current.getBoundingClientRect();
      const above = anchor.top >= box.height + 18;
      setPosition({
        left: Math.max(10, Math.min(window.innerWidth - box.width - 10, anchor.left + anchor.width / 2 - box.width / 2)),
        top: Math.max(10, Math.min(window.innerHeight - box.height - 10, above ? anchor.top - box.height - 10 : anchor.bottom + 10)),
      });
    };
    const outside = event => { if (!hint.button.contains(event.target) && !bubble.current?.contains(event.target)) close(); };
    const escape = event => { if (event.key === 'Escape') close(); };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [hint]);

  return {
    close,
    events: {
      onPointerOver: event => { const button = target(event); if (button && event.pointerType !== 'touch' && !button.contains(event.relatedTarget)) show(button); },
      onPointerOut: event => { const button = target(event); if (button && !button.contains(event.relatedTarget)) leave(); },
      onFocus: event => { const button = target(event); if (button) show(button); },
      onBlur: event => { if (target(event)) leave(); },
      onClick: event => { const button = target(event); if (button) { event.preventDefault(); show(button); } },
    },
    portal: hint && createPortal(<div ref={bubble} className="catalog-price-tooltip" aria-hidden="true" style={{ left: position?.left || 0, top: position?.top || 0, visibility: position ? 'visible' : 'hidden' }} onPointerEnter={cancel} onPointerLeave={leave}>{hint.text}</div>, document.body),
  };
}
