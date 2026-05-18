import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Lock, Users, MapPin, Clock, AlertCircle, Package, Truck, Sprout, Briefcase } from 'lucide-react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { api, getAccessToken } from '../lib/api.js';

const STATUS_META = {
  draft:      { label: 'Draft',      color: '#9aa3b2', bg: 'rgba(154,163,178,0.1)' },
  published:  { label: 'Live',       color: '#7fb069', bg: 'rgba(127,176,105,0.12)' },
  in_review:  { label: 'In review',  color: '#e2a45e', bg: 'rgba(226,164,94,0.12)' },
  closed:     { label: 'Closed',     color: '#c97b7b', bg: 'rgba(201,123,123,0.12)' },
  expired:    { label: 'Expired',    color: '#9aa3b2', bg: 'rgba(154,163,178,0.1)' },
  fulfilled:  { label: 'Fulfilled',  color: 'var(--gold-400)', bg: 'rgba(220,192,104,0.12)' },
};

const VERTICALS = [
  { type: 'commodity_request', label: 'Commodity Requests',     icon: Package,   color: '#c97b7b',
    ctaLabel: 'Post a commodity request',
    emptyTitle: 'No commodity requests yet',
    emptyBody:  'Post your first buy-side commodity request to verified suppliers across SADC.' },
  { type: 'logistics_load',    label: 'Logistics Loads',         icon: Truck,     color: '#5d8aa8',
    ctaLabel: 'Post a logistics load',
    emptyTitle: 'No logistics loads yet',
    emptyBody:  'Publish a freight load to verified transporters across SADC corridors.' },
  { type: 'agri_offtake',      label: 'Agricultural Offtake',    icon: Sprout,    color: '#7fb069',
    ctaLabel: 'Post an agri offtake',
    emptyTitle: 'No agri offtake requests yet',
    emptyBody:  'Publish an offtake commitment to verified producers and cooperatives.' },
  { type: 'tender',            label: 'Tenders',                 icon: Briefcase, color: '#6ec3c9',
    ctaLabel: 'Publish a tender',
    emptyTitle: 'No tenders yet',
    emptyBody:  'Publish a government or institutional tender to verified counterparties.' },
];

export default function MyListingsPage() {
  const navigate = useNavigate();
  const isLoggedIn = !!getAccessToken();
  const [listings, setListings] = useState(null);
  const [error, setError] = useState(null);
  const [closing, setClosing] = useState({});

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
      setListings((prev) => ({
        ...prev,
        [type]: (prev[type] || []).map((l) => l.id === id ? { ...l, status: result.opportunity.status } : l),
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

  // Compute totals for the page header
  const totalCount = listings
    ? VERTICALS.reduce((sum, v) => sum + (listings[v.type]?.length || 0), 0)
    : null;

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
            <NewListingMenu />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.55, maxWidth: 620, marginTop: 14 }}>
            Manage your active listings across commodity requests, logistics loads, agricultural offtake commitments, and tenders.
            Closing a listing preserves all interest expressions and audit history.
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
          {VERTICALS.map((v) => {
            const items = listings?.[v.type] || [];
            return (
              <VerticalGroup
                key={v.type}
                vertical={v}
                items={items}
                loading={listings === null && !error}
                closing={closing}
                onClose={handleClose}
              />
            );
          })}
        </div>
      </section>
    </Shell>
  );
}

function NewListingMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} className="btn btn-gold">
        <Plus size={16} /> New listing
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
          <div
            style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 10,
              background: 'var(--ink-900, #1a1a1a)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: 6, minWidth: 240,
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}
          >
            {VERTICALS.map((v) => {
              const Icon = v.icon;
              return (
                <Link
                  key={v.type}
                  to={`/opportunities/${v.type}/new`}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 6,
                    color: 'var(--ivory-50)', textDecoration: 'none',
                    fontSize: 14,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon size={14} style={{ color: v.color }} />
                  {v.ctaLabel}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function VerticalGroup({ vertical, items, loading, closing, onClose }) {
  const Icon = vertical.icon;
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Icon size={16} style={{ color: vertical.color }} />
        <h2 style={{ fontSize: 17, fontWeight: 500, color: 'var(--ivory-50)', margin: 0 }}>{vertical.label}</h2>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          {items.length} {items.length === 1 ? 'listing' : 'listings'}
        </span>
      </div>
      {loading ? (
        <div style={{ padding: 18, fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
          Loading…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={vertical.emptyTitle}
          body={vertical.emptyBody}
          ctaLabel={vertical.ctaLabel}
          ctaTo={`/opportunities/${vertical.type}/new`}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((listing) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              type={vertical.type}
              closingState={closing[`${vertical.type}:${listing.id}`]}
              onClose={() => onClose(vertical.type, listing.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ListingRow({ listing, type, closingState, onClose }) {
  const statusMeta = STATUS_META[listing.status] || STATUS_META.draft;
  const isConfirming = closingState === 'confirming';
  const isSubmitting = closingState === 'submitting';

  // Type-specific summary line (route for logistics, crop+qty for agri, etc.)
  let extraLine = null;
  if (type === 'logistics_load' && listing.origin_city && listing.destination_city) {
    extraLine = `${listing.origin_city} → ${listing.destination_city}`;
  } else if (type === 'agri_offtake' && listing.crop) {
    extraLine = listing.crop + (listing.quantity_tons ? ` · ${Number(listing.quantity_tons).toLocaleString()}t` : '');
  } else if (type === 'tender' && listing.issuing_authority) {
    extraLine = listing.issuing_authority;
  } else if (type === 'commodity_request' && listing.commodity) {
    extraLine = listing.commodity;
  }

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
          {extraLine && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{extraLine}</div>
          )}
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
        padding: '32px 22px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ivory-50)', marginBottom: 6 }}>{title}</div>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', maxWidth: 440, margin: '0 auto 18px', lineHeight: 1.55 }}>{body}</p>
      <Link to={ctaTo} className="btn btn-ghost-light" style={{ fontSize: 12, padding: '8px 16px' }}>
        <Plus size={13} /> {ctaLabel}
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
