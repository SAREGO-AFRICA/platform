import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, Shield, MapPin } from 'lucide-react';

/**
 * OpportunityCard — single card representing any opportunity-stream event.
 * Now clickable: routes to /opportunities/:type/:id where applicable.
 */

const TYPE_META = {
  project_published:        { label: 'Project',           color: '#dcc068', verticalType: null },
  tender_posted:            { label: 'Tender',            color: '#6ec3c9', verticalType: 'tender' },
  commodity_request_posted: { label: 'Commodity',         color: '#c97b7b', verticalType: 'commodity_request' },
  logistics_load_posted:    { label: 'Logistics',         color: '#5d8aa8', verticalType: 'logistics_load' },
  agri_offtake_posted:      { label: 'Agri Offtake',      color: '#7fb069', verticalType: 'agri_offtake' },
  interest_expressed:       { label: 'Investor Interest', color: '#a888c2', verticalType: null },
  deal_room_opened:         { label: 'Deal Room',         color: '#e2a45e', verticalType: null },
};

const VERIFIED_LABEL = {
  unverified:    null,
  basic:         null,
  verified:      'Verified',
  institutional: 'Institutional',
};

/**
 * Extract a UUID from the event.id prefix used by /api/activity.
 * Examples: "tender-054f8fbe-...." -> "054f8fbe-..."
 *           "commodity-d00f62aa-..." -> "d00f62aa-..."
 */
function extractUuid(eventId) {
  if (!eventId) return null;
  const m = eventId.match(/^[a-z]+-([0-9a-f-]{36})$/i);
  return m ? m[1] : null;
}

function getLinkTo(event) {
  const meta = TYPE_META[event.type];
  if (!meta) return null;
  // Vertical opportunity types route to /opportunities/:type/:id
  if (meta.verticalType) {
    const uuid = extractUuid(event.id);
    return uuid ? `/opportunities/${meta.verticalType}/${uuid}` : null;
  }
  // Project / interest / deal-room events route to the project page
  if ((event.type === 'project_published' || event.type === 'interest_expressed' || event.type === 'deal_room_opened') && event.slug) {
    return `/projects/${event.slug}`;
  }
  return null;
}

export default function OpportunityCard({ event, compact = false }) {
  if (!event) return null;
  const meta = TYPE_META[event.type] || { label: 'Activity', color: '#9aa3b2' };
  const verifiedLabel = VERIFIED_LABEL[event.verified_level];
  const timeAgo = formatTimeAgo(event.timestamp);
  const linkTo = getLinkTo(event);

  const card = (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: compact ? '14px 16px' : '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'border-color 150ms, background 150ms',
        cursor: linkTo ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(220,192,104,0.3)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
      }}
    >
      {/* Type badge + time */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: meta.color,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />
          {meta.label}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{timeAgo}</span>
      </div>

      {/* Title */}
      <div style={{ fontSize: compact ? 14 : 15, fontWeight: 500, color: '#faf6ee', lineHeight: 1.3 }}>
        {event.title}
      </div>

      {/* Meta row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          fontSize: 12,
          color: 'rgba(255,255,255,0.6)',
          marginTop: 2,
        }}
      >
        {event.country_iso && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={12} />
            {event.country_iso}
            {event.metadata?.destination_country_iso && event.metadata.destination_country_iso !== event.country_iso && (
              <> → {event.metadata.destination_country_iso}</>
            )}
          </span>
        )}
        {event.value_usd != null && event.value_usd > 0 && (
          <span style={{ color: 'var(--gold-400, #dcc068)', fontWeight: 500 }}>
            {formatUSDShort(event.value_usd)}
          </span>
        )}
        {event.applicants_count != null && event.applicants_count > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Users size={12} />
            {event.applicants_count} interested
          </span>
        )}
        {verifiedLabel && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--gold-400, #dcc068)' }}>
            <Shield size={12} />
            {verifiedLabel}
          </span>
        )}
      </div>
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        {card}
      </Link>
    );
  }
  return card;
}

function formatUSDShort(n) {
  if (!n) return '—';
  const v = Number(n);
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function formatTimeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
