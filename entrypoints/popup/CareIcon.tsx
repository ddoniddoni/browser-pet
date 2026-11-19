export function CareIcon({ kind }: { kind: 'food' | 'pet' }) {
  return <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === 'food' ? <>
      <path d="M4.5 9.1Q4.5 7 7 7h6q2.5 0 2.5 2.1l1.8 5.2q.3 1-1 1.2H3.7q-1.3 0-1-1.2z"/>
      <path d="M4.6 9q5.4 2.2 10.8 0M7.2 6.9a2 2 0 1 1 3.7-1.1M11.4 6.8a1.8 1.8 0 0 1 3.5-.2"/>
    </> : <>
      <path d="M6.4 11.4V7.2a1.2 1.2 0 0 1 2.4 0v3.2-5a1.2 1.2 0 0 1 2.4 0v4.7-3.7a1.2 1.2 0 0 1 2.4 0v4.1-2.3a1.2 1.2 0 0 1 2.4 0V12c0 3.9-2.2 5.8-5.4 5.8-2 0-3.5-.8-4.8-2.6l-2.6-3.4c-.9-1.3.5-2.7 1.6-1.8l1.6 1.4Z"/>
    </>}
  </svg>;
}
