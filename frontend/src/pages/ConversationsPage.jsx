import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ConversationsPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('sarego_access');
  const currentUserId = (() => { try { return JSON.parse(atob(token?.split('.')[1] || '')).sub; } catch { return null; } })();

  useEffect(() => {
    fetch(`${API}/api/conversations`, { credentials: 'include', headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setConversations(d.conversations || []); setLoading(false); })
      .catch(() => { setError('Failed to load conversations'); setLoading(false); });
  }, []);

  // Poll for updates every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`${API}/api/conversations`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(d => { if (d.conversations) setConversations(d.conversations); })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const s = {
    page: { minHeight: '100vh', background: '#0d0d0d', color: '#e8e0d0', fontFamily: "'Inter Tight', sans-serif", padding: '32px 24px' },
    header: { maxWidth: 720, margin: '0 auto 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 28, fontWeight: 600, color: '#e8e0d0', margin: 0 },
    back: { color: '#b8962e', textDecoration: 'none', fontSize: 14 },
    list: { maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 2 },
    card: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '16px 20px', cursor: 'pointer' },
    cardUnread: { borderColor: '#b8962e' },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
    name: { fontWeight: 600, fontSize: 15, color: '#e8e0d0' },
    listing: { fontSize: 12, color: '#888', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' },
    preview: { fontSize: 13, color: '#aaa', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 480 },
    meta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 },
    time: { fontSize: 12, color: '#666' },
    badge: { background: '#b8962e', color: '#0d0d0d', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
    empty: { textAlign: 'center', color: '#666', padding: '64px 0', fontSize: 15 },
  };

  if (loading) return <div style={s.page}><div style={s.empty}>Loading...</div></div>;
  if (error) return <div style={s.page}><div style={s.empty}>{error}</div></div>;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Conversations</h1>
        <Link to="/dashboard" style={s.back}>Back to dashboard</Link>
      </div>
      <div style={s.list}>
        {conversations.length === 0 && <div style={s.empty}>No conversations yet.</div>}
        {conversations.map(conv => {
          const isOwner = conv.owner_user_id === currentUserId;
          const otherName = isOwner ? conv.party_name : conv.owner_name;
          const unread = Number(conv.unread_count || 0);
          return (
            <div key={conv.id} style={{ ...s.card, ...(unread > 0 ? s.cardUnread : {}) }} onClick={() => navigate(`/conversations/${conv.id}`)}>
              <div style={s.row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.name}>{otherName || 'Unknown'}</div>
                  <div style={s.listing}>{(conv.listing_type || '').replace('_', ' ')}</div>
                  <div style={s.preview}>{conv.last_message_body || 'No messages yet'}</div>
                </div>
                <div style={s.meta}>
                  <span style={s.time}>{timeAgo(conv.last_message_at || conv.created_at)}</span>
                  {unread > 0 && <span style={s.badge}>{unread}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
