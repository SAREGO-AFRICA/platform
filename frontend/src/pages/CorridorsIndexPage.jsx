import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { api } from '../lib/api';

const COUNTRY_NAMES = { ZA:'South Africa', ZW:'Zimbabwe', ZM:'Zambia', BW:'Botswana', NA:'Namibia', MZ:'Mozambique', TZ:'Tanzania', MU:'Mauritius', LS:'Lesotho', SZ:'Eswatini', MW:'Malawi', AO:'Angola', CD:'DR Congo', MG:'Madagascar', KE:'Kenya' };
function cn(iso) { return COUNTRY_NAMES[iso] || iso; }
function fmtUSD(n) { if (!n) return ''; if (n>=1e9) return '$'+(n/1e9).toFixed(1)+'B'; if (n>=1e6) return '$'+(n/1e6).toFixed(1)+'M'; if (n>=1e3) return '$'+(n/1e3).toFixed(0)+'K'; return '$'+n; }

export default function CorridorsIndexPage() {
  const [corridors, setCorridors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api('/api/stats/corridors')
      .then(d => { setCorridors(d.corridors||[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = corridors.filter(c => {
    if (filter === 'regional') return c.origin !== c.destination;
    if (filter === 'domestic') return c.origin === c.destination;
    return true;
  });

  // Sort: regional first, then domestic
  const sorted = [...filtered].sort((a, b) => {
    const aD = a.origin === a.destination ? 1 : 0;
    const bD = b.origin === b.destination ? 1 : 0;
    return aD - bD || b.flow_count - a.flow_count;
  });

  const tabStyle = (active) => ({
    padding: '8px 20px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: active ? '#b8962e' : 'rgba(0,0,0,0.07)',
    color: active ? '#f5f0e8' : 'rgba(26,26,26,0.65)',
  });

  return (
    <div style={{ minHeight:'100vh', background:'#f5f0e8', color:'#f0ebe0', fontFamily:'Inter Tight, sans-serif' }}>
      <Header variant="dark" />
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'48px 24px' }}>
        <div style={{ marginBottom:32 }}>
          <div style={{ fontSize:11, color:'#b8962e', textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:600, marginBottom:12 }}>TRADE CORRIDORS</div>
          <h1 style={{ fontSize:'clamp(28px,3vw,42px)', fontWeight:500, margin:'0 0 12px', letterSpacing:'-0.01em' }}>Active Economic Corridors</h1>
          <p style={{ fontSize:15, color:'rgba(26,26,26,0.6)', maxWidth:560, lineHeight:1.6, margin:0 }}>Live commodity flows, logistics routes, and trade finance demand across Southern Africa.</p>
        </div>

        {/* Filter tabs */}
        <div style={{ display:'flex', gap:8, marginBottom:32 }}>
          <button style={tabStyle(filter==='all')} onClick={()=>setFilter('all')}>All Corridors</button>
          <button style={tabStyle(filter==='regional')} onClick={()=>setFilter('regional')}>Regional</button>
          <button style={tabStyle(filter==='domestic')} onClick={()=>setFilter('domestic')}>Domestic</button>
        </div>

        {/* Stats row */}
        {!loading && (
          <div style={{ display:'flex', gap:24, marginBottom:32, fontSize:13, color:'rgba(26,26,26,0.55)' }}>
            <span><strong style={{ color:'#b8962e' }}>{sorted.length}</strong> corridors</span>
            <span><strong style={{ color:'#b8962e' }}>{sorted.filter(c=>c.origin!==c.destination).length}</strong> cross-border</span>
            <span><strong style={{ color:'#b8962e' }}>{sorted.filter(c=>c.origin===c.destination).length}</strong> domestic</span>
          </div>
        )}

        {loading && <div style={{ color:'#666', textAlign:'center', padding:48 }}>Loading corridors...</div>}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
          {sorted.map(c => {
            const isDomestic = c.origin === c.destination;
            return (
              <Link key={c.origin+'-'+c.destination} to={'/corridors/'+c.origin+'-'+c.destination} style={{ textDecoration:'none' }}>
                <div style={{ background:'rgba(0,0,0,0.04)', border:'1px solid rgba(184,150,46,0.15)', borderRadius:12, padding:20, transition:'border-color 0.2s', position:'relative' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor='rgba(184,150,46,0.4)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor='rgba(184,150,46,0.15)'}>
                  <span style={{ position:'absolute', top:12, right:12, fontSize:9, padding:'2px 8px', borderRadius:8, background: isDomestic ? 'rgba(0,0,0,0.07)' : 'rgba(34,197,94,0.1)', color: isDomestic ? 'rgba(26,26,26,0.45)' : '#22c55e', textTransform:'uppercase', letterSpacing:'0.08em', border: isDomestic ? 'none' : '1px solid rgba(34,197,94,0.3)' }}>{isDomestic ? 'Domestic' : 'Regional'}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                    <span style={{ fontSize:18, fontWeight:700, color:'#b8962e' }}>{c.origin}</span>
                    <span style={{ color:'rgba(26,26,26,0.35)', fontSize:14 }}>→</span>
                    <span style={{ fontSize:18, fontWeight:700, color: isDomestic ? '#b8962e' : '#22c55e' }}>{c.destination}</span>
                  </div>
                  <div style={{ fontSize:13, color:'rgba(26,26,26,0.65)', marginBottom:12 }}>{cn(c.origin)}{isDomestic ? ' (domestic)' : ' → '+cn(c.destination)}</div>
                  <div style={{ display:'flex', gap:16, fontSize:12 }}>
                    <span style={{ color:'#b8962e', fontWeight:600 }}>{c.flow_count} {c.flow_count===1?'flow':'flows'}</span>
                    {c.total_value > 0 && <span style={{ color:'rgba(26,26,26,0.55)' }}>{fmtUSD(c.total_value)}</span>}
                  </div>
                  <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                    {(c.types||[]).map(t => <span key={t} style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(0,0,0,0.06)', color:'rgba(26,26,26,0.55)', textTransform:'capitalize' }}>{t.replace('_',' ')}</span>)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {!loading && sorted.length === 0 && (
          <div style={{ textAlign:'center', padding:64, color:'rgba(26,26,26,0.45)' }}>No corridors found for this filter.</div>
        )}
      </div>
    </div>
  );
}
