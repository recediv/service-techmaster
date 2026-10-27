const drawings = {
  info: <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7h.01" />
  </>,
  article: <>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
    <path d="M14 3v6h6M8 13h8M8 17h6" />
  </>,
  phone: <path d="m7.1 3.5-2.5 1.3c-1 .5-1.4 1.6-1.1 2.7 2.1 6.5 6.7 11.1 13.2 13.2 1.1.3 2.2-.1 2.7-1.1l1.3-2.5c.3-.6.1-1.3-.5-1.6l-3-1.7c-.5-.3-1.1-.2-1.5.2l-1.4 1.4a12 12 0 0 1-5.7-5.7L10 8.3c.4-.4.5-1 .2-1.5l-1.7-3c-.3-.6-1-.8-1.4-.3Z" />,
  pin: <>
    <path d="M20 10c0 5.8-8 11-8 11S4 15.8 4 10a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2.7" />
  </>,
  mail: <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </>,
  clock: <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </>,
  cart: <>
    <path d="M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6H18a2 2 0 0 0 2-1.6L21 7H5.8" />
    <circle cx="9.5" cy="20.5" r="1" />
    <circle cx="18.5" cy="20.5" r="1" />
  </>,
  repair: <>
    <rect x="7.5" y="2.5" width="9" height="4" rx="1.3" />
    <path d="M7.5 4.5H5.3A1.8 1.8 0 0 0 3.5 6.3v13.4a1.8 1.8 0 0 0 1.8 1.8h13.4a1.8 1.8 0 0 0 1.8-1.8V6.3a1.8 1.8 0 0 0-1.8-1.8h-2.2" />
    <path d="m8 12 2.5 2.5 5-5M8 18h8" />
  </>,
};

export default function SiteIcon({ name, size = 24, className, ...props }) {
  const drawing = drawings[name];
  if (!drawing) return null;
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{drawing}</svg>;
}
