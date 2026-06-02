import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Trash2 } from 'lucide-react';
import { api, getAccessToken } from '../lib/api';

const TABS = ['Overview', 'Milestones', 'Discussion', 'Documents', 'Members', 'Activity'];
const STATUS_META = {
  active:    { label: 'Active',    color: '#22c55e' },
  on_hold:   { label: 'On Hold',   color: '#f59e0b' },
  cancelled: { label: 'Cancelled', color: '#ef4444' },
  completed: { label: 'Completed', color: '#6366f1' },
};
const MILESTONE_STATUS = {
  completed: { icon: '✓', color: '#22c55e' },
  active:    { icon: '◉', color: '#b8962e' },
  pending:   { icon: '○', color: '#aaa' },
  skipped:   { icon: '—', color: '#666' },
};
function uid() { try { return JSON.parse(atob(getAccessToken().split('.')[1])).sub; } catch { return null; } }
function fmt(d) { return d ? new Date(d).toLocaleDateString(undefined,{dateStyle:'medium'}) : '—'; }
function fmtTime(d) { return d ? new Date(d).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}) : '—'; }
const s = {
  page: { minHeight:'100vh', background:'#0b0d10', fontFamily:"'Inter Tight', sans-serif", color:'#e8e0d0' },
  hdr:  { background:'rgba(11,13,16,0.95)', borderBottom:'1px solid rgba(184,150,46,0.2)', padding:'20px 32px', display:'flex', alignItems:'center', gap:16, backdropFilter:'blur(12px)' },
  back: { color:'#b8962e', textDecoration:'none', display:'flex', alignItems:'center', gap:4, fontSize:14, opacity:0.8 },
  title:{ fontSize:24, fontWeight:700, color:'#e8e0d0', margin:0, letterSpacing:'-0.01em' },
  sub:  { fontSize:13, color:'rgba(232,224,208,0.5)', marginTop:3 },
  badge:(c)=>({ display:'inline-block', padding:'3px 12px', borderRadius:20, fontSize:11, fontWeight:700, color:c, border:`1px solid ${c}`, background:c+'18', letterSpacing:'0.06em' }),
  tabs: { display:'flex', borderBottom:'1px solid rgba(184,150,46,0.15)', background:'rgba(15,17,20,0.8)', padding:'0 32px', backdropFilter:'blur(8px)' },
  tab:  (a)=>({ padding:'16px 22px', fontSize:12, fontWeight:a?600:400, color:a?'#b8962e':'rgba(232,224,208,0.45)', borderBottom:a?'2px solid #b8962e':'2px solid transparent', cursor:'pointer', background:'none', border:'none', borderBottom:a?'2px solid #b8962e':'2px solid transparent', letterSpacing:'0.06em', textTransform:'uppercase' }),
  body: { padding:'32px', maxWidth:960, margin:'0 auto' },
  card: { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(184,150,46,0.15)', borderRadius:12, padding:24, marginBottom:16, backdropFilter:'blur(4px)' },
  lbl:  { fontSize:10, color:'#b8962e', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:6, fontWeight:600 },
  val:  { fontSize:16, fontWeight:500, color:'#e8e0d0' },
  btn:  { background:'#b8962e', color:'#0b0d10', border:'none', borderRadius:6, padding:'9px 20px', fontWeight:700, fontSize:13, cursor:'pointer', letterSpacing:'0.04em' },
  btnG: { background:'transparent', color:'#b8962e', border:'1px solid rgba(184,150,46,0.5)', borderRadius:6, padding:'9px 20px', fontWeight:600, fontSize:13, cursor:'pointer' },
  inp:  { width:'100%', padding:'10px 12px', border:'1px solid rgba(184,150,46,0.2)', borderRadius:8, fontSize:14, boxSizing:'border-box', fontFamily:'inherit', background:'rgba(255,255,255,0.04)', color:'#e8e0d0' },
  ta:   { width:'100%', padding:'10px 12px', border:'1px solid rgba(184,150,46,0.2)', borderRadius:8, fontSize:14, resize:'vertical', minHeight:80, fontFamily:'inherit', boxSizing:'border-box', background:'rgba(255,255,255,0.04)', color:'#e8e0d0' },
  err:  { color:'#ef4444', fontSize:13, marginTop:6 },
};
export default function DealRoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [threads, setThreads] = useState([]);
  const [activity, setActivity] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Overview');
  const me = uid();

  async function load() {
    try {
      const d = await api(`/api/deal-rooms/${id}`);
      setRoom(d.room || d);
      setMembers(d.members || []);
      setDocs(d.documents || []);
    } catch { navigate('/login'); return; }
    try { const d = await api(`/api/deal-rooms/${id}/milestones`); setMilestones(d.milestones||[]); } catch {}
    try { const d = await api(`/api/deal-rooms/${id}/threads`);    setThreads(d.threads||[]);    } catch {}
    try { const d = await api(`/api/deal-rooms/${id}/activity`);   setActivity(d.log||[]);       } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  const isOwner = room?.created_by === me;
  const myRole  = members.find(m => m.user_id === me)?.room_role;
  const canEdit = isOwner || myRole === 'editor';
  const dealValue = room?.deal_value_override ?? room?.deal_value_source;
  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const currentMS = milestones.find(m => m.status === 'active') || milestones.find(m => m.status === 'pending');

  if (loading) return <div style={s.page}><div style={{padding:64,textAlign:'center',color:'#888'}}>Loading...</div></div>;
  if (!room)   return <div style={s.page}><div style={{padding:64,textAlign:'center',color:'#888'}}>Room not found.</div></div>;

  return (
    <div style={s.page}>
      <div style={s.hdr}>
        <Link to="/deal-rooms" style={s.back}><ArrowLeft size={16}/> All deal rooms</Link>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <h1 style={s.title}>{room.name}</h1>
            <span style={s.badge((STATUS_META[room.status]||STATUS_META.active).color)}>
              {(STATUS_META[room.status]||STATUS_META.active).label}
            </span>
          </div>
          {room.description && <div style={s.sub}>{room.description}</div>}
        </div>
        {dealValue && <div style={{textAlign:'right'}}><div style={s.lbl}>Deal Value</div><div style={{fontSize:18,fontWeight:700,color:'#111'}}>{room.currency||'USD'} {Number(dealValue).toLocaleString()}</div></div>}
      </div>

      <div style={s.tabs}>
        {TABS.map(t => <button key={t} style={s.tab(tab===t)} onClick={()=>setTab(t)}>{t}</button>)}
      </div>

      <div style={s.body}>
        {tab==='Overview'   && <OverviewTab   room={room} members={members} milestones={milestones} completedCount={completedCount} currentMS={currentMS} isOwner={isOwner} onRefresh={load}/>}
        {tab==='Milestones' && <MilestonesTab roomId={id} milestones={milestones} canEdit={canEdit} onRefresh={load}/>}
        {tab==='Discussion' && <DiscussionTab roomId={id} threads={threads} me={me} canEdit={canEdit} onRefresh={load}/>}
        {tab==='Documents'  && <DocumentsTab  roomId={id} docs={docs} me={me} isOwner={isOwner} canEdit={canEdit} onRefresh={load}/>}
        {tab==='Members'    && <MembersTab    roomId={id} members={members} isOwner={isOwner} onRefresh={load}/>}
        {tab==='Activity'   && <ActivityTab   activity={activity}/>}
      </div>
    </div>
  );
}
function OverviewTab({ room, members, milestones, completedCount, currentMS, isOwner, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(room.status||'active');
  const [valOverride, setValOverride] = useState(room.deal_value_override||'');
  const [saving, setSaving] = useState(false);
  const progress = milestones.length ? Math.round((completedCount/milestones.length)*100) : 0;
  async function handleSave() {
    setSaving(true);
    try { await api(`/api/deal-rooms/${room.id}`, {method:'PATCH',body:JSON.stringify({status,deal_value_override:valOverride||null})}); setEditing(false); onRefresh(); }
    catch {} finally { setSaving(false); }
  }
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:24}}>
        <div style={{...s.card, textAlign:'center'}}><div style={s.lbl}>Participants</div><div style={s.val}>{members.length}</div></div>
        <div style={{...s.card, textAlign:'center'}}><div style={s.lbl}>Progress</div><div style={s.val}>{completedCount}/{milestones.length} milestones</div></div>
        <div style={{...s.card, textAlign:'center'}}><div style={s.lbl}>Current Stage</div><div style={s.val}>{currentMS?.label||'—'}</div></div>
      </div>
      <div style={s.card}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
          <span style={s.lbl}>Transaction Progress</span>
          <span style={{fontSize:13,fontWeight:600,color:'#b8962e'}}>{progress}%</span>
        </div>
        <div style={{background:'rgba(255,255,255,0.08)',borderRadius:4,height:8}}>
          <div style={{background:'#b8962e',borderRadius:4,height:8,width:progress+'%',transition:'width 0.3s'}}/>
        </div>
      </div>
      {isOwner && (
        <div style={s.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <span style={{fontWeight:600,fontSize:15}}>Deal Settings</span>
            {!editing && <button style={s.btnG} onClick={()=>setEditing(true)}>Edit</button>}
          </div>
          {editing ? (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div><div style={s.lbl}>Status</div>
                <select style={{...s.inp,width:'auto'}} value={status} onChange={e=>setStatus(e.target.value)}>
                  <option value="active">Active</option><option value="on_hold">On Hold</option>
                  <option value="cancelled">Cancelled</option><option value="completed">Completed</option>
                </select>
              </div>
              <div><div style={s.lbl}>Deal Value Override (USD)</div>
                <input style={{...s.inp,width:240}} type="number" value={valOverride} onChange={e=>setValOverride(e.target.value)} placeholder="Negotiated value"/>
              </div>
              <div style={{display:'flex',gap:10}}>
                <button style={s.btn} onClick={handleSave} disabled={saving}>{saving?'Saving...':'Save'}</button>
                <button style={s.btnG} onClick={()=>setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <div><div style={s.lbl}>Status</div><div style={s.val}>{STATUS_META[room.status]?.label||'Active'}</div></div>
              <div><div style={s.lbl}>Value Override</div><div style={s.val}>{room.deal_value_override?USD +Number(room.deal_value_override).toLocaleString():'Not set'}</div></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MilestonesTab({ roomId, milestones, canEdit, onRefresh }) {
  const [busy, setBusy] = useState(null);
  async function advance(seq, cur) {
    const next = cur==='pending'?'active':cur==='active'?'completed':null;
    if (!next) return;
    setBusy(seq);
    try { await api(`/api/deal-rooms/${roomId}/milestones/${seq}`,{method:'PATCH',body:JSON.stringify({status:next})}); onRefresh(); }
    catch {} finally { setBusy(null); }
  }
  return (
    <div style={s.card}>
      <h3 style={{margin:'0 0 20px',fontSize:16,fontWeight:600}}>Transaction Milestones</h3>
      {milestones.map((m,i) => {
        const meta = MILESTONE_STATUS[m.status]||MILESTONE_STATUS.pending;
        const isLast = i===milestones.length-1;
        return (
          <div key={m.id} style={{display:'flex',gap:16,paddingBottom:isLast?0:24,position:'relative'}}>
            {!isLast && <div style={{position:'absolute',left:11,top:24,bottom:0,width:2,background:m.status==='completed'?'#22c55e':'#e5e7eb'}}/>}
            <div style={{width:24,height:24,borderRadius:'50%',background:m.status==='completed'?'#22c55e':m.status==='active'?'#b8962e':'#e5e7eb',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:12,color:m.status==='pending'?'rgba(232,224,208,0.3)':'#0b0d10',fontWeight:700,zIndex:1}}>
              {meta.icon}
            </div>
            <div style={{flex:1,paddingTop:2}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontWeight:m.status==='active'?700:500,fontSize:14,color:m.status==='pending'?'rgba(232,224,208,0.35)':'#e8e0d0'}}>{m.label}</span>
                {m.status==='completed'&&m.completed_at&&<span style={{fontSize:11,color:'#888'}}>{fmt(m.completed_at)}</span>}
                {canEdit&&m.status!=='completed'&&m.status!=='skipped'&&(
                  <button style={{...s.btn,padding:'3px 10px',fontSize:11,marginLeft:'auto'}} onClick={()=>advance(m.sequence,m.status)} disabled={busy===m.sequence}>
                    {m.status==='pending'?'Start':'Complete'}
                  </button>
                )}
              </div>
              {m.notes&&<div style={{fontSize:12,color:'#666',marginTop:4}}>{m.notes}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DiscussionTab({ roomId, threads, me, canEdit, onRefresh }) {
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const bottomRef = useRef(null);

  async function loadThread(t) {
    setActive(t);
    try { const d = await api(`/api/deal-rooms/${roomId}/threads/${t.id}/messages`); setMessages(d.messages||[]); }
    catch { setMessages([]); }
  }
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}); },[messages]);
  async function handleSend() {
    if (!body.trim()) return;
    setSending(true);
    try {
      await api(`/api/deal-rooms/${roomId}/threads/${active.id}/messages`,{method:'POST',body:JSON.stringify({body:body.trim()})});
      setBody('');
      const d = await api(`/api/deal-rooms/${roomId}/threads/${active.id}/messages`);
      setMessages(d.messages||[]);
    } catch {} finally { setSending(false); }
  }
  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try { await api(`/api/deal-rooms/${roomId}/threads`,{method:'POST',body:JSON.stringify({title:newTitle.trim()})}); setNewTitle(''); setShowNew(false); onRefresh(); }
    catch {} finally { setCreating(false); }
  }
  return (
    <div style={{display:'grid',gridTemplateColumns:'240px 1fr',gap:16,minHeight:500}}>
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <span style={{fontWeight:600,fontSize:14}}>Threads</span>
          {canEdit&&<button style={{...s.btnG,padding:'4px 10px',fontSize:12}} onClick={()=>setShowNew(!showNew)}>+ New</button>}
        </div>
        {showNew&&(
          <div style={{marginBottom:12}}>
            <input style={s.inp} placeholder="Thread title" value={newTitle} onChange={e=>setNewTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleCreate()}/>
            <button style={{...s.btn,marginTop:6,width:'100%'}} onClick={handleCreate} disabled={creating}>{creating?'Creating...':'Create'}</button>
          </div>
        )}
        {threads.map(t=>(
          <div key={t.id} onClick={()=>loadThread(t)} style={{padding:'10px 12px',borderRadius:8,cursor:'pointer',background:active?.id===t.id?'#fef3cd':'#fff',border:`1px solid ${active?.id===t.id?'#b8962e':'#e5e7eb'}`,marginBottom:6}}>
            <div style={{fontSize:13,fontWeight:500,color:'#e8e0d0'}}>{t.title}</div>
            <div style={{fontSize:11,color:'#888',marginTop:2}}>{t.is_default?'Default':'Custom'} · {t.message_count||0} msgs</div>
          </div>
        ))}
      </div>
      <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(184,150,46,0.15)',borderRadius:12,display:'flex',flexDirection:'column'}}>
        {!active?(
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#888',fontSize:14,padding:40}}>Select a thread to view messages</div>
        ):(
          <>
            <div style={{padding:'14px 20px',borderBottom:'1px solid rgba(184,150,46,0.15)',fontWeight:600,fontSize:15,color:'#b8962e',letterSpacing:'0.04em'}}>{active.title}</div>
            <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:12,minHeight:300,maxHeight:400}}>
              {messages.length===0&&<div style={{color:'#888',fontSize:13,textAlign:'center',padding:32}}>No messages yet.</div>}
              {messages.map(msg=>{
                const isMe=msg.sender_id===me;
                return(
                  <div key={msg.id} style={{alignSelf:isMe?'flex-end':'flex-start',maxWidth:'70%',background:isMe?'#fef3cd':'#f9fafb',border:`1px solid ${isMe?'#b8962e44':'#e5e7eb'}`,borderRadius:isMe?'12px 12px 4px 12px':'12px 12px 12px 4px',padding:'10px 14px'}}>
                    <div style={{fontSize:11,color:'#888',marginBottom:4}}>{isMe?'You':msg.sender_name}</div>
                    <div style={{fontSize:14,color:'#e8e0d0',lineHeight:1.5}}>{msg.body}</div>
                    <div style={{fontSize:11,color:'#aaa',marginTop:4,textAlign:'right'}}>{fmtTime(msg.created_at)}</div>
                  </div>
                );
              })}
              <div ref={bottomRef}/>
            </div>
            <div style={{padding:'12px 20px',borderTop:'1px solid #e5e7eb',display:'flex',gap:10}}>
              <textarea style={{...s.ta,minHeight:44,flex:1}} placeholder="Type a message... (Enter to send)" value={body} onChange={e=>setBody(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();}}}/>
              <button style={{...s.btn,alignSelf:'flex-end'}} onClick={handleSend} disabled={sending||!body.trim()}>{sending?'...':'Send'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
function DocumentsTab({ roomId, docs, me, isOwner, canEdit, onRefresh }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);
  const BASE_URL = import.meta.env.VITE_API_URL || '';

  async function handleUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true); setErr(null);
    const form = new FormData(); form.append('document', file);
    const token = getAccessToken();
    try {
      const res = await fetch(`${BASE_URL}/api/deal-rooms/${roomId}/documents`, {method:'POST',body:form,credentials:'include',headers:{Authorization:`Bearer ${token}`}});
      if (!res.ok) { const d=await res.json(); throw new Error(d.error||'Upload failed'); }
      onRefresh();
    } catch(ex) { setErr(ex.message); } finally { setUploading(false); e.target.value=''; }
  }
  async function handleView(docId) {
    try { const d=await api(`/api/deal-rooms/${roomId}/documents/${docId}`); window.open(d.url,'_blank'); } catch {}
  }
  async function handleDelete(docId, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await api(`/api/deal-rooms/${roomId}/documents/${docId}`,{method:'DELETE'}); onRefresh(); } catch {}
  }
  return (
    <div style={s.card}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <h3 style={{margin:0,fontSize:16,fontWeight:600}}>Documents</h3>
        {canEdit&&(
          <>
            <button style={s.btn} onClick={()=>fileRef.current?.click()} disabled={uploading}>{uploading?'Uploading...':'↑ Upload'}</button>
            <input ref={fileRef} type="file" style={{display:'none'}} onChange={handleUpload}/>
          </>
        )}
      </div>
      {err&&<div style={s.err}>{err}</div>}
      {docs.length===0&&<div style={{color:'#888',fontSize:14,textAlign:'center',padding:32}}>No documents yet.</div>}
      {docs.map(doc=>(
        <div key={doc.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderBottom:'1px solid rgba(184,150,46,0.1)'}}>
          <FileText size={18} color="#b8962e"/>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:500}}>{doc.title||doc.filename}</div>
            <div style={{fontSize:12,color:'#888'}}>{doc.file_size_bytes?Math.round(doc.file_size_bytes/1024)+' KB':''} · {fmt(doc.created_at)}</div>
          </div>
          <button style={{...s.btnG,padding:'5px 12px',fontSize:12}} onClick={()=>handleView(doc.id)}>↗ View</button>
          {(isOwner||doc.uploaded_by===me)&&<button style={{background:'transparent',border:'none',cursor:'pointer',color:'#ef4444'}} onClick={()=>handleDelete(doc.id,doc.title||doc.filename)}><Trash2 size={14}/></button>}
        </div>
      ))}
    </div>
  );
}

function MembersTab({ roomId, members, isOwner, onRefresh }) {
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(null);
  const ROLE_COLOR = { owner:'#b8962e', editor:'#6366f1', viewer:'#22c55e' };

  async function handleInvite() {
    setInviting(true); setErr(null); setOk(null);
    try { await api(`/api/deal-rooms/${roomId}/invite`,{method:'POST',body:JSON.stringify({email:email.trim(),role})}); setOk('Invited.'); setEmail(''); onRefresh(); }
    catch(ex) { setErr(ex.message||'Failed'); } finally { setInviting(false); }
  }
  async function handleRemove(userId, name) {
    if (!confirm(`Remove ${name}?`)) return;
    try { await api(`/api/deal-rooms/${roomId}/members/${userId}`,{method:'DELETE'}); onRefresh(); } catch {}
  }
  return (
    <div style={s.card}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <h3 style={{margin:0,fontSize:16,fontWeight:600}}>Participants</h3>
        {isOwner&&<button style={s.btnG} onClick={()=>setShowInvite(!showInvite)}>+ Invite</button>}
      </div>
      {showInvite&&(
        <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(184,150,46,0.2)',borderRadius:8,padding:16,marginBottom:20}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:8,alignItems:'end'}}>
            <div><div style={s.lbl}>Email</div><input style={s.inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="invitee@example.com"/></div>
            <div><div style={s.lbl}>Role</div>
              <select style={{...s.inp,width:'auto'}} value={role} onChange={e=>setRole(e.target.value)}>
                <option value="viewer">Viewer</option><option value="editor">Editor</option>
              </select>
            </div>
            <button style={{...s.btn,alignSelf:'flex-end'}} onClick={handleInvite} disabled={inviting}>{inviting?'...':'Invite'}</button>
          </div>
          {err&&<div style={s.err}>{err}</div>}
          {ok&&<div style={{color:'#22c55e',fontSize:13,marginTop:6}}>{ok}</div>}
        </div>
      )}
      {members.map(m=>(
        <div key={m.user_id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderBottom:'1px solid rgba(184,150,46,0.1)'}}>
          <div style={{width:38,height:38,borderRadius:'50%',background:'rgba(184,150,46,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,color:'#b8962e',flexShrink:0}}>
            {(m.full_name||'?').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:500}}>{m.full_name}</div>
            <div style={{fontSize:12,color:'#888'}}>{m.email}</div>
          </div>
          <span style={{fontSize:11,fontWeight:700,color:ROLE_COLOR[m.room_role]||'#888',border:`1px solid ${ROLE_COLOR[m.room_role]||'#888'}`,padding:'2px 8px',borderRadius:4,textTransform:'uppercase'}}>{m.room_role}</span>
          {isOwner&&m.room_role!=='owner'&&<button style={{background:'transparent',border:'none',cursor:'pointer',color:'#ef4444'}} onClick={()=>handleRemove(m.user_id,m.full_name)}><Trash2 size={14}/></button>}
        </div>
      ))}
    </div>
  );
}

function ActivityTab({ activity }) {
  const ACTION_LABEL = {
    view:'viewed the room', upload:'uploaded a document', download:'downloaded a document',
    delete:'deleted a document', invite:'invited a member', remove:'removed a member',
    thread_message:'posted a message', milestone_active:'started a milestone', milestone_completed:'completed a milestone',
  };
  return (
    <div style={s.card}>
      <h3 style={{margin:'0 0 20px',fontSize:16,fontWeight:600}}>Activity Timeline</h3>
      {activity.length===0&&<div style={{color:'#888',fontSize:14,textAlign:'center',padding:32}}>No activity yet.</div>}
      {activity.map((a,i)=>(
        <div key={a.id||i} style={{display:'flex',gap:12,paddingBottom:16,borderBottom:i<activity.length-1?'1px solid rgba(184,150,46,0.1)':'none',marginBottom:4}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#b8962e',flexShrink:0,marginTop:6}}/>
          <div>
            <span style={{fontSize:14,fontWeight:500}}>{a.user_name||'A user'}</span>
            <span style={{fontSize:14,color:'#555'}}> {ACTION_LABEL[a.action]||a.action}</span>
            <div style={{fontSize:12,color:'#888',marginTop:2}}>{fmtTime(a.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}