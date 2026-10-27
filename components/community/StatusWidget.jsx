'use client';

import { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button';
import './status-widget.css';

const noScriptStyles = '.site-status-widget .site-status-widget__enhanced{display:none}.site-status-widget .site-status-widget__fallback{display:block}';

function WidgetFrame({ src, title, width, height, ...props }) {
  return <iframe {...props} src={src} title={title} width={width} height={height} scrolling="auto" frameBorder="0" referrerPolicy="no-referrer" />;
}

export function StatusWidgetPlaceholder({ phase = 'loading', onRetry }) {
  const message = phase === 'slow' ? 'Загрузка занимает больше времени, чем обычно.'
    : phase === 'error' ? 'Не удалось загрузить форму проверки статуса.'
      : 'Загружаем форму проверки статуса…';
  return <div className="site-status-widget__placeholder">
    {phase === 'loading' && <div className="site-status-widget__skeleton" aria-hidden="true">
      <span className="site-status-widget__shape site-status-widget__shape--heading" />
      <span className="site-status-widget__shape site-status-widget__shape--field" />
      <span className="site-status-widget__shape site-status-widget__shape--field" />
      <span className="site-status-widget__shape site-status-widget__shape--button" />
    </div>}
    <div className="site-status-widget__feedback">
      <p className="site-status-widget__message" role="status" aria-live="polite" aria-atomic="true">{message}</p>
      {(phase === 'slow' || phase === 'error') && <Button variant="outline" className="site-status-widget__retry" onClick={onRetry}>Повторить загрузку</Button>}
    </div>
  </div>;
}

function WidgetAttempt({ src, title, width, height, frameId, onRetry, onPhaseChange }) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState('loading');
  const timer = useRef(null);
  useEffect(() => { onPhaseChange?.(phase); }, [phase, onPhaseChange]);
  useEffect(() => {
    setMounted(true);
    timer.current = setTimeout(() => {
      setPhase(current => current === 'loading' ? 'slow' : current);
    }, 15000);
    return () => clearTimeout(timer.current);
  }, []);
  const loaded = event => {
    if (!mounted || event.currentTarget.getAttribute('src') !== src) return;
    clearTimeout(timer.current);
    // Cross-origin load ends the frame navigation; it cannot verify its app.
    setPhase(current => current === 'error' ? current : 'loaded');
  };
  const failed = () => {
    clearTimeout(timer.current);
    setPhase('error');
  };
  return <div className="site-status-widget__enhanced" data-state={phase}>
    <WidgetFrame id={mounted ? frameId : undefined} className="site-status-widget__frame" src={mounted ? src : undefined} title={title} width={width} height={height} onLoad={loaded} onError={failed} />
    {phase !== 'loaded' && <StatusWidgetPlaceholder phase={phase} onRetry={onRetry} />}
  </div>;
}

export default function StatusWidget({ src, title, width, height, id = 'livesklad-widget', onPhaseChange }) {
  const [attempt, setAttempt] = useState(0);
  const frameId = id === 'livesklad-widget' ? 'widget_iframe' : `${id}-frame`;
  return <div id={id} className="site-status-widget" data-status-widget-src={src} data-status-widget-title={title}
    data-status-widget-width={width} data-status-widget-height={height}
    style={{ '--status-widget-width': width, '--status-widget-height': height }}>
    <WidgetAttempt key={attempt} src={src} title={title} width={width} height={height} frameId={frameId} onPhaseChange={onPhaseChange} onRetry={() => setAttempt(current => current + 1)} />
    <noscript>
      <style>{noScriptStyles}</style>
      <WidgetFrame id={frameId} className="site-status-widget__fallback" src={src} title={title} width={width} height={height} />
    </noscript>
  </div>;
}
