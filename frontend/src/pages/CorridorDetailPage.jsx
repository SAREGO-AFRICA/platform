import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import Header from '../components/Header';
import RouteMapWidget from '../components/RouteMapWidget';

const COUNTRY_NAMES = { ZA:'South Africa', ZW:'Zimbabwe', ZM:'Zambia', BW:'Botswana', NA:'Namibia', MZ:'Mozambique', TZ:'Tanzania', MU:'Mauritius', LS:'Lesotho', SZ:'Eswatini', MW:'Malawi', AO:'Angola', CD:'DR Congo', MG:'Madagascar', KE:'Kenya' };
function cn(iso) { return COUNTRY_NAMES[iso] || iso; }
function fmtUSD(n) { if (!n) return '—'; if (n>=1e9) return '$'+(n/1e9).toFixed(1)+'B'; if (n>=1e6) return '$'+(n/1e6).toFixed(1)+'M'; if (n>=1e3) return '$'+(n/1e3).toFixed(0)+'K'; return '$'+n; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString(undefined,{dateStyle:'medium'}) : '—'; }

function ListingCard({ item, type, linkBase }) {
  return (
    <Link to={'/opportunities/'+linkBase+'/'+item.id} style={{ textDecoration:'none' }}>
      <div style={{ background:'rgba(0,0,0,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'14px 16px', marginBottom:10, transition:'border-color 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.borderColor='rgba(184,150,46,0.3)'}
        onMouseLeave={e => e.currentTarget.style.borderColor='rgba(0,0,0,0.1)'}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:500, color:'#f0ebe0', marginBottom:4 }}>{item.title}</div>
            <div style={{ fontSize:12, color:'rgba(26,26,26,0.55)' }}>
              {type==='logistics' && item.cargo_type && <span>{item.cargo_type}</span>}
              {type==='trade_finance' && item.finance_type && <span style={{ textTransform:'capitalize' }}>{item.finance_type.replace(/_/g,' ')}</span>}
              {type==='commodity' && item.commodity && <span>{item.commodity}</span>}
              {item.sector && <span> · {item.sector}</span>}
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:15, fontWeight:600, color:'#b8962e' }}>{fmtUSD(item.value_usd)}</div>
            <div style={{ fontSize:11, color:'rgba(232,224,208,0.35)', marginTop:2 }}>{fmtDate(item.published_at)}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function CorridorDetailPage() {
  const { id } = useParams();
  const [origin, destination] = (id||'').split('-');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!origin || !destination) return;
    api('/api/stats/corridor/'+origin+'/'+destination)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [origin, destination]);

  const s = {
    page: { minHeight:'100vh', background:'#f5f0e8', color:'#f0ebe0', fontFamily:'Inter Tight, sans-serif' },
    inner: { maxWidth:1000, margin:'0 auto', padding:'48px 24px' },
    section: { marginBottom:32 },
    secTitle: { fontSize:12, color:'#b8962e', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, marginBottom:16, paddingBottom:8, borderBottom:'1px solid rgba(184,150,46,0.15)' },
    stat: { background:'rgba(0,0,0,0.04)', border:'1px solid rgba(184,150,46,0.15)', borderRadius:10, padding:'16px 20px', textAlign:'center' },
  };

  return (
    <div style={s.page}>
      <Header variant="dark" />
      <div style={s.inner}>
        {/* Breadcrumb */}
        <div style={{ fontSize:12, color:'rgba(26,26,26,0.45)', marginBottom:24 }}>
          <Link to="/corridors" style={{ color:'#b8962e', textDecoration:'none' }}>Corridors</Link>
          <span> / </span>
          <span>{origin} → {destination}</span>
        </div>

        {/* Header */}
        <div style={{ marginBottom:32 }}>
          <div style={{ fontSize:11, color:'#b8962e', textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:600, marginBottom:10 }}>TRADE CORRIDOR</div>
          <h1 style={{ fontSize:'clamp(24px,3vw,38px)', fontWeight:500, margin:'0 0 8px', letterSpacing:'-0.01em' }}>
            {cn(origin)} <span style={{ color:'rgba(26,26,26,0.35)' }}>→</span> {cn(destination)}
          </h1>
          <div style={{ fontSize:15, color:'rgba(26,26,26,0.55)' }}>{origin} → {destination} economic corridor</div>
        </div>

        {loading && <div style={{ color:'#666', padding:48, textAlign:'center' }}>Loading corridor data...</div>}

        {data && (
          <>
            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:32 }}>
              <div style={s.stat}><div style={{ fontSize:32, fontWeight:700, color:'#b8962e' }}>{data.summary?.total_flows||0}</div><div style={{ fontSize:12, color:'rgba(26,26,26,0.55)', marginTop:4 }}>Active Flows</div></div>
              <div style={s.stat}><div style={{ fontSize:32, fontWeight:700, color:'#f0ebe0' }}>{fmtUSD(data.summary?.total_value)}</div><div style={{ fontSize:12, color:'rgba(26,26,26,0.55)', marginTop:4 }}>Total Value</div></div>
              <div style={s.stat}><div style={{ fontSize:32, fontWeight:700, color:'#22c55e' }}>{(data.logistics?.length||0)+(data.trade_finance?.length||0)+(data.commodity?.length||0)}</div><div style={{ fontSize:12, color:'rgba(26,26,26,0.55)', marginTop:4 }}>Listed Opportunities</div></div>
            </div>

            {/* Route Map */}
            <RouteMapWidget originIso={origin} destinationIso={destination} />

            {/* Logistics */}
            {data.logistics?.length > 0 && (
              <div style={{ ...s.section, marginTop:32 }}>
                <div style={s.secTitle}>Logistics Loads ({data.logistics.length})</div>
                {data.logistics.map(item => <ListingCard key={item.id} item={item} type="logistics" linkBase="logistics_load" />)}
              </div>
            )}

            {/* Trade Finance */}
            {data.trade_finance?.length > 0 && (
              <div style={s.section}>
                <div style={s.secTitle}>Trade Finance ({data.trade_finance.length})</div>
                {data.trade_finance.map(item => <ListingCard key={item.id} item={item} type="trade_finance" linkBase="trade_finance" />)}
              </div>
            )}

            {/* Commodity */}
            {data.commodity?.length > 0 && (
              <div style={s.section}>
                <div style={s.secTitle}>Commodity Requests ({data.commodity.length})</div>
                {data.commodity.map(item => <ListingCard key={item.id} item={item} type="commodity" linkBase="commodity_request" />)}
              </div>
            )}

            {data.logistics?.length===0 && data.trade_finance?.length===0 && data.commodity?.length===0 && (
              <div style={{ textAlign:'center', padding:48, color:'rgba(26,26,26,0.45)' }}>No active listings on this corridor.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
