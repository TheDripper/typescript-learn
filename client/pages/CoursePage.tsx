import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { CourseOverview } from '../../shared/types.ts';
import { api } from '../api.ts';
import { LessonStatus } from '../components/LessonStatus.tsx';

export function CoursePage() {
  const [course, setCourse] = useState<CourseOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Course · Strict Mode';
    api.course().then(setCourse, (e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="page-status">{error}</p>;
  if (!course) return <p className="page-status">Loading your course…</p>;

  const percent = course.totalActivities ? Math.round((100 * course.passedActivities) / course.totalActivities) : 0;
  const started = course.passedActivities > 0;
  const totalMinutes = course.modules.flatMap((m) => m.lessons).reduce((sum, l) => sum + l.minutes, 0);

  return (
    <main className="course">
      <header className="course-head">
        <div>
          <p className="eyebrow">The TypeScript Handbook, as a course</p>
          <h1>From first annotation to mapped types</h1>
          <p className="lede">
            {course.modules.length} modules, about {Math.round(totalMinutes / 60)} hours. Every code example is verified
            against the compiler, and so is every answer you write.
          </p>
        </div>
        <aside className="progress-panel" aria-label="Your progress">
          <div className="progress-figure">
            <strong>{percent}%</strong>
            <span>
              {course.passedActivities} of {course.totalActivities} activities
            </span>
          </div>
          <div className="meter" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
            <span style={{ width: `${percent}%` }} />
          </div>
          {import.meta.env.VITE_STATIC && <p className="field-note">Your progress is saved in this browser.</p>}
          {course.next ? (
            <Link className="button primary" to={`/learn/${course.next.moduleId}/${course.next.lessonId}`}>
              {started ? 'Continue' : 'Start'}: {course.next.title}
            </Link>
          ) : (
            <p className="course-finished">You’ve completed the whole course.</p>
          )}
        </aside>
      </header>

      <ol className="modules">
        {course.modules.map((module, index) => {
          const total = module.lessons.reduce((sum, l) => sum + l.activities, 0);
          const passed = module.lessons.reduce((sum, l) => sum + l.passed, 0);
          return (
            <li key={module.id} className="module">
              <div className="module-number" aria-hidden="true">
                {index + 1}
              </div>
              <div className="module-body">
                <div className="module-title">
                  <h2>{module.title}</h2>
                  <span className="module-count">
                    {passed}/{total}
                  </span>
                </div>
                <p>{module.summary}</p>
                <ul className="lessons">
                  {module.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <Link to={`/learn/${module.id}/${lesson.id}`}>
                        <LessonStatus passed={lesson.passed} total={lesson.activities} />
                        <span className="lesson-name">{lesson.title}</span>
                        <span className="lesson-minutes">{lesson.minutes} min</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
