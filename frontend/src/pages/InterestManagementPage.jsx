// ============================================================
// InterestManagementPage.jsx
// Session H Phase 3: owner-side interest management
//
// Route: /my-listings/:listing_type/:listing_id/interest
//
// Generic component — reused across all 5 verticals. Listing type and
// vertical-specific affordances handled inline by checking listing_type.
//
// Auth: page assumes user is authenticated. The backend will 403 if the
// requester doesn't own the listing, and we render that as a clean error.
// ============================================================
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  MapPin,
  Building2,
  Sparkles,
  ShieldCheck,
  Award,
  XCircle,
  Phone,
  Clock,
  Loader2,
  AlertCircle,
  Trophy,
} from 'lucide-react';

// ============================================================
// Constants
// ============================================================
const LISTING_TYPE_LABELS = {
  commodity_request: 'Commodity Request',
  logistics_load:    'Logistics Load',
  agri_offtake:      'Agri Offtake',
  tender:            'Tender',
  trade_finance:     'Trade Finance',
};

const STATUS_META = {
  expressed:   { label: 'Expressed',   color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.10)',  border: 'rgba(245, 158, 11, 0.3)' },
  shortlisted: { label: 'Shortlisted', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.10)',   border: 'rgba(6, 182, 212, 0.3)' },
  contacted:   { label: 'Contacted',   color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.10)', border: 'rgba(167, 139, 250, 0.3)' },
  declined:    { label: 'Declined',    color: '#6b7280', bg: 'rgba(107, 114, 128, 0.10)', border: 'rgba(107, 114, 128, 0.3)' },
  awarded:     { label: 'Awarded',     color: '#84cc16', bg: 'rgba(132, 204, 22, 0.10)',  border: 'rgba(132, 204, 22, 0.4)' },
  withdrawn:   { label: 'Withdrawn',   color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.10)', border: 'rgba(156, 163, 175, 0.3)' },
};

const STATUSES_REVEALING_CONTACT = ['shortlisted', 'contacted', 'awarded'];

// What action buttons to show given current status
function getActions(status) {
  switch (status) {
    case 'expressed':   return ['shortlist', 'decline'];
    case 'shortlisted': return ['contact', 'decline', 'award'];
    case 'contacted':   return ['decline', 'award'];
    case 'declined':    return [];
    case 'awarded':     return [];
    case 'withdrawn':   return [];
    default:            return [];
  }
}

// Backend status target for each UI action
const ACTION_TO_STATUS = {
  shortlist: 'shortlisted',
  contact:   'contacted',
  decline:   'declined',
  award:     'awarded',
};

// ============================================================
// Helpers
// ============================================================
function formatRelative(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1)   return 'just now';
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24)   return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30)  return `${diffDay}d ago`;
  const diffMo = Math.round(diffDay / 30);
  return `${diffMo}mo ago`;
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status];
  if (!meta) return null;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 10px',
      borderRadius: 999,
      background: meta.bg,
      border: `1px solid ${meta.border}`,
      color: meta.color,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    }}>
      {meta.label}
    </span>
  );
}

function TierPill({ tier }) {
  if (tier === 'institutional') {
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
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: 0.3,
      }}>
        <Sparkles size={10} /> Institutional
      </span>
    );
  }
  if (tier === 'verified') {
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
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: 0.3,
      }}>
        <ShieldCheck size={10} /> Verified
      </span>
    );
  }
  return null;
}

// ============================================================
// Action Buttons
// ============================================================
function ActionButton({ action, onClick, busy }) {
  const config = {
    shortlist: { label: 'Shortlist', icon: Eye,         color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.10)',   border: 'rgba(6, 182, 212, 0.4)' },
    contact:   { label: 'Mark Contacted', icon: Phone,  color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.10)', border: 'rgba(167, 139, 250, 0.4)' },
    decline:   { label: 'Decline',   icon: XCircle,     color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.10)', border: 'rgba(156, 163, 175, 0.4)' },
    award:     { label: 'Award',     icon: Trophy,      color: '#84cc16', bg: 'rgba(132, 204, 22, 0.12)',  border: 'rgba(132, 204, 22, 0.5)' },
  }[action];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 6,
        background: config.bg,
        border: `1px solid ${config.border}`,
        color: config.color,
        fontSize: 13,
        fontWeight: 500,
        cursor: busy ? 'wait' : 'pointer',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <Icon size={13} />
      {config.label}
    </button>
  );
}

// ============================================================
// Decline Reason Modal
// ============================================================
function DeclineReasonModal({ open, onConfirm, onCancel, reasonRequired, busy }) {
  const [reason, setReason] = useState('');
  if (!open) return null;
  const canSubmit = !reasonRequired || (reason && reason.trim().length > 0);
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20,
    }}>
      <div style={{
        background: '#161a1f',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 24,
        maxWidth: 500,
        width: '100%',
      }}>
        <h3 style={{ margin: 0, marginBottom: 12, fontSize: 18, color: '#fff' }}>
          Decline this party?
        </h3>
        <p style={{ margin: 0, marginBottom: 16, fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
          {/* SAREGO-DECLINE-OPTIONAL: simplified copy */}
          Optionally provide a reason for your records. The declined party will not see it.

        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={reasonRequired ? 'Reason (required)' : 'Reason (optional)'}
          rows={3}
          maxLength={500}
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 6,
            background: 'rgba(11,13,16,0.8)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff',
            fontSize: 14,
            fontFamily: 'inherit',
            resize: 'vertical',
            marginBottom: 16,
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => { setReason(''); onCancel(); }}
            disabled={busy}
            style={{
              padding: '8px 16px', borderRadius: 6,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim() || null)}
            disabled={!canSubmit || busy}
            style={{
              padding: '8px 16px', borderRadius: 6,
              background: 'rgba(156, 163, 175, 0.15)',
              border: '1px solid rgba(156, 163, 175, 0.4)',
              color: '#d1d5db', fontSize: 13, fontWeight: 500,
              cursor: (canSubmit && !busy) ? 'pointer' : 'not-allowed',
              opacity: (canSubmit && !busy) ? 1 : 0.5,
            }}
          >
            {busy ? 'Declining…' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Award Confirmation Modal
// ============================================================
function AwardConfirmModal({ open, partyName, otherCount, onConfirm, onCancel, busy }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20,
    }}>
      <div style={{
        background: '#161a1f',
        border: '1px solid rgba(132, 204, 22, 0.5)',
        borderRadius: 12,
        padding: 24,
        maxWidth: 540,
        width: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Trophy size={22} color="#84cc16" />
          <h3 style={{ margin: 0, fontSize: 18, color: '#fff' }}>
            Award this opportunity?
          </h3>
        </div>
        <p style={{ margin: 0, marginBottom: 12, fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
          You're about to award this opportunity to <strong style={{ color: '#fff' }}>{partyName}</strong>.
        </p>
        <p style={{ margin: 0, marginBottom: 16, fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
          This will <strong style={{ color: '#f4bf4c' }}>automatically decline {otherCount} other interested {otherCount === 1 ? 'party' : 'parties'}</strong> and close the listing as fulfilled.
        </p>
        <p style={{ margin: 0, marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          This action is irreversible.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '8px 16px', borderRadius: 6,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: '8px 16px', borderRadius: 6,
              background: 'rgba(132, 204, 22, 0.2)',
              border: '1px solid rgba(132, 204, 22, 0.5)',
              color: '#84cc16', fontSize: 13, fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? 'Awarding…' : 'Confirm Award'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Interest Card
// ============================================================
function InterestCard({ interest, onAction, busy }) {
  const meta = STATUS_META[interest.status];
  const actions = getActions(interest.status);
  const revealContact = STATUSES_REVEALING_CONTACT.includes(interest.status);
  const transitionTime = interest.timestamps?.[`${interest.status}_at`] || interest.created_at;

  return (
    <div style={{
      background: 'rgba(20, 22, 26, 0.6)',
      border: `1px solid ${interest.status === 'awarded' ? meta?.border : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 12,
      padding: 20,
    }}>
      {/* Top row: identity + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 22,
          background: 'rgba(244, 191, 76, 0.15)',
          color: '#f4bf4c',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 600, flexShrink: 0,
        }}>
          {(interest.user?.full_name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>
              {interest.user?.full_name || 'Unknown party'}
            </span>
            <TierPill tier={interest.user?.trust_tier} />
          </div>
          {interest.organization && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              <Building2 size={12} />
              <span>{interest.organization.name}</span>
              {interest.organization.country_iso && (
                <>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <MapPin size={12} />
                  <span>{interest.organization.country_iso}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <StatusBadge status={interest.status} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            <Clock size={10} style={{ marginRight: 2 }} />
            {formatRelative(transitionTime)}
          </span>
        </div>
      </div>

      {/* Message body */}
      {interest.message && (
        <div style={{
          padding: 12,
          background: 'rgba(11,13,16,0.5)',
          borderRadius: 6,
          fontSize: 13,
          color: 'rgba(255,255,255,0.7)',
          lineHeight: 1.5,
          marginBottom: 12,
        }}>
          {interest.message}
        </div>
      )}

      {/* Indicative terms (if any — future-proofed for Session I+) */}
      {/* SAREGO-CONDITIONS-FIX */}
      {(interest.indicative?.amount || interest.indicative?.rate_range || interest.indicative?.tenor || interest.indicative?.conditions) && (
        <div style={{
          padding: 12,
          background: 'rgba(192, 132, 252, 0.06)',
          border: '1px solid rgba(192, 132, 252, 0.2)',
          borderRadius: 6,
          fontSize: 12,
          color: 'rgba(255,255,255,0.7)',
          marginBottom: 12,
          lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 10, color: '#c084fc', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>
            Indicative Terms
          </div>
          {interest.indicative.amount != null && <div>Amount: ${Number(interest.indicative.amount).toLocaleString()}</div>}
          {interest.indicative.rate_range && <div>Rate: {interest.indicative.rate_range}</div>}
          {interest.indicative.tenor && <div>Tenor: {interest.indicative.tenor}</div>}
          {interest.indicative.conditions && (
            <div style={{ marginTop: 6 }}>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>Conditions: </span>
              {interest.indicative.conditions}
            </div>
          )}
        </div>
      )}

      {/* Contact info */}
      <div style={{
        padding: 10,
        background: revealContact ? 'rgba(244, 191, 76, 0.06)' : 'rgba(11,13,16,0.5)',
        borderRadius: 6,
        border: revealContact ? '1px solid rgba(244, 191, 76, 0.2)' : '1px solid rgba(255,255,255,0.05)',
        fontSize: 13,
        marginBottom: actions.length > 0 ? 14 : 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <Mail size={14} color={revealContact ? '#f4bf4c' : 'rgba(255,255,255,0.4)'} />
        {revealContact ? (
          <a href={`mailto:${interest.user.email}`} style={{ color: '#f4bf4c', textDecoration: 'none' }}>
            {interest.user.email}
          </a>
        ) : (
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>
            <EyeOff size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Shortlist this party to reveal contact details
          </span>
        )}
      </div>

      {/* Decline reason (when applicable) */}
      {interest.status === 'declined' && interest.declined_reason && (
        <div style={{
          padding: 10,
          background: 'rgba(156, 163, 175, 0.08)',
          borderRadius: 6,
          fontSize: 12,
          color: 'rgba(255,255,255,0.6)',
          marginBottom: actions.length > 0 ? 14 : 0,
          fontStyle: 'italic',
        }}>
          <strong style={{ color: 'rgba(255,255,255,0.7)', fontStyle: 'normal' }}>Reason:</strong> {interest.declined_reason}
        </div>
      )}

      {/* Action row */}
      {actions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {actions.map((action) => (
            <ActionButton
              key={action}
              action={action}
              onClick={() => onAction(action, interest)}
              busy={busy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Status Summary Tiles
// ============================================================
function SummaryTiles({ counts }) {
  const tiles = [
    { key: 'expressed',   label: 'Expressed' },
    { key: 'shortlisted', label: 'Shortlisted' },
    { key: 'contacted',   label: 'Contacted' },
    { key: 'declined',    label: 'Declined' },
    { key: 'awarded',     label: 'Awarded' },
  ];
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 12,
      marginBottom: 32,
    }}>
      {tiles.map((tile) => {
        const count = counts[tile.key] || 0;
        const meta = STATUS_META[tile.key];
        return (
          <div key={tile.key} style={{
            padding: 16,
            background: 'rgba(20, 22, 26, 0.6)',
            border: `1px solid ${count > 0 ? meta.border : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 10,
          }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: count > 0 ? meta.color : 'rgba(255,255,255,0.3)' }}>
              {count}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>
              {tile.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Main Page Component
// ============================================================
export default function InterestManagementPage() {
  const { listing_type, listing_id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionBusy, setActionBusy] = useState(null); // interest_id of currently-acting row
  const [declineModal, setDeclineModal] = useState(null); // { interest, reasonRequired }
  const [awardModal, setAwardModal] = useState(null); // { interest }
  const [successBanner, setSuccessBanner] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api(`/api/my-listings/${listing_type}/${listing_id}/interest`);
      setData(res);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load interest data');
      setLoading(false);
    }
  }, [listing_type, listing_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Action handler
  const handleAction = useCallback(async (action, interest) => {
    const targetStatus = ACTION_TO_STATUS[action];

    // SAREGO-DECLINE-OPTIONAL
    // Decline: open modal (reason always optional - kept in owner records only, never emailed)
    if (action === 'decline') {
      setDeclineModal({ interest, reasonRequired: false });
      return;
    }
    // Award: open confirmation modal
    if (action === 'award') {
      setAwardModal({ interest });
      return;
    }

    // Direct actions (shortlist, contact) — no modal
    setActionBusy(interest.id);
    try {
      await api(`/api/my-listings/${listing_type}/${listing_id}/interest/${interest.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: targetStatus }),
      });
      setSuccessBanner(`${interest.user.full_name} marked as ${targetStatus}.`);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setActionBusy(null);
    }
  }, [listing_type, listing_id, fetchData]);

  const handleDeclineConfirm = useCallback(async (reason) => {
    const { interest } = declineModal;
    setActionBusy(interest.id);
    try {
      await api(`/api/my-listings/${listing_type}/${listing_id}/interest/${interest.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'declined', declined_reason: reason || undefined }),
      });
      setSuccessBanner(`${interest.user.full_name} declined.`);
      setDeclineModal(null);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Decline failed');
    } finally {
      setActionBusy(null);
    }
  }, [declineModal, listing_type, listing_id, fetchData]);

  const handleAwardConfirm = useCallback(async () => {
    const { interest } = awardModal;
    setActionBusy(interest.id);
    try {
      await api(`/api/my-listings/${listing_type}/${listing_id}/interest/${interest.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'awarded' }),
      });
      // Q9 = (b): redirect to /my-listings after award
      navigate('/my-listings', {
        state: { awardedMessage: `${interest.user.full_name} was awarded the opportunity. Listing closed as fulfilled.` }
      });
    } catch (err) {
      setError(err.message || 'Award failed');
      setActionBusy(null);
    }
  }, [awardModal, listing_type, listing_id, navigate]);

  const listingTitle = data?.listing?.title || 'Listing';
  const listingTypeLabel = LISTING_TYPE_LABELS[listing_type] || listing_type;

  // Compute "other count" for award modal (excluding terminal states + the to-be-awarded row)
  const otherCount = data?.interests?.filter(i =>
    i.id !== awardModal?.interest?.id &&
    !['declined', 'awarded', 'withdrawn'].includes(i.status)
  ).length || 0;

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
        maxWidth: 1000,
        margin: '0 auto',
        padding: '32px 24px',
        width: '100%',
      }}>
        {/* Back link */}
        <Link to="/my-listings" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'rgba(255,255,255,0.6)',
          textDecoration: 'none',
          fontSize: 13,
          marginBottom: 20,
        }}>
          <ArrowLeft size={14} /> Back to My Listings
        </Link>

        {/* Page header */}
        {!loading && data && (
          <div style={{ marginBottom: 24 }}>
            {/* SAREGO-HISTORICAL-LABEL */}
            <div style={{ fontSize: 11, color: '#f4bf4c', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
              {['fulfilled', 'closed', 'expired'].includes(data.listing.status)
                ? 'Interest History'
                : 'Interest Management'} · {listingTypeLabel}
            </div>
            <h1 style={{
              margin: 0,
              marginBottom: 8,
              fontSize: 28,
              fontWeight: 600,
              fontFamily: 'Georgia, serif',
              letterSpacing: -0.3,
            }}>
              {listingTitle}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
              <span>Listing status:</span>
              <span style={{
                padding: '2px 8px', borderRadius: 4,
                background: data.listing.status === 'fulfilled' ? 'rgba(132, 204, 22, 0.15)' : 'rgba(255,255,255,0.08)',
                color: data.listing.status === 'fulfilled' ? '#84cc16' : 'rgba(255,255,255,0.7)',
                textTransform: 'uppercase', fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
              }}>
                {data.listing.status}
              </span>
            </div>
          </div>
        )}

        {/* Success banner */}
        {successBanner && (
          <div style={{
            marginBottom: 20,
            padding: '10px 16px',
            background: 'rgba(132, 204, 22, 0.10)',
            border: '1px solid rgba(132, 204, 22, 0.3)',
            borderRadius: 8,
            fontSize: 13,
            color: '#84cc16',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <CheckCircle2 size={14} />
            {successBanner}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div style={{
            marginBottom: 20,
            padding: '10px 16px',
            background: 'rgba(239, 68, 68, 0.10)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 8,
            fontSize: 13,
            color: '#fca5a5',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
            <Loader2 size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Loading interest data…
          </div>
        )}

        {/* Summary tiles */}
        {!loading && data && <SummaryTiles counts={data.counts || {}} />}

        {/* Interest list */}
        {!loading && data?.interests?.length === 0 && (
          <div style={{
            padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.5)',
            background: 'rgba(20, 22, 26, 0.4)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
          }}>
            <div style={{ fontSize: 16, marginBottom: 6 }}>No interest yet</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              When parties express interest in this listing, they'll appear here.
            </div>
          </div>
        )}

        {!loading && data?.interests?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data.interests.map((interest) => (
              <InterestCard
                key={interest.id}
                interest={interest}
                onAction={handleAction}
                busy={actionBusy === interest.id}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />

      {/* Modals */}
      <DeclineReasonModal
        open={!!declineModal}
        reasonRequired={declineModal?.reasonRequired || false}
        busy={actionBusy === declineModal?.interest?.id}
        onConfirm={handleDeclineConfirm}
        onCancel={() => setDeclineModal(null)}
      />
      <AwardConfirmModal
        open={!!awardModal}
        partyName={awardModal?.interest?.user?.full_name || ''}
        otherCount={otherCount}
        busy={actionBusy === awardModal?.interest?.id}
        onConfirm={handleAwardConfirm}
        onCancel={() => setAwardModal(null)}
      />
    </div>
  );
}
