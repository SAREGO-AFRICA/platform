import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
const PKGS = [
  { id:'standard', label:'Standard', price:0, desc:'Free listing, standard visibility', features:['Opportunity feed listing','Provider matching','Basic profile'] },
  { id:'priority', label:'Priority', price:199, desc:'Enhanced visibility, 30-day boost', features:['Priority feed placement','Featured badge','Provider notifications','30-day boost'] },
  { id:'premium', label:'Premium', price:499, desc:'Maximum visibility, 60-day boost', features:['Top feed placement','Homepage featured','Direct provider intro','60-day boost'] },
];
export default function TradeFinanceListingFeePage() {
  const navigate = useNavigate();
  const [sel, setSel] = React.useState('priority');
  const [ref, setRef] = React.useState('');
  const [prov, setProv] = React.useState('bank_transfer');
  const [lid, setLid] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const pkg = PKGS.find(p=>p.id===sel);
  async function submit() {
    if (pkg.price===0) { navigate('/opportunities/trade_finance/new'); return; }
    setBusy(true); setErr(null);
    try { await api('/api/billing/featured', { method:'POST', body:JSON.stringify({ listing_type:'trade_finance', listing_id:lid, feature_type:sel==='premium'?'homepage_featured':'featured_opportunity', payment_provider:prov, payment_reference:ref }) }); setDone(true); }
    catch(e) { setErr(e.message||'Failed'); } finally { setBusy(false); }
  }
  const pg = { minHeight:'100vh', background:'#f5f0e8', color:'#f0ebe0', fontFamily:'Inter Tight, sans-serif' };
  const inn = { maxWidth:700, margin:'0 auto', padding:'0 24px 80px' };
  const inp = { width:'100%', background:'#f0ebe0', color:'#f0ebe0', border:'1px solid #333', borderRadius:6, padding:'10px 12px', fontSize:13, boxSizing:'border-box', marginTop:6 };
  const btn = { background:'#b8962e', color:'#f5f0e8', border:'none', borderRadius:8, padding:'14px 24px', fontWeight:700, fontSize:15, cursor:'pointer', width:'100%', marginTop:16 };
  const lbl = { fontSize:11, color:'#b8962e', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600 };
  const sec = { background:'rgba(0,0,0,0.04)', border:'1px solid rgba(184,150,46,0.15)', borderRadius:12, padding:20, marginTop:20 };
  const crd = (s) => ({ background:s?'rgba(184,150,46,0.08)':'rgba(255,255,255,0.03)', border:'1px solid '+(s?'#b8962e':'rgba(0,0,0,0.1)'), borderRadius:12, padding:20, cursor:'pointer' });
  const NAV = <div style={{ background:'#ece8df', borderBottom:'1px solid rgba(184,150,46,0.15)', padding:'12px 24px', display:'flex', alignItems:'center', gap:16 }}><a href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}><span style={{ color:'#b8962e', fontSize:18 }}>◈</span><span style={{ color:'#f0ebe0', fontSize:14, fontWeight:600 }}>SAREGO</span></a><span style={{ color:'rgba(232,224,208,0.2)' }}>|</span><a href="/my-listings" style={{ color:'rgba(26,26,26,0.55)', fontSize:13, textDecoration:'none' }}>My Listings</a><a href="/account" style={{ color:'rgba(26,26,26,0.55)', fontSize:13, textDecoration:'none', marginLeft:'auto' }}>My Account</a></div>;
  if (done) return <div style={pg}>{NAV}<div style={{ ...inn, textAlign:'center', paddingTop:60 }}><h2 style={{ fontSize:24, fontWeight:700, marginBottom:12 }}>Listing Boosted</h2><p style={{ color:'rgba(26,26,26,0.65)', marginBottom:32 }}>Priority placement active within 24 hours of payment confirmation.</p><Link to="/my-listings" style={{ background:'#b8962e', color:'#f5f0e8', padding:'12px 32px', borderRadius:8, fontWeight:700, textDecoration:'none' }}>View My Listings</Link></div></div>;
  return (
    <div style={pg}>{NAV}<div style={inn}>
      <h1 style={{ fontSize:28, fontWeight:700, margin:'32px 0 8px' }}>Finance Listing Packages</h1>
      <p style={{ fontSize:14, color:'rgba(26,26,26,0.55)', margin:'0 0 24px' }}>Boost visibility for your trade finance request</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
        {PKGS.map(p => (<div key={p.id} style={crd(sel===p.id)} onClick={()=>setSel(p.id)}><div style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>{p.label}</div><div style={{ fontSize:24, fontWeight:800, color:p.price===0?'#888':'#b8962e', marginBottom:8 }}>{p.price===0?'Free':'$'+p.price}</div><div style={{ fontSize:12, color:'rgba(26,26,26,0.55)', marginBottom:10 }}>{p.desc}</div>{p.features.map((f,i)=><div key={i} style={{ fontSize:12, color:'rgba(26,26,26,0.75)', padding:'2px 0' }}>✓ {f}</div>)}</div>))}
      </div>
      {pkg.price>0 && (<div style={sec}>
        <div style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Payment Details</div>
        <div style={{ marginBottom:14 }}><div style={lbl}>Listing ID</div><input value={lid} onChange={e=>setLid(e.target.value)} placeholder="Paste your trade finance listing UUID" style={inp} /></div>
        <div style={{ marginBottom:14 }}><div style={lbl}>Payment Method</div><select value={prov} onChange={e=>setProv(e.target.value)} style={inp}><option value="bank_transfer">Bank Transfer</option><option value="paypal">PayPal</option><option value="wise">Wise</option><option value="other">Other</option></select></div>
        <div style={{ marginBottom:14 }}><div style={lbl}>Payment Reference</div><input value={ref} onChange={e=>setRef(e.target.value)} placeholder="Transaction ID or reference" style={inp} /></div>
        <div style={{ fontSize:13, color:'rgba(26,26,26,0.55)', lineHeight:1.6, padding:'12px 0', borderTop:'1px solid rgba(255,255,255,0.06)' }}>Send ${pkg.price} USD to <strong style={{ color:'#f0ebe0' }}>payments@sarego.africa</strong></div>
        {err && <div style={{ color:'#ef4444', fontSize:13, marginTop:8 }}>{err}</div>}
        <button onClick={submit} disabled={busy||!ref.trim()||!lid.trim()} style={{ ...btn, opacity:(!ref.trim()||!lid.trim())?0.5:1 }}>{busy?'Submitting...':'Submit — $'+pkg.price}</button>
      </div>)}
      {pkg.price===0 && <button onClick={submit} style={btn}>Create Standard Listing</button>}
    </div></div>
  );
}
