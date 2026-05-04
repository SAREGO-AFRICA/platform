import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { SaregoMark } from '../components/Brand.jsx';
import { api, setAccessToken } from '../lib/api.js';

const ROLE_OPTIONS = [
  { value: 'investor', label: 'Investor' },
  { value: 'project_developer', label: 'Project Developer' },
  { value: 'government', label: 'Government / Agency' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'sme', label: 'SME' },
];

export default function LoginPage() {
  const [params] = useSearchParams();
  const initialMode = params.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState(initialMode);

  useEffect(() => setMode(initialMode), [initialMode]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
      }}
      data-auth-grid
    >
      {/* Left — brand panel */}
      <div
        style={{
          background: 'var(--ink-950)',
          color: 'var(--ivory-50)',
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 600 600"
          style={{
            position: 'absolute',
            right: -100,
            bottom: -100,
            width: 700,
            opacity: 0.3,
            pointerEvents: 'none',
          }}
        >
          <circle cx="300" cy="300" r="280" fill="none" stroke="#dcc068" strokeWidth="0.4" strokeDasharray="2 8" />
          <circle cx="300" cy="300" r="220" fill="none" stroke="#dcc068" strokeWidth="0.4" />
          <circle cx="300" cy="300" r="160" fill="none" stroke="#dcc068" strokeWidth="0.4" strokeDasharray="2 8" />
          <line x1="0" y1="300" x2="600" y2="300" stroke="#dcc068" strokeWidth="0.3" />
          <line x1="300" y1="0" x2="300" y2="600" stroke="#dcc068" strokeWidth="0.3" />
        </svg>

        <Link to="/" style={{ position: 'relative' }}>
          <SaregoMark size={26} light />
        </Link>

        <div style={{ position: 'relative', maxWidth: 480 }}>
          <div className="eyebrow" style={{ color: 'var(--gold-400)' }}>
            Verified by SAREGO
          </div>
          <h2
            style={{
              marginTop: 16,
              color: 'var(--ivory-50)',
              fontSize: 'clamp(28px, 3vw, 44px)',
              lineHeight: 1.1,
            }}
          >
            Access is verified.{' '}
            <span style={{ fontStyle: 'italic', color: 'var(--gold-400)' }}>
              Counterparties are vetted.
            </span>
          </h2>
          <p style={{ marginTop: 24, color: 'var(--ink-300)', lineHeight: 1.6 }}>
            Every SAREGO account passes a tiered verification process before participating
            in the marketplace. Your data and your deals stay where they belong.
          </p>

          <div className="flex items-center gap-3" style={{ marginTop: 32 }}>
            <ShieldCheck size={20} color="var(--gold-400)" />
            <span style={{ fontSize: 13, letterSpacing: '0.08em', color: 'var(--ink-300)' }}>
              ISO 27001-aligned · KYC-tier verification · Audit logged
            </span>
          </div>
        </div>

        <div className="text-xs" style={{ position: 'relative', color: 'var(--ink-500)', letterSpacing: '0.1em' }}>
          © {new Date().getFullYear()} SAREGO
        </div>
      </div>

      {/* Right — form panel */}
      <div
        style={{
          background: 'var(--ivory-50)',
          padding: 'var(--space-8) var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div className="flex gap-5" style={{ marginBottom: 'var(--space-6)' }}>
            <button
              onClick={() => setMode('login')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '8px 0',
                fontSize: 13,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: mode === 'login' ? 'var(--ink-950)' : 'var(--fg-muted)',
                borderBottom: mode === 'login' ? '2px solid var(--gold-600)' : '2px solid transparent',
                fontWeight: 500,
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '8px 0',
                fontSize: 13,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: mode === 'register' ? 'var(--ink-950)' : 'var(--fg-muted)',
                borderBottom: mode === 'register' ? '2px solid var(--gold-600)' : '2px solid transparent',
                fontWeight: 500,
              }}
            >
              Request Access
            </button>
          </div>

          {mode === 'login' ? <LoginForm /> : <RegisterForm onDone={() => setMode('login')} />}
        </div>
      </div>

      <style>{`
        @media (max-width: 880px) {
          [data-auth-grid] { grid-template-columns: 1fr !important; }
          [data-auth-grid] > div:first-child {
            min-height: 320px;
          }
        }
      `}</style>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(data.access_token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h2 style={{ fontSize: 36 }}>Welcome back.</h2>
      <p className="muted" style={{ marginTop: 8, fontSize: 15 }}>
        Sign in to access your dashboard.
      </p>

      <div style={{ marginTop: 32 }}>
        <label className="label">Email</label>
        <input
          className="input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@institution.org"
          autoComplete="email"
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <label className="label">Password</label>
        <input
          className="input"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      {error && (
        <div style={{ marginTop: 20, padding: 12, background: '#fff5ee', border: '1px solid #f0c5a8', fontSize: 13, color: 'var(--rust-600)' }}>
          {error}
        </div>
      )}

      <button type="submit" className="btn btn-primary" style={{ marginTop: 28, width: '100%', justifyContent: 'center' }} disabled={busy}>
        {busy ? 'Signing in…' : 'Sign In'}
        {!busy && <ArrowUpRight size={16} />}
      </button>

      <div className="text-sm muted" style={{ marginTop: 18, textAlign: 'center' }}>
        Forgot your password? Contact your SAREGO relationship manager.
      </div>
    </form>
  );
}

function RegisterForm({ onDone }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'investor',
    organization_name: '',
    country_iso: 'ZA',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  function update(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSuccess(true);
      setTimeout(() => onDone(), 1800);
    } catch (err) {
      if (err.issues) {
        setError(err.issues.map((i) => `${i.path?.join('.')}: ${i.message}`).join(' · '));
      } else {
        setError(err.message || 'Registration failed');
      }
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <ShieldCheck size={40} color="var(--gold-700)" style={{ margin: '0 auto' }} />
        <h2 style={{ marginTop: 24, fontSize: 32 }}>Request received.</h2>
        <p className="muted" style={{ marginTop: 12 }}>
          Our team will review your application and confirm your account by email.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <h2 style={{ fontSize: 32 }}>Request access.</h2>
      <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
        All accounts are verified before activation.
      </p>

      <div style={{ marginTop: 28, display: 'grid', gap: 18 }}>
        <div>
          <label className="label">Full name</label>
          <input className="input" required value={form.full_name} onChange={(e) => update('full_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Work email</label>
          <input className="input" type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Password (10+ characters)</label>
          <input className="input" type="password" required minLength={10} value={form.password} onChange={(e) => update('password', e.target.value)} />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="select" value={form.role} onChange={(e) => update('role', e.target.value)}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Organization</label>
          <input className="input" value={form.organization_name} onChange={(e) => update('organization_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Primary country (ISO-2)</label>
          <input className="input" maxLength={2} value={form.country_iso} onChange={(e) => update('country_iso', e.target.value.toUpperCase())} />
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 20, padding: 12, background: '#fff5ee', border: '1px solid #f0c5a8', fontSize: 13, color: 'var(--rust-600)' }}>
          {error}
        </div>
      )}

      <button type="submit" className="btn btn-primary" style={{ marginTop: 28, width: '100%', justifyContent: 'center' }} disabled={busy}>
        {busy ? 'Submitting…' : 'Submit Request'}
        {!busy && <ArrowUpRight size={16} />}
      </button>
    </form>
  );
}
