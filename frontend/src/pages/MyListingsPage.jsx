import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Lock, Users, MapPin, Clock, Shield, AlertCircle } from 'lucide-react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { api, getAccessToken } from '../lib/api.js';

/**
 * MyListingsPage — /my-listings
 * Shows opportunities owned by the current user, grouped by vertical.
 * Tonight: commodity_request only. Other 3 verticals appear as
 * "coming soon" placeholder sections.
 */

const STATUS_META = {
  draft:      { label: 'Draft',      color: '#9aa3b2', bg: 'rgba(154,163,178,0.1)' },
  published:  { label: 'Live',       color: '#7fb069', bg: 'rgba(127,176,105,0.12)' },
  in_review:  { label: 'In review',  color: '#e2a45e', bg: 'rgba(226,164,94,0.12)' },
  closed:     { label: 'Closed',     color: '#c97b7b', bg: 'rgba(201,123,123,0.12)' },
  expired:    { label: 'Expired',    color: '#9aa3b2', bg: 'rgba(154,163,178,0.1)' },
  fulfilled:  { label: 'Fulfilled',  color: 'var(--gold-400)', bg: 'rgba(220,192,104,0.12)' },
};

export default function MyListingsPage() {
  const navigate = useNavigate();
  const isLoggedIn = !!getAccessToken();
  const [listings, setListings] = useState(null);
  const [error, setError] = useState(null);
  const [closing, setClosing] = useState({}); // { 'commodity_request:id': 'pending'|'confirming'|'submitting' }

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api('/api/opportunities/mine');
        if (!cancelled) setListings(data.listings || {});
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load listings');
      }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn]);

  async function handleClose(type, id) {
    const key = `${type}:${id}`;
    if (closing[key] !== 'confirming') {
      setClosing((prev) => ({ ...prev, [key]: 'confirming' }));
      setTimeout(() => {
        setClosing((prev) => prev[key] === 'confirming' ? { ...prev, [key]: undefined } : prev);
      }, 4000);
      return;
    }

    setClosing((prev) => ({ ...prev, [key]: 'submitting' }));
    try {
      const result = await api(`/api/opportunities/${type}/${id}`, { method: 'DELETE' });
      // Update the listing in place
      setListings((prev) => ({
        ...prev,
        [type]: prev[type].map((l) => l.id === id ? { ...l, status: result.opportunity.status } : l),
      }));
    } catch (err) {
      setError(err.message || 'Could not close the listing');
    } finally {
      setClosing((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  if (!isLoggedIn) {
    return (
      <Shell>
        <section style={{ padding: '80px 0', textAlign: 'center' }}>
          <div className="container" style={{ maxWidth: 520 }}>
            <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 14 }}>Sign in to manage your listings</h1>
            <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: 32, lineHeight: 1.55 }}>
              View and manage opportunities you've posted to SAREGO.
            </p>
            <Link to="/login?next=%2Fmy-listings" className="btn btn-gold">Sign in</Link>
          </div>
        </section>
      </Shell>
    );
  }

  const commodityListings = listings?.commodity_request || [];

  return (
    <Shell>
      <section style={{ padding: '40px 0 24px' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold-400)', marginBottom: 8 }}>
                My listings
              </div>
              <h1 style={{ fontSize: 'clamp(28px, 3vw, 38px)', fontWeight: 500, letterSpacing: '-0.01em', margin: 0 }}>
                Opportunities you've posted.
              </h1>
            </div>
            <Link to="/opportunities/commodity_request/new" className="btn btn-gold">
              <Plus size={16} /> Post a commodity request
            </Link>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.55, maxWidth: 620, marginTop: 14 }}>
            Manage your active listings. Closing a listing preserves all interest expressions and audit history.
          </p>
        </div>
      </section>

      {error && (
        <section style={{ padding: '0 0 24px' }}>
          <div className="container">
            <div style={{
              padding: 14, borderRadius: 6,
              background: 'rgba(201,123,123,0.1)',
              border: '1px solid rgba(201,123,123,0.3)',
              color: '#e2a4a4', fontSize: 13, lineHeight: 1.5,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
              {error}
            </div>
          </div>
        </section>
      )}

      <section style={{ padding: '20px 0 40px' }}>
        <div className="container">
          <VerticalGroup
            title="Commodity Requests"
            count={commodityListings.length}
            loading={listings === null && !error}
          >
            {commodityListings.length === 0 ? (
              <EmptyState
                title="No commodity requests yet"
                body="Post your first buy-side commodity request to verified suppliers across SADC."
                ctaLabel="Post a commodity request"
                ctaTo="/opportunities/commodity_request/new"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {commodityListings.map((listing) => (
                  <ListingRow
                    key={listing.id}
                    listing={listing}
                    type="commodity_request"
                    closingState={closing[`commodity_request:${listing.id}`]}
                    onClose={() => handleClose('commodity_request', listing.id)}
                  />
                ))}
              </div>
            )}
          </VerticalGroup>

          <VerticalGroup title="Logistics Loads" comingSoon />
          <VerticalGroup title="Agricultural Offtake" comingSoon />
          <VerticalGroup title="Tenders" comingSoon />
        </div>
      </section>
    </Shell>
  );
}

// ============================================================
// Building blocks
// ============================================================

function VerticalGroup({ title, count, loading, comingSoon, children }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <h2 style={{ fontSize: 17, fontWeight: 500, color: 'var(--ivory-50)', margin: 0 }}>{title}</h2>
        {!comingSoon && typeof count === 'number' && (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {count} {count === 1 ? 'listing' : 'listings'}
          </span>
        )}
        {comingSoon && (
          <span style={{
            fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)',
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '3px 8px', borderRadius: 999,
          }}>
            Coming soon
          </span>
        )}
      </div>
      {comingSoon ? (
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', padding: '14px 0' }}>
          Posting for this vertical will be enabled in an upcoming release.
        </div>
      ) : loading ? (
        <div style={{ padding: 18, fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
          Loading…
        </div>
      ) : children}
    </div>
  );
}

function ListingRow({ listing, type, closingState, onClose }) {
  const statusMeta = STATUS_META[listing.status] || STATUS_META.draft;
  const isConfirming = closingState === 'confirming';
  const isSubmitting = closingState === 'submitting';

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <Link
            to={`/opportunities/${type}/${listing.id}`}
            style={{ fontSize: 15, fontWeight: 500, color: 'var(--ivory-50)', textDecoration: 'none', display: 'block' }}
          >
            {listing.title}
          </Link>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={11} /> {listing.country_iso}
            </span>
            {listing.value_usd && (
              <span style={{ color: 'var(--gold-400)', fontWeight: 500 }}>
                {formatUSDShort(listing.value_usd)}
              </span>
            )}
            {listing.applicants_count > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Users size={11} /> {listing.applicants_count} interested
              </span>
            )}
            {listing.expires_at && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Clock size={11} /> Closes {formatDate(listing.expires_at)}
              </span>
            )}
          </div>
        </div>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '4px 10px', borderRadius: 999,
            background: statusMeta.bg,
            color: statusMeta.color,
            fontSize: 11, letterSpacing: '0.08em',
            textTransform: 'uppercase', fontWeight: 500,
          }}
        >
          {statusMeta.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Link
          to={`/opportunities/${type}/${listing.id}/edit`}
          className="btn btn-ghost-light"
          style={{ fontSize: 12, padding: '7px 14px' }}
        >
          <Pencil size={13} /> Edit
        </Link>
        {listing.status === 'published' && (
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="btn btn-ghost-light"
            style={{
              fontSize: 12, padding: '7px 14px',
              ...(isConfirming ? {
                borderColor: 'rgba(201,123,123,0.5)',
                color: '#e2a4a4',
              } : {}),
            }}
          >
            <Lock size={13} />
            {isSubmitting ? 'Closing…' : isConfirming ? 'Confirm close?' : 'Close listing'}
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, body, ctaLabel, ctaTo }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px dashed rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '36px 22px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ivory-50)', marginBottom: 8 }}>{title}</div>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', maxWidth: 440, margin: '0 auto 22px', lineHeight: 1.55 }}>{body}</p>
      <Link to={ctaTo} className="btn btn-gold">
        <Plus size={14} /> {ctaLabel}
      </Link>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div style={{ background: 'var(--ink-950)', color: 'var(--ivory-50)', minHeight: '100vh' }}>
      <Header variant="dark" />
      {children}
      <Footer />
    </div>
  );
}

function formatUSDShort(n) {
  if (!n) return '—';
  const v = Number(n);
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}
