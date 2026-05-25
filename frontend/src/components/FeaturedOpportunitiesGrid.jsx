// SAREGO-TF-PHASE2
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Truck, Sprout, Briefcase, TrendingUp, ArrowUpRight, MapPin, Users, Clock, Shield, Banknote } from 'lucide-react';
import { api } from '../lib/api.js';

/**
 * FeaturedOpportunitiesGrid — homepage snapshot of one opportunity per vertical.
 * Fetches /api/opportunities/featured and renders a responsive grid of cards.
 * Each card routes to its detail page.
 *
 * Different from <OpportunityCard /> because:
 *   - takes a vertical record (not an activity event) and renders type-specific summary
 *   - bigger, more detailed display for above-the-fold prominence
 *   - source of truth for the card is the vertical's own row shape, not normalized event shape
 */

const VERTICAL_META = {
  commodity_request:  { label: 'Commodity',   icon: Package,    color: '#c97b7b', section: 'Trade Hub' },
  logistics_load:     { label: 'Logistics',   icon: Truck,      color: '#5d8aa8', section: 'Trade Hub' },
  agri_offtake:       { label: 'Agri Offtake', icon: Sprout,    color: '#7fb069', section: 'Trade Hub' },
  tender:             { label: 'Tender',      icon: Briefcase,  color: '#6ec3c9', section: 'For Governments' },
  trade_finance:      { label: 'Trade Finance', icon: Banknote, color: '#a087d9', section: 'Trade Hub' },
  investment_project: { label: 'Project',     icon: TrendingUp, color: '#dcc068', section: 'For Investors' },
};

const VERIFIED_LABEL = {
  unverified: null, basic: null,
  verified: 'Verified', institutional: 'Institutional',
};

export default function FeaturedOpportunitiesGrid() {
  const [featured, setFeatured] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api('/api/opportunities/featured');
        if (!cancelled) setFeatured(data.featured || {});
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load featured opportunities');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Order matters for visual hierarchy: tender (institutional) first, then projects,
  // then the three commercial verticals.
  const order = ['tender', 'trade_finance', 'investment_project', 'commodity_request', 'logistics_load', 'agri_offtake'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold-400, #dcc068)', marginBottom: 6 }}>
            Now Active Across SADC
          </div>
          <h2 style={{ fontSize: 'clamp(22px, 2.4vw, 28px)', fontWeight: 500, color: 'var(--ivory-50)', margin: 0, letterSpacing: '-0.01em' }}>
            Featured live opportunities
          </h2>
        </div>
        <Link
          to="/opportunities" /* SAREGO-CTA-FEATURED */
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: 'var(--gold-400, #dcc068)',
            textDecoration: 'none',
          }}
        >
          View Live Trade Activity <ArrowUpRight size={14} />
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        {featured === null && !error && (
          <>
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
          </>
        )}
        {featured !== null && order.map((vertical) => {
          const item = featured[vertical];
          if (!item) return null;
          return <FeaturedCard key={vertical} vertical={vertical} item={item} />;
        })}
        {error && (
          <div style={{
            padding: 18, fontSize: 13, color: 'rgba(255,255,255,0.5)',
            border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 8,
            gridColumn: '1 / -1', textAlign: 'center',
          }}>
            Could not load featured opportunities. Try refreshing.
          </div>
        )}
      </div>
    </div>
  );
}

function FeaturedCard({ vertical, item }) {
  const meta = VERTICAL_META[vertical];
  const Icon = meta.icon;
  const verifiedLabel = VERIFIED_LABEL[item.verified_level];
  const expiresLabel = formatExpiresIn(item.expires_at);

  // Build the link target. Investment projects use slug-based projects route;
  // other verticals use /opportunities/:type/:id.
  const linkTo = vertical === 'investment_project'
    ? `/projects/${item.metadata?.slug || item.id}`
    : `/opportunities/${vertical}/${item.id}`;

  // Build a single concise "context line" specific to the vertical so cards
  // communicate their commercial shape at a glance.
  const contextLine = renderContextLine(vertical, item);

  return (
    <Link to={linkTo} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          minHeight: 220,
          transition: 'border-color 150ms, background 150ms, transform 150ms',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `${meta.color}66`;
          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
        }}
      >
        {/* Top row: vertical badge + verification glow */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 999,
              background: `${meta.color}1a`, border: `1px solid ${meta.color}40`,
              color: meta.color, fontSize: 10, letterSpacing: '0.1em',
              textTransform: 'uppercase', fontWeight: 500,
            }}
          >
            <Icon size={11} />
            {meta.label}
          </span>
          {verifiedLabel && (
            <span
              title={verifiedLabel}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                color: 'var(--gold-400, #dcc068)', fontSize: 11,
              }}
            >
              <Shield size={11} />
              {verifiedLabel}
            </span>
          )}
        </div>

        {/* Title */}
        <div style={{
          fontSize: 16, fontWeight: 500, color: 'var(--ivory-50)',
          lineHeight: 1.3, flex: 1,
        }}>
          {item.title}
        </div>

        {/* Context line (vertical-specific) */}
        {contextLine && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
            {contextLine}
          </div>
        )}

        {/* Bottom row: metrics */}
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 12,
            paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 12, color: 'rgba(255,255,255,0.6)',
          }}
        >
          {item.country_iso && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={11} /> {item.country_iso}
            </span>
          )}
          {item.value_usd && (
            <span style={{ color: 'var(--gold-400, #dcc068)', fontWeight: 500 }}>
              {formatUSDShort(item.value_usd)}
            </span>
          )}
          {item.applicants_count > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Users size={11} /> {item.applicants_count}
            </span>
          )}
          {expiresLabel && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                marginLeft: 'auto',
                color: expiresLabel.urgent ? '#e2a45e' : 'rgba(255,255,255,0.6)',
              }}
            >
              <Clock size={11} /> {expiresLabel.text}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}


function formatEnumWord(v) {
  if (!v) return null;
  return v.split('_').map((w) => w.toLowerCase() === 'lc' ? 'LC' : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function renderContextLine(vertical, item) {
  switch (vertical) {
    case 'commodity_request':
      return [item.commodity, item.quantity && `${Number(item.quantity).toLocaleString()} ${item.quantity_unit || ''}`.trim(), item.incoterms]
        .filter(Boolean).join(' · ');
    case 'logistics_load':
      return [
        item.origin_city && item.destination_city ? `${item.origin_city} → ${item.destination_city}` : null,
        item.cargo_type,
        item.weight_tons ? `${Number(item.weight_tons)}t` : null,
      ].filter(Boolean).join(' · ');
    case 'agri_offtake':
      return [
        item.crop,
        item.quantity_tons ? `${Number(item.quantity_tons).toLocaleString()}t` : null,
      ].filter(Boolean).join(' · ');
    case 'tender':
      return [item.issuing_authority, item.tender_type].filter(Boolean).join(' · ');
    case 'trade_finance':
      return [formatEnumWord(item.finance_type), formatEnumWord(item.sector)].filter(Boolean).join(' · ');
    case 'investment_project':
      return item.summary?.slice(0, 120) + (item.summary?.length > 120 ? '…' : '');
    default:
      return null;
  }
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 10,
        padding: 22,
        minHeight: 220,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ width: '40%', height: 18, background: 'rgba(255,255,255,0.05)', borderRadius: 999 }} />
      <div style={{ width: '90%', height: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }} />
      <div style={{ width: '75%', height: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 3 }} />
      <div style={{ width: '60%', height: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 3, marginTop: 'auto' }} />
    </div>
  );
}

function formatUSDShort(n) {
  if (!n) return null;
  const v = Number(n);
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function formatExpiresIn(iso) {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  const now = Date.now();
  const ms = target - now;
  if (ms <= 0) return { text: 'Closed', urgent: false };
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 24) return { text: `${hours}h left`, urgent: true };
  const days = Math.floor(hours / 24);
  if (days < 7) return { text: `${days}d left`, urgent: days <= 2 };
  return { text: `${days}d left`, urgent: false };
}
