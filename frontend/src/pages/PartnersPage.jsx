import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { api } from '../lib/api';

function fmtUSD(n) { if (!n && n !== 0) return '$0'; return '$' + Number(n).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString(undefined,{dateStyle:'medium'}) : '—'; }

const TIER_META = {
  connector:        { label:'Connector',        color:'#888',    range:'1–10 referrals' },
  ambassador:       { label:'Ambassador',        color:'#22c55e', range:'11–50 referrals' },
  ecosystem_partner:{ label:'Ecosystem Partner', color:'#b8962e', range:'51–100 referrals' },
  strategic_partner:{ label:'Strategic Partner', color:'#6366f1', range:'100+ referrals' },
};

const STATUS_COLOR = { pending:'#f59e0b', approved:'#22c55e', paid:'#22c55e', registered:'#6366f1', verified:'#22c55e', active:'#22c55e', commissionable:'#b8962e' };

export default function PartnersPage() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [tab, setTab] = useState('overview');
  const [commFilter, setCommFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);
  const [notPartner, setNotPartner] = useState(false);

  useEffect(() => {
    Promise.all([
      api('/api/partners/stats'),
      api('/api/partners/referrals'),
      api('/api/partners/commissions'),
    ]).then(([s, r, c]) => {
      setStats(s);
      setProfile(s.profile);
      setReferrals(r.referrals || []);
      setCommissions(c.commissions || []);
      setLoading(false);
      if (!s.profile) setNotPartner(true);
    }).catch(() => { setNotPartner(true); setLoading(false); });
  }, []);

  async function handleJoin() {
    setJoining(true);
    try {
      const d = await api('/api/partners/join', { method: 'POST' });
      setProfile(d.profile);
      setNotPartner(false);
      const s = await api('/api/partners/stats');
      setStats(s);
    } catch(e) { alert(e.message||'Failed to enroll'); }
    finally { setJoining(false); }
  }

  function copyCode() {
    if (!profile) return;
    navigator.clipboard.writeText('https://sarego.africa/register?ref=' + profile.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filteredComm = commFilter ? commissions.filter(c => c.revenue_type === commFilter) : commissions;

  const s = {
    page:    { minHeight:'100vh', background:'#f5f0e8', color:'#f0ebe0', fontFamily:'Inter Tight, sans-serif' },
    inner:   { maxWidth:1000, margin:'0 auto', padding:'48px 24px' },
    card:    { background:'rgba(0,0,0,0.04)', border:'1px solid rgba(184,150,46,0.15)', borderRadius:12, padding:24, marginBottom:20 },
    stat:    { background:'rgba(0,0,0,0.04)', border:'1px solid rgba(184,150,46,0.1)', borderRadius:10, padding:'16px 20px', textAlign:'center' },
    lbl:     { fontSize:10, color:'#b8962e', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6, fontWeight:600 },
    tab:     (a) => ({ padding:'8px 20px', borderRadius:20, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, background:a?'#b8962e':'rgba(0,0,0,0.07)', color:a?'#f5f0e8':'rgba(26,26,26,0.65)' }),
    row:     { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' },
    badge:   (color) => ({ fontSize:11, fontWeight:700, color, border:'1px solid '+color+'44', padding:'2px 10px', borderRadius:8, background:color+'11' }),
    inp:     { background:'#f0ebe0', color:'#f0ebe0', border:'1px solid #333', borderRadius:6, padding:'10px 14px', fontSize:13, flex:1 },
    btn:     { background:'#b8962e', color:'#f5f0e8', border:'none', borderRadius:8, padding:'10px 20px', fontWeight:700, fontSize:13, cursor:'pointer' },
  };

  if (loading) return <div style={s.page}><Header variant="dark" /><div style={{ textAlign:'center', padding:64, color:'#666' }}>Loading...</div></div>;

  if (notPartner || !profile) return (
    <div style={s.page}>
      <Header variant="dark" />
      <div style={{ ...s.inner, textAlign:'center', paddingTop:80 }}>
        <div style={{ fontSize:11, color:'#b8962e', textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:600, marginBottom:16 }}>ECOSYSTEM PARTNER PROGRAM</div>
        <h1 style={{ fontSize:'clamp(28px,3vw,42px)', fontWeight:500, margin:'0 0 16px' }}>Build the SADC Economic Ecosystem</h1>
        <p style={{ fontSize:16, color:'rgba(26,26,26,0.65)', maxWidth:560, margin:'0 auto 40px', lineHeight:1.7 }}>
          Introduce businesses, capital providers, governments, and opportunity creators into SAREGO. Earn recurring revenue as the ecosystem grows.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16, maxWidth:700, margin:'0 auto 48px', textAlign:'left' }}>
          {[
            { label:'Subscription Revenue', value:'20% for 12 months' },
            { label:'Verification Revenue', value:'20% one-time' },
            { label:'Featured Listings', value:'20% per placement' },
            { label:'Facilitation Fees', value:'10% of SAREGO fee' },
          ].map(item => (
            <div key={item.label} style={{ background:'rgba(0,0,0,0.04)', border:'1px solid rgba(184,150,46,0.15)', borderRadius:10, padding:16 }}>
              <div style={{ fontSize:11, color:'#b8962e', fontWeight:600, marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>{item.label}</div>
              <div style={{ fontSize:18, fontWeight:700 }}>{item.value}</div>
            </div>
          ))}
        </div>
        <button onClick={handleJoin} disabled={joining} style={{ ...s.btn, fontSize:16, padding:'14px 40px' }}>
          {joining ? 'Enrolling...' : 'Join the Ecosystem Partner Program'}
        </button>
        <div style={{ marginTop:16, fontSize:13, color:'rgba(26,26,26,0.45)' }}>Free to join. Commissions paid on verified revenue events only.</div>
      </div>
    </div>
  );

  const tier = TIER_META[profile.tier] || TIER_META.connector;

  return (
    <div style={s.page}>
      <Header variant="dark" />
      <div style={s.inner}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:32 }}>
          <div>
            <div style={{ fontSize:11, color:'#b8962e', textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:600, marginBottom:10 }}>ECOSYSTEM PARTNER</div>
            <h1 style={{ fontSize:'clamp(24px,3vw,36px)', fontWeight:500, margin:'0 0 8px' }}>Partner Dashboard</h1>
            <div style={{ fontSize:14, color:'rgba(26,26,26,0.55)' }}>Referral Code: <strong style={{ color:'#b8962e' }}>{profile.referral_code}</strong></div>
          </div>
          <span style={s.badge(tier.color)}>{tier.label}</span>
        </div>

        {/* Stats grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
          <div style={s.stat}><div style={{ fontSize:28, fontWeight:700, color:'#b8962e' }}>{profile.lifetime_referrals}</div><div style={{ fontSize:12, color:'rgba(26,26,26,0.55)', marginTop:4 }}>Total Referrals</div></div>
          <div style={s.stat}><div style={{ fontSize:28, fontWeight:700, color:'#f59e0b' }}>{fmtUSD(stats?.commissions?.pending)}</div><div style={{ fontSize:12, color:'rgba(26,26,26,0.55)', marginTop:4 }}>Pending</div></div>
          <div style={s.stat}><div style={{ fontSize:28, fontWeight:700, color:'#22c55e' }}>{fmtUSD(stats?.commissions?.approved)}</div><div style={{ fontSize:12, color:'rgba(26,26,26,0.55)', marginTop:4 }}>Approved</div></div>
          <div style={s.stat}><div style={{ fontSize:28, fontWeight:700, color:'#f0ebe0' }}>{fmtUSD(stats?.commissions?.paid)}</div><div style={{ fontSize:12, color:'rgba(26,26,26,0.55)', marginTop:4 }}>Paid Out</div></div>
        </div>

        {/* Tier progress */}
        <div style={{ ...s.card, marginBottom:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={s.lbl}>Partner Tier</div>
            <span style={s.badge(tier.color)}>{tier.label} · {tier.range}</span>
          </div>
          <div style={{ display:'flex', gap:0, borderRadius:6, overflow:'hidden', height:8 }}>
            {[
              { key:'connector', min:0, max:10 },
              { key:'ambassador', min:11, max:50 },
              { key:'ecosystem_partner', min:51, max:100 },
              { key:'strategic_partner', min:101, max:200 },
            ].map(t => {
              const isActive = profile.tier === t.key;
              const isPast = profile.lifetime_referrals > t.max;
              return <div key={t.key} style={{ flex:1, background: isPast||isActive ? TIER_META[t.key].color : 'rgba(0,0,0,0.07)', opacity: isActive ? 1 : isPast ? 0.5 : 0.2 }} />;
            })}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'rgba(26,26,26,0.35)', marginTop:6 }}>
            <span>Connector</span><span>Ambassador</span><span>Ecosystem</span><span>Strategic</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:8, marginBottom:24 }}>
          {['overview','referrals','earnings','tools'].map(t => (
            <button key={t} style={s.tab(tab===t)} onClick={()=>setTab(t)}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab==='overview' && (
          <div style={s.card}>
            <div style={s.lbl}>Recent Referrals</div>
            {referrals.length===0 && <div style={{ color:'rgba(26,26,26,0.45)', fontSize:13, padding:'16px 0' }}>No referrals yet. Share your referral link to get started.</div>}
            {referrals.slice(0,5).map(r => (
              <div key={r.id} style={s.row}>
                <div>
                  <div style={{ fontSize:14 }}>{r.referred_email||r.referred_name||'Anonymous'}</div>
                  <div style={{ fontSize:12, color:'rgba(26,26,26,0.45)', marginTop:2 }}>{fmtDate(r.created_at)}</div>
                </div>
                <span style={s.badge(STATUS_COLOR[r.status]||'#888')}>{r.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Referrals */}
        {tab==='referrals' && (
          <div style={s.card}>
            <div style={s.lbl}>All Referrals ({referrals.length})</div>
            {referrals.length===0 && <div style={{ color:'rgba(26,26,26,0.45)', fontSize:13, padding:'16px 0' }}>No referrals yet.</div>}
            {referrals.map(r => (
              <div key={r.id} style={s.row}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14 }}>{r.referred_email||r.referred_name||'Anonymous'}</div>
                  <div style={{ fontSize:12, color:'rgba(26,26,26,0.45)', marginTop:2 }}>Joined {fmtDate(r.created_at)} · {r.membership_tier||'free'}</div>
                </div>
                <span style={s.badge(STATUS_COLOR[r.status]||'#888')}>{r.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Earnings */}
        {tab==='earnings' && (
          <div style={s.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={s.lbl}>Commission History</div>
              <select value={commFilter} onChange={e=>setCommFilter(e.target.value)} style={{ background:'#f0ebe0', color:'#f0ebe0', border:'1px solid #333', borderRadius:6, padding:'6px 10px', fontSize:12 }}>
                <option value="">All Types</option>
                <option value="subscription">Subscription</option>
                <option value="verification">Verification</option>
                <option value="featured_listing">Featured Listing</option>
                <option value="facilitation_fee">Facilitation Fee</option>
                <option value="analytics">Analytics</option>
              </select>
            </div>
            {filteredComm.length===0 && <div style={{ color:'rgba(26,26,26,0.45)', fontSize:13 }}>No commissions yet.</div>}
            {filteredComm.map(c => (
              <div key={c.id} style={s.row}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, textTransform:'capitalize' }}>{c.revenue_type.replace(/_/g,' ')}</div>
                  <div style={{ fontSize:12, color:'rgba(26,26,26,0.45)', marginTop:2 }}>{fmtDate(c.created_at)} · {c.commission_percentage}% of {fmtUSD(c.gross_amount)}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:16, fontWeight:600, color:'#b8962e' }}>{fmtUSD(c.commission_amount)}</div>
                  <span style={{ ...s.badge(STATUS_COLOR[c.status]||'#888'), fontSize:10 }}>{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tools */}
        {tab==='tools' && (
          <div style={s.card}>
            <div style={s.lbl}>Referral Tools</div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13, color:'rgba(26,26,26,0.65)', marginBottom:10 }}>Your Referral Link</div>
              <div style={{ display:'flex', gap:8 }}>
                <input readOnly value={'https://sarego.africa/register?ref='+profile.referral_code} style={s.inp} />
                <button onClick={copyCode} style={{ ...s.btn, whiteSpace:'nowrap' }}>{copied ? '✓ Copied' : 'Copy Link'}</button>
              </div>
            </div>
            <div>
              <div style={{ fontSize:13, color:'rgba(26,26,26,0.65)', marginBottom:10 }}>Your Referral Code</div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontSize:28, fontWeight:800, color:'#b8962e', letterSpacing:'0.15em' }}>{profile.referral_code}</span>
                <button onClick={()=>{navigator.clipboard.writeText(profile.referral_code);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{ ...s.btn, fontSize:12, padding:'6px 14px' }}>Copy Code</button>
              </div>
            </div>
            <div style={{ marginTop:24, padding:16, background:'rgba(184,150,46,0.06)', borderRadius:8, border:'1px solid rgba(184,150,46,0.15)' }}>
              <div style={{ fontSize:12, color:'rgba(26,26,26,0.65)', lineHeight:1.7 }}>
                Share your referral link with businesses, exporters, capital providers, and opportunity creators across SADC. When they register and purchase a subscription, verification, or featured listing, you earn a commission on verified revenue events.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
