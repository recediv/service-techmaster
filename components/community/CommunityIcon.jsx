export default function CommunityIcon({ review = false }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {review ? <><path d="M5 13h5V6H4v6c0 4 1.7 6 5 6m7-5h5V6h-6v6c0 4 1.7 6 5 6" /></> : <>
      <path d="M7 19l-4 2V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7Z" />
      <path d="M9.7 8.5a2.4 2.4 0 0 1 4.6 1c0 1.7-2.3 2-2.3 3.5M12 16h.01" />
    </>}
  </svg>;
}
