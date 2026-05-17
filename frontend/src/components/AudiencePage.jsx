import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, ShieldCheck, Globe, Layers } from 'lucide-react';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import LiveCounter from './LiveCounter.jsx';
import RecentActivityFeed from './RecentActivityFeed.jsx';
import { api } from '../lib/api.js';

/**
 * AudiencePage — shared template for /investors, /governments, /trade-hub.
 * Accepts a config object describing the audience-specific copy.
 */
export default function AudiencePage({ config }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api('/api/stats');
        if (!cancelled) setStats(data);
      } catch {
        // Render with zeros on failure; counters degrade gracefully
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ background: 'var(--ink-950)', color: 'var(--ivory-50)', minHeight: '100vh' }}>
      <Header variant="dark" />

      {/* Hero */}
      <section style={{ padding: 'var(--space-10) 0 var(--space-8)', position: 'relative', overflow: 'hidden' }}>
        <BackgroundDecoration />
        <div className="container">
          <div style={{ maxWidth: 760, position: 'relative' }}>
            <div
              className="eyebrow"
              style={{ color: 'var(--gold-400)', letterSpacing: '0.18em', fontSize: 12 }}
            >
              {config.eyebrow}
            </div>
            <h1
              style={{
                marginTop: 18,
                fontSize: 'clamp(34px, 4.4vw, 58px)',
                lineHeight: 1.05,
                letterSpacing: '-0.015em',
                fontWeight: 500,
              }}
            >
              {config.headline}{' '}
              {config.headlineItalic && (
                <span style={{ fontStyle: 'italic', color: 'var(--gold-400)' }}>
                  {config.headlineItalic}
                </span>
              )}
            </h1>
            <p
              style={{
                marginTop: 22,
                fontSize: 17,
                lineHeight: 1.55,
                color: 'rgba(255,255,255,0.7)',
                maxWidth: 640,
              }}
            >
              {config.subhead}
            </p>
            <div style={{ marginTop: 32, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link to={config.primaryCta.href} className="btn btn-gold">
                {config.primaryCta.label}
                <ArrowUpRight size={16} />
              </Link>
              <Link to={config.secondaryCta.href} className="btn btn-ghost-light">
                {config.secondaryCta.label}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Counters strip */}
      <section style={{ padding: 'var(--space-8) 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-6)',
            }}
          >
            <LiveCounter
              value={stats?.activeOpportunities ?? 0}
              loading={!stats}
              label="Active Opportunities"
              format="number"
            />
            <LiveCounter
              value={stats?.totalCapitalUsd ?? 0}
              loading={!stats}
              label="Total Capital Tracked"
              format="usd"
            />
            <LiveCounter
              value={stats?.activeCountries ?? 0}
              loading={!stats}
              label="Active Countries"
              format="number"
            />
            <LiveCounter
              value={stats?.verifiedCounterparties ?? 0}
              loading={!stats}
              label="Verified Counterparties"
              format="number"
            />
            <LiveCounter
              value={stats?.recentActivity24h ?? 0}
              loading={!stats}
              label="Events in Last 24h"
              format="number"
            />
          </div>
        </div>
      </section>

      {/* Value props + Live feed (two-column on desktop) */}
      <section style={{ padding: 'var(--space-10) 0' }}>
        <div className="container">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.3fr 1fr',
              gap: 'var(--space-10)',
              alignItems: 'flex-start',
            }}
            data-audience-grid
          >
            {/* Left: value props + how-it-works */}
            <div>
              <div className="eyebrow" style={{ color: 'var(--gold-400)' }}>
                Why SAREGO
              </div>
              <h2 style={{ marginTop: 12, fontSize: 'clamp(28px, 3vw, 36px)', lineHeight: 1.15 }}>
                {config.whyTitle}
              </h2>
              <div
                style={{
                  marginTop: 28,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 18,
                }}
              >
                {config.valueProps.map((vp, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 8,
                      padding: 20,
                    }}
                  >
                    <div style={{ color: 'var(--gold-400)', marginBottom: 12 }}>
                      {vp.icon}
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ivory-50)', marginBottom: 8 }}>
                      {vp.title}
                    </h3>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>
                      {vp.body}
                    </p>
                  </div>
                ))}
              </div>

              {/* How it works */}
              <div style={{ marginTop: 56 }}>
                <div className="eyebrow" style={{ color: 'var(--gold-400)' }}>
                  How it works
                </div>
                <h2 style={{ marginTop: 12, fontSize: 'clamp(24px, 2.6vw, 32px)', lineHeight: 1.2 }}>
                  {config.howTitle}
                </h2>
                <ol style={{ marginTop: 28, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {config.steps.map((step, i) => (
                    <li
                      key={i}
                      style={{
                        display: 'flex',
                        gap: 18,
                        padding: 18,
                        background: 'rgba(255,255,255,0.02)',
                        borderLeft: '2px solid var(--gold-400)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 500,
                          color: 'var(--gold-400)',
                          fontFamily: 'Inter Tight, sans-serif',
                          minWidth: 32,
                        }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, color: 'var(--ivory-50)' }}>
                          {step.title}
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>
                          {step.body}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Right: live activity feed */}
            <aside style={{ position: 'sticky', top: 100 }} data-audience-aside>
              <RecentActivityFeed
                audience={config.feedAudience}
                title={config.feedTitle}
                limit={10}
                maxHeight={620}
                compact
              />
            </aside>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section style={{ padding: 'var(--space-10) 0 var(--space-12)', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(26px, 3vw, 36px)', maxWidth: 640, margin: '0 auto', lineHeight: 1.2 }}>
            {config.closingTitle}
          </h2>
          <p style={{ marginTop: 18, color: 'rgba(255,255,255,0.65)', fontSize: 16, maxWidth: 560, margin: '18px auto 0', lineHeight: 1.55 }}>
            {config.closingBody}
          </p>
          <div style={{ marginTop: 32, display: 'inline-flex', gap: 14, flexWrap: 'wrap' }}>
            <Link to={config.primaryCta.href} className="btn btn-gold">
              {config.primaryCta.label}
              <ArrowUpRight size={16} />
            </Link>
            <Link to="/" className="btn btn-ghost-light">
              Back to Overview
            </Link>
          </div>
        </div>
      </section>

      <Footer />

      <style>{`
        @media (max-width: 920px) {
          [data-audience-grid] { grid-template-columns: 1fr !important; }
          [data-audience-aside] { position: static !important; }
        }
      `}</style>
    </div>
  );
}

function BackgroundDecoration() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMaxYMin meet"
      style={{ position: 'absolute', right: -100, top: -80, width: 900, opacity: 0.18, pointerEvents: 'none' }}
    >
      <defs>
        <radialGradient id="ap-glow" cx="60%" cy="40%" r="40%">
          <stop offset="0%" stopColor="#dcc068" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#dcc068" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="780" cy="200" r="320" fill="url(#ap-glow)" />
      <circle cx="780" cy="200" r="280" fill="none" stroke="#dcc068" strokeWidth="0.6" strokeDasharray="2 6" opacity="0.5" />
      <circle cx="780" cy="200" r="220" fill="none" stroke="#dcc068" strokeWidth="0.4" />
      <circle cx="780" cy="200" r="160" fill="none" stroke="#dcc068" strokeWidth="0.4" strokeDasharray="2 8" opacity="0.6" />
    </svg>
  );
}
