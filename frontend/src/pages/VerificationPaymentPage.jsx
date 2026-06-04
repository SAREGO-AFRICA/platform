import React from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
const TYPES = [
  { id: 'business', label: 'Business Verification', price: 49, desc: 'KYC review, Verified badge, enhanced feed visibility', turnaround: '2-3 business days' },
  { id: 'institutional', label: 'Institutional Verification', price: 249, desc: 'Enhanced due diligence, Institutional badge, priority placement', turnaround: '3-5 business days' },
];
export default function VerificationPaymentPage() {
  const [selected, setSelected] = React.useState('business');
  const [ref, setRef] = React.useState('');
  const [provider, setProvider] = React.useState('bank_transfer');
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const tier = TYPES.find(t => t.id === selected);
  async function handleSubmit() {
    setSubmitting(true); setErr(null);
    try { await api('/api/billing/verification', { method:'POST', body:JSON.stringify({ verification_type:selected, payment_provider:provider, payment_reference:ref }) }); setDone(true); }
    catch(e) { setErr(e.message||'Failed'); } finally { setSubmitting(false); }
  }
  const pg = { minHeight:'100vh', background:'#0b0d10', color:'#e8e0d0', fontFamily:'Inter Tight, sans-serif' };
  const inn = { maxWidth:600, margin:'0 auto', padding:'0 24px 80px' };
  const inp = { width:'100%', background:'#1a1a1a', color:'#e8e0d0', border:'1px solid #333', borderRadius:6, padding:'10px 12px', fontSize:13, boxSizing:'border-box', marginTop:6 };
  const btn = { background:'#b8962e', color:'#0b0d10', border:'none', borderRadius:8, padding:'14px 24px', fontWeight:700, fontSize:15, cursor:'pointer', width:'100%', marginTop:16 };
  const lbl = { fontSize:11, color:'#b8962e', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600 };
  const sec = { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(184,150,46,0.15)', borderRadius:12, padding:20, marginTop:20 };
  const crd = (sel) => ({ background:sel?'rgba(184,150,46,0.08)':'rgba(255,255,255,0.03)', border:'1px solid '+(sel?'#b8962e':'rgba(255,255,255,0.08)'), borderRadius:12, padding:20, marginBottom:12, cursor:'pointer' });
  const NAV = <div style={{ background:'#0d0f13', borderBottom:'1px solid rgba(184,150,46,0.15)', padding:'12px 24px', display:'flex', alignItems:'center', gap:16 }}><a href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}><span style={{ color:'#b8962e', fontSize:18 }}>◈</span><span style={{ color:'#e8e0d0', fontSize:14, fontWeight:600 }}>SAREGO</span></a><span style={{ color:'rgba(232,224,208,0.2)' }}>|</span><a href="/dashboard" style={{ color:'rgba(232,224,208,0.5)', fontSize:13, textDecoration:'none' }}>Dashboard</a><a href="/account" style={{ color:'rgba(232,224,208,0.5)', fontSize:13, textDecoration:'none', marginLeft:'auto' }}>My Account</a></div>;
  if (done) return <div style={pg}>{NAV}<div style={{ ...inn, textAlign:'center', paddingTop:60 }}><div style={{ fontSize:48, marginBottom:16 }}>✅</div><h2 style={{ fontSize:24, fontWeight:700, marginBottom:12 }}>Verification Order Submitted</h2><p style={{ color:'rgba(232,224,208,0.6)', marginBottom:32 }}>Our team will review within {tier.turnaround}.</p><Link to="/account" style={{ background:'#b8962e', color:'#0b0d10', padding:'12px 32px', borderRadius:8, fontWeight:700, textDecoration:'none' }}>View Account</Link></div></div>;
  return (
    <div style={pg}>{NAV}<div style={inn}>
      <h1 style={{ fontSize:28, fontWeight:700, margin:'32px 0 8px' }}>Verification</h1>
      <p style={{ fontSize:14, color:'rgba(232,224,208,0.5)', margin:'0 0 32px' }}>Build institutional trust on SAREGO</p>
      {TYPES.map(t => (<div key={t.id} style={crd(selected===t.id)} onClick={()=>setSelected(t.id)}><div style={{ display:'flex', justifyContent:'space-between' }}><div style={{ fontSize:16, fontWeight:600 }}>{t.label}</div><div style={{ fontSize:28, fontWeight:800, color:'#b8962e' }}>${t.price}</div></div><div style={{ fontSize:13, color:'rgba(232,224,208,0.6)', marginTop:6 }}>{t.desc}</div><div style={{ fontSize:12, color:'#b8962e', marginTop:8 }}>Turnaround: {t.turnaround}</div></div>))}
      <div style={sec}>
        <div style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Payment Details</div>
        <div style={{ marginBottom:14 }}><div style={lbl}>Payment Method</div><select value={provider} onChange={e=>setProvider(e.target.value)} style={inp}><option value="bank_transfer">Bank Transfer (EFT)</option><option value="paypal">PayPal</option><option value="wise">Wise</option><option value="other">Other</option></select></div>
        <div style={{ marginBottom:14 }}><div style={lbl}>Payment Reference</div><input value={ref} onChange={e=>setRef(e.target.value)} placeholder="Transaction ID or reference number" style={inp} /></div>
        <div style={{ fontSize:13, color:'rgba(232,224,208,0.5)', lineHeight:1.6, padding:'12px 0', borderTop:'1px solid rgba(255,255,255,0.06)' }}>Send ${tier&&tier.price} USD to <strong style={{ color:'#e8e0d0' }}>payments@sarego.africa</strong> with your email as reference.</div>
        {err && <div style={{ color:'#ef4444', fontSize:13, marginTop:8 }}>{err}</div>}
        <button onClick={handleSubmit} disabled={submitting||!ref.trim()} style={{ ...btn, opacity:!ref.trim()?0.5:1 }}>{submitting?'Submitting...':'Submit Order — $'+(tier&&tier.price)}</button>
      </div>
    </div></div>
  );
}
