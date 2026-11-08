import { useEffect, useState } from 'react';
import type { GradebookResponse } from '../../shared/types.ts';
import { api } from '../api.ts';

function formatDate(value: string | null): string {
  if (!value) return 'No activity yet';
  // SQLite's datetime('now') is UTC, without a zone marker.
  return new Date(`${value.replace(' ', 'T')}Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function GradebookPage() {
  const [data, setData] = useState<GradebookResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Gradebook · Strict Mode';
    api.gradebook().then(setData, (e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="page-status">{error}</p>;
  if (!data) return <p className="page-status">Loading gradebook…</p>;

  return (
    <main className="gradebook">
      <header>
        <p className="eyebrow">Instructor</p>
        <h1>Gradebook</h1>
        <p className="lede">
          Completion by module for every account. <em>First try</em> is the average score on each activity’s first
          submission, so retries can’t inflate it.
        </p>
      </header>

      <div className="table-scroll" tabIndex={0} role="region" aria-label="Learner progress by module">
        <table>
          <thead>
            <tr>
              <th scope="col">Learner</th>
              <th scope="col" className="num">Overall</th>
              <th scope="col" className="num">First try</th>
              {data.modules.map((module) => (
                <th scope="col" key={module.id} className="num module-col">
                  {module.title}
                </th>
              ))}
              <th scope="col">Last active</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  {row.name}
                  {row.role === 'instructor' && <span className="role-tag">Instructor</span>}
                  <span className="row-email">{row.email}</span>
                </th>
                <td className="num strong">{row.overall}%</td>
                <td className="num">{row.firstTryAverage === null ? '–' : `${row.firstTryAverage}%`}</td>
                {row.modules.map((percent, i) => (
                  <td key={data.modules[i]?.id ?? i} className="num heat" style={{ '--heat': `${percent}%` } as React.CSSProperties}>
                    {percent}%
                  </td>
                ))}
                <td className="nowrap">{formatDate(row.lastActive)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="hardest">
        <h2>Where learners struggle</h2>
        {data.hardest.length === 0 ? (
          <p className="muted">Lowest-scoring activities will appear here once learners have submitted work.</p>
        ) : (
          <ol>
            {data.hardest.map((item) => (
              <li key={item.activityId}>
                <div>
                  <strong>{item.label}</strong>
                  <span className="muted">
                    {item.passed} of {item.learners} passed · {item.averageAttempts.toFixed(1)} attempts on average
                  </span>
                </div>
                <span className="hardest-score">{item.firstTryAverage}%</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
