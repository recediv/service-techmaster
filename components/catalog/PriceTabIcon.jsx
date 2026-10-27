const drawings = {
  mechanical: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.5-3.5a5.8 5.8 0 0 1-7.7 7.7l-6.8 6.8a2.1 2.1 0 0 1-3-3l6.8-6.8a5.8 5.8 0 0 1 7.7-7.7z" />,
  hardware: <>
    <rect x="6" y="6" width="12" height="12" rx="2" />
    <path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4" />
    <rect x="9.5" y="9.5" width="5" height="5" rx=".7" />
  </>,
  software: <>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M3 8h18m-12 3-3 3 3 3m6-6 3 3-3 3m-2-6-2 6" />
    <path d="M6 6h.1M9 6h.1" />
  </>,
  faults: <>
    <path d="m10.4 4-8 13.8a1.8 1.8 0 0 0 1.6 2.7h16a1.8 1.8 0 0 0 1.6-2.7L13.6 4a1.85 1.85 0 0 0-3.2 0Z" />
    <path d="M12 8v5m0 3h.01" />
  </>,
};

export default function PriceTabIcon({ label = '' }) {
  const name = /неисправност/i.test(label) ? 'faults' : /программ/i.test(label) ? 'software' : /аппарат/i.test(label) ? 'hardware' : 'mechanical';
  return <svg className="catalog-price-tab-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{drawings[name]}</svg>;
}
