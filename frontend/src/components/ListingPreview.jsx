// SAREGO-TRADE-FINANCE-INTEGRATION
import React from 'react';
import {
  MapPin, Users, Shield, Clock,
  Package, Truck, Sprout, Briefcase, Banknote,
} from 'lucide-react';

/**
 * ListingPreview — renders an opportunity in the same visual style as
 * OpportunityDetailPage, used by all 4 form pages for preview-before-publish.
 *
 * Props:
 *   type    'commodity_request' | 'logistics_load' | 'agri_offtake' | 'tender'
 *   data    The validated form payload (Zod-parsed). Shape matches the backend
 *           CREATE schema for the given type.
 *   owner   Optional. The currently-logged-in user (from /api/auth/me) for
 *           "posted by" attribution in the preview.
 *
 * The preview is read-only and shows a "Preview only" badge to make its state
 * unmistakable. Engage controls are present but disabled to demonstrate the
 * eventual UX without allowing interaction.
 */

const TYPE_META = {
  commodity_request: {
    label: 'Commodity Request',
    icon: Package,
    color: '#c97b7b',
  },
  logistics_load: {
    label: 'Logistics Load',
    icon: Truck,
    color: '#5d8aa8',
  },
  agri_offtake: {
    label: 'Agricultural Offtake',
    icon: Sprout,
    color: '#7fb069',
  },
  tender: {
    label: 'Government Tender',
    icon: Briefcase,
    color: '#6ec3c9',
  },
  trade_finance: {
    label: 'Trade Finance',
    icon: Banknote,
    color: '#a087d9',
  },
};

const VERIFIED_TIER = {
  unverified:    { label: 'Unverified',    color: '#9aa3b2' },
  basic:         { label: 'Basic',         color: '#9aa3b2' },
  verified:      { label: 'Verified',      color: 'var(--gold-400, #dcc068)' },
  institutional: { label: 'Institutional', color: 'var(--gold-400, #dcc068)' },
};

export default function ListingPreview({ type, data, owner }) {
  const meta = TYPE_META[type];
  if (!meta || !data) return null;

  const Icon = meta.icon;
  const tier = owner?.trust_tier || 'verified';
  const verifiedTier = VERIFIED_TIER[tier];
  const expiresLabel = formatExpiresIn(data.expires_at);

  // For logistics, route is two-sided
  const countryLine = type === 'logistics_load' && data.origin_country_iso && data.destination_country_iso
    ? `${data.origin_country_iso} → ${data.destination_country_iso}`
    : data.country_iso || '—';

  return (
    <div
      style={{
        background: 'var(--ink-950)',
        border: '1px solid rgba(220,192,104,0.25)',
        borderRadius: 12,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Preview badge */}
      <div
        style={{
          position: 'absolute',
          top: 14, right: 14,
          padding: '5px 12px',
          background: 'rgba(220,192,104,0.15)',
          border: '1px solid rgba(220,192,104,0.4)',
          color: 'var(--gold-400, #dcc068)',
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontWeight: 500,
          borderRadius: 999,
          zIndex: 2,
        }}
      >
        Preview only
      </div>

      {/* Hero block */}
      <div style={{ padding: '32px 32px 24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', borderRadius: 999,
              background: `${meta.color}1a`, border: `1px solid ${meta.color}40`,
              color: meta.color, fontSize: 10, letterSpacing: '0.08em',
              textTransform: 'uppercase', fontWeight: 500,
            }}
          >
            <Icon size={11} />
            {meta.label}
          </span>
          {tier === 'verified' || tier === 'institutional' ? (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 999,
                background: 'rgba(220,192,104,0.1)',
                border: '1px solid rgba(220,192,104,0.35)',
                color: verifiedTier.color, fontSize: 10, letterSpacing: '0.08em',
                textTransform: 'uppercase', fontWeight: 500,
              }}
            >
              <Shield size={11} />
              {verifiedTier.label}
            </span>
          ) : null}
        </div>

        <h2
          style={{
            fontSize: 'clamp(22px, 2.8vw, 30px)',
            lineHeight: 1.15, fontWeight: 500, letterSpacing: '-0.01em',
            color: 'var(--ivory-50)', margin: 0, paddingRight: 110,
          }}
        >
          {data.title || <span style={{ color: 'rgba(255,255,255,0.3)' }}>Untitled listing</span>}
        </h2>

        {data.summary && (
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)', marginTop: 16, marginBottom: 0 }}>
            {data.summary}
          </p>
        )}

        {/* Metrics row */}
        <div
          style={{
            marginTop: 26,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 18,
          }}
        >
          {data.value_usd != null && data.value_usd > 0 && (
            <Metric label="Indicative Value" value={formatUSD(data.value_usd)} accent="var(--gold-400, #dcc068)" />
          )}
          <Metric label="Country" value={countryLine} icon={<MapPin size={12} />} />
          <Metric label="Interested" value="0 companies" icon={<Users size={12} />} muted />
          {expiresLabel && (
            <Metric label="Closes" value={expiresLabel.text} icon={<Clock size={12} />} urgent={expiresLabel.urgent} />
          )}
        </div>
      </div>

      {/* Type-specific detail panel */}
      <div style={{ padding: '0 32px 24px' }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            padding: 22,
          }}
        >
          <div
            style={{
              fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'var(--gold-400, #dcc068)', marginBottom: 16,
            }}
          >
            Listing Detail
          </div>
          {renderTypePanel(type, data)}
        </div>
      </div>

      {/* Disabled engage rail (faded) */}
      <div style={{ padding: '0 32px 28px' }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.015)',
            border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: 18,
            opacity: 0.7,
            textAlign: 'center',
            fontSize: 12,
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          Engage panel — verified counterparties will see "Express Interest" here after publish.
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Type-specific panels
// ============================================================

function renderTypePanel(type, data) {
  switch (type) {
    case 'commodity_request':
      return (
        <DefList items={[
          ['Commodity',     data.commodity],
          ['Quantity',      data.quantity ? `${Number(data.quantity).toLocaleString()} ${data.quantity_unit || ''}`.trim() : null],
          ['Incoterms',     data.incoterms],
          ['Country',       data.country_iso],
        ]} />
      );
    case 'logistics_load':
      return (
        <DefList items={[
          ['Route',        data.origin_city && data.destination_city ? `${data.origin_city} → ${data.destination_city}` : null],
          ['Cargo Type',   data.cargo_type],
          ['Weight',       data.weight_tons ? `${Number(data.weight_tons).toLocaleString()} tons` : null],
          ['Load Date',    formatDate(data.load_date)],
        ]} />
      );
    case 'agri_offtake':
      return (
        <DefList items={[
          ['Crop',          data.crop],
          ['Quantity',      data.quantity_tons ? `${Number(data.quantity_tons).toLocaleString()} tons` : null],
          ['Delivery Window', data.delivery_window_start && data.delivery_window_end
            ? `${formatDate(data.delivery_window_start)} → ${formatDate(data.delivery_window_end)}` : null],
          ['Country',       data.country_iso],
        ]} />
      );
    case 'tender':
      return (
        <DefList items={[
          ['Reference',           data.tender_reference],
          ['Issuing Authority',   data.issuing_authority],
          ['Tender Type',         data.tender_type],
          ['Submission Deadline', formatDate(data.submission_deadline)],
          ['Country',             data.country_iso],
        ]} />
      );
    case 'trade_finance':
      return (
        <DefList items={[
          ['Finance Type',     formatEnum(data.finance_type)],
          ['Sector',           formatEnum(data.sector)],
          ['Trade Context',    formatEnum(data.trade_context)],
          ['Contract Ref',     data.contract_reference],
          ['Timeline',         formatEnum(data.finance_timeline)],
          ['Collateral',       formatEnum(data.collateral_type)],
          ['Origin',           data.country_iso],
          ['Destination',      data.destination_country_iso],
        ]} />
      );
    default:
      return null;
  }
}

function DefList({ items }) {
  const filtered = items.filter(([, v]) => v);
  if (filtered.length === 0) {
    return <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>No detail fields yet.</div>;
  }
  return (
    <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 24px' }}>
      {filtered.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{label}</dt>
          <dd style={{ margin: 0, fontSize: 13, color: 'var(--ivory-50)', fontWeight: 500 }}>{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function Metric({ label, value, accent, icon, urgent, muted }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon} {label}
      </div>
      <div
        style={{
          fontSize: 16, fontWeight: 500,
          color: urgent ? '#e2a45e' : muted ? 'rgba(255,255,255,0.5)' : (accent || 'var(--ivory-50)'),
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ============================================================
// Utilities
// ============================================================

function formatEnum(value) {
  if (!value) return null;
  // Convert "pre_export" → "Pre-export", "lc_facilitation" → "LC Facilitation"
  return value
    .split('_')
    .map((w) => w.toLowerCase() === 'lc' ? 'LC' : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatUSD(n) {
  if (!n) return '—';
  const v = Number(n);
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatExpiresIn(iso) {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  const now = Date.now();
  const ms = target - now;
  if (ms <= 0) return { text: 'Closed', urgent: false };
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 24) return { text: `Closes in ${hours}h`, urgent: true };
  const days = Math.floor(hours / 24);
  if (days < 7) return { text: `Closes in ${days}d`, urgent: days <= 2 };
  return { text: `Closes in ${days}d`, urgent: false };
}
