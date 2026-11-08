import { useState } from 'react';
import type { PublicQuiz, QuizResult } from '../../shared/types.ts';
import { api, type ActivityRef } from '../api.ts';

interface Props {
  quiz: PublicQuiz;
  activity: ActivityRef;
  onPassed: () => void;
}

export function Quiz({ quiz, activity, onPassed }: Props) {
  const [answers, setAnswers] = useState<number[][]>(
    () => quiz.review?.answers ?? quiz.questions.map(() => []),
  );
  const [result, setResult] = useState<QuizResult | null>(quiz.review?.result ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = result !== null;
  const passed = result?.passed ?? false;
  const complete = answers.every((a) => a.length > 0);

  const toggle = (question: number, choice: number, multi: boolean) => {
    setAnswers((current) =>
      current.map((selected, i) => {
        if (i !== question) return selected;
        if (!multi) return [choice];
        return selected.includes(choice) ? selected.filter((c) => c !== choice) : [...selected, choice];
      }),
    );
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.submitQuiz(activity, answers);
      setResult(response.result);
      if (response.result.passed) onPassed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    setResult(null);
    setAnswers(quiz.questions.map(() => []));
  };

  return (
    <section className={`activity ${passed ? 'activity-passed' : ''}`} aria-label="Knowledge check">
      <header className="activity-head">
        <span className="activity-kind">Knowledge check</span>
        {passed && <span className="badge-good">Passed</span>}
      </header>
      {quiz.questions.map((question, q) => {
        const outcome = result?.questions[q];
        const selected = answers[q] ?? [];
        return (
          <fieldset key={q} className="question" disabled={locked}>
            <legend className="prose" dangerouslySetInnerHTML={{ __html: question.promptHtml }} />
            {question.multi && <p className="field-note">Choose all that apply.</p>}
            {question.choices.map((choice, c) => {
              const isSelected = selected.includes(c);
              const mark = outcome && isSelected ? (outcome.correctChoices.includes(c) ? 'right' : 'wrong') : '';
              return (
                <label key={c} className={`choice ${isSelected ? 'selected' : ''} ${mark}`}>
                  <input
                    type={question.multi ? 'checkbox' : 'radio'}
                    name={`${quiz.id}-${q}`}
                    checked={isSelected}
                    onChange={() => toggle(q, c, question.multi)}
                  />
                  <span dangerouslySetInnerHTML={{ __html: choice.html }} />
                </label>
              );
            })}
            {outcome && (
              <div className={`explanation ${outcome.correct ? 'right' : 'wrong'}`}>
                <strong>{outcome.correct ? 'Correct.' : 'Not quite.'}</strong>
                <div className="prose" dangerouslySetInnerHTML={{ __html: outcome.whyHtml }} />
              </div>
            )}
          </fieldset>
        );
      })}
      <div aria-live="polite">{error && <p className="form-error">{error}</p>}</div>
      {!passed && (
        <div className="activity-actions">
          {result ? (
            <>
              <button type="button" className="button primary" onClick={retry}>
                Try again
              </button>
              <span className="muted" role="status">
                {result.questions.filter((q) => q.correct).length} of {result.questions.length} correct. Get all of them right
                to pass.
              </span>
            </>
          ) : (
            <button type="button" className="button primary" disabled={!complete || busy} onClick={() => void submit()}>
              {busy ? 'Checking…' : 'Check answers'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
