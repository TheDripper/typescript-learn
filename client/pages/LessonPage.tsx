import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useParams } from 'react-router';
import type { LessonDetail, LessonRef } from '../../shared/types.ts';
import { api } from '../api.ts';
import { Exercise } from '../components/Exercise.tsx';
import { LessonStatus } from '../components/LessonStatus.tsx';
import { Quiz } from '../components/Quiz.tsx';

const lessonPath = (ref: LessonRef) => `/learn/${ref.moduleId}/${ref.lessonId}`;

export function LessonPage() {
  const { moduleId = '', lessonId = '' } = useParams();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setLesson(null);
    setError(null);
    api.lesson(moduleId, lessonId).then(
      (detail) => {
        if (!current) return;
        setLesson(detail);
        document.title = `${detail.title} · Strict Mode`;
        window.scrollTo(0, 0);
      },
      (e: Error) => {
        if (current) setError(e.message);
      },
    );
    return () => {
      current = false;
    };
  }, [moduleId, lessonId]);

  // Refreshes the sidebar rings after a pass. Mounted activities keep their own state.
  const refresh = useCallback(() => {
    api.lesson(moduleId, lessonId).then((detail) => {
      setLesson((existing) => (existing?.lessonId === detail.lessonId ? { ...existing, siblings: detail.siblings } : existing));
    }, () => {});
  }, [moduleId, lessonId]);

  if (error) return <p className="page-status">{error}</p>;
  if (!lesson) return <p className="page-status">Loading lesson…</p>;

  const ref = { moduleId: lesson.moduleId, lessonId: lesson.lessonId };

  return (
    <div className="lesson-layout">
      <aside className="lesson-nav">
        <Link to="/" className="back-link">
          ← All modules
        </Link>
        <p className="eyebrow">{lesson.moduleTitle}</p>
        <ul>
          {lesson.siblings.map((sibling) => (
            <li key={sibling.id}>
              <NavLink to={`/learn/${lesson.moduleId}/${sibling.id}`}>
                <LessonStatus passed={sibling.passed} total={sibling.activities} />
                <span>{sibling.title}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </aside>
      <main className="lesson">
        <header className="lesson-head">
          <p className="eyebrow">{lesson.moduleTitle}</p>
          <h1>{lesson.title}</h1>
          <p className="lesson-meta">
            {lesson.minutes} min ·{' '}
            <a href={lesson.source} target="_blank" rel="noreferrer">
              Handbook chapter
            </a>
          </p>
        </header>
        {lesson.blocks.map((block, index) => {
          if (block.kind === 'html') {
            return <div key={index} className="prose" dangerouslySetInnerHTML={{ __html: block.html }} />;
          }
          const activity = { ...ref, activityId: block.id };
          return block.kind === 'quiz' ? (
            <Quiz key={block.id} quiz={block} activity={activity} onPassed={refresh} />
          ) : (
            <Exercise key={block.id} exercise={block} activity={activity} onPassed={refresh} />
          );
        })}
        <nav className="lesson-pager" aria-label="Lesson navigation">
          {lesson.prev ? (
            <Link to={lessonPath(lesson.prev)} className="pager-link">
              <span>Previous</span>
              {lesson.prev.title}
            </Link>
          ) : (
            <span />
          )}
          {lesson.next && (
            <Link to={lessonPath(lesson.next)} className="pager-link pager-next">
              <span>Next</span>
              {lesson.next.title}
            </Link>
          )}
        </nav>
      </main>
    </div>
  );
}
