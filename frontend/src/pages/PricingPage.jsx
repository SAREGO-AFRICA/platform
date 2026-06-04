import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getAccessToken } from '../lib/api';

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price_monthly: 0,
    price_annual: 0,
    tagline: 'Browse and explore SAREGO',
    color: '#888',
    features: [
      'Browse all opportunities',
      'Basic company profile',
      'Express interest (10/month)',
      'View capital providers',
    ],
    cta: 'Current Plan',
    disabled: true,
  },
  {
    id: 'verified_business',
    name: 'Verified Business',
    price_monthly: 29,
    price_annual: 290,
    tagline: 'For SMEs, exporters and suppliers',
    color: '#22c55e',
    badge: 'MOST POPULAR',
    features: [
      'Verified badge on profile',
      'Unlimited interest expressions',
      'Deal room access',
      'Basic analytics',
      'Priority support',
      'Enhanced company visibility',
    ],
    cta: 'Upgrade to Verified',
  },
  {
    id: 'institutional',
    name: 'Institutional',
    price_monthly: 149,
    price_annual: 1490,
    tagline: 'For capital providers and institutions',
    color: '#b8962e',
    features: [
      'Institutional badge',
      'Featured profile placement',
      'Advanced analytics dashboard',
      'Unlimited deal rooms',
      'Priority queue placement',
      'Market intelligence access',
      'Capital matching tools',
    ],
    cta: 'Upgrade to Institutional',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price_monthly: 499,
    price_annual: 4990,
    tagline: 'For governments, DFIs and large corporates',
    color: '#6366f1',
    features: [
      'Everything in Institutional',
      'Organisation dashboard',
      'Team seats',
      'Featured opportunities',
      'Priority onboarding',
      'Dedicated account management',
      'API access (coming soon)',
      'Custom invoicing',
    ],
    cta: 'Contact Us',
  },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const [currentTier, setCurrentTier] = useState('free');
  const [upgrading, setUpgrading] = useState(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    api('/api/memberships/me').then(d => setCurrentTier(d.membership?.tier || 'free')).catch(() => {});
  }, []);

  async function handleUpgrade(tierId) {
    if (!getAccessToken()) { navigate('/login'); return; }
    if (tierId === 'enterprise') { window.location.href = 'mailto:info@sarego.africa?subject=Enterprise Membership'; return; }
    setUpgrading(tierId);
    try {
      await api('/api/memberships/me', {
        method: 'PATCH',
        body: JSON.stringify({ tier: tierId, billing_period: annual ? 'annual' : 'monthly' }),
      });
      setCurrentTier(tierId);
      navigate('/account');
    } catch (e) {
      alert(e.message || 'Upgrade failed');
    } finally {
      setUpgrading(null);
    }
  }

  const s = {
    page: { minHeight: '100vh', background: '#0b0d10', color: '#e8e0d0', fontFamily: "'Inter Tight', sans-serif" },
    hdr:  { textAlign: 'center', padding: '64px 24px 48px' },
    title: { fontSize: 42, fontWeight: 700, color: '#e8e0d0', margin: '0 0 12px' },
    sub:   { fontSize: 18, color: 'rgba(232,224,208,0.6)', margin: '0 0 32px' },
    toggle: { display: 'inline-flex', background: 'rgba(255,255,255,0.06)', borderRadius: 24, padding: 4, gap: 2 },
    toggleBtn: (a) => ({ padding: '8px 20px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: a ? '#b8962e' : 'transparent', color: a ? '#0b0d10' : 'rgba(232,224,208,0.6)' }),
    grid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' },
    card:  (color, current) => ({ background: current ? 'rgba(184,150,46,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${current ? color : 'rgba(255,255,255,0.08)'}`, borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', position: 'relative' }),
    badge: (color) => ({ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: color, color: '#0b0d10', fontSize: 10, fontWeight: 800, padding: '3px 12px', borderRadius: 10, letterSpacing: '0.1em', whiteSpace: 'nowrap' }),
    tierName: { fontSize: 20, fontWeight: 700, color: '#e8e0d0', margin: '0 0 4px' },
    tagline: { fontSize: 13, color: 'rgba(232,224,208,0.55)', margin: '0 0 20px' },
    price:   { fontSize: 40, fontWeight: 800, color: '#e8e0d0', margin: '0 0 4px' },
    period:  { fontSize: 13, color: 'rgba(232,224,208,0.45)', margin: '0 0 24px' },
    divider: { border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', margin: '0 0 20px' },
    feat:    { fontSize: 13, color: 'rgba(232,224,208,0.75)', padding: '5px 0', display: 'flex', alignItems: 'center', gap: 8 },
    check:   (color) => ({ color, fontSize: 16, flexShrink: 0 }),
    btn:     (color, disabled) => ({ marginTop: 'auto', paddingTop: 24, background: disabled ? 'rgba(255,255,255,0.06)' : color, color: disabled ? 'rgba(232,224,208,0.4)' : '#0b0d10', border: 'none', borderRadius: 8, padding: '12px 20px', fontWeight: 700, fontSize: 14, cursor: disabled ? 'default' : 'pointer', width: '100%' }),
    saving:  { textAlign: 'center', color: '#22c55e', fontSize: 12, marginTop: 8 },
  };

  return (
    <div style={s.page}>
      <div style={{ background:'#0d0f13', borderBottom:'1px solid rgba(184,150,46,0.15)', padding:'12px 24px', display:'flex', alignItems:'center', gap:16 }}>
        <a href="/" style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}><span style={{ color:'#b8962e', fontSize:18 }}>◈</span><span style={{ color:'#e8e0d0', fontSize:14, fontWeight:600, letterSpacing:'0.05em' }}>SAREGO</span></a>
        <span style={{ color:'rgba(232,224,208,0.2)' }}>|</span>
        <a href="/dashboard" style={{ color:'rgba(232,224,208,0.5)', fontSize:13, textDecoration:'none' }}>Dashboard</a>
        <a href="/account" style={{ color:'rgba(232,224,208,0.5)', fontSize:13, textDecoration:'none', marginLeft:'auto' }}>My Account</a>
      </div>
      <div style={s.hdr}>
        <h1 style={s.title}>Institutional Access</h1>
        <p style={s.sub}>Monetize your participation in SADC economic activity</p>
        <div style={s.toggle}>
          <button style={s.toggleBtn(!annual)} onClick={() => setAnnual(false)}>Monthly</button>
          <button style={s.toggleBtn(annual)} onClick={() => setAnnual(true)}>Annual <span style={{ color: '#22c55e', fontSize: 11 }}>Save 17%</span></button>
        </div>
      </div>

      <div style={s.grid}>
        {TIERS.map(tier => {
          const isCurrent = currentTier === tier.id;
          const price = annual ? tier.price_annual : tier.price_monthly;
          const period = tier.price_monthly === 0 ? 'Forever free' : annual ? '/year' : '/month';
          return (
            <div key={tier.id} style={s.card(tier.color, isCurrent)}>
              {tier.badge && <div style={s.badge(tier.color)}>{tier.badge}</div>}
              <div style={s.tierName}>{tier.name}</div>
              <div style={s.tagline}>{tier.tagline}</div>
              <div style={s.price}>{tier.price_monthly === 0 ? 'Free' : `$${price}`}</div>
              <div style={s.period}>{period}</div>
              {annual && tier.price_monthly > 0 && (
                <div style={s.saving}>Save ${(tier.price_monthly * 12) - tier.price_annual}/year</div>
              )}
              <hr style={s.divider} />
              <div style={{ flex: 1 }}>
                {tier.features.map((f, i) => (
                  <div key={i} style={s.feat}>
                    <span style={s.check(tier.color)}>✓</span>{f}
                  </div>
                ))}
              </div>
              <button
                style={s.btn(tier.color, isCurrent || tier.disabled)}
                onClick={() => !isCurrent && !tier.disabled && handleUpgrade(tier.id)}
                disabled={isCurrent || upgrading === tier.id}
              >
                {upgrading === tier.id ? 'Upgrading...' : isCurrent ? 'Current Plan' : tier.cta}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', padding: '0 24px 64px', color: 'rgba(232,224,208,0.4)', fontSize: 13 }}>
        All prices in USD. Enterprise clients may request annual invoicing.{' '}
        <Link to="/account" style={{ color: '#b8962e' }}>Manage your account →</Link>
      </div>
    </div>
  );
}
