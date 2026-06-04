import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

function fmtUSD(n) {
  if (!n) return '$0';
  if (n >= 1e9) return '$' + (n/1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n/1e3).toFixed(0) + 'K';
  return '$' + n;
}
const SC = { energy:'#f59e0b', agriculture:'#84cc16', mining:'#a78bfa', infrastructure:'#06b6d4', manufacturing:'#f97316', logistics:'#22c55e', commodities:'#e11d48' };

export default function AnalyticsDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => { api('/api/stats/analytics').then(d => { setData(d); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); }); }, []);
  const s = { page: { minHeight:'100vh', background:'#0b0d10', color:'#e8e0d0', fontFamily:'Inter Tight, sans-serif' }, inner: { maxWidth:1100, margin:'0 auto', padding:'0 24px 80px' }, card: { background:'rgba(255,255,255,0.03)', border:'1px solid rgba(184,150,46,0.15)', borderRadius:12, padding:20 }, lbl: { fontSize:10, color:'#b8962e', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6, fontWeight:600 } };
  if (loading) return <div style={s.page}><div style={{ textAlign:'center', padding:64, color:'#666' }}>Loading analytics...</div></div>;
  if (error && (error.includes('Premium') || error.includes('requires') || error.includes('403'))) return (
    <div style={s.page}>
      <div style={{ ...s.inner, textAlign:'center', paddingTop:80 }}>
        <div style={{ fontSize:48, marginBottom:16 }}>📊</div>
        <h2 style={{ fontSize:24, fontWeight:700, marginBottom:12 }}>Premium Analytics</h2>
        <p style={{ color:'rgba(232,224,208,0.55)', marginBottom:32, maxWidth:480, margin:'0 auto 32px' }}>Market intelligence requires a Verified Business membership or higher.</p>
        <Link to="/pricing" style={{ background:'#b8962e', color:'#0b0d10', padding:'12px 32px', borderRadius:8, fontWeight:700, textDecoration:'none', fontSize:15 }}>Upgrade to Access Analytics</Link>
      </div>
    </div>
  );
  if (!data) return <div style={s.page}><div style={{ color:'#ef4444', padding:40 }}>{error}</div></div>;
  const maxS = Math.max(...(data.sector_trends||[]).map(x=>x.count),1);
  const maxC = Math.max(...(data.country_activity||[]).map(x=>x.opportunities),1);
  const maxF = Math.max(...(data.finance_type_demand||[]).map(x=>x.count),1);
  return (
    <div style={s.page}>
      <div style={{ background:'#0d0f13', borderBottom:'1px solid rgba(184,150,46,0.15)', padding:'12px 24px', display:'flex', alignItems:'center', gap:16 }}>
        <a href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}><span style={{ color:'#b8962e', fontSize:18 }}>◈</span><span style={{ color:'#e8e0d0', fontSize:14, fontWeight:600, letterSpacing:'0.05em' }}>SAREGO</span></a>
        <span style={{ color:'rgba(232,224,208,0.2)' }}>|</span>
        <a href="/dashboard" style={{ color:'rgba(232,224,208,0.5)', fontSize:13, textDecoration:'none' }}>Dashboard</a>
        <a href="/account" style={{ color:'rgba(232,224,208,0.5)', fontSize:13, textDecoration:'none', marginLeft:'auto' }}>My Account</a>
      </div>
      <div style={s.inner}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', margin:'32px 0' }}>
          <div><h1 style={{ fontSize:28, fontWeight:700, margin:'0 0 8px' }}>Market Intelligence</h1><div style={{ fontSize:14, color:'rgba(232,224,208,0.5)' }}>SADC trade analytics</div></div>
          <span style={{ fontSize:11, fontWeight:700, color:'#b8962e', border:'1px solid rgba(184,150,46,0.4)', padding:'4px 12px', borderRadius:10 }}>{data.tier ? data.tier.replace('_',' ').toUpperCase() : ''} ACCESS</span>
        </div>
        <div style={{ ...s.card, marginBottom:24 }}>
          <div style={s.lbl}>Interest Activity — Last 30 Days</div>
          <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:80, marginTop:12 }}>
            {(data.interest_activity||[]).map((d,i) => { const mv=Math.max(...(data.interest_activity||[]).map(x=>x.interests),1); return <div key={i} title={d.date+': '+d.interests} style={{ flex:1, background:'#b8962e', borderRadius:'2px 2px 0 0', height:Math.max((d.interests/mv)*72,4), opacity:0.8 }} />; })}
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
          <div style={s.card}><div style={s.lbl}>Sector Trends</div><div style={{ marginTop:12 }}>{(data.sector_trends||[]).slice(0,8).map(item => (<div key={item.sector} style={{ marginBottom:10 }}><div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:3 }}><span style={{ textTransform:'capitalize' }}>{(item.sector||'').replace(/_/g,' ')}</span><span style={{ color:'#b8962e', fontWeight:600 }}>{item.count} · {fmtUSD(item.total_value)}</span></div><div style={{ background:'rgba(255,255,255,0.06)', borderRadius:3, height:6 }}><div style={{ height:6, background:SC[item.sector]||'#b8962e', borderRadius:3, width:((item.count/maxS)*100)+'%' }} /></div></div>))}</div></div>
          <div style={s.card}><div style={s.lbl}>Country Activity</div><div style={{ marginTop:12 }}>{(data.country_activity||[]).slice(0,10).map(item => (<div key={item.country_iso} style={{ marginBottom:10 }}><div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:3 }}><span style={{ fontWeight:500 }}>{item.country_iso}</span><span style={{ color:'#b8962e', fontWeight:600 }}>{item.opportunities} · {fmtUSD(item.total_value)}</span></div><div style={{ background:'rgba(255,255,255,0.06)', borderRadius:3, height:6 }}><div style={{ height:6, background:'#06b6d4', borderRadius:3, width:((item.opportunities/maxC)*100)+'%' }} /></div></div>))}</div></div>
        </div>
        <div style={s.card}><div style={s.lbl}>Finance Type Demand</div><div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginTop:12 }}>{(data.finance_type_demand||[]).map(item => (<div key={item.finance_type} style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:12 }}><div style={{ fontSize:12, color:'rgba(232,224,208,0.6)', marginBottom:4, textTransform:'capitalize' }}>{(item.finance_type||'').replace(/_/g,' ')}</div><div style={{ fontSize:20, fontWeight:700, color:'#b8962e' }}>{item.count}</div><div style={{ fontSize:12, color:'rgba(232,224,208,0.4)' }}>{fmtUSD(item.total_value)}</div><div style={{ background:'rgba(255,255,255,0.06)', borderRadius:3, height:4, marginTop:8 }}><div style={{ height:4, background:'#b8962e', borderRadius:3, width:((item.count/maxF)*100)+'%' }} /></div></div>))}</div></div>
        {data.is_advanced && data.membership_stats && (<div style={{ ...s.card, marginTop:24 }}><div style={s.lbl}>Membership Distribution</div><div style={{ display:'flex', gap:24, marginTop:12, flexWrap:'wrap' }}>{data.membership_stats.map(m => (<div key={m.tier} style={{ textAlign:'center' }}><div style={{ fontSize:28, fontWeight:700, color:'#b8962e' }}>{m.count}</div><div style={{ fontSize:12, color:'rgba(232,224,208,0.5)', textTransform:'capitalize' }}>{(m.tier||'').replace('_',' ')}</div></div>))}</div></div>)}
      </div>
    </div>
  );
}
