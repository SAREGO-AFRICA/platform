import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  MapPin,
  TrendingUp,
  Layers,
  Lock,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { api, getAccessToken } from '../lib/api.js';

export default function ProjectDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [interestOpen, setInterestOpen] = useState(false);
  const [interestSubmitted, setInterestSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api(`/api/projects/${slug}`);
        if (!cancelled) setProject(data.project);
        if (getAccessToken()) {
          try {
            const me = await api('/api/auth/me');
            if (!cancelled) setUser(me.user);
          } catch { /* not signed in */ }
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ivory-50)' }}>
        <Header variant="light" />
        <div className="container" style={{ paddingTop: 80 }}>
          <div className="muted text-sm">Loading project…</div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ivory-50)' }}>
        <Header variant="light" />
        <div className="container" style={{ paddingTop: 80 }}>
          <h2>Project not found</h2>
          <p className="muted">{error || 'This project may have been archived or is not yet published.'}</p>
          <Link to="/" className="btn btn-ghost" style={{ marginTop: 24 }}>
            <ArrowLeft size={14} /> Back to Pipeline
          </Link>
        </div>
      </div>
    );
  }

  const sectors = Array.isArray(project.sectors) ? project.sectors : [];
  const isInvestor = user?.role === 'investor';
  const isOwner = !!user && project.owner_user_id === user.id;
  const tierVerified = user && ['verified', 'institutional'].includes(user.trust_tier);

  return (
    <div style={{ background: 'var(--ivory-50)', minHeight: '100vh' }}>
      <Header variant="light" />

      {/* Header band */}
      <section style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-5)' }}>
        <div className="container">
          <Link
            to="/"
            className="text-xs uppercase muted fade-up"
            style={{ letterSpacing: '0.16em', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={12} /> Pipeline
          </Link>

          <div
            className="flex items-center gap-3 fade-up fade-up-1"
            style={{ marginTop: 22, fontSize: 14, color: 'var(--fg-muted)', flexWrap: 'wrap' }}
          >
            <span style={{ fontSize: 18 }}>{project.flag_emoji}</span>
            <span>{project.country_name}</span>
            {project.location_text && <><span>·</span><span>{project.location_text}</span></>}
            <span>·</span>
            <span
              className="mono"
              style={{ color: 'var(--gold-700)', textTransform: 'uppercase', letterSpacing: '0.14em', fontSize: 11 }}
            >
              {project.stage}
            </span>
          </div>

          <h1
            className="display fade-up fade-up-2"
            style={{ marginTop: 16, fontSize: 'clamp(38px, 5vw, 68px)', fontWeight: 500, maxWidth: 1000 }}
          >
            {project.title}
          </h1>

          <p
            className="fade-up fade-up-3"
            style={{ marginTop: 22, fontSize: 18, color: 'var(--fg-muted)', maxWidth: 760, lineHeight: 1.6 }}
          >
            {project.summary}
          </p>
        </div>
      </section>

      <hr className="gold-rule" style={{ maxWidth: 1320, marginInline: 'auto' }} />

      {/* Stats strip */}
      <section style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-8)' }}>
        <div className="container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              border: '1px solid var(--border)',
              background: 'var(--bg-elev)',
            }}
            data-stats-grid
          >
            <Stat label="Capital Required" value={formatUSD(project.capital_required_usd)} />
            <Stat
              label="Capital Committed"
              value={formatUSD(project.capital_committed_usd)}
              hint={
                project.capital_required_usd > 0
                  ? `${Math.round((project.capital_committed_usd / project.capital_required_usd) * 100)}%`
                  : ''
              }
            />
            <Stat
              label="Target IRR"
              value={project.expected_irr_pct ? `${Number(project.expected_irr_pct).toFixed(1)}%` : '—'}
              accent
            />
            <Stat label="Stage" value={titleCase(project.stage)} />
          </div>
        </div>
      </section>

      {/* Body grid */}
      <section style={{ paddingBottom: 'var(--space-12)' }}>
        <div
          className="container"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 1fr',
            gap: 'var(--space-8)',
          }}
          data-body-grid
        >
          {/* Left column: description */}
          <div>
            <div className="eyebrow">Project Description</div>
            <h2 style={{ marginTop: 12, fontSize: 'clamp(24px, 3vw, 32px)' }}>
              Investment <span style={{ fontStyle: 'italic' }}>thesis & structure.</span>
            </h2>
            <div
              style={{
                marginTop: 24,
                fontSize: 16,
                lineHeight: 1.75,
                color: 'var(--fg)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {project.description || (
                <span className="muted italic">
                  Detailed project description is available within the deal room upon verified
                  investor onboarding.
                </span>
              )}
            </div>

            {sectors.length > 0 && (
              <div style={{ marginTop: 'var(--space-6)' }}>
                <div className="eyebrow" style={{ marginBottom: 12 }}>Sectors</div>
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                  {sectors.map((s) => (
                    <span key={s.slug} className="pill">{s.name}</span>
                  ))}
                </div>
              </div>
            )}

            <DealRoomTeaser tierVerified={tierVerified} isInvestor={isInvestor} signedIn={!!user} />
          </div>

          {/* Right rail: action card */}
          <aside>
            <div
              className="card card-dark"
              style={{ position: 'sticky', top: 100, padding: 0 }}
            >
              <div style={{ padding: 22, borderBottom: '1px solid var(--ink-800)' }}>
                <div className="eyebrow" style={{ color: 'var(--gold-400)' }}>Counterparty</div>
                <div style={{ marginTop: 10, fontSize: 18, color: 'var(--ivory-50)', fontFamily: 'var(--font-display)' }}>
                  {project.organization_name || 'SAREGO Verified Sponsor'}
                </div>
                <div className="flex items-center gap-2" style={{ marginTop: 8, color: 'var(--ink-300)', fontSize: 12 }}>
                  <ShieldCheck size={14} color="var(--gold-400)" />
                  Verified by SAREGO
                </div>
              </div>

              <div style={{ padding: 22 }}>
                {isOwner ? (
                  <SponsorInterestsPanel projectId={project.id} />
                ) : !user ? (
                  <>
                    <p style={{ fontSize: 14, color: 'var(--ink-300)', margin: 0, lineHeight: 1.6 }}>
                      Sign in as a verified investor to express interest and request access to the deal room.
                    </p>
                    <Link
                      to="/login"
                      className="btn btn-gold"
                      style={{ marginTop: 18, width: '100%', justifyContent: 'center' }}
                    >
                      Sign In <ArrowUpRight size={14} />
                    </Link>
                  </>
                ) : !isInvestor ? (
                  <p style={{ fontSize: 14, color: 'var(--ink-300)', margin: 0, lineHeight: 1.6 }}>
                    Your account role doesn't allow expressing investor interest. Switch to an
                    investor profile to engage with this project.
                  </p>
                ) : interestSubmitted ? (
                  <>
                    <ShieldCheck size={28} color="var(--gold-400)" />
                    <h3 style={{ color: 'var(--ivory-50)', fontSize: 22, marginTop: 14 }}>Interest received.</h3>
                    <p style={{ color: 'var(--ink-300)', fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
                      The sponsor will be notified. If approved, you will receive a deal room invitation by email.
                    </p>
                  </>
                ) : !tierVerified ? (
                  <>
                    <Lock size={20} color="var(--gold-400)" />
                    <h3 style={{ color: 'var(--ivory-50)', fontSize: 18, marginTop: 12 }}>Verified tier required</h3>
                    <p style={{ color: 'var(--ink-300)', fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
                      Expressing interest requires verified KYC standing. Complete onboarding to unlock.
                    </p>
                    <Link
                      to="/dashboard"
                      className="btn btn-ghost-light"
                      style={{ marginTop: 18, width: '100%', justifyContent: 'center', fontSize: 12 }}
                    >
                      Complete KYC <ArrowUpRight size={14} />
                    </Link>
                  </>
                ) : !interestOpen ? (
                  <>
                    <p style={{ fontSize: 14, color: 'var(--ink-300)', margin: 0, lineHeight: 1.6 }}>
                      Express interest to signal commitment. The sponsor will review and may invite you into the deal room.
                    </p>
                    <button
                      onClick={() => setInterestOpen(true)}
                      className="btn btn-gold"
                      style={{ marginTop: 18, width: '100%', justifyContent: 'center' }}
                    >
                      Express Interest <ArrowUpRight size={14} />
                    </button>
                  </>
                ) : (
                  <InterestForm
                    projectId={project.id}
                    onSubmitted={() => {
                      setInterestSubmitted(true);
                      setInterestOpen(false);
                    }}
                  />
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <Footer />

      <style>{`
        @media (max-width: 880px) {
          [data-body-grid] {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 540px) {
          [data-stats-grid] {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

/* =========== Sponsor-side: Investor Interest panel + Open Deal Room modal =========== */

function SponsorInterestsPanel({ projectId }) {
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalInterest, setModalInterest] = useState(null);

  useEffect(() => { load(); }, [projectId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api(`/api/projects/${projectId}/interests`);
      setInterests(data.interests || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="eyebrow" style={{ color: 'var(--gold-400)', marginBottom: 10 }}>
        Your Project
      </div>
      <h3 style={{ color: 'var(--ivory-50)', fontSize: 18, marginTop: 0, marginBottom: 10 }}>
        Investor Interest
      </h3>
      <p style={{ fontSize: 13, color: 'var(--ink-300)', lineHeight: 1.6, marginBottom: 16 }}>
        Verified investors who have signalled interest in this project. Open a deal room to share due-diligence documents.
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--ink-300)' }}>Loading...</p>
      ) : error ? (
        <p style={{ fontSize: 13, color: '#f0c5a8' }}>{error}</p>
      ) : interests.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-300)' }}>No interests received yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {interests.map((i) => (
            <SponsorInterestRow
              key={i.id}
              interest={i}
              onOpen={() => setModalInterest(i)}
            />
          ))}
        </ul>
      )}

      {modalInterest && (
        <OpenDealRoomModal
          interest={modalInterest}
          onClose={() => setModalInterest(null)}
          onCreated={async () => {
            setModalInterest(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function SponsorInterestRow({ interest, onOpen }) {
  const navigate = useNavigate();
  const tierEligible = ['verified', 'institutional'].includes(interest.trust_tier);
  const hasRoom = !!interest.existing_room_id;

  return (
    <li
      style={{
        background: 'var(--ink-950)',
        border: '1px solid var(--ink-800)',
        padding: 14,
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ivory-50)' }}>
        {interest.full_name}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-300)', marginTop: 2 }}>
        {interest.email}
        {interest.organization_name ? ` - ${interest.organization_name}` : ''}
      </div>
      {interest.ticket_usd && (
        <div style={{ fontSize: 12, color: 'var(--gold-400)', marginTop: 6 }}>
          Ticket: ${(interest.ticket_usd / 1_000_000).toLocaleString()}M
        </div>
      )}
      {interest.message && (
        <div style={{ fontSize: 12, color: 'var(--ink-300)', marginTop: 8, fontStyle: 'italic', lineHeight: 1.5 }}>
          "{interest.message}"
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        {hasRoom ? (
          <button
            type="button"
            onClick={() => navigate(`/deal-rooms/${interest.existing_room_id}`)}
            className="btn btn-ghost-light"
            style={{ fontSize: 12, width: '100%', justifyContent: 'center' }}
          >
            Open existing deal room <ArrowUpRight size={12} />
          </button>
        ) : !tierEligible ? (
          <div style={{ fontSize: 11, color: 'var(--ink-300)', fontStyle: 'italic' }}>
            Investor not yet KYC-verified.
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="btn btn-gold"
            style={{ fontSize: 12, width: '100%', justifyContent: 'center' }}
          >
            Open Deal Room <ArrowUpRight size={12} />
          </button>
        )}
      </div>
    </li>
  );
}

function OpenDealRoomModal({ interest, onClose, onCreated }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api('/api/deal-rooms', {
        method: 'POST',
        body: JSON.stringify({
          investment_interest_id: interest.id,
          name: name.trim() || undefined,
          description: description.trim() || undefined,
        }),
      });
      if (onCreated) await onCreated();
      if (data.room?.id) navigate(`/deal-rooms/${data.room.id}`);
    } catch (e2) {
      setError(e2.message || 'Failed to open deal room.');
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: 'var(--ink-900)',
          border: '1px solid var(--ink-800)',
          borderRadius: 12,
          padding: 28,
          maxWidth: 460,
          width: '100%',
          color: 'var(--ivory-50)',
        }}
      >
        <h3 style={{ fontSize: 20, marginTop: 0, marginBottom: 10 }}>Open Deal Room</h3>
        <p style={{ fontSize: 13, color: 'var(--ink-300)', lineHeight: 1.6, marginBottom: 18 }}>
          {interest.full_name} will be added as an editor and can immediately upload documents.
        </p>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--ink-300)' }}>
          Room name (optional)
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          placeholder="Defaults to project title"
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 13,
            borderRadius: 6,
            border: '1px solid var(--ink-700)',
            background: 'var(--ink-950)',
            color: 'var(--ivory-50)',
            marginBottom: 14,
            fontFamily: 'inherit',
          }}
        />

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--ink-300)' }}>
          Welcome note (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
          rows={3}
          placeholder="Any context for the investor on what to expect..."
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: 13,
            borderRadius: 6,
            border: '1px solid var(--ink-700)',
            background: 'var(--ink-950)',
            color: 'var(--ivory-50)',
            marginBottom: 18,
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />

        {error && (
          <div style={{ padding: 10, background: 'rgba(163, 82, 46, 0.15)', color: '#f0c5a8', fontSize: 13, borderLeft: '2px solid var(--rust-600)', marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-ghost-light" style={{ fontSize: 13 }}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn btn-gold" style={{ fontSize: 13 }}>
            {busy ? 'Opening...' : 'Open Deal Room'}
          </button>
        </div>
      </form>
    </div>
  );
}
/* ============================ Subcomponents ============================ */

function Stat({ label, value, hint, accent }) {
  return (
    <div
      style={{
        padding: '24px 22px',
        borderRight: '1px solid var(--border)',
      }}
    >
      <div className="text-xs uppercase muted" style={{ letterSpacing: '0.14em' }}>{label}</div>
      <div
        className="mono"
        style={{
          fontSize: 26,
          fontWeight: 500,
          marginTop: 8,
          color: accent ? 'var(--gold-700)' : 'var(--ink-950)',
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </div>
      {hint && (
        <div className="text-xs muted" style={{ marginTop: 4 }}>
          {hint} of target
        </div>
      )}
    </div>
  );
}

function DealRoomTeaser({ tierVerified, isInvestor, signedIn }) {
  return (
    <div
      style={{
        marginTop: 'var(--space-8)',
        padding: 'var(--space-6)',
        background: 'var(--ivory-100)',
        borderLeft: '3px solid var(--gold-600)',
      }}
    >
      <div className="flex items-center gap-3">
        <FileText size={20} color="var(--gold-700)" strokeWidth={1.4} />
        <div className="eyebrow">Deal Room</div>
      </div>
      <h3 style={{ fontSize: 22, marginTop: 12 }}>
        Detailed financials & technical documents
      </h3>
      <p className="muted" style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, maxWidth: 580 }}>
        Information memoranda, financial models, technical due diligence, and counterparty
        agreements are accessible from a verified deal room — granted on a case-by-case basis
        once interest is mutually confirmed.
      </p>
      {!signedIn || !tierVerified || !isInvestor ? (
        <div className="flex items-center gap-2 muted text-xs" style={{ marginTop: 16, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          <Lock size={12} /> Access gated by verification tier
        </div>
      ) : (
        <a href="#" className="btn btn-ghost" style={{ marginTop: 18, fontSize: 12 }}>
          Request Access <ArrowUpRight size={14} />
        </a>
      )}
    </div>
  );
}

function InterestForm({ projectId, onSubmitted }) {
  const [ticket, setTicket] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/projects/${projectId}/interest`, {
        method: 'POST',
        body: JSON.stringify({
          ticket_usd: ticket ? parseInt(ticket, 10) * 1_000_000 : undefined,
          message: message || undefined,
        }),
      });
      onSubmitted();
    } catch (err) {
      setError(err.message || 'Submission failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="label" style={{ color: 'var(--ink-300)' }}>Indicative ticket (USD millions)</label>
      <input
        className="input"
        type="number"
        min="1"
        value={ticket}
        onChange={(e) => setTicket(e.target.value)}
        placeholder="e.g. 25"
        style={{ background: 'var(--ink-950)', color: 'var(--ivory-50)', borderColor: 'var(--ink-700)' }}
      />
      <label className="label" style={{ color: 'var(--ink-300)', marginTop: 16 }}>Message (optional)</label>
      <textarea
        className="textarea"
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Aligned with our infrastructure mandate..."
        style={{ background: 'var(--ink-950)', color: 'var(--ivory-50)', borderColor: 'var(--ink-700)', resize: 'vertical' }}
      />
      {error && (
        <div style={{ marginTop: 12, padding: 10, fontSize: 12, color: '#f0c5a8', borderLeft: '2px solid var(--rust-600)' }}>
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={busy}
        className="btn btn-gold"
        style={{ marginTop: 18, width: '100%', justifyContent: 'center' }}
      >
        {busy ? 'Submitting…' : 'Submit Interest'}
        {!busy && <ArrowUpRight size={14} />}
      </button>
    </form>
  );
}

/* ============================ Helpers ============================ */
function formatUSD(value) {
  const v = Number(value);
  if (!v) return '$—';
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function titleCase(s) {
  return s
    .split(/[_\s]+/)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
