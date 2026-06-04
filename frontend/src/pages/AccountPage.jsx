import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getAccessToken } from '../lib/api';

const TIER_META = {
  free:              { label: 'Free',             color: '#888',    desc: 'Basic platform access' },
  verified_business: { label: 'Verified Business', color: '#22c55e', desc: 'Verified participant status' },
  institutional:     { label: 'Institutional',     color: '#b8962e', desc: 'Institutional member status' },
  enterprise:        { label: 'Enterprise',         color: '#6366f1', desc: 'Enterprise organisation access' },
};

export default function AccountPage() {
  const [membership, setMembership] = useState(null);
  const [features, setFeatures] = useState(null);
  const [billing, setBilling] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api('/api/memberships/me'),
      api('/api/billing/history'),
    ]).then(([m, b]) => {
      setMembership(m.membership);
      setFeatures(m.features);
      setBilling(b.records || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const s = {
    page:  { minHeight: '100vh', background: '#0b0d10', color: '#e8e0d0', fontFamily: "'Inter Tight', sans-serif", padding: '40px 24px' },
    inner: { maxWidth: 760, margin: '0 auto' },
    title: { fontSize: 28, fontWeight: 700, margin: '0 0 32px' },
    card:  { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(184,150,46,0.15)', borderRadius: 12, padding: 24, marginBottom: 20 },
    lbl:   { fontSize: 10, color: '#b8962e', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, fontWeight: 600 },
    val:   { fontSize: 16, fontWeight: 500, color: '#e8e0d0' },
    badge: (color) => ({ display: 'inline-block', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, color, border: `1px solid ${color}`, background: color + '18' }),
    row:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
    feat:  (on) => ({ fontSize: 13, color: on ? '#22c55e' : 'rgba(232,224,208,0.35)', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }),
    btn:   { background: '#b8962e', color: '#0b0d10', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' },
  };

  function fmt(d) { return d ? new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'; }
  function fmtUSD(n) { return n != null ? `$${Number(n).toLocaleString()}` : '—'; }

  if (loading) return <div style={s.page}><div style={{ textAlign: 'center', padding: 64, color: '#666' }}>Loading...</div></div>;

  const tier = membership?.tier || 'free';
  const meta = TIER_META[tier] || TIER_META.free;

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <h1 style={s.title}>Account & Membership</h1>

        {/* Current membership */}
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={s.lbl}>Current Plan</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 700 }}>{meta.label}</span>
                <span style={s.badge(meta.color)}>{tier.replace('_', ' ').toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(232,224,208,0.5)', marginTop: 4 }}>{meta.desc}</div>
            </div>
            <Link to="/pricing" style={s.btn}>Upgrade Plan</Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div><div style={s.lbl}>Billing Period</div><div style={s.val}>{membership?.billing_period || 'N/A'}</div></div>
            <div><div style={s.lbl}>Period Ends</div><div style={s.val}>{fmt(membership?.current_period_end)}</div></div>
            <div><div style={s.lbl}>Interests This Month</div><div style={s.val}>{membership?.interests_used_this_month ?? 0} {tier === 'free' ? '/ 10' : '/ ∞'}</div></div>
          </div>
        </div>

        {/* Feature access */}
        {features && (
          <div style={s.card}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Feature Access</div>
            {[
              ['Unlimited Interest Expressions', features.monthly_interest_limit > 100],
              ['Deal Room Access', features.deal_rooms],
              ['Basic Analytics', features.basic_analytics],
              ['Advanced Analytics', features.advanced_analytics],
              ['Featured Profile', features.featured_profile],
              ['Priority Placement', features.priority_placement],
            ].map(([label, on]) => (
              <div key={label} style={s.feat(on)}>
                <span>{on ? '✓' : '✗'}</span>{label}
                {!on && tier === 'free' && label === 'Unlimited Interest Expressions' && (
                  <Link to="/pricing" style={{ marginLeft: 'auto', fontSize: 11, color: '#b8962e' }}>Upgrade →</Link>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Billing history */}
        <div style={s.card}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Billing History</div>
          {billing.length === 0 && <div style={{ color: 'rgba(232,224,208,0.4)', fontSize: 13 }}>No billing records yet.</div>}
          {billing.map(r => (
            <div key={r.id} style={s.row}>
              <div>
                <div style={{ fontSize: 14 }}>{r.description}</div>
                <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.4)', marginTop: 2 }}>{fmt(r.created_at)} · {r.record_type.replace('_', ' ')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{fmtUSD(r.amount_usd)}</div>
                <div style={{ fontSize: 11, color: r.status === 'paid' ? '#22c55e' : '#f59e0b', marginTop: 2 }}>{r.status}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:12, justifyContent:'center', marginBottom:16 }}>
          <a href="/verification/pay" style={{ fontSize:13, color:'#b8962e', border:'1px solid rgba(184,150,46,0.3)', padding:'8px 16px', borderRadius:6, textDecoration:'none' }}>Apply for Verification</a>
          <a href="/analytics" style={{ fontSize:13, color:'#b8962e', border:'1px solid rgba(184,150,46,0.3)', padding:'8px 16px', borderRadius:6, textDecoration:'none' }}>View Analytics</a>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Link to="/pricing" style={{ color: '#b8962e', fontSize: 14 }}>View all plans →</Link>
        </div>
      </div>
    </div>
  );
}
