import './work-step-icons.css';

function Diagnostics() {
  return <>
    <g className="work-step-icon__board">
      <rect x="10" y="20" width="37" height="39" rx="4" />
      <rect x="20" y="30" width="17" height="18" rx="2" />
      <path d="M24 26v4m8-4v4m-8 18v5m8-5v5M15 35h5m-5 8h5m17-8h5m-5 8h5" />
      <circle cx="15" cy="25" r="1" />
      <circle cx="42" cy="54" r="1" />
    </g>
    <g className="work-step-icon__magnifier work-step-icon__accent">
      <circle cx="51" cy="32" r="14" />
      <path d="m61 42 12 12M45 26a8 8 0 0 1 6-2" />
    </g>
  </>;
}

function Devices() {
  return <>
    <g className="work-step-icon__device work-step-icon__device--laptop">
      <rect x="5" y="31" width="24" height="18" rx="2" />
      <path d="m5 49-1 6h26l-1-6M13 52h8" />
    </g>
    <g className="work-step-icon__device work-step-icon__device--phone work-step-icon__accent">
      <rect x="32" y="15" width="17" height="38" rx="3" />
      <path d="M38 19h5m-5 30h5" />
    </g>
    <g className="work-step-icon__device work-step-icon__device--tablet">
      <rect x="53" y="26" width="22" height="32" rx="3" />
      <path d="M58 31h12m-9 22h6" />
    </g>
  </>;
}

function FastRepair() {
  return <>
    <circle cx="28" cy="30" r="20" />
    <path d="M28 14v3m0 26v3M12 30h3m26 0h3" />
    <g className="work-step-icon__clock-hands work-step-icon__accent">
      <path d="M28 19v11l8 5" />
    </g>
    <circle cx="28" cy="30" r="1.5" />
    <g className="work-step-icon__wrench work-step-icon__accent">
      <path d="M65 43a11 11 0 0 0 11-14l-7 7-6-2-2-6 7-7a11 11 0 0 0-13 13c.2 1.9.7 3.5 1.7 5.1L42 54.8a5 5 0 0 0 7.1 7.1L64.8 46a11 11 0 0 0 .2-3Z" />
    </g>
  </>;
}

function Chip() {
  return <>
    <g className="work-step-icon__traces">
      <path d="M4 27h10l8 8M4 53h10l8-8M58 34h10V24h8M58 46h10v12h8M29 22v-9h-8V5M47 22V5M31 58v17m16-17v9h11v8" />
      <circle cx="4" cy="27" r="1.5" />
      <circle cx="4" cy="53" r="1.5" />
      <circle cx="76" cy="24" r="1.5" />
      <circle cx="76" cy="58" r="1.5" />
    </g>
    <rect x="22" y="22" width="36" height="36" rx="5" />
    <rect className="work-step-icon__chip-core" x="31" y="31" width="18" height="18" rx="2" />
    <path d="M35 16v6m6-6v6m-6 36v6m6-6v6M16 39h6m-6 6h6m36-6h6m-6 6h6" />
    <g className="work-step-icon__accent">
      <path className="work-step-icon__signal work-step-icon__signal--one" pathLength="1" d="M4 27h10l8 8" />
      <path className="work-step-icon__signal work-step-icon__signal--two" pathLength="1" d="M58 34h10V24h8" />
      <path className="work-step-icon__signal work-step-icon__signal--three" pathLength="1" d="M31 58v17" />
      <circle className="work-step-icon__packet work-step-icon__packet--one" cx="4" cy="27" r="3.2" />
      <circle className="work-step-icon__packet work-step-icon__packet--two" cx="58" cy="34" r="3.2" />
      <circle className="work-step-icon__packet work-step-icon__packet--three" cx="31" cy="58" r="3.2" />
    </g>
  </>;
}

function Guarantee() {
  return <g className="work-step-icon__shield">
    <path d="m40 10 23 9v19c0 15-13 27-23 32-10-5-23-17-23-32V19Z" />
    <path d="m25 25 11-4" />
    <path className="work-step-icon__check work-step-icon__accent" pathLength="1" d="m27 40 9 10 18-22" />
  </g>;
}

export default function WorkStepIcon({ index, html }) {
  const guarantee = index === 4 || index === 2 && /гарант/i.test(String(html || ''));
  const drawing = guarantee ? <Guarantee /> : index === 0 ? <Diagnostics /> : index === 1 ? <Devices /> : index === 2 ? <FastRepair /> : <Chip />;
  return <svg className="how-we-work__icon" width="80" height="80" viewBox="0 0 80 80" fill="none" color="#028291" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {drawing}
  </svg>;
}
