// ============================================================
// OpportunitiesPage.jsx
// Session G: cross-vertical opportunities browse.
//
// Public discovery page - no auth required to view. Engagement actions
// (Express Interest) still require auth as enforced on the detail page.
//
// URL state syncs all filters via useSearchParams so links are shareable.
// Sort: institutional > verified > unverified, then published_at DESC.
// Capped at 50 server-side.
// ============================================================
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import {
  Filter,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Briefcase,
  Truck,
  Wheat,
  FileText,
  Banknote,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

// ============================================================
// Constants
// ============================================================
const TYPE_META = {
  commodity_request: {
    label: 'Commodity Request',
    color: '#f59e0b', // amber
    icon: Briefcase,
  },
  logistics_load:    {
    label: 'Logistics Load',
    color: '#06b6d4', // cyan
    icon: Truck,
  },
  agri_offtake:      {
    label: 'Agri Offtake',
    color: '#84cc16', // lime
    icon: Wheat,
  },
  tender:            {
    label: 'Tender',
    color: '#a78bfa', // violet
    icon: FileText,
  },
  trade_finance:     {
    label: 'Trade Finance',
    color: '#c084fc', // purple-light
    icon: Banknote,
  },
};

const SECTOR_OPTIONS = [
  { value: '',                label: 'All sectors' },
  { value: 'mining',          label: 'Mining' },
  { value: 'agriculture',     label: 'Agriculture' },
  { value: 'manufacturing',   label: 'Manufacturing' },
  { value: 'logistics',       label: 'Logistics' },
  { value: 'infrastructure',  label: 'Infrastructure' },
  { value: 'energy',          label: 'Energy' },
  { value: 'commodities',     label: 'Commodities' },
  { value: 'cross_sector',    label: 'Cross-sector' },
  { value: 'other',           label: 'Other' },
];

const TYPE_OPTIONS = [
  { value: '',                  label: 'All types' },
  { value: 'commodity_request', label: 'Commodity Request' },
  { value: 'logistics_load',    label: 'Logistics Load' },
  { value: 'agri_offtake',      label: 'Agri Offtake' },
  { value: 'tender',            label: 'Tender' },
  { value: 'trade_finance',     label: 'Trade Finance' },
];

const VERIFIED_OPTIONS = [
  { value: '',              label: 'All listings' },
  { value: 'verified',      label: 'Verified+' },
  { value: 'institutional', label: 'Institutional only' },
];

// 16 SADC countries
const COUNTRY_OPTIONS = [
  { value: '',   label: 'All countries' },
  { value: 'AO', label: 'Angola' },
  { value: 'BW', label: 'Botswana' },
  { value: 'CD', label: 'DR Congo' },
  { value: 'KM', label: 'Comoros' },
  { value: 'LS', label: 'Lesotho' },
  { value: 'MG', label: 'Madagascar' },
  { value: 'MU', label: 'Mauritius' },
  { value: 'MW', label: 'Malawi' },
  { value: 'MZ', label: 'Mozambique' },
  { value: 'NA', label: 'Namibia' },
  { value: 'SC', label: 'Seychelles' },
  { value: 'SZ', label: 'Eswatini' },
  { value: 'TZ', label: 'Tanzania' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'ZM', label: 'Zambia' },
  { value: 'ZW', label: 'Zimbabwe' },
];

// ============================================================
// Helper functions
// ============================================================
function formatValue(usd) {
  if (usd == null) return '—';
  const n = Number(usd);
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatRelativeDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0)   return `Closed ${-diffDays}d ago`;
  if (diffDays === 0) return 'Closes today';
  if (diffDays === 1) return 'Closes tomorrow';
  if (diffDays < 30)  return `Closes in ${diffDays}d`;
  const diffMonths = Math.round(diffDays / 30);
  return `Closes in ~${diffMonths}mo`;
}

function VerificationPill({ level }) {
  if (level === 'institutional') {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        background: 'rgba(192, 132, 252, 0.12)',
        border: '1px solid rgba(192, 132, 252, 0.3)',
        color: '#c084fc',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 0.3,
      }}>
        <Sparkles size={11} /> Institutional
      </span>
    );
  }
  if (level === 'verified') {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        background: 'rgba(244, 191, 76, 0.12)',
        border: '1px solid rgba(244, 191, 76, 0.3)',
        color: '#f4bf4c',
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 0.3,
      }}>
        <ShieldCheck size={11} /> Verified
      </span>
    );
  }
  return null;
}

// ============================================================
// Filter Bar
// ============================================================
function FilterBar({ filters, setFilter, reset, totalResults }) {
  const hasAny = filters.type || filters.sector || filters.country_iso ||
                 filters.min_value_usd || filters.max_value_usd || filters.verified_level;

  return (
    <div style={{
      background: 'rgba(20, 22, 26, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: 12,
      padding: 20,
      marginBottom: 32,
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 13,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}>
        <Filter size={14} />
        <span>Filters</span>
        <span style={{ flex: 1 }} />
        {totalResults != null && (
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textTransform: 'none', letterSpacing: 0 }}>
            {totalResults} {totalResults === 1 ? 'result' : 'results'}
          </span>
        )}
        {hasAny && (
          <button
            type="button"
            onClick={reset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={11} /> Reset
          </button>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
      }}>
        <FilterSelect
          label="Type"
          value={filters.type}
          onChange={(v) => setFilter('type', v)}
          options={TYPE_OPTIONS}
        />
        <FilterSelect
          label="Sector"
          value={filters.sector}
          onChange={(v) => setFilter('sector', v)}
          options={SECTOR_OPTIONS}
        />
        <FilterSelect
          label="Country"
          value={filters.country_iso}
          onChange={(v) => setFilter('country_iso', v)}
          options={COUNTRY_OPTIONS}
        />
        <FilterSelect
          label="Verification"
          value={filters.verified_level}
          onChange={(v) => setFilter('verified_level', v)}
          options={VERIFIED_OPTIONS}
        />
        <FilterInput
          label="Min ticket (USD)"
          value={filters.min_value_usd}
          onChange={(v) => setFilter('min_value_usd', v)}
          placeholder="e.g. 500000"
        />
        <FilterInput
          label="Max ticket (USD)"
          value={filters.max_value_usd}
          onChange={(v) => setFilter('max_value_usd', v)}
          placeholder="e.g. 50000000"
        />
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '8px 10px',
          borderRadius: 6,
          background: 'rgba(11, 13, 16, 0.8)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff',
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} style={{ background: '#0b0d10' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterInput({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          padding: '8px 10px',
          borderRadius: 6,
          background: 'rgba(11, 13, 16, 0.8)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff',
          fontSize: 14,
          fontFamily: 'inherit',
        }}
      />
    </label>
  );
}

// ============================================================
// Opportunity Card
// ============================================================
function OpportunityCard({ opp }) {
  const meta = TYPE_META[opp.type];
  const Icon = meta?.icon;
  const closingText = formatRelativeDate(opp.expires_at);

  return (
    <Link
      to={`/opportunities/${opp.type}/${opp.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(20, 22, 26, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 12,
        padding: 20,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.2s, background 0.2s',
        minHeight: 200,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${meta?.color || 'rgba(255,255,255,0.15)'}`;
        e.currentTarget.style.background = 'rgba(20, 22, 26, 0.85)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
        e.currentTarget.style.background = 'rgba(20, 22, 26, 0.6)';
      }}
    >
      {/* Header row: type badge + verification */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          borderRadius: 4,
          background: `${meta?.color}1a`,
          color: meta?.color,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}>
          {Icon && <Icon size={11} />}
          {meta?.label || opp.type}
        </span>
        <span style={{ flex: 1 }} />
        <VerificationPill level={opp.verified_level} />
      </div>

      {/* Title */}
      <h3 style={{
        margin: 0,
        marginBottom: 8,
        fontSize: 16,
        fontWeight: 600,
        color: '#fff',
        lineHeight: 1.3,
      }}>
        {opp.title}
      </h3>

      {/* Summary */}
      {opp.summary && (
        <p style={{
          margin: 0,
          marginBottom: 16,
          fontSize: 13,
          color: 'rgba(255, 255, 255, 0.6)',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {opp.summary}
        </p>
      )}

      {/* Footer metadata */}
      <div style={{
        marginTop: 'auto',
        paddingTop: 12,
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.5)',
      }}>
        {opp.country_iso && <span>{opp.country_iso}</span>}
        {opp.value_usd != null && (
          <>
            {opp.country_iso && <span style={{ opacity: 0.4 }}>·</span>}
            <span style={{ color: '#f4bf4c', fontWeight: 600 }}>{formatValue(opp.value_usd)}</span>
          </>
        )}
        <span style={{ flex: 1 }} />
        {closingText && <span>{closingText}</span>}
      </div>
    </Link>
  );
}

// ============================================================
// Main Page Component
// ============================================================
export default function OpportunitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state derived from URL
  const filters = useMemo(() => ({
    type:           searchParams.get('type') || '',
    sector:         searchParams.get('sector') || '',
    country_iso:    searchParams.get('country_iso') || '',
    verified_level: searchParams.get('verified_level') || '',
    min_value_usd:  searchParams.get('min_value_usd') || '',
    max_value_usd:  searchParams.get('max_value_usd') || '',
  }), [searchParams]);

  const setFilter = useCallback((key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === '' || value == null) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const reset = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  // Fetch results when filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters.type)           params.set('type', filters.type);
    if (filters.sector)         params.set('sector', filters.sector);
    if (filters.country_iso)    params.set('country_iso', filters.country_iso);
    if (filters.verified_level) params.set('verified_level', filters.verified_level);
    if (filters.min_value_usd)  params.set('min_value_usd', filters.min_value_usd);
    if (filters.max_value_usd)  params.set('max_value_usd', filters.max_value_usd);

    const qs = params.toString();
    const path = `/api/opportunities/browse${qs ? `?${qs}` : ''}`;

    api(path)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load opportunities');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [filters]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0d10',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Header />

      <main style={{
        flex: 1,
        maxWidth: 1200,
        margin: '0 auto',
        padding: '48px 24px',
        width: '100%',
      }}>
        {/* Page header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{
            margin: 0,
            marginBottom: 12,
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: -0.5,
            fontFamily: 'Georgia, serif',
          }}>
            Opportunities
          </h1>
          <p style={{
            margin: 0,
            fontSize: 16,
            color: 'rgba(255, 255, 255, 0.6)',
            fontWeight: 400,
          }}>
            Live economic activity across Southern Africa
          </p>
        </div>

        {/* Filter bar */}
        <FilterBar
          filters={filters}
          setFilter={setFilter}
          reset={reset}
          totalResults={data?.total}
        />

        {/* Capped notice */}
        {data?.capped_at_50 && (
          <div style={{
            marginBottom: 16,
            padding: '10px 16px',
            background: 'rgba(244, 191, 76, 0.08)',
            border: '1px solid rgba(244, 191, 76, 0.2)',
            borderRadius: 8,
            fontSize: 13,
            color: '#f4bf4c',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <AlertCircle size={14} />
            Showing the first 50 results. Refine filters to narrow down.
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{
            padding: 60,
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: 14,
          }}>
            Loading opportunities…
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div style={{
            padding: 32,
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 8,
            color: '#fca5a5',
            textAlign: 'center',
          }}>
            <AlertCircle size={20} style={{ marginBottom: 8 }} />
            <div>{error}</div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && data?.opportunities?.length === 0 && (
          <div style={{
            padding: 60,
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.5)',
          }}>
            <div style={{ fontSize: 16, marginBottom: 8 }}>No opportunities match your filters</div>
            <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.4)' }}>
              Try broadening your search criteria or{' '}
              <button
                type="button"
                onClick={reset}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f4bf4c',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                  font: 'inherit',
                }}
              >
                reset filters
              </button>
            </div>
          </div>
        )}

        {/* Results grid */}
        {!loading && !error && data?.opportunities?.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 20,
          }}>
            {data.opportunities.map((opp) => (
              <OpportunityCard key={`${opp.type}:${opp.id}`} opp={opp} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
