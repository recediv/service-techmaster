const sectionNames = {
  '/services/remont-avtomagnitol/': 'car-stereo',
  '/services/remont-iphone/': 'iphone',
  '/services/remont-byitovoj-texniki/': 'washing-machine',
  '/services/remont-videokart/': 'graphics-card',
  '/services/remont-kompyuterov/': 'desktop-computer',
  '/services/konsoli/': 'game-console',
  '/services/remont-lazernyix-printerov-i-mfu/': 'laser-printer',
  '/services/remont-monitorov/': 'monitor',
  '/services/remont-noutbukov/': 'laptop',
  '/services/remont-obogrevatelej/': 'radiator',
  '/services/remont-planshetov/': 'tablet',
  '/services/remont-televizorov/': 'television',
  '/services/remont-sotovyh/': 'mobile-phones',
  '/services/remont-fotoapparatov/': 'camera',
  '/services/remont-elektronnyh-knig/': 'ebook',
};

const drawings = {
  'car-stereo': <>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <rect data-icon-part="stereo-display" x="5" y="9" width="8" height="4" rx=".7" />
    <circle data-icon-part="stereo-knob" cx="17.2" cy="12" r="2.2" />
    <path d="M5 15.5h2.5m2 0H12" />
  </>,
  iphone: <>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M9 2.5v1.2c0 .5.4.8.8.8h4.4c.4 0 .8-.3.8-.8V2.5M10 18.8h4" />
  </>,
  'washing-machine': <>
    <rect x="4" y="3" width="16" height="18" rx="1.8" />
    <path d="M4 7.5h16M7 5.3h2m6.5 0h1" />
    <circle cx="12" cy="13.8" r="4.5" />
    <path data-icon-part="washer-drum" d="M8 13.8c1.5-1 2.5 1 4 0s2.5-1 4 0" />
  </>,
  'graphics-card': <>
    <rect x="2.5" y="5.5" width="18" height="12" rx="1.3" />
    <path d="M21.5 4v15M5 17.5v2h11v-2m-8 0v2m4-2v2" />
    <circle cx="7.7" cy="11.5" r="3.1" />
    <circle cx="15.3" cy="11.5" r="3.1" />
    <path data-icon-part="gpu-fan-left" d="M7.7 9.5v2l1.7 1m-1.7-1-1.7 1" />
    <path data-icon-part="gpu-fan-right" d="M15.3 9.5v2l1.7 1m-1.7-1-1.7 1" />
  </>,
  'desktop-computer': <>
    <rect x="2.5" y="4" width="13" height="11" rx="1.4" />
    <path d="M9 15v4M5.5 19h7" />
    <rect x="18" y="3.5" width="4" height="17" rx="1" />
    <path data-icon-part="computer-led" d="M19.8 7h.4m-.4 3h.4m-.4 7.5h.4" />
  </>,
  'game-console': <>
    <path d="M7 7.5h10c2 0 3.2 2.4 4 7 .3 1.7-.4 3.1-1.7 3.4-1 .2-1.8-.4-3.5-2.4H8.2c-1.7 2-2.5 2.6-3.5 2.4-1.3-.3-2-1.7-1.7-3.4.8-4.6 2-7 4-7Z" />
    <path data-icon-part="console-dpad" d="M5.7 11.5h4m-2-2v4" />
    <circle data-icon-part="console-button-a" cx="16" cy="10.8" r=".6" />
    <circle data-icon-part="console-button-b" cx="18.2" cy="13" r=".6" />
  </>,
  'laser-printer': <>
    <path d="M7 7V3h10v4M7 17H4a1.5 1.5 0 0 1-1.5-1.5v-6A1.5 1.5 0 0 1 4 8h16a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 20 17h-3" />
    <path data-icon-part="printer-paper" d="M7 13h10v8H7zM10 16h4m-4 2.5h4" />
    <circle cx="17.8" cy="10.5" r=".5" />
  </>,
  monitor: <>
    <rect data-icon-part="monitor-screen" x="3" y="3.5" width="18" height="13" rx="1.6" />
    <path d="M12 16.5v4M8 20.5h8" />
  </>,
  laptop: <>
    <rect x="5" y="3.5" width="14" height="12" rx="1.3" />
    <path d="M2.5 16.5h19L20 20H4zM10 18.2h4" />
  </>,
  radiator: <>
    <rect x="4" y="7" width="3" height="12" rx="1.2" />
    <rect x="8.3" y="7" width="3" height="12" rx="1.2" />
    <rect x="12.6" y="7" width="3" height="12" rx="1.2" />
    <rect x="16.9" y="7" width="3" height="12" rx="1.2" />
    <path d="M2.5 10H4m15.9 5h1.6M6 19v2m12-2v2" />
    <path data-icon-part="radiator-heat" d="M7 4.5c-1-1 1-1.5 0-2.5m5 2.5c-1-1 1-1.5 0-2.5m5 2.5c-1-1 1-1.5 0-2.5" />
  </>,
  tablet: <>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M17.5 8v8" />
    <circle cx="19.5" cy="12" r=".5" />
  </>,
  television: <>
    <rect x="3" y="7" width="18" height="12" rx="1.7" />
    <path d="m8 2.5 4 4 4-4M7 19l-2 2m12-2 2 2" />
  </>,
  'mobile-phones': <>
    <path d="M6 19H5a1.5 1.5 0 0 1-1.5-1.5V4A1.5 1.5 0 0 1 5 2.5h8A1.5 1.5 0 0 1 14.5 4" />
    <g data-icon-part="phone-front">
      <rect x="8" y="5.5" width="12" height="16" rx="2" />
      <path d="M12 8h4m-3.5 11h3" />
    </g>
  </>,
  camera: <>
    <rect x="2.5" y="7.5" width="19" height="13" rx="2" />
    <path d="m7 7.5 1.5-4h7l1.5 4M5 5.5h1.5" />
    <circle data-icon-part="camera-lens" cx="12" cy="14" r="4" />
    <circle cx="18.5" cy="10.5" r=".5" />
  </>,
  ebook: <>
    <path d="M12 6.5C9.3 4.7 6.3 4.3 3 5.1v14c3.3-.8 6.3-.4 9 1.4 2.7-1.8 5.7-2.2 9-1.4v-14c-3.3-.8-6.3-.4-9 1.4Zm0 0v14" />
    <path d="M5.5 8.5c1.4-.1 2.7.1 4 .7m-4 2.3c1.4-.1 2.7.1 4 .7m5-3c1.3-.6 2.6-.8 4-.7m-4 3.7c1.3-.6 2.6-.8 4-.7" />
  </>,
  fallback: <path d="M14.5 5.5a5.1 5.1 0 0 0-6.2 6.2l-5 5a2.1 2.1 0 0 0 3 3l5-5a5.1 5.1 0 0 0 6.2-6.2l-3 3-3-3 3-3Z" />,
};

const motionDetails = {
  laptop: <path data-icon-part="laptop-typing" d="m8 7 2 2-2 2m4 0h3" />,
  'desktop-computer': <path data-icon-part="computer-boot" d="M5.5 9.5h7" />,
  television: <path data-icon-part="tv-signal" d="M6 10h12" />,
  ebook: <g data-icon-part="book-leaf">
    <path d="M12 6.5c2.7-1.8 5.7-2.2 9-1.4v14c-3.3-.8-6.3-.4-9 1.4M14.5 9.2c1.3-.6 2.6-.8 4-.7m-4 3.7c1.3-.6 2.6-.8 4-.7" />
  </g>,
};

export default function SectionIcon({ path, motionParts = false }) {
  const name = sectionNames[path] || 'fallback';
  return <svg className="site-category-icon" data-section-icon={name} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{drawings[name]}{motionParts && motionDetails[name]}</svg>;
}
