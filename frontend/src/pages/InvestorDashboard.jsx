import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ShieldCheck,
  TrendingUp,
  Target,
  Globe2,
  Briefcase,
  AlertCircle,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { api, getAccessToken, setAccessToken } from '../lib/api.js';

const TIER_COPY = {
  unverified: {
    label: 'Unverified',
    body: 'Submit identity & organization documents to unlock the marketplace.',
    color: 'var(--rust-600)',
  },
  basic: {
    label: 'Basic · In Review',
    body: 'Documents received. SAREGO compliance is reviewing your application.',
    color: 'var(--gold-700)',
  },
  verified: {
    label: 'Verified',
    body: 'Full marketplace access granted. Express interest, open deal rooms, message owners.',
    color: 'var(--sage-700)',
  },
  institutional: {
    label: 'Institutional',
    body: 'Enhanced due diligence cleared. Priority routing on government-grade pipeline.',
    color: 'var(--gold-700)',
  },
};

export default function InvestorDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [mandate, setMandate] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!getAccessToken()) {
      navigate('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await api('/api/auth/me');
        if (cancelled) return;
        setUser(me.user);

        // Mandate + matches only relevant for investor accounts
        if (me.user.role === 'investor') {
          const [mandateData, matchData] = await Promise.all([
            api('/api/investor/mandate').catch(() => ({ mandate: null, sectors: [], countries: [] })),
            api('/api/investor/matches?limit=10').catch(() => ({ matches: [] })),
          ]);
          if (cancelled) return;
          setMandate(mandateData);
          setMatches(matchData.matches || []);
        }
      } catch (err) {
        if (err.status === 401) {
          setAccessToken(null);
          navigate('/login');
          return;
        }
        setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ivory-50)' }}>
        <Header variant="light" />
        <div className="container" style={{ paddingTop: 80, paddingBottom: 80 }}>
          <div className="muted text-sm">Loading dashboard…</div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ivory-50)' }}>
        <Header variant="light" />
        <div className="container" style={{ paddingTop: 80 }}>
          <h2>Unable to load dashboard</h2>
          <p className="muted">{error || 'Please sign in again.'}</p>
        </div>
      </div>
    );
  }

  const tier = TIER_COPY[user.trust_tier] || TIER_COPY.unverified;

  return (
    <div style={{ background: 'var(--ivory-50)', minHeight: '100vh' }}>
      <Header variant="light" />

      {/* Greeting band */}
      <section style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-5)' }}>
        <div className="container">
          <div className="eyebrow fade-up">
            {user.role === 'investor' ? 'Investor Console' : `${user.role.replace('_', ' ')} Console`}
          </div>
          <h1
            className="display fade-up fade-up-1"
            style={{ marginTop: 12, fontSize: 'clamp(36px, 4vw, 56px)', fontWeight: 400 }}
          >
            Good day,{' '}
            <span style={{ fontStyle: 'italic', color: 'var(--gold-700)' }}>
              {user.full_name.split(' ')[0]}
            </span>
            .
          </h1>
          <p className="muted fade-up fade-up-2" style={{ marginTop: 14, fontSize: 16, maxWidth: 620 }}>
            Your verified position on the regional pipeline. Below is the latest activity matched
            to your mandate.
          </p>
        </div>
      </section>

      <hr className="gold-rule fade-up fade-up-3" style={{ maxWidth: 1320, marginLeft: 'auto', marginRight: 'auto' }} />

      {/* Top grid: Trust tier · Mandate · KPI */}
      <section style={{ paddingBottom: 'var(--space-8)' }}>
        <div className="container">
          <div
            className="fade-up fade-up-3"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'var(--space-4)',
            }}
          >
            <TrustCard tier={tier} role={user.role} />
            <MandateCard mandate={mandate} role={user.role} />
            <ActivityCard matches={matches} />
          </div>
        </div>
      </section>

      {/* Matched pipeline */}
      <section style={{ paddingBottom: 'var(--space-12)' }}>
        <div className="container">
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div className="eyebrow">Matched Pipeline</div>
              <h2 style={{ marginTop: 10, fontSize: 'clamp(26px, 3vw, 38px)' }}>
                Aligned with your{' '}
                <span style={{ fontStyle: 'italic' }}>mandate.</span>
              </h2>
            </div>
            <Link to="/" className="btn btn-ghost">
              Browse All Projects <ArrowUpRight size={16} />
            </Link>
          </div>

          {matches.length === 0 ? (
            <EmptyMatches role={user.role} />
          ) : (
            <div
              style={{
                background: 'var(--bg-elev)',
                border: '1px solid var(--border)',
              }}
            >
              {matches.map((m, idx) => (
                <MatchRow key={m.id} match={m} index={idx} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ============================ Sub-components ============================ */

function TrustCard({ tier, role }) {
  return (
    <article className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
        <ShieldCheck size={20} color={tier.color} strokeWidth={1.4} />
        <div className="eyebrow">Verification Tier</div>
      </div>
      <div
        className="mono pill-tier"
        style={{
          display: 'inline-block',
          padding: '6px 14px',
          background: 'var(--ink-950)',
          color: 'var(--gold-400)',
          marginBottom: 14,
        }}
      >
        {tier.label}
      </div>
      <p style={{ fontSize: 14, color: 'var(--fg-muted)', lineHeight: 1.6, margin: 0 }}>
        {tier.body}
      </p>
      {tier.label === 'Unverified' && (
        <a href="#" className="btn btn-primary" style={{ marginTop: 18, fontSize: 12 }}>
          Begin KYC
          <ArrowUpRight size={14} />
        </a>
      )}
    </article>
  );
}

function MandateCard({ mandate, role }) {
  if (role !== 'investor') {
    return (
      <article className="card">
        <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
          <Briefcase size={20} color="var(--gold-700)" strokeWidth={1.4} />
          <div className="eyebrow">Profile</div>
        </div>
        <h3 style={{ fontSize: 20, marginBottom: 8 }}>
          {role.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </h3>
        <p style={{ fontSize: 14, color: 'var(--fg-muted)', lineHeight: 1.6, margin: 0 }}>
          Use the marketplace to publish projects, list trade opportunities, and engage
          counterparties on the platform.
        </p>
      </article>
    );
  }

  const m = mandate?.mandate;
  const sectors = mandate?.sectors || [];
  const countries = mandate?.countries || [];
  const isEmpty = !m || (!m.ticket_size_min_usd && !sectors.length && !countries.length);

  return (
    <article className="card">
      <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
        <Target size={20} color="var(--gold-700)" strokeWidth={1.4} />
        <div className="eyebrow">Investment Mandate</div>
      </div>

      {isEmpty ? (
        <>
          <p style={{ fontSize: 14, color: 'var(--fg-muted)', margin: '4px 0 16px' }}>
            Define your sectors, geographies, and ticket sizes to unlock matchmaking.
          </p>
          <a href="#" className="btn btn-ghost" style={{ fontSize: 12 }}>
            Configure Mandate <ArrowUpRight size={14} />
          </a>
        </>
      ) : (
        <>
          <div
            className="mono"
            style={{
              fontSize: 22,
              fontWeight: 500,
              marginBottom: 4,
              color: 'var(--ink-950)',
            }}
          >
            {formatTicket(m.ticket_size_min_usd, m.ticket_size_max_usd)}
          </div>
          <div className="text-xs uppercase muted" style={{ letterSpacing: '0.14em' }}>
            Ticket Range
          </div>

          {sectors.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="text-xs uppercase muted" style={{ letterSpacing: '0.14em', marginBottom: 8 }}>
                Sectors
              </div>
              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                {sectors.slice(0, 4).map((s) => (
                  <span key={s.slug} className="pill">{s.name}</span>
                ))}
                {sectors.length > 4 && <span className="pill">+{sectors.length - 4}</span>}
              </div>
            </div>
          )}

          {countries.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="text-xs uppercase muted" style={{ letterSpacing: '0.14em', marginBottom: 8 }}>
                Geographies
              </div>
              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                {countries.slice(0, 6).map((c) => (
                  <span key={c.iso_code} className="pill">
                    {c.flag_emoji} {c.iso_code}
                  </span>
                ))}
                {countries.length > 6 && <span className="pill">+{countries.length - 6}</span>}
              </div>
            </div>
          )}
        </>
      )}
    </article>
  );
}

function ActivityCard({ matches }) {
  const totalCapital = matches.reduce(
    (sum, m) => sum + Number(m.capital_required_usd || 0),
    0
  );
  return (
    <article className="card card-dark" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
        <TrendingUp size={20} color="var(--gold-400)" strokeWidth={1.4} />
        <div className="eyebrow" style={{ color: 'var(--gold-400)' }}>
          This Week
        </div>
      </div>
      <div
        className="display"
        style={{ fontSize: 56, color: 'var(--gold-400)', lineHeight: 1, fontWeight: 500, letterSpacing: '-0.02em' }}
      >
        {matches.length}
      </div>
      <div className="text-xs uppercase" style={{ marginTop: 8, color: 'var(--ink-300)', letterSpacing: '0.14em' }}>
        Matched Opportunities
      </div>

      <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--ink-800)' }}>
        <div className="mono" style={{ fontSize: 18, color: 'var(--ivory-50)' }}>
          {formatUSD(totalCapital)}
        </div>
        <div className="text-xs uppercase" style={{ marginTop: 4, color: 'var(--ink-500)', letterSpacing: '0.14em' }}>
          Aggregate Pipeline
        </div>
      </div>
    </article>
  );
}

function MatchRow({ match, index }) {
  return (
    <Link
      to={`/projects/${match.slug}`}
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr auto auto auto',
        alignItems: 'center',
        gap: 'var(--space-5)',
        padding: '20px 24px',
        borderTop: index === 0 ? 'none' : '1px solid var(--border)',
        transition: 'background 200ms',
        color: 'inherit',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ivory-100)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      data-match-row
    >
      <div className="mono" style={{ fontSize: 12, color: 'var(--gold-700)', letterSpacing: '0.14em' }}>
        {String(index + 1).padStart(2, '0')}
      </div>

      <div>
        <div className="text-xs muted" style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>{match.flag_emoji}</span> {match.country_name}
        </div>
        <div style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 500, lineHeight: 1.2 }}>
          {match.title}
        </div>
      </div>

      <div style={{ textAlign: 'right' }} data-hide-narrow>
        <div className="text-xs uppercase muted" style={{ letterSpacing: '0.12em' }}>Capital</div>
        <div className="mono" style={{ fontSize: 16, marginTop: 2 }}>{formatUSD(match.capital_required_usd)}</div>
      </div>

      <div style={{ textAlign: 'right' }} data-hide-narrow>
        <div className="text-xs uppercase muted" style={{ letterSpacing: '0.12em' }}>IRR</div>
        <div className="mono" style={{ fontSize: 16, marginTop: 2, color: 'var(--gold-700)' }}>
          {match.expected_irr_pct ? `${Number(match.expected_irr_pct).toFixed(1)}%` : '—'}
        </div>
      </div>

      <div className="flex items-center gap-2" style={{ color: 'var(--ink-950)' }}>
        <span
          className="mono"
          style={{
            background: 'var(--ink-950)',
            color: 'var(--gold-400)',
            padding: '4px 10px',
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          {match.match_score}
        </span>
        <ArrowUpRight size={16} />
      </div>

      <style>{`
        @media (max-width: 720px) {
          [data-match-row] {
            grid-template-columns: 40px 1fr auto !important;
          }
          [data-hide-narrow] { display: none !important; }
        }
      `}</style>
    </Link>
  );
}

function EmptyMatches({ role }) {
  return (
    <div
      style={{
        background: 'var(--bg-elev)',
        border: '1px dashed var(--ivory-200)',
        padding: 'var(--space-8)',
        textAlign: 'center',
      }}
    >
      <AlertCircle size={28} color="var(--gold-700)" style={{ margin: '0 auto' }} strokeWidth={1.4} />
      <h3 style={{ marginTop: 16, fontSize: 22 }}>No matches yet.</h3>
      <p className="muted" style={{ marginTop: 10, fontSize: 14, maxWidth: 480, marginInline: 'auto' }}>
        {role === 'investor'
          ? 'Configure your mandate (sectors, geographies, ticket sizes) to start receiving matched pipeline.'
          : 'Once published projects align with active investor mandates, you will see them here.'}
      </p>
    </div>
  );
}

/* ============================ Helpers ============================ */
function formatUSD(value) {
  const v = Number(value);
  if (!v) return '$—';
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function formatTicket(min, max) {
  if (!min && !max) return '$ —';
  if (min && max) return `${formatUSD(min)} – ${formatUSD(max)}`;
  return formatUSD(min || max);
}
