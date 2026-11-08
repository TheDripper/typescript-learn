import { useState, type FormEvent } from 'react';
import type { User } from '../../shared/types.ts';
import { api, ApiError } from '../api.ts';

export function AuthPage({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const registering = mode === 'register';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onAuthenticated(registering ? await api.register(name, email, password) : await api.login(email, password));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <section className="auth-pitch">
        <p className="eyebrow">Strict Mode</p>
        <h1>Learn TypeScript by satisfying the compiler.</h1>
        <p>
          A course built on The TypeScript Handbook. Read a short lesson, then write real types in the browser and let
          the TypeScript compiler grade them.
        </p>
      </section>
      <form className="auth-form" onSubmit={(e) => void submit(e)}>
        <h2>{registering ? 'Create your account' : 'Sign in'}</h2>
        {registering && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={registering ? 'new-password' : 'current-password'}
            minLength={registering ? 8 : undefined}
            required
          />
          {registering && <span className="field-note">At least 8 characters.</span>}
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? 'One moment…' : registering ? 'Create account' : 'Sign in'}
        </button>
        <p className="auth-switch">
          {registering ? 'Already have an account?' : 'New here?'}{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMode(registering ? 'login' : 'register');
              setError(null);
            }}
          >
            {registering ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </form>
    </main>
  );
}
