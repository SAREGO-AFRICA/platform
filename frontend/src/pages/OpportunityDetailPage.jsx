// SAREGO-TRADE-FINANCE-INTEGRATION
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, MapPin, Calendar, Users, Shield, Clock, FileText,
  Building2, Truck, Package, Sprout, Briefcase, Banknote, AlertCircle, Check, Pencil, Lock,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { api, getAccessToken } from '../lib/api.js';

const TYPE_META = {
  commodity_request: {
    label: 'Commodity Request',
    icon: Package,
    color: '#c97b7b',
    crumb: { trade: 'Trade Hub', section: 'Commodity Requests', sectionPath: '/trade-hub' },
  },
  logistics_load: {
    label: 'Logistics Load',
    icon: Truck,
    color: '#5d8aa8',
    crumb: { trade: 'Trade Hub', section: 'Logistics Loads', sectionPath: '/trade-hub' },
  },
  agri_offtake: {
    label: 'Agricultural Offtake',
    icon: Sprout,
    color: '#7fb069',
    crumb: { trade: 'Trade Hub', section: 'Agri Offtake', sectionPath: '/trade-hub' },
  },
  tender: {
    label: 'Government Tender',
    icon: Briefcase,
    color: '#6ec3c9',
    crumb: { trade: 'For Governments', section: 'Tenders', sectionPath: '/governments' },
  },
  trade_finance: {
    label: 'Trade Finance',
    icon: Banknote,
    color: '#a087d9',
    crumb: { trade: 'Trade Hub', section: 'Trade Finance', sectionPath: '/trade-hub' },
  },
};

const VERIFIED_TIER = {
  unverified:    { label: 'Unverified',    color: '#9aa3b2' },
  basic:         { label: 'Basic',         color: '#9aa3b2' },
  verified:      { label: 'Verified',      color: 'var(--gold-400, #dcc068)' },
  institutional: { label: 'Institutional', color: 'var(--gold-400, #dcc068)' },
};

export default function OpportunityDetailPage() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [closeState, setCloseState] = useState(null); // null | 'confirming' | 'submitting'

  const meta = TYPE_META[type];
  const isLoggedIn = !!getAccessToken();

  useEffect(() => {
    if (!meta) {
      setError('Unknown opportunity type');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [result, meResult] = await Promise.all([
          api(`/api/opportunities/${type}/${id}`),
          isLoggedIn ? api('/api/auth/me').catch(() => null) : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setData(result);
          setMe(meResult?.user || null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load this opportunity');
      }
    })();
    return () => { cancelled = true; };
  }, [type, id, meta, isLoggedIn]);

  async function handleExpressInterest() {
    if (!isLoggedIn) {
      navigate('/login?next=' + encodeURIComponent(`/opportunities/${type}/${id}`));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api(`/api/opportunities/${type}/${id}/interest`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setData((prev) => prev ? {
        ...prev,
        opportunity: { ...prev.opportunity, applicants_count: result.applicants_count },
        userInterest: result.interest,
      } : prev);
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 4000);
    } catch (err) {
      const msg = err.message || 'Could not express interest right now.';
      if (msg.includes('403') || msg.toLowerCase().includes('verified')) {
        setSubmitError('Verified KYC status is required to express interest. Complete KYC to continue.');
      } else {
        setSubmitError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCloseListing() {
    if (closeState !== 'confirming') {
      setCloseState('confirming');
      setTimeout(() => {
        setCloseState((cur) => cur === 'confirming' ? null : cur);
      }, 4000);
      return;
    }

    setCloseState('submitting');
    try {
      const result = await api(`/api/opportunities/${type}/${id}`, { method: 'DELETE' });
      setData((prev) => prev ? {
        ...prev,
        opportunity: { ...prev.opportunity, status: result.opportunity.status },
      } : prev);
      setCloseState(null);
    } catch (err) {
      setSubmitError(err.message || 'Could not close the listing');
      setCloseState(null);
    }
  }

  if (!meta) {
    return <ErrorShell message="Unknown opportunity type" />;
  }
  if (error) {
    return <ErrorShell message={error} />;
  }
  if (!data) {
    return <LoadingShell />;
  }

  const { opportunity: opp, userInterest, owner } = data;
  const Icon = meta.icon;
  const verifiedTier = VERIFIED_TIER[opp.verified_level] || VERIFIED_TIER.unverified;
  const expiresLabel = formatExpiresIn(opp.expires_at);
  const isUrgent = expiresLabel?.urgent;
  const isOwner = me?.id && owner?.id && me.id === owner.id;
  const isClosed = opp.status === 'closed';

  return (
    <div style={{ background: 'var(--ink-950)', color: 'var(--ivory-50)', minHeight: '100vh' }}>
      <Header variant="dark" />

      <div style={{ padding: '24px 0 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="container" style={{ paddingBottom: 16 }}>
          <nav style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>Home</Link>
            <span style={{ opacity: 0.5 }}>/</span>
            <Link to={meta.crumb.sectionPath} style={{ color: 'inherit', textDecoration: 'none' }}>{meta.crumb.trade}</Link>
            <span style={{ opacity: 0.5 }}>/</span>
            <span>{meta.crumb.section}</span>
            <span style={{ opacity: 0.5 }}>/</span>
            <span style={{ color: 'var(--ivory-50)' }}>{opp.title}</span>
          </nav>
        </div>
      </div>

      <section style={{ padding: '48px 0 36px', position: 'relative', overflow: 'hidden' }}>
        <div className="container" style={{ position: 'relative' }}>
          <Link
            to={meta.crumb.sectionPath}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
              color: 'rgba(255,255,255,0.6)', textDecoration: 'none', marginBottom: 24,
            }}
          >
            <ArrowLeft size={14} /> Back to {meta.crumb.section}
          </Link>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', borderRadius: 999,
                background: `${meta.color}1a`, border: `1px solid ${meta.color}40`,
                color: meta.color, fontSize: 11, letterSpacing: '0.08em',
                textTransform: 'uppercase', fontWeight: 500,
              }}
            >
              <Icon size={13} />
              {meta.label}
            </span>
            {verifiedTier.label !== 'Unverified' && (
              <VerifiedBadge tier={verifiedTier} />
            )}
            {isClosed && (
              <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#e2a4a4', border: '1px solid rgba(201,123,123,0.4)', padding: '4px 10px', borderRadius: 999 }}>
                Closed
              </span>
            )}
            {opp.metadata?.demo && (
              <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: 999 }}>
                Demo listing
              </span>
            )}
          </div>

          <h1
            style={{
              fontSize: 'clamp(28px, 4vw, 44px)',
              lineHeight: 1.1, fontWeight: 500, letterSpacing: '-0.015em',
              marginBottom: 18, maxWidth: 900,
            }}
          >
            {opp.title}
          </h1>

          {opp.summary && (
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)', maxWidth: 760 }}>
              {opp.summary}
            </p>
          )}

          <div
            style={{
              marginTop: 36,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 24,
            }}
          >
            {opp.value_usd != null && opp.value_usd > 0 && (
              <Metric label="Indicative Value" value={formatUSDLong(opp.value_usd)} accent="var(--gold-400, #dcc068)" />
            )}
            <Metric label="Country" value={countryDisplay(opp)} icon={<MapPin size={14} />} />
            <ApplicantsMetric count={opp.applicants_count} pulsing />
            {expiresLabel && (
              <Metric label="Closes" value={expiresLabel.text} icon={<Clock size={14} />} urgent={isUrgent} />
            )}
          </div>
        </div>
      </section>

      <section style={{ padding: '20px 0 64px' }}>
        <div className="container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.3fr 1fr',
              gap: 'var(--space-8)',
              alignItems: 'flex-start',
            }}
            data-detail-grid
          >
            <div>
              <Panel title="Listing Detail">
                {renderTypePanel(type, opp)}
              {opp.type === 'trade_finance' && <InstitutionalVisibility id={opp.id} />}
              </Panel>

              {opp.metadata?.tags?.length > 0 && (
                <Panel title="Tags" tight>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {opp.metadata.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 11, padding: '5px 11px', borderRadius: 999,
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'rgba(255,255,255,0.7)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Panel>
              )}
            </div>

            <aside style={{ position: 'sticky', top: 100 }} data-detail-aside>
              {isOwner ? (
                <OwnerRail
                  type={type}
                  opportunityId={id}
                  status={opp.status}
                  applicantsCount={opp.applicants_count}
                  expiresLabel={expiresLabel}
                  closeState={closeState}
                  onClose={handleCloseListing}
                  submitError={submitError}
                />
              ) : (
                <CtaRail
                  isLoggedIn={isLoggedIn}
                  userInterest={userInterest}
                  opportunityType={type}
                  opportunityId={id}
                  submitting={submitting}
                  submitError={submitError}
                  justSubmitted={justSubmitted}
                  onSubmit={handleExpressInterest}
                  applicantsCount={opp.applicants_count}
                  expiresLabel={expiresLabel}
                  isClosed={isClosed}
                />
              )}
            </aside>
          </div>
        </div>
      </section>

      <Footer />

      <style>{`
        @media (max-width: 920px) {
          [data-detail-grid] { grid-template-columns: 1fr !important; }
          [data-detail-aside] { position: static !important; }
        }
      `}</style>
    </div>
  );
}

function renderTypePanel(type, opp) {
  switch (type) {
    case 'commodity_request':
      return (
        <DefinitionList items={[
          ['Commodity',     opp.commodity],
          ['Quantity',      opp.quantity ? `${Number(opp.quantity).toLocaleString()} ${opp.quantity_unit || ''}`.trim() : null],
          ['Incoterms',     opp.incoterms],
          ['Country',       opp.country_iso],
        ]} />
      );
    case 'logistics_load':
      return (
        <DefinitionList items={[
          ['Route',         `${opp.origin_city || opp.origin_country_iso} → ${opp.destination_city || opp.destination_country_iso}`],
          ['Cargo Type',    opp.cargo_type],
          ['Weight',        opp.weight_tons ? `${Number(opp.weight_tons).toLocaleString()} tons` : null],
          ['Load Date',     formatDate(opp.load_date)],
        ]} />
      );
    case 'agri_offtake':
      return (
        <DefinitionList items={[
          ['Crop',          opp.crop],
          ['Quantity',      opp.quantity_tons ? `${Number(opp.quantity_tons).toLocaleString()} tons` : null],
          ['Delivery Window', opp.delivery_window_start && opp.delivery_window_end
            ? `${formatDate(opp.delivery_window_start)} → ${formatDate(opp.delivery_window_end)}` : null],
          ['Country',       opp.country_iso],
        ]} />
      );
    case 'tender':
      return (
        <DefinitionList items={[
          ['Reference',         opp.tender_reference],
          ['Issuing Authority', opp.issuing_authority],
          ['Tender Type',       opp.tender_type],
          ['Submission Deadline', formatDate(opp.submission_deadline)],
          ['Country',           opp.country_iso],
        ]} />
      );
    case 'trade_finance':
      return (
        <DefinitionList items={[
          ['Finance Type',     formatEnumDetail(opp.finance_type)],
          ['Sector',           formatEnumDetail(opp.sector)],
          ['Trade Context',    formatEnumDetail(opp.trade_context)],
          ['Contract Ref',     opp.contract_reference],
          ['Timeline',         formatEnumDetail(opp.finance_timeline)],
          ['Collateral',       formatEnumDetail(opp.collateral_type)],
          ['Origin',           opp.country_iso],
          ['Destination',      opp.destination_country_iso],
        ]} />
      );
    default:
      return <div style={{ color: 'rgba(255,255,255,0.5)' }}>No detail panel for this type.</div>;
  }
}

function Panel({ title, children, tight }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        padding: tight ? '20px 22px' : '28px 30px',
        marginBottom: 20,
      }}
    >
      <div
        style={{
          fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'var(--gold-400, #dcc068)', marginBottom: 18,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function DefinitionList({ items }) {
  return (
    <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '14px 28px' }}>
      {items.filter(([, v]) => v).map(([label, value]) => (
        <React.Fragment key={label}>
          <dt style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{label}</dt>
          <dd style={{ margin: 0, fontSize: 14, color: 'var(--ivory-50)', fontWeight: 500 }}>{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function Metric({ label, value, accent, icon, urgent }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon} {label}
      </div>
      <div
        style={{
          fontSize: 20, fontWeight: 500,
          color: urgent ? '#e2a45e' : (accent || 'var(--ivory-50)'),
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ApplicantsMetric({ count, pulsing }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Users size={14} /> Interested
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {pulsing && (
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#7fb069',
            animation: 'sarego-pulse-applicant 2s infinite',
          }} />
        )}
        <span style={{ fontSize: 20, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
          {count} {count === 1 ? 'company' : 'companies'}
        </span>
      </div>
      <style>{`
        @keyframes sarego-pulse-applicant {
          0%   { box-shadow: 0 0 0 0   rgba(127,176,105,0.6); }
          70%  { box-shadow: 0 0 0 10px rgba(127,176,105, 0);  }
          100% { box-shadow: 0 0 0 0   rgba(127,176,105, 0);  }
        }
      `}</style>
    </div>
  );
}

function VerifiedBadge({ tier }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: 999,
        background: 'rgba(220,192,104,0.1)',
        border: '1px solid rgba(220,192,104,0.35)',
        color: tier.color, fontSize: 11, letterSpacing: '0.08em',
        textTransform: 'uppercase', fontWeight: 500,
        boxShadow: '0 0 12px rgba(220,192,104,0.15)',
      }}
    >
      <Shield size={12} />
      {tier.label}
    </span>
  );
}

// ============================================================
// CTA rail — non-owner viewer (express interest flow)
// ============================================================
function CtaRail({
  isLoggedIn, userInterest, opportunityType, submitting, submitError,
  justSubmitted, onSubmit, applicantsCount, expiresLabel, isClosed,
}) {
  const hasInterest = !!userInterest;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: 26,
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold-400)', marginBottom: 14 }}>
          Engage
        </div>

        {isClosed ? (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, margin: 0 }}>
            This listing is closed. New interest expressions are not accepted.
          </p>
        ) : hasInterest ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, color: '#7fb069' }}>
              <Check size={20} />
              <strong style={{ fontSize: 14 }}>Interest registered</strong>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, margin: 0 }}>
              You expressed interest on {formatDate(userInterest.created_at)}. The listing owner has been notified
              and will contact you if your profile matches their requirements.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, marginTop: 0, marginBottom: 18 }}>
              {!isLoggedIn
                ? 'Sign in with a verified institutional account to express interest in this listing.'
                : 'Register your interest. The listing owner will be notified and may contact you to progress the opportunity.'}
            </p>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="btn btn-gold"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {submitting ? 'Submitting…' : (isLoggedIn ? 'Express Interest' : 'Sign In to Engage')}
            </button>
            <AnimatePresence>
              {submitError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    marginTop: 14, padding: '10px 12px', borderRadius: 6,
                    background: 'rgba(201,123,123,0.1)',
                    border: '1px solid rgba(201,123,123,0.3)',
                    color: '#e2a4a4', fontSize: 12, lineHeight: 1.5,
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}
                >
                  <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                  {submitError}
                  {submitError.toLowerCase().includes('kyc') && (
                    <Link to="/kyc" style={{ color: '#e2a4a4', textDecoration: 'underline', marginLeft: 4 }}>
                      Open KYC →
                    </Link>
                  )}
                </motion.div>
              )}
              {justSubmitted && !submitError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    marginTop: 14, padding: '10px 12px', borderRadius: 6,
                    background: 'rgba(127,176,105,0.1)',
                    border: '1px solid rgba(127,176,105,0.3)',
                    color: '#a8d088', fontSize: 12, lineHeight: 1.5,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <Check size={14} />
                  Interest registered successfully.
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10,
          padding: 22,
          fontSize: 13,
          color: 'rgba(255,255,255,0.7)',
          lineHeight: 1.7,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Interested companies</span>
          <strong style={{ color: 'var(--ivory-50)' }}>{applicantsCount}</strong>
        </div>
        {expiresLabel && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Closes</span>
            <strong style={{ color: expiresLabel.urgent ? '#e2a45e' : 'var(--ivory-50)' }}>
              {expiresLabel.text}
            </strong>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Owner rail — listing owner's controls (edit / close)
// ============================================================
function OwnerRail({ type, opportunityId, status, applicantsCount, expiresLabel, closeState, onClose, submitError }) {
  const isClosed = status === 'closed';
  const isConfirming = closeState === 'confirming';
  const isSubmittingClose = closeState === 'submitting';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: 26,
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold-400)', marginBottom: 14 }}>
          Owner controls
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, marginTop: 0, marginBottom: 18 }}>
          You own this listing. Edit details or close it to new interest. Existing interest expressions are preserved.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link
            to={`/opportunities/${type}/${opportunityId}/edit`}
            className="btn btn-gold"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Pencil size={15} /> Edit listing
          </Link>
          {!isClosed && (
            <button
              onClick={onClose}
              disabled={isSubmittingClose}
              className="btn btn-ghost-light"
              style={{
                width: '100%', justifyContent: 'center',
                ...(isConfirming ? {
                  borderColor: 'rgba(201,123,123,0.5)',
                  color: '#e2a4a4',
                } : {}),
              }}
            >
              <Lock size={14} />
              {isSubmittingClose ? 'Closing…' : isConfirming ? 'Confirm close?' : 'Close listing'}
            </button>
          )}
          {isClosed && (
            <div style={{ fontSize: 12, color: '#e2a4a4', padding: '8px 0', textAlign: 'center' }}>
              This listing is closed.
            </div>
          )}
        </div>
        {submitError && (
          <div style={{
            marginTop: 14, padding: '10px 12px', borderRadius: 6,
            background: 'rgba(201,123,123,0.1)',
            border: '1px solid rgba(201,123,123,0.3)',
            color: '#e2a4a4', fontSize: 12, lineHeight: 1.5,
          }}>
            {submitError}
          </div>
        )}
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10,
          padding: 22,
          fontSize: 13,
          color: 'rgba(255,255,255,0.7)',
          lineHeight: 1.7,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Interested companies</span>
          <strong style={{ color: 'var(--ivory-50)' }}>{applicantsCount}</strong>
        </div>
        {expiresLabel && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Closes</span>
            <strong style={{ color: expiresLabel.urgent ? '#e2a45e' : 'var(--ivory-50)' }}>
              {expiresLabel.text}
            </strong>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingShell() {
  return (
    <div style={{ background: 'var(--ink-950)', color: 'var(--ivory-50)', minHeight: '100vh' }}>
      <Header variant="dark" />
      <div style={{ padding: 80, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
        Loading opportunity…
      </div>
      <Footer />
    </div>
  );
}

function ErrorShell({ message }) {
  return (
    <div style={{ background: 'var(--ink-950)', color: 'var(--ivory-50)', minHeight: '100vh' }}>
      <Header variant="dark" />
      <div style={{ padding: 80, textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>Opportunity not available</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 32 }}>{message}</p>
        <Link to="/" className="btn btn-gold">Back to Home</Link>
      </div>
      <Footer />
    </div>
  );
}

function formatEnumDetail(value) {
  if (!value) return null;
  return value
    .split('_')
    .map((w) => w.toLowerCase() === 'lc' ? 'LC' : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatUSDLong(n) {
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
  if (hours < 24) return { text: `Closes in ${hours} hour${hours === 1 ? '' : 's'}`, urgent: true };
  const days = Math.floor(hours / 24);
  if (days < 7) return { text: `Closes in ${days} day${days === 1 ? '' : 's'}`, urgent: days <= 2 };
  if (days < 30) return { text: `Closes in ${Math.floor(days / 7)} week${days >= 14 ? 's' : ''}`, urgent: false };
  return { text: `Closes ${formatDate(iso)}`, urgent: false };
}

function countryDisplay(opp) {
  if (opp.origin_country_iso && opp.destination_country_iso) {
    return `${opp.origin_country_iso} → ${opp.destination_country_iso}`;
  }
  return opp.country_iso || '—';
}


// ============================================================
// InstitutionalVisibility — Session E
// ============================================================
// Count-only signal showing how many published capital provider profiles
// match the current trade finance request on (finance_type, sector,
// geography, ticket_range). No provider identities exposed per
// "no public directory yet" policy until participation density exists.
// SAREGO-INSTITUTIONAL-VISIBILITY
function InstitutionalVisibility({ id }) {
  const [count, setCount] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api(`/api/opportunities/trade_finance/${id}/matched-providers-count`);
        if (cancelled) return;
        setCount(typeof data.count === 'number' ? data.count : 0);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load institutional visibility');
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (error) return null;       // fail silently — informational panel
  if (count === null) return null; // still loading
  if (count === 0) return null; // don't show empty signal

  return (
    <section style={{
      marginTop: 24,
      padding: '20px 22px',
      background: 'rgba(160,135,217,0.06)',
      border: '1px solid rgba(160,135,217,0.3)',
      borderRadius: 8,
    }}>
      <div style={{
        fontSize: 11,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: '#a087d9',
        marginBottom: 10,
      }}>
        Institutional visibility
      </div>
      <div style={{
        fontSize: 18,
        fontWeight: 500,
        color: 'var(--ivory-50)',
        marginBottom: 6,
        lineHeight: 1.35,
      }}>
        {count} compatible institutional provider{count === 1 ? '' : 's'} identified
      </div>
      <p style={{
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
        lineHeight: 1.55,
        margin: 0,
      }}>
        Mandates align with this request's finance type, sector, geography, and ticket range.
        Capital providers can express interest from their browse view.
      </p>
    </section>
  );
}
