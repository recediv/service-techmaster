'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { basePath, internalHref } from '../../lib/public-urls.mjs';
import SectionIcon from './SectionIcon';
import Button from '../ui/Button';

function activeItem(item, path) {
  return item.path === path || (item.path !== '/' && path.startsWith(item.path)) || item.children?.some(child => activeItem(child, path));
}

function ItemLabel({ item, section = false }) {
  return <>{section && <span className="site-icon" aria-hidden="true"><SectionIcon path={item.path} /></span>}<span className="site-label">{item.label}</span></>;
}

export default function Navigation({ items = [], informationItems = [] }) {
  const pathname = usePathname() || '/';
  let currentPath = basePath && pathname.startsWith(basePath + '/') ? pathname.slice(basePath.length) : pathname;
  try { currentPath = decodeURIComponent(currentPath); } catch { /* Keep invalid URIs unchanged. */ }
  const services = items.find(item => item.children?.length) || items[0];
  const categories = services?.children || [];
  const [mobile, setMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [mobileCategory, setMobileCategory] = useState(null);
  const wrapper = useRef(null);
  const mobileToggle = useRef(null);
  const servicesToggle = useRef(null);
  const categoryHover = useRef(null);
  const activeHasBrands = categories.some(item => item.path === activeCategory && item.children?.length > 0);
  const cancelCategoryHover = useCallback(() => {
    clearTimeout(categoryHover.current);
    categoryHover.current = null;
  }, []);
  const close = useCallback(() => {
    cancelCategoryHover();
    setMobileOpen(false);
    setServicesOpen(false);
    setActiveCategory(null);
    setMobileCategory(null);
  }, [cancelCategoryHover]);

  useEffect(() => cancelCategoryHover, [cancelCategoryHover]);

  useLayoutEffect(() => {
    const media = matchMedia('(max-width: 730px)');
    const sync = () => { setMobile(media.matches); close(); };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [close]);

  useLayoutEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    const outside = event => { if (!wrapper.current?.contains(event.target)) close(); };
    const escape = event => {
      if (event.key !== 'Escape' || !mobileOpen && !servicesOpen) return;
      event.preventDefault();
      close();
      (mobile ? mobileToggle : servicesToggle).current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    addEventListener('site:navigation-close', close);
    addEventListener('popstate', close);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      removeEventListener('site:navigation-close', close);
      removeEventListener('popstate', close);
    };
  }, [close, mobile, mobileOpen, servicesOpen]);

  const panelId = item => `site-brands-${item.id || categories.indexOf(item)}`;
  const brands = item => item.children?.length > 0 && <ul
    className="site-brand-list" id={panelId(item)} aria-label={item.label}
    data-active={activeCategory === item.path} data-open={mobileCategory === item.path}
    aria-hidden={mobile ? mobileCategory !== item.path : activeCategory !== item.path}>
    <li className="site-brands-heading" aria-hidden="true">{item.label}</li>
    {item.children.map(child => <li key={child.id || child.path}>
      <Link href={internalHref(child.path)} prefetch={false} className={activeItem(child, currentPath) ? 'site-nav-active' : undefined} aria-current={currentPath === child.path ? 'page' : undefined}><ItemLabel item={child} /></Link>
    </li>)}
  </ul>;

  return <div className="site-navigation-wrap" ref={wrapper} onBlurCapture={event => {
    if (event.relatedTarget && !wrapper.current?.contains(event.relatedTarget)) close();
  }}>
    <button ref={mobileToggle} type="button" className="site-menu-toggle" aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'} aria-controls="site-navigation" aria-expanded={mobileOpen} onClick={() => {
      cancelCategoryHover(); setActiveCategory(null);
      setMobileOpen(value => !value); setServicesOpen(false); setMobileCategory(null);
    }}><span className="site-hamburger" aria-hidden="true"><i /><i /><i /></span><span>Меню</span></button>
    <nav className="site-navigation" id="site-navigation" aria-label="Основная навигация" data-mobile-open={mobileOpen}>
      <ul className="menu1 site-menu-root">
        {items.map(item => item === services ? <li className="site-services" data-open={servicesOpen} key={item.id || item.path}>
          <div className="site-service-control">
            <Button ref={servicesToggle} type="button" variant="primary" className="site-service-toggle" aria-label={`Разделы: ${item.label}`} aria-controls="site-services-panel" aria-expanded={servicesOpen} onClick={() => {
              cancelCategoryHover(); setActiveCategory(null); setMobileCategory(null);
              setServicesOpen(value => !value);
            }}><span className="site-label">{item.label}</span></Button>
          </div>
          <div className="site-mega" id="site-services-panel" data-open={servicesOpen}>
            <ul className="site-category-list">
              <li className="site-all-services"><Link href={internalHref(item.path)} prefetch={false} aria-current={currentPath === item.path ? 'page' : undefined}><ItemLabel item={item} /></Link></li>
              {categories.map(category => <li className="site-category" key={category.id || category.path} data-active={activeCategory === category.path} data-mobile-open={mobileCategory === category.path}>
                <div className="site-category-row" onPointerEnter={event => {
                  if (mobile || event.pointerType !== 'mouse') return;
                  cancelCategoryHover();
                  categoryHover.current = setTimeout(() => {
                    categoryHover.current = null;
                    setActiveCategory(category.path);
                  }, 120);
                }} onPointerLeave={cancelCategoryHover} onFocusCapture={() => {
                  if (!mobile) {
                    cancelCategoryHover();
                    setActiveCategory(category.path);
                  }
                }}>
                  <Link href={internalHref(category.path)} prefetch={false} className={activeItem(category, currentPath) ? 'site-nav-active' : undefined} aria-current={currentPath === category.path ? 'page' : undefined}><ItemLabel item={category} section /></Link>
                  {category.children?.length > 0 && <button type="button" className="site-category-toggle" aria-label={`Разделы: ${category.label}`} aria-controls={panelId(category)} aria-expanded={mobile ? mobileCategory === category.path : activeCategory === category.path} onClick={() => {
                    cancelCategoryHover();
                    if (mobile) setMobileCategory(value => value === category.path ? null : category.path);
                    else setActiveCategory(category.path);
                  }} />}
                </div>
                {mobile && brands(category)}
              </li>)}
            </ul>
            {!mobile && <div className="site-brand-panels" data-visible={activeHasBrands}>{categories.map(category => <div key={category.id || category.path}>{brands(category)}</div>)}</div>}
          </div>
        </li> : <li key={item.id || item.path}><Link href={internalHref(item.path)} prefetch={false}><ItemLabel item={item} /></Link></li>)}
      </ul>
      <ul className="menu2 site-information">{informationItems.map(item => <li key={item.id || item.path}>
        <Link href={internalHref(item.path)} prefetch={false} className={activeItem(item, currentPath) ? 'site-nav-active' : undefined} aria-current={currentPath === item.path ? 'page' : undefined}><ItemLabel item={item} /></Link>
      </li>)}</ul>
    </nav>
  </div>;
}
