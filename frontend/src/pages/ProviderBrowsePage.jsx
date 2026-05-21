import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Banknote, Filter, MapPin, Building2,
  CheckCircle2, Circle, AlertCircle, Loader2, ExternalLink,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { api, getAccessToken } from '../lib/api.js';

/**
 * ProviderBrowsePage — /provider/browse
 *
 * Provider's-eye view of trade_finance_requests with match indicators.
 *
 * Per Session E direction:
 *   - Show ALL published requests with match indicators (don't hide non-matches)
 *   - Sort matched first
 *   - Institutional indicators, NOT consumer-app recommendation engine
 *   - Filters prefilled from the user's own provider profile (returned by the endpoint)
 *   - Provider can override filters or toggle "matched only"
 *
 * Match levels (deterministic, 4 hard filters: finance_type / sector / geography / ticket_range):
 *   high              — all 4 criteria match
 *   sector_geography  — 3 of 4 match
 *   partial           — 2 of 4 match
 *   outside_mandate   — 0-1 match
 *   no_profile        — user has no provider profile yet (browse-only mode)
 */

const MATCH_META = {
  high: {
    label: 'Highly Compatible',
    sublabel: 'Mandate alignment across all criteria',
    color: '#7fb069',
    bg: 'rgba(127,176,105,0.12)',
    border: 'rgba(127,176,105,0.45)',
    sortRank: 0,
  },
  sector_geography: {
    label: 'Sector + Geography Match',
    sublabel: 'Strong fit, one criterion partial',
    color: '#a087d9',
    bg: 'rgba(160,135,217,0.12)',
    border: 'rgba(160,135,217,0.45)',
    sortRank: 1,
  },
  partial: {
    label: 'Partial Match',
    sublabel: 'Some mandate criteria align',
    color: '#dcc068',
    bg: 'rgba(220,192,104,0.12)',
    border: 'rgba(220,192,104,0.4)',
    sortRank: 2,
  },
  outside_mandate: {
    label: 'Outside Preferred Mandate',
    sublabel: 'Limited alignment with your profile',
    color: '#7a8290',
    bg: 'rgba(122,130,144,0.1)',
    border: 'rgba(122,130,144,0.35)',
    sortRank: 3,
  },
  no_profile: {
    label: 'No Mandate Set',
    sublabel: 'Configure your profile for match indicators',
    color: '#7a8290',
    bg: 'rgba(122,130,144,0.1)',
    border: 'rgba(122,130,144,0.35)',
    sortRank: 4,
  },
};

const FINANCE_TYPES = [
  { value: '', label: 'All finance types' },
  { value: 'pre_export',      label: 'Pre-Export Finance' },
  { value: 'working_capital', label: 'Working Capital' },
  { value: 'invoice_finance', label: 'Invoice / Receivables' },
  { value: 'purchase_order',  label: 'Purchase Order Finance' },
  { value: 'lc_facilitation', label: 'LC Facilitation' },
];

const SECTORS = [
  { value: '', label: 'All sectors' },
  { value: 'mining',         label: 'Mining' },
  { value: 'agriculture',    label: 'Agriculture' },
  { value: 'manufacturing',  label: 'Manufacturing' },
  { value: 'logistics',      label: 'Logistics' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'energy',         label: 'Energy' },
  { value: 'commodities',    label: 'Commodities' },
  { value: 'cross_sector',   label: 'Cross-sector' },
  { value: 'other',          label: 'Other' },
];

export default function ProviderBrowsePage() {
  const isLoggedIn = !!getAccessToken();

  const [state, setState] = useState({
    loading: true,
    profile: null,
    requests: [],
    countries: [],
  });

  // Filters
  const [filters, setFilters] = useState({
    finance_type: '',
    sector: '',
    country_iso: '',
    matched_only: false,
  });

  const [error, setError] = useState(null);
  const [refetching, setRefetching] = useState(false);

  // Initial load — fetch countries reference + initial browse (no filters)
  useEffect(() => {
    if (!isLoggedIn) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [browseData, countryData] = await Promise.all([
          api('/api/capital-providers/browse?limit=30'),
          api('/api/reference/countries'),
        ]);
        if (cancelled) return;
        setState({
          loading: false,
          profile: browseData.profile,
          requests: browseData.requests || [],
          countries: countryData.countries || [],
        });
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load trade finance opportunities');
          setState((s) => ({ ...s, loading: false }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  async function refetch(newFilters) {
    setRefetching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (newFilters.finance_type) params.set('finance_type', newFilters.finance_type);
      if (newFilters.sector) params.set('sector', newFilters.sector);
      if (newFilters.country_iso) params.set('country_iso', newFilters.country_iso);
      if (newFilters.matched_only) params.set('matched_only', 'true');
      const data = await api(`/api/capital-providers/browse?${params.toString()}`);
      setState((s) => ({ ...s, requests: data.requests || [], profile: data.profile }));
    } catch (err) {
      setError(err.message || 'Could not load opportunities');
    } finally {
      setRefetching(false);
    }
  }

  function setFilter(key, value) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    refetch(next);
  }

  // ===== Logged-out wall =====
  if (!isLoggedIn) {
    return (
      <Shell>
        <Wall
          title="Provider browse requires authentication"
          body="Browsing trade finance opportunities with mandate-based match indicators requires a verified capital provider account."
          ctaLabel="Sign in"
          ctaTo={`/login?next=${encodeURIComponent(window.location.pathname)}`}
        />
      </Shell>
    );
  }

  if (state.loading) {
    return <Shell><div style={{ padding: 80, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>Loading institutional opportunities…</div></Shell>;
  }

  const hasProfile = !!state.profile;

  // Match summary counts (for the institutional overview tile)
  const matchCounts = state.requests.reduce((acc, r) => {
    const lvl = r.match?.level || 'no_profile';
    acc[lvl] = (acc[lvl] || 0) + 1;
    return acc;
  }, {});

  return (
    <Shell>
      {/* ===== Hero ===== */}
      <section style={{ padding: '40px 0 24px' }}>
        <div className="container" style={{ maxWidth: 1180 }}>
          <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', marginBottom: 20 }}>
            <ArrowLeft size={14} /> Back to dashboard
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Banknote size={14} style={{ color: '#a087d9' }} />
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a087d9' }}>
              Provider opportunity feed
            </div>
          </div>
          <h1 style={{ fontSize: 'clamp(26px, 3vw, 36px)', fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.15, marginTop: 4 }}>
            Trade finance opportunities matched to your mandate.
          </h1>
          <p style={{ marginTop: 14, color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 1.55, maxWidth: 720 }}>
            {hasProfile
              ? 'Live opportunities from across SADC, sorted by institutional compatibility with your mandate. Express interest to engage with seekers.'
              : 'You have not published a provider profile yet. Below shows all published trade finance opportunities. '}
            {!hasProfile && (
              <Link to="/my-provider-profile" style={{ color: 'var(--gold-400, #dcc068)', marginLeft: 4 }}>Define your mandate →</Link>
            )}
          </p>
        </div>
      </section>

      {/* ===== Match summary bar ===== */}
      {hasProfile && (
        <section style={{ padding: '0 0 24px' }}>
          <div className="container" style={{ maxWidth: 1180 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <MatchTile level="high"             count={matchCounts.high || 0} />
              <MatchTile level="sector_geography" count={matchCounts.sector_geography || 0} />
              <MatchTile level="partial"          count={matchCounts.partial || 0} />
              <MatchTile level="outside_mandate"  count={matchCounts.outside_mandate || 0} />
            </div>
          </div>
        </section>
      )}

      {/* ===== Filter bar ===== */}
      <section style={{ padding: '0 0 24px' }}>
        <div className="container" style={{ maxWidth: 1180 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
              <Filter size={12} /> Filters
            </div>
            <select value={filters.finance_type} onChange={(e) => setFilter('finance_type', e.target.value)} style={selectStyle()}>
              {FINANCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={filters.sector} onChange={(e) => setFilter('sector', e.target.value)} style={selectStyle()}>
              {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={filters.country_iso} onChange={(e) => setFilter('country_iso', e.target.value)} style={selectStyle()}>
              <option value="">All countries</option>
              {state.countries.map((c) => <option key={c.iso_code} value={c.iso_code}>{c.name}</option>)}
            </select>
            {hasProfile && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.75)', cursor: 'pointer', marginLeft: 'auto' }}>
                <input type="checkbox" checked={filters.matched_only} onChange={(e) => setFilter('matched_only', e.target.checked)} />
                Highly compatible only
              </label>
            )}
            {refetching && (
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Loader2 size={12} className="spin" /> Refreshing…
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ===== Results ===== */}
      <section style={{ padding: '0 0 80px' }}>
        <div className="container" style={{ maxWidth: 1180 }}>
          {error && (
            <div style={{ padding: 16, background: 'rgba(201,123,123,0.1)', border: '1px solid rgba(201,123,123,0.3)', borderRadius: 6, color: '#e2a4a4', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <AlertCircle size={16} style={{ marginTop: 1 }} /> {error}
            </div>
          )}

          {state.requests.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
              <Banknote size={28} style={{ color: 'rgba(255,255,255,0.25)', marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>No opportunities match these filters</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 480, margin: '0 auto', lineHeight: 1.55 }}>
                {filters.matched_only
                  ? 'No highly-compatible opportunities right now. Try unchecking "Highly compatible only" to see partial matches.'
                  : 'Try widening your filters, or check back as new opportunities post.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
              {state.requests.map((req) => (
                <OpportunityCard key={req.id} req={req} />
              ))}
            </div>
          )}
        </div>
      </section>

      <style>{`.spin { animation: sarego-spin 1s linear infinite; } @keyframes sarego-spin { to { transform: rotate(360deg); } }`}</style>
    </Shell>
  );
}

// ============================================================
// MatchTile - the institutional overview tile
// ============================================================
function MatchTile({ level, count }) {
  const meta = MATCH_META[level];
  return (
    <div style={{ padding: '14px 16px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 6 }}>
      <div style={{ fontSize: 24, fontWeight: 500, color: meta.color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>{meta.label}</div>
    </div>
  );
}

// ============================================================
// OpportunityCard - per request, with match indicator
// ============================================================
function OpportunityCard({ req }) {
  const matchLevel = req.match?.level || 'no_profile';
  const meta = MATCH_META[matchLevel];
  const matched = req.match?.matched || [];

  return (
    <Link
      to={`/opportunities/trade_finance/${req.id}`}
      style={{
        display: 'flex', flexDirection: 'column',
        padding: 20,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${meta.border}`,
        borderRadius: 8,
        textDecoration: 'none', color: 'inherit',
        transition: 'border-color 150ms, background 150ms',
        position: 'relative',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
    >
      {/* Top: match badge + verification */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 9px',
          background: meta.bg,
          border: `1px solid ${meta.border}`,
          borderRadius: 4,
          fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: meta.color, fontWeight: 500,
        }}>
          {meta.label}
        </div>
        {req.verified_level === 'institutional' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(220,192,104,0.85)' }}>
            <CheckCircle2 size={11} /> Institutional
          </div>
        )}
      </div>

      {/* Title */}
      <h3 style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.35, marginBottom: 10, color: 'var(--ivory-50)' }}>
        {req.title}
      </h3>

      {/* Summary preview */}
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, marginBottom: 18, flexGrow: 1 }}>
        {(req.summary || '').slice(0, 180)}{(req.summary || '').length > 180 ? '…' : ''}
      </p>

      {/* Key metrics row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 14 }}>
        <Metric label={formatFinanceType(req.finance_type)} />
        <Metric label={formatSector(req.sector)} />
        <Metric icon={<MapPin size={11} />} label={req.destination_country_iso ? `${req.country_iso} → ${req.destination_country_iso}` : req.country_iso} />
        {req.value_usd && <Metric label={formatUSDCompact(req.value_usd)} highlight />}
      </div>

      {/* Match criteria indicators (4 mini-dots) */}
      {matchLevel !== 'no_profile' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
          <CriterionDot label="Finance"  on={matched.includes('finance_type')} />
          <CriterionDot label="Sector"   on={matched.includes('sector')} />
          <CriterionDot label="Geography" on={matched.includes('geography')} />
          <CriterionDot label="Ticket"   on={matched.includes('ticket_range')} />
        </div>
      )}
    </Link>
  );
}

function Metric({ icon, label, highlight }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: highlight ? 'var(--gold-400, #dcc068)' : 'rgba(255,255,255,0.7)' }}>
      {icon}{label}
    </span>
  );
}

function CriterionDot({ label, on }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: on ? '#7fb069' : 'rgba(255,255,255,0.3)' }}>
      {on ? <CheckCircle2 size={11} /> : <Circle size={11} />}
      {label}
    </span>
  );
}

// ============================================================
// Helpers
// ============================================================

function Shell({ children }) {
  return (
    <div style={{ background: 'var(--ink-950)', color: 'var(--ivory-50)', minHeight: '100vh' }}>
      <Header variant="dark" />
      {children}
      <Footer />
    </div>
  );
}

function Wall({ title, body, ctaLabel, ctaTo }) {
  return (
    <section style={{ padding: '80px 0', textAlign: 'center' }}>
      <div className="container" style={{ maxWidth: 520 }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 14 }}>{title}</h1>
        <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: 32, lineHeight: 1.55 }}>{body}</p>
        <Link to={ctaTo} className="btn btn-gold">{ctaLabel}</Link>
      </div>
    </section>
  );
}

function selectStyle() {
  return {
    padding: '8px 11px',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--ivory-50)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 4,
    fontSize: 13,
    outline: 'none',
    cursor: 'pointer',
  };
}

function formatFinanceType(v) {
  if (!v) return '';
  return v.split('_').map((w) => w.toLowerCase() === 'lc' ? 'LC' : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatSector(v) {
  if (!v) return '';
  return v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ');
}

function formatUSDCompact(n) {
  const num = Number(n);
  if (!isFinite(num)) return '';
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num}`;
}
