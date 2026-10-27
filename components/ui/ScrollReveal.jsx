'use client';

import { useEffect, useRef } from 'react';
import './scroll-reveal.css';

function observeReveals(root, selector, stagger, seen, animateInitial, { threshold, maxDelay, scope }) {
  const targets = [...(typeof selector === 'function' ? selector(root) : root.querySelectorAll(selector))];
  const ownedTargets = new Set(targets);
  const initialTargets = new Set();
  const reveal = target => {
    seen.add(target);
    target.dataset.scrollRevealState = 'visible';
    observer.unobserve(target);
  };
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) reveal(entry.target);
    }
  }, { threshold, rootMargin: '0px 0px 40px 0px' });

  targets.forEach((target, index) => {
    if (seen.has(target)) return;
    target.style.setProperty('--scroll-reveal-delay', `${Math.min(index * stagger, maxDelay)}ms`);
    if (scope) target.dataset.scrollRevealScope = scope;
    // Existing consumers keep immediately visible content; initial animation is opt-in.
    if (target.getBoundingClientRect().top < window.innerHeight) {
      // Navigation already reveals this viewport through the robot's light.
      // Keep first-load and subsequent scroll entrances independent.
      if (animateInitial && !root.closest('.site-page-content[data-page-projection]')) {
        target.dataset.scrollRevealState = 'initial';
        initialTargets.add(target);
      } else seen.add(target);
      return;
    }
    target.dataset.scrollRevealState = 'pending';
    observer.observe(target);
  });

  // Mark initial content as seen only after its animation. Dev StrictMode may
  // clean up and restart the effect before the first animation frame.
  const finishInitial = event => {
    if (event.animationName === 'scroll-reveal-enter' && initialTargets.has(event.target)) {
      seen.add(event.target);
      initialTargets.delete(event.target);
    }
  };
  root.addEventListener('animationend', finishInitial);
  const focus = event => {
    const target = event.target.closest('[data-scroll-reveal-state]');
    if (target && ownedTargets.has(target)) {
      if (target.dataset.scrollRevealState === 'pending') reveal(target);
      else seen.add(target);
    }
  };
  root.addEventListener('focusin', focus);

  return () => {
    observer.disconnect();
    root.removeEventListener('animationend', finishInitial);
    root.removeEventListener('focusin', focus);
    targets.forEach(target => {
      delete target.dataset.scrollRevealState;
      if (scope) delete target.dataset.scrollRevealScope;
      target.style.removeProperty('--scroll-reveal-delay');
    });
  };
}

// Children remain server-rendered and visible without the optional enhancement.
export default function ScrollReveal({ children, className = '', selector = ':scope > *', stagger = 70, animateInitial = false, revealKey, threshold = 0.08, maxDelay = Infinity, scope, watchChildren = true }) {
  const ref = useRef(null);
  const seen = useRef(new WeakSet());
  const previousKey = useRef(revealKey);

  useEffect(() => {
    const root = ref.current;
    if (previousKey.current !== revealKey) {
      seen.current = new WeakSet();
      previousKey.current = revealKey;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let dispose = () => {};
    const update = () => {
      dispose();
      dispose = !reduced.matches && typeof IntersectionObserver === 'function'
        ? observeReveals(root, selector, stagger, seen.current, animateInitial, { threshold, maxDelay, scope })
        : () => {};
    };
    update();
    reduced.addEventListener('change', update);
    return () => {
      dispose();
      reduced.removeEventListener('change', update);
    };
  }, [watchChildren ? children : null, selector, stagger, animateInitial, revealKey, threshold, maxDelay, scope]);

  return <div className={['scroll-reveal', className].filter(Boolean).join(' ')} ref={ref}>{children}</div>;
}
