import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { SOLUTION_AFTER_ATTEMPTS, type CheckResult, type PublicExercise } from '../../shared/types.ts';
import { api, type ActivityRef } from '../api.ts';

const CodeEditor = lazy(() => import('./CodeEditor.tsx').then((module) => ({ default: module.CodeEditor })));

const CHECK_DELAY_MS = 500;

interface Props {
  exercise: PublicExercise;
  activity: ActivityRef;
  onPassed: () => void;
}

export function Exercise({ exercise, activity, onPassed }: Props) {
  const [initialCode] = useState(exercise.draft ?? exercise.starter);
  const [code, setCode] = useState(initialCode);
  const [replacement, setReplacement] = useState<{ code: string } | null>(null);
  const [live, setLive] = useState<CheckResult | null>(null);
  const [passed, setPassed] = useState(exercise.state.passed);
  const [attempts, setAttempts] = useState(exercise.state.attempts);
  const [verdict, setVerdict] = useState<'passed' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [solution, setSolution] = useState<string | null>(null);

  const latest = useRef(0);

  const runCheck = useCallback(
    (source: string) => {
      const id = ++latest.current;
      api.check(activity, source).then(
        (result) => {
          if (id === latest.current) setLive(result);
        },
        // Live feedback is a convenience. Submitting reports any real failure.
        () => {},
      );
    },
    // `activity` is rebuilt on each render, but its identity fields are stable for this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activity.moduleId, activity.lessonId, activity.activityId],
  );

  useEffect(() => {
    const timer = setTimeout(() => runCheck(code), CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [code, runCheck]);

  const edited = useRef(false);
  useEffect(() => {
    if (!edited.current) return;
    const timer = setTimeout(() => void api.saveDraft(activity, code).catch(() => {}), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleChange = useCallback((next: string) => {
    edited.current = true;
    setVerdict(null);
    setCode(next);
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // Stop any in-flight live check from overwriting this result.
      latest.current++;
      const response = await api.submitCode(activity, code);
      setLive(response.result);
      setAttempts(response.state.attempts);
      setVerdict(response.result.passed ? 'passed' : 'failed');
      if (response.result.passed && !passed) {
        setPassed(true);
        onPassed();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const showSolution = async () => {
    setError(null);
    try {
      setSolution((await api.solution(activity)).solution);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const canSeeSolution = passed || attempts >= SOLUTION_AFTER_ATTEMPTS;
  const untilSolution = SOLUTION_AFTER_ATTEMPTS - attempts;
  const errorCount = live?.diagnostics.length ?? 0;
  const tests = live?.tests ?? exercise.tests.map((label) => ({ label, passed: false }));

  return (
    <section className={`activity ${passed ? 'activity-passed' : ''}`} aria-label={`Exercise: ${exercise.title}`}>
      <header className="activity-head">
        <span className="activity-kind">Exercise</span>
        {passed && <span className="badge-good">Passed</span>}
      </header>
      <h3 className="activity-title">{exercise.title}</h3>
      <div className="prose" dangerouslySetInnerHTML={{ __html: exercise.promptHtml }} />

      {exercise.support.map((file) => (
        <details key={file.name} className="support-file">
          <summary>
            Provided file: <code>{file.name}</code>
          </summary>
          <pre>
            <code>{file.code}</code>
          </pre>
        </details>
      ))}

      <Suspense fallback={<pre className="editor editor-loading">{code}</pre>}>
        <CodeEditor
          initialValue={initialCode}
          replacement={replacement}
          onChange={handleChange}
          diagnostics={live?.diagnostics ?? []}
          label={`Code for ${exercise.title}`}
        />
      </Suspense>
      <p className="editor-note">Press Esc, then Tab, to move out of the editor.</p>

      <div className="checks">
        <h4>
          Requirements
          {live && (
            <span className={errorCount ? 'check-summary bad' : 'check-summary'}>
              {errorCount ? `${errorCount} compiler ${errorCount === 1 ? 'error' : 'errors'} in your code` : 'Compiles cleanly'}
            </span>
          )}
        </h4>
        <ul>
          {tests.map((test) => (
            <li key={test.label} className={live && test.passed ? 'met' : ''}>
              <span className="check-mark" aria-hidden="true">
                {live && test.passed ? '✓' : '○'}
              </span>
              <span className="visually-hidden">{live && test.passed ? 'Met: ' : 'Not met yet: '}</span>
              <span dangerouslySetInnerHTML={{ __html: inlineCode(test.label) }} />
            </li>
          ))}
        </ul>
        {live?.setupError && <p className="form-error">{live.setupError}</p>}
      </div>

      <div aria-live="polite">
        {verdict === 'passed' && <p className="verdict good">Passed. The compiler agrees with you.</p>}
        {verdict === 'failed' && (
          <p className="verdict bad">Not yet. Fix the compiler errors and the unmet requirements, then submit again.</p>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="activity-actions">
        <button type="button" className="button primary" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Grading…' : 'Submit'}
        </button>
        <button
          type="button"
          className="button"
          disabled={code === exercise.starter}
          onClick={() => setReplacement({ code: exercise.starter })}
        >
          Reset code
        </button>
        {hintsShown < exercise.hints.length && (
          <button type="button" className="button" onClick={() => setHintsShown((n) => n + 1)}>
            Show a hint
          </button>
        )}
        {canSeeSolution ? (
          solution === null && (
            <button type="button" className="button" onClick={() => void showSolution()}>
              Show solution
            </button>
          )
        ) : (
          <span className="muted">
            Solution unlocks after {untilSolution} more {untilSolution === 1 ? 'submission' : 'submissions'}.
          </span>
        )}
      </div>

      {exercise.hints.slice(0, hintsShown).map((hint) => (
        <p key={hint} className="hint" dangerouslySetInnerHTML={{ __html: inlineCode(hint) }} />
      ))}

      {solution !== null && (
        <div className="solution">
          <div className="solution-head">
            <h4>Solution</h4>
            <button type="button" className="link-button" onClick={() => setReplacement({ code: solution })}>
              Copy into editor
            </button>
          </div>
          <pre>
            <code>{solution}</code>
          </pre>
        </div>
      )}
    </section>
  );
}

function inlineCode(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
}
