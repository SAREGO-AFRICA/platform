import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function formatTime(d) { return d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''; }

export default function ConversationThreadPage() {
  const { id } = useParams();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [sendError, setSendError] = useState(null);
  const bottomRef = useRef(null);
  const token = localStorage.getItem('sarego_access');
  const currentUserId = (() => { try { return JSON.parse(atob(token?.split('.')[1] || '')).sub; } catch { return null; } })();
  const H = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/api/conversations/${id}`, { credentials: 'include', headers: H })
      .then(r => r.json())
      .then(d => { setConv(d.conversation); setMessages(d.messages || []); setLoading(false); fetch(`${API}/api/conversations/${id}/seen`, { method: 'PATCH', credentials: 'include', headers: H }); })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Poll for new messages every 10 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`${API}/api/conversations/${id}`, {
          credentials: 'include',
          headers: H,
        });
        const d = await r.json();
        if (d.messages && d.messages.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMsgs = d.messages.filter(m => !existingIds.has(m.id));
            if (newMsgs.length === 0) return prev;
            // Mark seen if new messages from other party
            fetch(`${API}/api/conversations/${id}/seen`, { method: 'PATCH', credentials: 'include', headers: H });
            return [...prev, ...newMsgs];
          });
        }
      } catch { /* silent */ }
    }, 10000);
    return () => clearInterval(interval);
  }, [id]);

  function handleFileChange(e) {
    const f = e.target.files[0]; setFileError(null);
    if (!f) { setFile(null); return; }
    if (f.type !== 'application/pdf') { setFileError('Only PDF files allowed.'); setFile(null); return; }
    if (f.size > 10485760) { setFileError('Max 10MB.'); setFile(null); return; }
    setFile(f);
  }

  async function handleSend() {
    if (!body.trim() && !file) return;
    setSending(true); setSendError(null);
    try {
      let att = null;
      if (file) {
        const ur = await fetch(`${API}/api/conversations/${id}/attachment-upload-url`, { method: 'POST', credentials: 'include', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, mime_type: file.type }) });
        const ud = await ur.json();
        if (!ur.ok) throw new Error(ud.error || 'Upload URL failed');
        const up = await fetch(ud.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!up.ok) throw new Error('Upload failed');
        att = { attachment_path: ud.storage_path, attachment_filename: file.name, attachment_size_bytes: file.size, attachment_mime_type: file.type };
      }
      const mr = await fetch(`${API}/api/conversations/${id}/messages`, { method: 'POST', credentials: 'include', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ body: body.trim() || undefined, ...att }) });
      const md = await mr.json();
      if (!mr.ok) throw new Error(md.error || 'Send failed');
      setMessages(p => [...p, md.message]); setBody(''); setFile(null);
    } catch (e) { setSendError(e.message); } finally { setSending(false); }
  }

  const s = {
    page: { minHeight: '100vh', background: '#0d0d0d', color: '#e8e0d0', fontFamily: "'Inter Tight', sans-serif", display: 'flex', flexDirection: 'column' },
    hdr: { background: '#111', borderBottom: '1px solid #2a2a2a', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 },
    back: { color: '#b8962e', textDecoration: 'none', fontSize: 20, lineHeight: 1 },
    htitle: { fontWeight: 600, fontSize: 16 },
    hsub: { fontSize: 12, color: '#666', marginTop: 2 },
    feed: { flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
    bub: (me) => ({ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '70%', background: me ? '#1e1a10' : '#1a1a1a', border: `1px solid ${me ? '#b8962e44' : '#2a2a2a'}`, borderRadius: me ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '12px 16px' }),
    bname: { fontSize: 11, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' },
    bbody: { fontSize: 14, color: '#e8e0d0', lineHeight: 1.5 },
    btime: { fontSize: 11, color: '#555', marginTop: 6, textAlign: 'right' },
    att: { display: 'flex', alignItems: 'center', gap: 8, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 6, padding: '8px 12px', marginTop: 8, cursor: 'pointer' },
    attname: { fontSize: 13, color: '#b8962e', textDecoration: 'underline' },
    comp: { borderTop: '1px solid #2a2a2a', padding: '16px 24px', background: '#111' },
    compIn: { maxWidth: 720, margin: '0 auto' },
    ta: { width: '100%', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, color: '#e8e0d0', padding: 12, fontSize: 14, resize: 'vertical', minHeight: 80, fontFamily: 'inherit', boxSizing: 'border-box' },
    crow: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 },
    flabel: { fontSize: 13, color: '#b8962e', cursor: 'pointer' },
    fname: { fontSize: 12, color: '#888' },
    sbtn: (d) => ({ marginLeft: 'auto', background: '#b8962e', color: '#0d0d0d', border: 'none', borderRadius: 6, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: d ? 'not-allowed' : 'pointer', opacity: d ? 0.5 : 1 }),
    err: { color: '#e05c5c', fontSize: 13, marginTop: 6 },
  };

  if (loading) return <div style={s.page}><div style={{ textAlign: 'center', padding: 64, color: '#666' }}>Loading...</div></div>;
  if (!conv) return <div style={s.page}><div style={{ textAlign: 'center', padding: 64, color: '#666' }}>Not found.</div></div>;

  const isOwner = conv.owner_user_id === currentUserId;
  const otherName = isOwner ? conv.party_name : conv.owner_name;

  return (
    <div style={s.page}>
      <div style={s.hdr}>
        <Link to="/conversations" style={s.back}>←</Link>
        <div>
          <div style={s.htitle}>{otherName}</div>
          <div style={s.hsub}>{(conv.listing_type || '').replace('_', ' ')} · {conv.message_count || 0} messages</div>
        </div>
      </div>
      <div style={s.feed}>
        {messages.length === 0 && <div style={{ textAlign: 'center', color: '#555', fontSize: 14, padding: 32 }}>No messages yet.</div>}
        {messages.map(msg => {
          const me = msg.sender_user_id === currentUserId;
          return (
            <div key={msg.id} style={s.bub(me)}>
              <div style={s.bname}>{me ? 'You' : (msg.sender_name || otherName)}</div>
              {msg.body && <div style={s.bbody}>{msg.body}</div>}
              {msg.attachment_path && (
                <div style={s.att} onClick={async () => { const r = await fetch(`${API}/api/conversations/${id}/messages/${msg.id}/attachment-download-url`, { credentials: 'include', headers: H }); const d = await r.json(); if (d.download_url) window.open(d.download_url, '_blank'); }}>
                  <span>📎</span><span style={s.attname}>{msg.attachment_filename || 'Attachment'}</span>
                </div>
              )}
              <div style={s.btime}>{formatTime(msg.created_at)}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div style={s.comp}>
        <div style={s.compIn}>
          <textarea style={s.ta} placeholder="Type a message... (Ctrl+Enter to send)" value={body} onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
          <div style={s.crow}>
            <label style={s.flabel}>📎 Attach PDF<input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFileChange} /></label>
            {file && <span style={s.fname}>{file.name}</span>}
            {fileError && <span style={s.err}>{fileError}</span>}
            <button style={s.sbtn(sending || (!body.trim() && !file))} onClick={handleSend} disabled={sending || (!body.trim() && !file)}>{sending ? 'Sending...' : 'Send'}</button>
          </div>
          {sendError && <div style={s.err}>{sendError}</div>}
        </div>
      </div>
    </div>
  );
}
