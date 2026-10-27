'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { internalHref, withBase } from '../../lib/public-urls.mjs';

let dialogModule;
function loadDialog() {
  if (!dialogModule) dialogModule = import('./PrivacyDialog').catch(error => { dialogModule = null; throw error; });
  return dialogModule;
}

export default function PrivacyLink({ href, children }) {
  const publicHref = withBase(internalHref(href));
  const pathname = usePathname();
  const link = useRef(null);
  const [Dialog, setDialog] = useState(null);
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  const preload = () => { loadDialog().catch(() => {}); };
  const show = async event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const openingPath = location.pathname;
    setPreparing(true);
    try {
      const component = (await loadDialog()).default;
      if (location.pathname !== openingPath) return;
      setDialog(() => component);
      setOpen(true);
    } catch {
      if (location.pathname === openingPath) location.assign(publicHref);
    } finally { setPreparing(false); }
  };
  return <>
    <a className="site-footer__policy" href={publicHref} rel="nofollow" ref={link} data-site-dialog="" onClick={show} onPointerEnter={preload} onFocus={preload} aria-haspopup="dialog" aria-expanded={open} aria-busy={preparing || undefined}>
      {children}{preparing && <span className="privacy-link__loading" aria-hidden="true">…</span>}
    </a>
    {Dialog && <Dialog href={publicHref} open={open} onOpenChange={setOpen} returnFocus={() => link.current?.focus({ preventScroll: true })} />}
  </>;
}
