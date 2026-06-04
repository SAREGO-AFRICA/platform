import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';

const COUNTRY_NAMES = { ZA:'South Africa', ZW:'Zimbabwe', ZM:'Zambia', BW:'Botswana', NA:'Namibia', MZ:'Mozambique', TZ:'Tanzania', MU:'Mauritius', LS:'Lesotho', SZ:'Eswatini', MW:'Malawi', AO:'Angola', CD:'DR Congo', MG:'Madagascar', KE:'Kenya' };
function cn(iso) { return COUNTRY_NAMES[iso] || iso; }
function fmtUSD(n) { if (!n) return ''; if (n>=1e9) return '$'+(n/1e9).toFixed(1)+'B'; if (n>=1e6) return '$'+(n/1e6).toFixed(1)+'M'; if (n>=1e3) return '$'+(n/1e3).toFixed(0)+'K'; return '$'+n; }

export default function CorridorsIndexPage() {
  const [corridors, setCorridors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats/corridors')
      .then(r => r.json())
      .then(d => { setCorridors(d.corridors||[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight:'100vh', background:'#0b0d10', color:'#e8e0d0', fontFamily:'Inter Tight, sans-serif' }}>
      <Header variant="dark" />
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'48px 24px' }}>
        <div style={{ marginBottom:40 }}>
          <div style={{ fontSize:11, color:'#b8962e', textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:600, marginBottom:12 }}>TRADE CORRIDORS</div>
          <h1 style={{ fontSize:'clamp(28px,3vw,42px)', fontWeight:500, margin:'0 0 12px', letterSpacing:'-0.01em' }}>Active Economic Corridors</h1>
          <p style={{ fontSize:15, color:'rgba(232,224,208,0.55)', maxWidth:560, lineHeight:1.6, margin:0 }}>Live commodity flows, logistics routes, and trade finance demand across Southern Africa.</p>
        </div>

        {loading && <div style={{ color:'#666', textAlign:'center', padding:48 }}>Loading corridors...</div>}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
          {corridors.map(c => (
            <Link key={c.origin+'-'+c.destination} to={'/corridors/'+c.origin+'-'+c.destination} style={{ textDecoration:'none' }}>
              <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(184,150,46,0.15)', borderRadius:12, padding:20, transition:'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor='rgba(184,150,46,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor='rgba(184,150,46,0.15)'}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <span style={{ fontSize:18, fontWeight:700, color:'#b8962e' }}>{c.origin}</span>
                  <span style={{ color:'rgba(232,224,208,0.3)', fontSize:14 }}>→</span>
                  <span style={{ fontSize:18, fontWeight:700, color:'#22c55e' }}>{c.destination}</span>
                </div>
                <div style={{ fontSize:13, color:'rgba(232,224,208,0.6)', marginBottom:12 }}>{cn(c.origin)} → {cn(c.destination)}</div>
                <div style={{ display:'flex', gap:16, fontSize:12 }}>
                  <span style={{ color:'#b8962e', fontWeight:600 }}>{c.flow_count} {c.flow_count===1?'flow':'flows'}</span>
                  {c.total_value > 0 && <span style={{ color:'rgba(232,224,208,0.5)' }}>{fmtUSD(c.total_value)}</span>}
                </div>
                <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                  {(c.types||[]).map(t => <span key={t} style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(255,255,255,0.05)', color:'rgba(232,224,208,0.5)', textTransform:'capitalize' }}>{t.replace('_',' ')}</span>)}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {!loading && corridors.length === 0 && (
          <div style={{ textAlign:'center', padding:64, color:'rgba(232,224,208,0.4)' }}>No active cross-border corridors found.</div>
        )}
      </div>
    </div>
  );
}
