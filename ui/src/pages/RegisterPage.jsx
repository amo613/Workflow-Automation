import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { fetchWithCSRF } from '../utils/csrf.utils.js';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check for error in URL params (from redirect)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const redirectTo = searchParams.get('redirectTo') || '/test-openai';
      const response = await fetchWithCSRF(
        `/api/auth/sign-up?redirectTo=${encodeURIComponent(redirectTo)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ name, email, password }),
        }
      );

      if (response.ok || response.redirected) {
        // Check if redirect is needed
        if (redirectTo) {
          window.location.href = redirectTo;
        } else if (response.redirected) {
          // Follow redirect from server
          window.location.href = response.url;
        } else {
          // Default redirect
          window.location.href = '/test-openai';
        }
      } else {
        let errorMessage = 'Registration failed. Please try again.';
        try {
          const result = await response.json();
          errorMessage = result.error || result.details || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        setError(errorMessage);
        setLoading(false);
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        background: '#0b0f14',
        color: '#e6edf3',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        margin: 0,
      }}
    >
      <div
        style={{
          background: '#11161d',
          border: '1px solid #1f2a35',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '380px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
        }}
      >
        <h1 style={{ fontSize: '18px', margin: '0 0 16px' }}>Sign up</h1>
        <form onSubmit={handleSubmit}>
          <label
            htmlFor="name"
            style={{
              display: 'block',
              fontSize: '13px',
              margin: '10px 0 6px',
              color: '#cbd5e1',
            }}
          >
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={255}
            placeholder="Your name"
            autoComplete="name"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #2b3a48',
              background: '#0e1318',
              color: '#e6edf3',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <label
            htmlFor="email"
            style={{
              display: 'block',
              fontSize: '13px',
              margin: '10px 0 6px',
              color: '#cbd5e1',
            }}
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #2b3a48',
              background: '#0e1318',
              color: '#e6edf3',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <label
            htmlFor="password"
            style={{
              display: 'block',
              fontSize: '13px',
              margin: '10px 0 6px',
              color: '#cbd5e1',
            }}
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            maxLength={128}
            placeholder="••••••••"
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #2b3a48',
              background: '#0e1318',
              color: '#e6edf3',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '16px',
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: 'none',
              background: loading ? '#475569' : '#3b82f6',
              color: '#fff',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
          {error && (
            <div
              style={{
                marginTop: '10px',
                fontSize: '12px',
                color: '#f87171',
                textAlign: 'center',
              }}
            >
              {error}
            </div>
          )}
          <div
            style={{
              marginTop: '10px',
              fontSize: '12px',
              color: '#94a3b8',
              textAlign: 'center',
            }}
          >
            After registration you'll be redirected to the OpenAI test page.
          </div>
          <div
            style={{
              marginTop: '16px',
              fontSize: '12px',
              color: '#94a3b8',
              textAlign: 'center',
            }}
          >
            Already have an account?{' '}
            <Link
              to="/login"
              style={{ color: '#3b82f6', textDecoration: 'none' }}
            >
              Go to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
