'use client';

import { useEffect, useRef } from 'react';

export default function WorkJourney({ children, revealKey }) {
  const rootRef = useRef(null);
  const svgRef = useRef(null);
  const trackRef = useRef(null);
  const progressRef = useRef(null);
  const dotRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    const track = trackRef.current;
    const progress = progressRef.current;
    const dot = dotRef.current;
    if (!root || !svg || !track || !progress || !dot || typeof track.getTotalLength !== 'function') return;
    const steps = [...root.querySelectorAll('.how-we-work__step')];
    const nodes = steps.map(step => step.querySelector('.how-we-work__node'));
    if (steps.length < 2 || nodes.some(node => !node)) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const played = new WeakSet();

    const reset = () => {
      delete root.dataset.workMotion;
      steps.forEach(step => { delete step.dataset.workActive; delete step.dataset.workPlay; });
      track.removeAttribute('d');
      progress.removeAttribute('d');
      progress.removeAttribute('stroke-dasharray');
      progress.removeAttribute('stroke-dashoffset');
      dot.removeAttribute('cx');
      dot.removeAttribute('cy');
    };

    const enhance = () => {
      let alive = true;
      let frame = 0;
      let resizeFrame = 0;
      let geometry = null;
      root.dataset.workMotion = 'measure';

      const update = () => {
        frame = 0;
        if (!alive || !geometry) return;
        const cursor = window.innerHeight * .65 - root.getBoundingClientRect().top;
        const { points, lengths, total } = geometry;
        let distance = cursor >= points.at(-1).y ? total : 0;
        for (let i = 0; i < points.length - 1; i++) {
          if (cursor >= points[i].y && cursor < points[i + 1].y) {
            const amount = (cursor - points[i].y) / (points[i + 1].y - points[i].y);
            distance = lengths[i] + (lengths[i + 1] - lengths[i]) * amount;
            break;
          }
        }
        distance = Math.max(0, Math.min(total, distance));
        progress.setAttribute('stroke-dashoffset', String(total - distance));
        const point = track.getPointAtLength(distance);
        dot.setAttribute('cx', String(point.x));
        dot.setAttribute('cy', String(point.y));
        steps.forEach((step, index) => {
          const active = cursor >= points[index].y;
          step.dataset.workActive = String(active);
          if (active && !played.has(step)) {
            played.add(step);
            step.dataset.workPlay = 'true';
          }
        });
      };
      const measure = () => {
        resizeFrame = 0;
        if (!alive) return;
        if (!root.dataset.workMotion) root.dataset.workMotion = 'measure';
        const box = root.getBoundingClientRect();
        if (!box.width || !box.height) return;
        // The anchors stay outside reveal transforms and SVG part animations.
        const points = nodes.map(node => {
          const rect = node.getBoundingClientRect();
          return { x: rect.left - box.left + rect.width / 2, y: rect.top - box.top + rect.height / 2 };
        });
        const bounds = steps.map(step => step.getBoundingClientRect());
        svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
        const n = value => Math.round(value * 10) / 10;
        let d = `M ${n(points[0].x)} ${n(points[0].y)}`;
        const lengths = [0];
        try {
          for (let i = 0; i < points.length - 1; i++) {
            const a = points[i], b = points[i + 1];
            if (Math.abs(b.x - a.x) < 1) d += ` L ${n(b.x)} ${n(b.y)}`;
            else {
              // Horizontal sections stay in the actual gap, clear of full text.
              const middle = (bounds[i].bottom + bounds[i + 1].top) / 2 - box.top;
              const radius = Math.max(0, Math.min(24, (bounds[i + 1].top - bounds[i].bottom) / 3, Math.abs(b.x - a.x) / 4));
              const direction = Math.sign(b.x - a.x);
              d += ` L ${n(a.x)} ${n(middle - radius)} Q ${n(a.x)} ${n(middle)} ${n(a.x + direction * radius)} ${n(middle)} L ${n(b.x - direction * radius)} ${n(middle)} Q ${n(b.x)} ${n(middle)} ${n(b.x)} ${n(middle + radius)} L ${n(b.x)} ${n(b.y)}`;
            }
            track.setAttribute('d', d);
            lengths.push(track.getTotalLength());
          }
          const total = lengths.at(-1);
          if (!Number.isFinite(total) || total <= 0) throw new Error('Empty route');
          progress.setAttribute('d', d);
          progress.setAttribute('stroke-dasharray', `${total} ${total}`);
          geometry = { points, lengths, total };
          root.dataset.workMotion = 'ready';
          cancelAnimationFrame(frame);
          frame = 0;
          update();
        } catch {
          geometry = null;
          reset();
        }
      };
      const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
      const resize = () => { if (!resizeFrame) resizeFrame = requestAnimationFrame(measure); };
      window.addEventListener('scroll', scroll, { passive: true });
      window.addEventListener('resize', resize);
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
      observer?.observe(root);
      steps.forEach(step => observer?.observe(step));
      measure();
      document.fonts?.ready.then(() => { if (alive) resize(); });
      return () => {
        alive = false;
        cancelAnimationFrame(frame);
        cancelAnimationFrame(resizeFrame);
        window.removeEventListener('scroll', scroll);
        window.removeEventListener('resize', resize);
        observer?.disconnect();
        reset();
      };
    };
    let dispose = () => {};
    const sync = () => {
      dispose();
      dispose = reduced.matches ? () => {} : enhance();
    };
    sync();
    reduced.addEventListener('change', sync);
    return () => { dispose(); reduced.removeEventListener('change', sync); };
  }, [revealKey]);

  return <div className="how-we-work__journey" ref={rootRef}>
    <svg className="how-we-work__route" ref={svgRef} aria-hidden="true" focusable="false" preserveAspectRatio="none">
      <path className="how-we-work__track" ref={trackRef} />
      <path className="how-we-work__progress" ref={progressRef} />
      <circle className="how-we-work__traveller" r="5" ref={dotRef} />
    </svg>
    {children}
  </div>;
}
