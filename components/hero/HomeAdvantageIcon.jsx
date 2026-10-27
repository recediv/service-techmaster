const drawings = [
  <><rect x="4" y="5" width="24" height="19" rx="2" /><path d="M12 28h8m-4-4v4M8 15h4l2-5 4 10 2-5h4" /></>,
  <><rect x="11" y="4" width="10" height="5" rx="1.5" /><path d="M11 6H8a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3m-10 12 4 4 7-8" /></>,
  <><circle cx="16" cy="16" r="12" /><path d="M16 9v7l5 3" /></>,
  <><path d="M16 4v24m-5 0h10M6 10h20M9 10l-4 9h8l-4-9Zm14 0-4 9h8l-4-9Z" /></>,
  <><path d="m4 12 12-8 12 8v16H4V12Zm0 0h24M11 28V17h10v11m-10-7h10m-10 4h10" /></>,
  <><path d="m16 4 11 4v7c0 6-4 10-11 13C9 25 5 21 5 15V8l11-4Z" /><path d="m11 16 4 4 7-8" /></>,
];

export default function HomeAdvantageIcon({ index }) {
  return <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{drawings[index] || drawings[0]}</svg>;
}
