import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { getApiErrorMessage } from '../utils/errors';

type LocationState = {
  from?: { pathname?: string; search?: string };
};

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      const state = location.state as LocationState | null;
      const destination = state?.from?.pathname
        ? `${state.from.pathname}${state.from.search ?? ''}`
        : '/quotes';
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to sign in. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <p className="eyebrow">Comtanix assessment</p>
        <h1 id="login-title">Staff sign in</h1>
        <p className="muted">Use your admin or staff account to review quote requests.</p>
        <p><Link to="/request-quote">Request a Quote</Link></p>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <button className="button button-primary button-block" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <aside className="demo-credentials" aria-label="Demo credentials">
          <strong>Demo accounts</strong>
          <span>admin@comtanix.test</span>
          <span>staff1@comtanix.test</span>
          <span>staff2@comtanix.test</span>
          <span>Password: Password123!</span>
        </aside>
      </section>
    </main>
  );
}
