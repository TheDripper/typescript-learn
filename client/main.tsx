import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router';
import type { User } from '../shared/types.ts';
import { api } from './api.ts';
import { AuthPage } from './pages/AuthPage.tsx';
import { CoursePage } from './pages/CoursePage.tsx';
import { GradebookPage } from './pages/GradebookPage.tsx';
import { LessonPage } from './pages/LessonPage.tsx';
import './styles.css';

function Footer() {
  return (
    <footer className="site-footer">
      Lessons adapted from{' '}
      <a href="https://www.typescriptlang.org/docs/handbook/intro.html" target="_blank" rel="noreferrer">
        The TypeScript Handbook
      </a>{' '}
      by Microsoft and contributors, under{' '}
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
        CC BY 4.0
      </a>
      . Rewritten and extended with quizzes and exercises. Independent project, not affiliated with or endorsed by
      Microsoft.
    </footer>
  );
}

function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    api.me().then(setUser, () => setUser(null));
  }, []);

  if (user === undefined) return <p className="page-status">Loading…</p>;
  if (user === null) {
    return (
      <>
        <AuthPage onAuthenticated={setUser} />
        <Footer />
      </>
    );
  }

  const signOut = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="var(--accent)" />
            <path d="M9 17l5 5 9-12" fill="none" stroke="var(--on-accent)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Strict Mode
        </Link>
        <nav aria-label="Main">
          <NavLink to="/" end>
            Course
          </NavLink>
          {user.role === 'instructor' && <NavLink to="/instructor">Gradebook</NavLink>}
        </nav>
        {!import.meta.env.VITE_STATIC && (
          <div className="topbar-user">
            <span>{user.name}</span>
            <button type="button" className="link-button" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        )}
      </header>
      <Routes>
        <Route path="/" element={<CoursePage />} />
        <Route path="/learn/:moduleId/:lessonId" element={<LessonPage />} />
        <Route path="/instructor" element={user.role === 'instructor' ? <GradebookPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
