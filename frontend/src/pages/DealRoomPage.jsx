import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Lock,
  Upload,
  FileText,
  UserPlus,
  Trash2,
  Loader2,
  Activity,
  Users,
  X,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import { api, getAccessToken } from '../lib/api.js';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/zip',
  'application/x-zip-compressed',
];
const BASE_URL = import.meta.env.VITE_API_URL || '';

const ROLE_BADGE = {
  owner: { label: 'Owner', color: 'var(--gold-700)' },
  editor: { label: 'Editor', color: 'var(--sage-700)' },
  viewer: { label: 'Viewer', color: 'var(--fg-muted)' },
};

const ACTION_LABEL = {
  create: 'opened the room',
  invite: 'invited a member',
  remove: 'removed a member',
  upload: 'uploaded',
  view: 'viewed',
  delete: 'deleted',
};

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function DealRoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [myRole, setMyRole] = useState('viewer');
  const [members, setMembers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!getAccessToken()) {
      navigate('/login');
      return;
    }
    load();
  }, [id, navigate]);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await api(`/api/deal-rooms/${id}`);
      setRoom(data.room);
      setMyRole(data.my_role);
      setMembers(data.members || []);
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err.message || 'Failed to load deal room.');
    } finally {
      setLoading(false);
    }
  }

  async function loadActivity() {
    try {
      const data = await api(`/api/deal-rooms/${id}/activity`);
      setActivity(data.activity || []);
    } catch (err) {
      console.warn('Failed to load activity', err);
    }
  }

  function toggleActivity() {
    const next = !activityOpen;
    setActivityOpen(next);
    if (next && activity.length === 0) loadActivity();
  }

  if (loading) {
    return (
      <>
        <Header />
        <main style={{ maxWidth: 1020, margin: '0 auto', padding: '40px 24px' }}>
          <p style={{ color: 'var(--fg-muted)' }}>Loading...</p>
        </main>
        <Footer />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <main style={{ maxWidth: 1020, margin: '0 auto', padding: '40px 24px' }}>
          <Link
            to="/deal-rooms"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: 'var(--fg-muted)',
              textDecoration: 'none',
              marginBottom: 24,
            }}
          >
            <ArrowLeft size={14} />
            Back to deal rooms
          </Link>
          <div
            style={{
              background: '#fdecea',
              color: 'var(--rust-600)',
              padding: '12px 16px',
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const canUpload = myRole === 'owner' || myRole === 'editor';
  const isOwner = myRole === 'owner';

  return (
    <>
      <Header />
      <main style={{ maxWidth: 1020, margin: '0 auto', padding: '40px 24px 80px' }}>
        <Link
          to="/deal-rooms"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: 'var(--fg-muted)',
            textDecoration: 'none',
            marginBottom: 24,
          }}
        >
          <ArrowLeft size={14} />
          All deal rooms
        </Link>

        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--fg-muted)',
              marginBottom: 6,
            }}
          >
            {room.project?.title || 'Project'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Lock size={26} style={{ color: 'var(--gold-700)' }} />
            <h1 style={{ fontSize: 28, margin: 0 }}>{room.name}</h1>
          </div>
          {room.description && (
            <p style={{ color: 'var(--fg-muted)', fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 720 }}>
              {room.description}
            </p>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 320px',
            gap: 32,
          }}
          data-deal-room-grid
        >
          <div>
            <DocumentsPanel
              roomId={id}
              documents={documents}
              myRole={myRole}
              canUpload={canUpload}
              isOwner={isOwner}
              onChange={load}
            />

            <ActivityPanel
              open={activityOpen}
              onToggle={toggleActivity}
              activity={activity}
            />
          </div>

          <MembersPanel
            roomId={id}
            members={members}
            myRole={myRole}
            isOwner={isOwner}
            onChange={load}
          />
        </div>

        <style>{`
          @media (max-width: 900px) {
            [data-deal-room-grid] { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </main>
      <Footer />
    </>
  );
}

// ---------- Documents ----------

function DocumentsPanel({ roomId, documents, myRole, canUpload, isOwner, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);

    if (file.size > MAX_FILE_BYTES) {
      setUploadError('File is larger than 50 MB.');
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      setUploadError('Unsupported file type. Use PDF, image, Office doc, or ZIP.');
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const token = getAccessToken();
      const res = await fetch(`${BASE_URL}/api/deal-rooms/${roomId}/documents`, {
        method: 'POST',
        body: form,
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        let msg = `Upload failed (HTTP ${res.status})`;
        try { const b = await res.json(); if (b.error) msg = b.error; } catch {}
        throw new Error(msg);
      }
      await onChange();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleView(docId) {
    setBusyId(docId);
    try {
      const data = await api(`/api/deal-rooms/${roomId}/documents/${docId}`);
      if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(err.message || 'Failed to open document.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(docId, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusyId(docId);
    try {
      await api(`/api/deal-rooms/${roomId}/documents/${docId}`, { method: 'DELETE' });
      await onChange();
    } catch (err) {
      alert(err.message || 'Failed to delete document.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Documents</h2>
        {canUpload && (
          <label
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading...' : 'Upload document'}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.zip"
              onChange={handleUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
        )}
      </div>

      {uploadError && (
        <div
          style={{
            background: '#fdecea',
            color: 'var(--rust-600)',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          {uploadError}
        </div>
      )}

      {documents.length === 0 ? (
        <div
          style={{
            border: '1px dashed var(--border, #ccc)',
            borderRadius: 8,
            padding: 28,
            textAlign: 'center',
            color: 'var(--fg-muted)',
            fontSize: 14,
          }}
        >
          No documents yet.{canUpload ? ' Upload the first one.' : ''}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {documents.map((doc) => (
            <li
              key={doc.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                border: '1px solid var(--border, #e5e5e5)',
                borderRadius: 8,
                background: 'var(--bg-card, #fff)',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                <FileText size={18} style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                    {formatBytes(doc.size_bytes)} · uploaded by {doc.uploaded_by_name} · {timeAgo(doc.created_at)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => handleView(doc.id)}
                  disabled={busyId === doc.id}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  {busyId === doc.id ? <Loader2 size={12} className="spin" /> : <ArrowUpRight size={12} />}
                  View
                </button>
                {(doc.uploaded_by === currentUserId() || isOwner) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id, doc.title)}
                    disabled={busyId === doc.id}
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: '6px 10px', color: 'var(--rust-600)' }}
                    aria-label="Delete document"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <style>{`
        .spin { animation: dr-spin 1s linear infinite; }
        @keyframes dr-spin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}

// We don't have current user ID in this component's scope.
// Backend already restricts delete to uploader or owner, so this is just UI hint.
// Always show delete for owner; for others, backend will reject if not uploader.
function currentUserId() {
  try {
    const raw = localStorage.getItem('sarego_access');
    if (!raw) return null;
    const payload = JSON.parse(atob(raw.split('.')[1]));
    return payload.sub || payload.id || null;
  } catch {
    return null;
  }
}

// ---------- Members ----------

function MembersPanel({ roomId, members, myRole, isOwner, onChange }) {
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(null);
  const [busyUserId, setBusyUserId] = useState(null);

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      await api(`/api/deal-rooms/${roomId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), role }),
      });
      setInviteSuccess('Member invited.');
      setEmail('');
      await onChange();
    } catch (err) {
      setInviteError(err.message || 'Invite failed.');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(userId, name) {
    if (!confirm(`Remove ${name} from this deal room?`)) return;
    setBusyUserId(userId);
    try {
      await api(`/api/deal-rooms/${roomId}/members/${userId}`, { method: 'DELETE' });
      await onChange();
    } catch (err) {
      alert(err.message || 'Remove failed.');
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <aside
      style={{
        border: '1px solid var(--border, #e5e5e5)',
        borderRadius: 12,
        padding: 20,
        background: 'var(--bg-card, #fff)',
        alignSelf: 'flex-start',
        position: 'sticky',
        top: 24,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Users size={14} /> Members
        </h3>
        {isOwner && (
          <button
            type="button"
            onClick={() => setShowInvite(!showInvite)}
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            {showInvite ? <X size={12} /> : <UserPlus size={12} />}
            {showInvite ? 'Cancel' : 'Invite'}
          </button>
        )}
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border, #e5e5e5)' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={inviting}
            required
            placeholder="invitee@example.com"
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border, #ccc)', marginBottom: 8 }}
          />
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={inviting}
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border, #ccc)', marginBottom: 10, background: '#fff' }}
          >
            <option value="viewer">Viewer (read only)</option>
            <option value="editor">Editor (can upload)</option>
          </select>
          {inviteError && (
            <div style={{ fontSize: 12, color: 'var(--rust-600)', marginBottom: 8 }}>{inviteError}</div>
          )}
          {inviteSuccess && (
            <div style={{ fontSize: 12, color: 'var(--sage-700)', marginBottom: 8 }}>{inviteSuccess}</div>
          )}
          <button type="submit" disabled={inviting} className="btn btn-primary" style={{ width: '100%', fontSize: 13, padding: '8px 12px' }}>
            {inviting ? 'Sending...' : 'Send invite'}
          </button>
        </form>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {members.map((m) => {
          const badge = ROLE_BADGE[m.room_role] || ROLE_BADGE.viewer;
          return (
            <li key={m.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.full_name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: badge.color,
                    border: `1px solid ${badge.color}`,
                    padding: '2px 6px',
                    borderRadius: 3,
                  }}
                >
                  {badge.label}
                </span>
                {isOwner && m.room_role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => handleRemove(m.user_id, m.full_name)}
                    disabled={busyUserId === m.user_id}
                    aria-label={`Remove ${m.full_name}`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 2,
                      color: 'var(--rust-600)',
                      display: 'inline-flex',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

// ---------- Activity ----------

function ActivityPanel({ open, onToggle, activity }) {
  return (
    <section style={{ marginTop: 16 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          background: 'transparent',
          border: '1px solid var(--border, #e5e5e5)',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--fg-muted)',
        }}
      >
        <Activity size={14} />
        {open ? 'Hide activity log' : 'Show activity log'}
      </button>
      {open && (
        <ul style={{ listStyle: 'none', padding: 16, margin: '12px 0 0', background: 'var(--bg-subtle, #fafafa)', borderRadius: 8, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {activity.length === 0 ? (
            <li style={{ color: 'var(--fg-muted)' }}>No activity yet.</li>
          ) : (
            activity.map((a) => (
              <li key={a.id} style={{ color: 'var(--fg)' }}>
                <span style={{ fontWeight: 500 }}>{a.user_name}</span>{' '}
                <span style={{ color: 'var(--fg-muted)' }}>
                  {ACTION_LABEL[a.action] || a.action}
                  {a.document_title ? ` "${a.document_title}"` : ''} · {timeAgo(a.created_at)}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
