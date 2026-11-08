/** A ring that fills as a lesson's activities are passed. */
export function LessonStatus({ passed, total }: { passed: number; total: number }) {
  const done = total > 0 && passed >= total;
  const label = done ? 'Complete' : passed > 0 ? `${passed} of ${total} activities passed` : 'Not started';
  const circumference = 2 * Math.PI * 7;
  return (
    <svg className={`status ${done ? 'status-done' : ''}`} viewBox="0 0 18 18" width="18" height="18" role="img" aria-label={label}>
      {done ? (
        <>
          <circle cx="9" cy="9" r="9" fill="var(--good)" />
          <path d="M5 9.5l2.7 2.7L13 6.6" fill="none" stroke="var(--on-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="9" cy="9" r="7" fill="none" stroke="var(--line-strong)" strokeWidth="2" />
          {passed > 0 && (
            <circle
              cx="9"
              cy="9"
              r="7"
              fill="none"
              stroke="var(--good)"
              strokeWidth="2"
              strokeDasharray={`${(passed / total) * circumference} ${circumference}`}
              transform="rotate(-90 9 9)"
            />
          )}
        </>
      )}
    </svg>
  );
}
