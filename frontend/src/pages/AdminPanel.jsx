import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowLeft,
  ShieldCheck,
  TrendingUp,
  FileText,
  Users,
  ClipboardList,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCw,
  Search,
  ChevronRight,
  X,
  Loader2,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import { api, getAccessToken, setAccessToken } from '../lib/api.js';

const TABS = [
  { id: 'overview', label: 'Overview',     icon: TrendingUp },
  { id: 'projects', label: 'Project Queue', icon: ClipboardList },
  { id: 'kyc',      label: 'KYC Queue',    icon: ShieldCheck },
  { id: 'users',    label: 'Users',        icon: Users },
  { id: 'audit',    label: 'Audit Log',    icon: FileText },
];

export default function AdminPanel() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (!getAccessToken()) {
      navigate('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const me = await api('/api/auth/me');
        if (cancelled) return;
        if (me.user.role !== 'admin') {
          setAuthError('This area is restricted to SAREGO staff.');
        }
        setUser(me.user);
      } catch (err) {
        if (err.status === 401) {
          setAccessToken(null);
          navigate('/login');
          return;
        }
        setAuthError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ink-950)' }}>
        <Header variant="dark" />
        <div className="container" style={{ paddingTop: 80 }}>
          <div style={{ color: 'var(--ink-300)', fontSize: 14 }}>Loading admin console…</div>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ivory-50)' }}>
        <Header variant="light" />
        <div className="container" style={{ paddingTop: 80, maxWidth: 640 }}>
          <h2>Access denied</h2>
          <p className="muted" style={{ marginTop: 16 }}>{authError}</p>
          <Link to="/dashboard" className="btn btn-ghost" style={{ marginTop: 24 }}>
            <ArrowLeft size={14} /> Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--ink-950)', minHeight: '100vh', color: 'var(--ivory-50)' }}>
      <Header variant="dark" />

      {/* Title band */}
      <section style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-5)' }}>
        <div className="container">
          <div className="flex items-center gap-3" style={{ color: 'var(--gold-400)', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
            <ShieldCheck size={14} />
            SAREGO Operations
          </div>
          <h1
            className="display"
            style={{
              marginTop: 12,
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: 500,
              color: 'var(--ivory-50)',
            }}
          >
            Admin <span style={{ fontStyle: 'italic', color: 'var(--gold-400)' }}>console</span>
          </h1>
          <p style={{ marginTop: 12, color: 'var(--ink-300)', fontSize: 14, maxWidth: 640 }}>
            Moderate submissions, verify counterparties, and monitor platform integrity. All
            actions are audit-logged.
          </p>
        </div>
      </section>

      {/* Tab nav */}
      <nav
        style={{
          borderTop: '1px solid var(--ink-800)',
          borderBottom: '1px solid var(--ink-800)',
          background: 'rgba(11, 13, 16, 0.6)',
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 78,
          zIndex: 10,
        }}
      >
        <div className="container">
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '16px 20px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: active ? '2px solid var(--gold-400)' : '2px solid transparent',
                    color: active ? 'var(--gold-400)' : 'var(--ink-300)',
                    fontSize: 13,
                    letterSpacing: '0.06em',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    transition: 'color 150ms',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--ivory-50)'; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--ink-300)'; }}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Tab content */}
      <section style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-12)' }}>
        <div className="container">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'projects' && <ProjectQueueTab />}
          {activeTab === 'kyc'      && <KycQueueTab />}
          {activeTab === 'users'    && <UsersTab />}
          {activeTab === 'audit'    && <AuditLogTab />}
        </div>
      </section>
    </div>
  );
}

/* =====================================================================
   OVERVIEW
   ===================================================================== */
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api('/api/admin/stats');
        setStats(data.stats);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <DarkSpinner />;
  if (err) return <ErrorBox>{err}</ErrorBox>;

  const tiles = [
    { label: 'Total Users', value: stats.total_users, accent: false },
    { label: 'Verified Users', value: stats.verified_users, hint: pct(stats.verified_users, stats.total_users) + ' verified', accent: true },
    { label: 'New This Week', value: stats.new_users_week, hint: 'Past 7 days' },
    { label: 'Active Projects', value: stats.active_projects, accent: true },
    { label: 'Pending Review', value: stats.pending_projects, hint: 'Awaiting moderation', urgent: stats.pending_projects > 0 },
    { label: 'Drafts', value: stats.draft_projects, hint: 'Not yet submitted' },
    { label: 'Pending KYC', value: stats.pending_kyc, hint: 'In verification queue', urgent: stats.pending_kyc > 0 },
    { label: 'Open Interests', value: stats.open_interests, hint: 'Investor signals' },
    { label: 'Active Deal Rooms', value: stats.active_deal_rooms },
  ];

  return (
    <div>
      {/* Total capital headline */}
      <div
        style={{
          padding: 'var(--space-6)',
          border: '1px solid var(--ink-800)',
          background: 'linear-gradient(135deg, rgba(176, 138, 58, 0.08), transparent 60%)',
          marginBottom: 'var(--space-5)',
        }}
      >
        <div className="eyebrow" style={{ color: 'var(--gold-400)' }}>Aggregate Capital On Platform</div>
        <div
          className="display mono"
          style={{
            fontSize: 'clamp(56px, 7vw, 96px)',
            color: 'var(--gold-400)',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            marginTop: 12,
          }}
        >
          {formatUSD(stats.total_capital_usd)}
        </div>
        <div className="text-xs" style={{ color: 'var(--ink-300)', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 12 }}>
          Sum of capital required across all published projects
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 0,
          border: '1px solid var(--ink-800)',
        }}
      >
        {tiles.map((t, idx) => (
          <StatTile key={t.label} {...t} index={idx} />
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, hint, accent, urgent, index }) {
  return (
    <div
      style={{
        padding: '22px',
        borderRight: '1px solid var(--ink-800)',
        borderBottom: '1px solid var(--ink-800)',
        background: 'var(--ink-900)',
        position: 'relative',
      }}
    >
      <div className="text-xs uppercase" style={{ color: 'var(--ink-300)', letterSpacing: '0.14em' }}>
        {label}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 36,
          fontWeight: 500,
          color: accent ? 'var(--gold-400)' : 'var(--ivory-50)',
          marginTop: 10,
          letterSpacing: '-0.01em',
        }}
      >
        {Number(value).toLocaleString()}
      </div>
      {hint && (
        <div
          className="text-xs"
          style={{
            marginTop: 6,
            color: urgent ? 'var(--gold-400)' : 'var(--ink-500)',
            letterSpacing: '0.06em',
          }}
        >
          {urgent && '● '}{hint}
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   PROJECT QUEUE
   ===================================================================== */
function ProjectQueueTab() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [reviewing, setReviewing] = useState(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await api('/api/admin/projects/pending');
      setProjects(data.projects || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleReview(decision, notes) {
    if (!reviewing) return;
    try {
      await api(`/api/admin/projects/${reviewing.id}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, notes: notes || undefined }),
      });
      setReviewing(null);
      await load();
    } catch (e) {
      throw e;  // surfaced inside the drawer
    }
  }

  return (
    <div>
      <SectionHeader
        title="Project moderation"
        subtitle={`${projects.length} project${projects.length === 1 ? '' : 's'} awaiting review`}
        onRefresh={load}
      />

      {loading ? (
        <DarkSpinner />
      ) : err ? (
        <ErrorBox>{err}</ErrorBox>
      ) : projects.length === 0 ? (
        <EmptyDark icon={CheckCircle2} title="Queue is empty" body="All submitted projects have been processed. Submissions will appear here automatically." />
      ) : (
        <div
          style={{
            background: 'var(--ink-900)',
            border: '1px solid var(--ink-800)',
          }}
        >
          {projects.map((p, idx) => (
            <ProjectQueueRow
              key={p.id}
              project={p}
              index={idx}
              onClick={() => setReviewing(p)}
            />
          ))}
        </div>
      )}

      {reviewing && (
        <ProjectReviewDrawer
          project={reviewing}
          onClose={() => setReviewing(null)}
          onDecide={handleReview}
        />
      )}
    </div>
  );
}

function ProjectQueueRow({ project, index, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        background: 'transparent',
        border: 'none',
        borderTop: index === 0 ? 'none' : '1px solid var(--ink-800)',
        color: 'var(--ivory-50)',
        textAlign: 'left',
        cursor: 'pointer',
        padding: '20px 24px',
        display: 'grid',
        gridTemplateColumns: '60px 1fr auto auto auto auto',
        alignItems: 'center',
        gap: 'var(--space-5)',
        fontFamily: 'inherit',
        transition: 'background 150ms',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-800)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      data-admin-row
    >
      <div className="mono" style={{ fontSize: 12, color: 'var(--gold-400)', letterSpacing: '0.14em' }}>
        {String(index + 1).padStart(2, '0')}
      </div>

      <div>
        <div className="text-xs" style={{ color: 'var(--ink-300)', marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>{project.flag_emoji}</span> {project.country_name} · {titleCase(project.stage)}
        </div>
        <div style={{ fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 500, lineHeight: 1.2 }}>
          {project.title}
        </div>
        <div className="text-xs" style={{ color: 'var(--ink-300)', marginTop: 4 }}>
          {project.organization_name || 'Independent'} · {project.owner_name}
        </div>
      </div>

      <div style={{ textAlign: 'right' }} data-hide-narrow>
        <div className="text-xs" style={{ color: 'var(--ink-300)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Capital
        </div>
        <div className="mono" style={{ fontSize: 16, marginTop: 2 }}>
          {formatUSD(project.capital_required_usd)}
        </div>
      </div>

      <div style={{ textAlign: 'right' }} data-hide-narrow>
        <div className="text-xs" style={{ color: 'var(--ink-300)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Tier
        </div>
        <div className="mono" style={{ fontSize: 12, marginTop: 6, color: tierColor(project.owner_tier), textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          {project.owner_tier}
        </div>
      </div>

      <div className="text-xs" style={{ color: 'var(--ink-300)' }} data-hide-narrow>
        {formatRelative(project.created_at)}
      </div>

      <ChevronRight size={16} color="var(--gold-400)" />

      <style>{`
        @media (max-width: 880px) {
          [data-admin-row] {
            grid-template-columns: 40px 1fr auto !important;
          }
          [data-hide-narrow] { display: none !important; }
        }
      `}</style>
    </button>
  );
}

function ProjectReviewDrawer({ project, onClose, onDecide }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const sectors = Array.isArray(project.sectors) ? project.sectors : [];

  async function decide(decision) {
    if (decision === 'reject' && notes.trim().length < 10) {
      setErr('Please provide a reason for the developer (minimum 10 characters).');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onDecide(decision, notes);
    } catch (e) {
      setErr(e.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 200ms ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(100%, 640px)',
          height: '100%',
          background: 'var(--ivory-50)',
          color: 'var(--ink-950)',
          overflowY: 'auto',
          animation: 'slideIn 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            padding: 'var(--space-5)',
            borderBottom: '1px solid var(--ivory-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            background: 'var(--ivory-50)',
            zIndex: 1,
          }}
        >
          <div className="eyebrow">Reviewing project</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6 }}>
            <X size={18} color="var(--ink-950)" />
          </button>
        </div>

        <div style={{ padding: 'var(--space-6)' }}>
          <div className="text-xs" style={{ color: 'var(--fg-muted)', marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>{project.flag_emoji}</span> {project.country_name}
            {project.location_text && <> · {project.location_text}</>}
            <> · {titleCase(project.stage)}</>
          </div>

          <h2 style={{ fontSize: 32, lineHeight: 1.15 }}>{project.title}</h2>

          {/* Owner block */}
          <div
            style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-4)',
              background: 'var(--ivory-100)',
              borderLeft: '3px solid var(--gold-600)',
            }}
          >
            <div className="eyebrow">Submitted by</div>
            <div style={{ marginTop: 6, fontSize: 16, fontWeight: 500 }}>{project.owner_name}</div>
            <div className="text-sm muted" style={{ marginTop: 2 }}>{project.owner_email}</div>
            <div className="text-xs muted" style={{ marginTop: 8, letterSpacing: '0.04em' }}>
              {project.organization_name || 'Independent'} · {titleCase(project.owner_role)} · Tier:{' '}
              <span style={{ color: tierColor(project.owner_tier), fontWeight: 500 }}>{project.owner_tier}</span>
            </div>
          </div>

          {/* Stats */}
          <div
            style={{
              marginTop: 'var(--space-5)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ padding: '14px 16px', borderRight: '1px solid var(--border)' }}>
              <div className="text-xs uppercase muted" style={{ letterSpacing: '0.14em' }}>Capital Required</div>
              <div className="mono" style={{ fontSize: 22, marginTop: 6, fontWeight: 500 }}>
                {formatUSD(project.capital_required_usd)}
              </div>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div className="text-xs uppercase muted" style={{ letterSpacing: '0.14em' }}>Target IRR</div>
              <div className="mono" style={{ fontSize: 22, marginTop: 6, fontWeight: 500, color: 'var(--gold-700)' }}>
                {project.expected_irr_pct ? `${Number(project.expected_irr_pct).toFixed(1)}%` : '—'}
              </div>
            </div>
          </div>

          {/* Sectors */}
          {sectors.length > 0 && (
            <div style={{ marginTop: 'var(--space-5)' }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Sectors</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {sectors.map((s) => <span key={s.slug} className="pill">{s.name}</span>)}
              </div>
            </div>
          )}

          {/* Summary + description */}
          <div style={{ marginTop: 'var(--space-5)' }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Summary</div>
            <p style={{ fontSize: 15, lineHeight: 1.65, margin: 0 }}>{project.summary}</p>
          </div>

          {project.description && (
            <div style={{ marginTop: 'var(--space-5)' }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Full description</div>
              <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                {project.description}
              </p>
            </div>
          )}

          {/* Decision section */}
          <div
            style={{
              marginTop: 'var(--space-8)',
              padding: 'var(--space-5)',
              background: 'var(--bg-elev)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 12 }}>Reviewer decision</div>
            <p className="text-sm muted" style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
              Approval publishes the project to the marketplace. Rejection returns it to the
              owner as a draft with your notes attached.
            </p>

            <label className="label">Notes (required for rejection)</label>
            <textarea
              className="textarea"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Capital structure needs further detail before this can be published…"
              maxLength={2000}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />

            {err && (
              <div style={{ marginTop: 12, padding: 10, background: '#fff5ee', border: '1px solid #f0c5a8', fontSize: 13, color: 'var(--rust-600)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} /> {err}
              </div>
            )}

            <div className="flex gap-3" style={{ marginTop: 18, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => decide('reject')}
                disabled={busy}
                className="btn btn-ghost"
                style={{ flex: 1, justifyContent: 'center', minWidth: 160 }}
              >
                <XCircle size={14} />
                Reject & Return
              </button>
              <button
                type="button"
                onClick={() => decide('approve')}
                disabled={busy}
                className="btn btn-gold"
                style={{ flex: 1, justifyContent: 'center', minWidth: 160 }}
              >
                <CheckCircle2 size={14} />
                {busy ? 'Working…' : 'Approve & Publish'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

/* =====================================================================
   KYC QUEUE
   ===================================================================== */
function KycQueueTab() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await api('/api/admin/verification-queue');
      setQueue(data.queue || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleReview(docId, payload) {
    await api(`/api/admin/verification/${docId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await load();
  }

  // Group documents by user
  const applicants = useMemo(() => {
    const byUser = new Map();
    for (const doc of queue) {
      const uid = doc.user_id;
      if (!byUser.has(uid)) {
        byUser.set(uid, {
          user_id: uid,
          full_name: doc.full_name,
          email: doc.email,
          role: doc.role,
          trust_tier: doc.trust_tier,
          organization_name: doc.organization_name,
          country_name: doc.country_name,
          flag_emoji: doc.flag_emoji,
          documents: [],
          oldest_created_at: doc.created_at,
        });
      }
      const entry = byUser.get(uid);
      entry.documents.push(doc);
      if (doc.created_at < entry.oldest_created_at) {
        entry.oldest_created_at = doc.created_at;
      }
    }
    // Sort applicants by oldest pending document (FIFO)
    return Array.from(byUser.values()).sort((a, b) =>
      a.oldest_created_at < b.oldest_created_at ? -1 : 1
    );
  }, [queue]);

  const totalDocs = queue.length;
  const totalApplicants = applicants.length;

  return (
    <div>
      <SectionHeader
        title="KYC verification"
        subtitle={
          totalDocs === 0
            ? 'No documents pending review'
            : `${totalApplicants} applicant${totalApplicants === 1 ? '' : 's'} · ${totalDocs} document${totalDocs === 1 ? '' : 's'} pending review`
        }
        onRefresh={load}
      />
      {loading ? (
        <DarkSpinner />
      ) : err ? (
        <ErrorBox>{err}</ErrorBox>
      ) : applicants.length === 0 ? (
        <EmptyDark
          icon={ShieldCheck}
          title="No pending verifications"
          body="When users submit KYC documents, they will appear here, grouped by applicant."
        />
      ) : (
        <div style={{ background: 'var(--ink-900)', border: '1px solid var(--ink-800)' }}>
          {applicants.map((applicant, idx) => (
            <KycApplicantRow
              key={applicant.user_id}
              applicant={applicant}
              index={idx}
              onReview={handleReview}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KycApplicantRow({ applicant, index, onReview }) {
  const [expanded, setExpanded] = useState(false);
  const docCount = applicant.documents.length;

  return (
    <div style={{ borderTop: index === 0 ? 'none' : '1px solid var(--ink-800)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          color: 'var(--ivory-50)',
          textAlign: 'left',
          cursor: 'pointer',
          padding: '18px 24px',
          display: 'grid',
          gridTemplateColumns: '60px 1fr auto auto auto',
          alignItems: 'center',
          gap: 'var(--space-5)',
          fontFamily: 'inherit',
          transition: 'background 150ms',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-800)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        data-kyc-applicant-row
      >
        <div className="mono" style={{ fontSize: 12, color: 'var(--gold-400)', letterSpacing: '0.14em' }}>
          {String(index + 1).padStart(2, '0')}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500 }}>{applicant.full_name}</div>
          <div className="text-xs" style={{ color: 'var(--ink-300)', marginTop: 4 }}>
            {applicant.email} · {titleCase(applicant.role)}
            {applicant.organization_name && <> · {applicant.organization_name}</>}
            {applicant.flag_emoji && <> · {applicant.flag_emoji} {applicant.country_name}</>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }} data-hide-narrow>
          <div className="text-xs" style={{ color: 'var(--ink-300)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Documents
          </div>
          <div className="mono" style={{ fontSize: 12, marginTop: 4, letterSpacing: '0.06em' }}>
            {docCount} pending
          </div>
        </div>
        <div className="text-xs" style={{ color: 'var(--ink-300)' }} data-hide-narrow>
          oldest {formatRelative(applicant.oldest_created_at)}
        </div>
        <ChevronRight
          size={16}
          color="var(--gold-400)"
          style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }}
        />
        <style>{`
          @media (max-width: 880px) {
            [data-kyc-applicant-row] { grid-template-columns: 40px 1fr auto !important; }
            [data-hide-narrow] { display: none !important; }
          }
        `}</style>
      </button>

      {expanded && (
        <div style={{ padding: '0 24px 24px', background: 'var(--ink-900)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {applicant.documents.map((doc) => (
              <KycDocReviewCard key={doc.id} doc={doc} onReview={onReview} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KycDocReviewCard({ doc, onReview }) {
  const [tier, setTier] = useState('verified');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null); // 'approved' | 'rejected' | null

  async function decide(decision) {
    setBusy(true);
    setErr(null);
    try {
      await onReview(doc.id, {
        decision,
        promote_to_tier: decision === 'approve' ? tier : undefined,
        notes: notes || undefined,
      });
      setDone(decision === 'approve' ? 'approved' : 'rejected');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div
        style={{
          background: 'var(--ink-950)',
          border: '1px solid var(--ink-800)',
          padding: 'var(--space-4)',
          color: 'var(--ink-300)',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {done === 'approved' ? (
          <CheckCircle2 size={16} color="var(--sage-700)" />
        ) : (
          <XCircle size={16} color="var(--rust-600)" />
        )}
        <span>
          <span className="mono">{doc.document_type}</span> {done}. Refresh to remove from queue.
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--ink-950)',
        border: '1px solid var(--ink-800)',
        padding: 'var(--space-5)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-4)',
      }}
      data-kyc-form
    >
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="text-xs" style={{ color: 'var(--ink-300)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Document type
          </div>
          <div className="mono" style={{ fontSize: 14, marginTop: 4, color: 'var(--ivory-50)' }}>
            {doc.document_type}
          </div>
        </div>
        <div className="text-xs" style={{ color: 'var(--ink-300)' }}>
          Submitted {formatRelative(doc.created_at)}
        </div>
      </div>

      <div>
        <label className="label" style={{ color: 'var(--ink-300)' }}>Promote to tier (on approve)</label>
        <select
          className="select"
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          style={{ background: 'var(--ink-900)', color: 'var(--ivory-50)', borderColor: 'var(--ink-700)' }}
        >
          <option value="basic">Basic</option>
          <option value="verified">Verified</option>
          <option value="institutional">Institutional</option>
        </select>
      </div>
      <div>
        <label className="label" style={{ color: 'var(--ink-300)' }}>Storage key</label>
        <div
          className="mono text-xs"
          style={{
            padding: '12px 14px',
            background: 'var(--ink-900)',
            color: 'var(--ink-300)',
            border: '1px solid var(--ink-800)',
            wordBreak: 'break-all',
          }}
        >
          {doc.storage_key}
        </div>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label className="label" style={{ color: 'var(--ink-300)' }}>Notes</label>
        <textarea
          className="textarea"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional reviewer notes..."
          style={{
            background: 'var(--ink-900)',
            color: 'var(--ivory-50)',
            borderColor: 'var(--ink-700)',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </div>
      {err && (
        <div style={{ gridColumn: '1 / -1', padding: 10, background: 'rgba(163, 82, 46, 0.15)', color: '#f0c5a8', fontSize: 13, borderLeft: '2px solid var(--rust-600)' }}>
          {err}
        </div>
      )}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button onClick={() => decide('reject')} disabled={busy} className="btn btn-ghost-light">
          <XCircle size={14} /> Reject
        </button>
        <button onClick={() => decide('approve')} disabled={busy} className="btn btn-gold">
          <CheckCircle2 size={14} /> {busy ? 'Working...' : 'Approve & Promote'}
        </button>
      </div>
      <style>{`
        @media (max-width: 720px) {
          [data-kyc-form] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* =====================================================================
   USERS
   ===================================================================== */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (tierFilter) params.set('tier', tierFilter);
      if (roleFilter) params.set('role', roleFilter);
      const data = await api(`/api/admin/users?${params.toString()}`);
      setUsers(data.users || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Reload when filters change (debounced for search)
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [search, tierFilter, roleFilter]);

  async function changeTier(userId, newTier) {
    try {
      await api(`/api/admin/users/${userId}/tier`, {
        method: 'PATCH',
        body: JSON.stringify({ trust_tier: newTier }),
      });
      await load();
    } catch (e) {
      alert(e.message); // simple feedback for v0
    }
  }

  return (
    <div>
      <SectionHeader
        title="Users"
        subtitle={`${users.length} result${users.length === 1 ? '' : 's'}`}
        onRefresh={load}
      />

      {/* Filter bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr',
          gap: 12,
          marginBottom: 16,
        }}
        data-filter-bar
      >
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-300)' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            style={{
              width: '100%',
              padding: '12px 14px 12px 38px',
              background: 'var(--ink-900)',
              color: 'var(--ivory-50)',
              border: '1px solid var(--ink-800)',
              fontFamily: 'inherit',
              fontSize: 14,
            }}
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          style={{
            padding: '12px 14px',
            background: 'var(--ink-900)',
            color: 'var(--ivory-50)',
            border: '1px solid var(--ink-800)',
            fontFamily: 'inherit',
            fontSize: 14,
          }}
        >
          <option value="">All tiers</option>
          <option value="unverified">Unverified</option>
          <option value="basic">Basic</option>
          <option value="verified">Verified</option>
          <option value="institutional">Institutional</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{
            padding: '12px 14px',
            background: 'var(--ink-900)',
            color: 'var(--ivory-50)',
            border: '1px solid var(--ink-800)',
            fontFamily: 'inherit',
            fontSize: 14,
          }}
        >
          <option value="">All roles</option>
          <option value="investor">Investor</option>
          <option value="project_developer">Project Developer</option>
          <option value="government">Government</option>
          <option value="corporate">Corporate</option>
          <option value="sme">SME</option>
          <option value="admin">Admin</option>
        </select>

        <style>{`
          @media (max-width: 720px) {
            [data-filter-bar] { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>

      {loading ? (
        <DarkSpinner />
      ) : err ? (
        <ErrorBox>{err}</ErrorBox>
      ) : users.length === 0 ? (
        <EmptyDark icon={Users} title="No users match these filters" />
      ) : (
        <div style={{ background: 'var(--ink-900)', border: '1px solid var(--ink-800)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--ink-800)' }}>
                {['Name', 'Role', 'Tier', 'Organization', 'Joined', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '14px 18px',
                      fontSize: 11,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-300)',
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: '1px solid var(--ink-800)' }}>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{u.full_name}</div>
                    <div className="text-xs" style={{ color: 'var(--ink-300)', marginTop: 2 }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: 13 }}>
                    {titleCase(u.role)}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <select
                      value={u.trust_tier}
                      onChange={(e) => changeTier(u.id, e.target.value)}
                      style={{
                        background: 'var(--ink-950)',
                        color: tierColor(u.trust_tier),
                        border: '1px solid var(--ink-800)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        padding: '4px 8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.14em',
                      }}
                    >
                      <option value="unverified">UNVERIFIED</option>
                      <option value="basic">BASIC</option>
                      <option value="verified">VERIFIED</option>
                      <option value="institutional">INSTITUTIONAL</option>
                    </select>
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: 13, color: 'var(--ink-300)' }}>
                    {u.organization_name || '—'}
                  </td>
                  <td style={{ padding: '14px 18px', fontSize: 13, color: 'var(--ink-300)' }}>
                    {formatRelative(u.created_at)}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span className="text-xs" style={{ color: u.is_active ? 'var(--sage-700)' : 'var(--rust-600)', letterSpacing: '0.08em' }}>
                      {u.is_active ? '● ACTIVE' : '○ INACTIVE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   AUDIT LOG
   ===================================================================== */
function AuditLogTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [actionFilter, setActionFilter] = useState('');

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      params.set('limit', '100');
      const data = await api(`/api/admin/audit-log?${params.toString()}`);
      setEntries(data.entries || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [actionFilter]);

  return (
    <div>
      <SectionHeader
        title="Audit log"
        subtitle="All privileged platform actions"
        onRefresh={load}
      />

      <div style={{ marginBottom: 16 }}>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{
            padding: '10px 14px',
            background: 'var(--ink-900)',
            color: 'var(--ivory-50)',
            border: '1px solid var(--ink-800)',
            fontFamily: 'inherit',
            fontSize: 13,
          }}
        >
          <option value="">All actions</option>
          <option value="project.approve">Project — approved</option>
          <option value="project.reject">Project — rejected</option>
          <option value="project.publish">Project — published (admin)</option>
          <option value="project.submit_review">Project — submitted for review</option>
          <option value="kyc.approve">KYC — approved</option>
          <option value="kyc.reject">KYC — rejected</option>
          <option value="user.tier_change">User — tier change</option>
        </select>
      </div>

      {loading ? (
        <DarkSpinner />
      ) : err ? (
        <ErrorBox>{err}</ErrorBox>
      ) : entries.length === 0 ? (
        <EmptyDark icon={FileText} title="No log entries" />
      ) : (
        <div style={{ background: 'var(--ink-900)', border: '1px solid var(--ink-800)' }}>
          {entries.map((e, idx) => (
            <AuditRow key={e.id} entry={e} first={idx === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function AuditRow({ entry, first }) {
  const [open, setOpen] = useState(false);
  const action = entry.action || '';
  const tone = action.includes('reject')
    ? { color: 'var(--rust-600)', dot: '#a3522e' }
    : action.includes('approve') || action.includes('publish')
      ? { color: 'var(--sage-700)', dot: '#4a5d4f' }
      : { color: 'var(--gold-400)', dot: '#dcc068' };

  const meta = entry.metadata || {};

  return (
    <div style={{ borderTop: first ? 'none' : '1px solid var(--ink-800)' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          color: 'var(--ivory-50)',
          textAlign: 'left',
          padding: '14px 24px',
          display: 'grid',
          gridTemplateColumns: '20px 1fr auto auto',
          alignItems: 'center',
          gap: 'var(--space-4)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 150ms',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ink-800)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone.dot, display: 'inline-block' }} />
        <div>
          <span className="mono" style={{ color: tone.color, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {action}
          </span>
          <span className="text-xs" style={{ color: 'var(--ink-300)', marginLeft: 12 }}>
            on {entry.entity}
          </span>
        </div>
        <div className="text-xs" style={{ color: 'var(--ink-300)' }} data-hide-narrow>
          {entry.actor_name || 'system'}
        </div>
        <div className="text-xs" style={{ color: 'var(--ink-500)' }}>
          {formatRelative(entry.created_at)}
        </div>

        <style>{`
          @media (max-width: 640px) {
            [data-hide-narrow] { display: none !important; }
          }
        `}</style>
      </button>
      {open && Object.keys(meta).length > 0 && (
        <div style={{ padding: '0 24px 16px 52px' }}>
          <pre
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--ink-300)',
              background: 'var(--ink-950)',
              padding: 12,
              border: '1px solid var(--ink-800)',
              margin: 0,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {JSON.stringify(meta, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   SHARED PIECES
   ===================================================================== */
function SectionHeader({ title, subtitle, onRefresh }) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 12 }}>
      <div>
        <h2 style={{ fontSize: 28, color: 'var(--ivory-50)', fontFamily: 'var(--font-display)', fontWeight: 500, lineHeight: 1.1 }}>
          {title}
        </h2>
        {subtitle && (
          <div className="text-sm" style={{ color: 'var(--ink-300)', marginTop: 4 }}>{subtitle}</div>
        )}
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="btn btn-ghost-light"
          style={{ fontSize: 12 }}
        >
          <RotateCw size={12} /> Refresh
        </button>
      )}
    </div>
  );
}

function DarkSpinner() {
  return (
    <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--ink-300)' }}>
      <Loader2 size={20} className="pulse-gold" style={{ animation: 'spin 1.4s linear infinite', display: 'inline-block' }} />
      <div className="text-sm" style={{ marginTop: 12 }}>Loading…</div>
      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorBox({ children }) {
  return (
    <div
      style={{
        padding: 'var(--space-5)',
        background: 'rgba(163, 82, 46, 0.15)',
        border: '1px solid var(--rust-600)',
        color: '#f0c5a8',
        fontSize: 14,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} /> {children}
    </div>
  );
}

function EmptyDark({ icon: Icon, title, body }) {
  return (
    <div
      style={{
        padding: 'var(--space-10)',
        textAlign: 'center',
        background: 'var(--ink-900)',
        border: '1px dashed var(--ink-800)',
      }}
    >
      <Icon size={32} color="var(--gold-400)" strokeWidth={1.4} style={{ margin: '0 auto' }} />
      <h3 style={{ marginTop: 16, fontSize: 22, color: 'var(--ivory-50)' }}>{title}</h3>
      {body && <p style={{ marginTop: 10, color: 'var(--ink-300)', fontSize: 14, maxWidth: 480, marginInline: 'auto' }}>{body}</p>}
    </div>
  );
}

/* =====================================================================
   HELPERS
   ===================================================================== */
function formatUSD(value) {
  const v = Number(value);
  if (!v) return '$—';
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

function titleCase(s) {
  if (!s) return '—';
  return s.split(/[_\s]+/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function tierColor(t) {
  switch (t) {
    case 'institutional': return 'var(--gold-400)';
    case 'verified':      return 'var(--sage-700)';
    case 'basic':         return 'var(--gold-700)';
    default:              return 'var(--rust-600)';
  }
}

function pct(num, denom) {
  if (!denom) return '0%';
  return `${Math.round((num / denom) * 100)}%`;
}

function formatRelative(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
