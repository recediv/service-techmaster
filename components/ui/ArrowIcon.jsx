import './arrow-icon.css';

export default function ArrowIcon({ size = 20, className = '' }) {
  return <svg className={`site-arrow-icon ${className}`.trim()} aria-hidden="true" focusable="false" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14m-6-6 6 6-6 6" />
  </svg>;
}
