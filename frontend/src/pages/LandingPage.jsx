import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  Globe2,
  Landmark,
  Lock,
  ShieldCheck,
  TrendingUp,
  Users2,
  FileText,
  Layers,
} from 'lucide-react';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import AfricaMap from '../components/AfricaMap.jsx';

/* ----------------------------- Demo data ------------------------------- */
const FEATURED_PROJECTS = [
  {
    title: 'Beira–Tete Solar Corridor',
    country: 'Mozambique',
    flag: '🇲🇿',
    sector: 'Renewable Energy',
    capital: '$180M',
    irr: '14.5%',
    stage: 'Bankable',
  },
  {
    title: 'Kazungula SEZ Phase II',
    country: 'Botswana',
    flag: '🇧🇼',
    sector: 'Logistics & Trade',
    capital: '$92M',
    irr: '11.8%',
    stage: 'Preparation',
  },
  {
    title: 'Lake Malawi Aquaculture Initiative',
    country: 'Malawi',
    flag: '🇲🇼',
    sector: 'Agribusiness',
    capital: '$34M',
    irr: '17.2%',
    stage: 'Financing',
  },
];

const STATS = [
  { figure: '16', label: 'SADC Member States' },
  { figure: '$340B', label: 'Estimated Pipeline Capital' },
  { figure: '6', label: 'Continental Economic Communities' },
];

const ROLES = [
  {
    icon: Landmark,
    label: 'Governments',
    body:
      'Publish national projects, set investment priorities, and connect directly with vetted institutional capital.',
  },
  {
    icon: TrendingUp,
    label: 'Investors',
    body:
      'DFIs, private equity, and family offices source bankable opportunities matched to mandate, sector, and ticket size.',
  },
  {
    icon: Building2,
    label: 'Corporates',
    body:
      'Source partners, list procurement opportunities, and structure cross-border ventures across the region.',
  },
  {
    icon: Users2,
    label: 'SMEs',
    body:
      'Apply for trade facilitation, secure introductions, and access growth capital through verified networks.',
  },
];

/* =====================================================================
   Page
   ===================================================================== */
export default function LandingPage() {
  return (
    <div>
      <Header variant="dark" />
      <Hero />
      <PipelineSection />
      <RolesSection />
      <MapSection />
      <PillarsSection />
      <CTASection />
      <Footer />
    </div>
  );
}

/* ----------------------------- HERO ------------------------------------ */
function Hero() {
  return (
    <section
      style={{
        background: 'var(--ink-950)',
        color: 'var(--ivory-50)',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: 'var(--space-12)',
        paddingBottom: 'var(--space-12)',
      }}
    >
      {/* Decorative gold compass arcs */}
      <svg
        aria-hidden="true"
        viewBox="0 0 800 800"
        style={{
          position: 'absolute',
          right: -200,
          top: -100,
          width: 900,
          height: 900,
          opacity: 0.18,
          pointerEvents: 'none',
        }}
      >
        <defs>
          <radialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#dcc068" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#dcc068" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="400" cy="400" r="400" fill="url(#heroGlow)" />
        <circle cx="400" cy="400" r="320" fill="none" stroke="#dcc068" strokeWidth="0.5" strokeDasharray="2 8" />
        <circle cx="400" cy="400" r="240" fill="none" stroke="#dcc068" strokeWidth="0.5" />
        <circle cx="400" cy="400" r="160" fill="none" stroke="#dcc068" strokeWidth="0.5" strokeDasharray="2 8" />
        <line x1="400" y1="40" x2="400" y2="760" stroke="#dcc068" strokeWidth="0.4" />
        <line x1="40" y1="400" x2="760" y2="400" stroke="#dcc068" strokeWidth="0.4" />
      </svg>

      <div className="container" style={{ position: 'relative' }}>
        <div className="eyebrow fade-up" style={{ color: 'var(--gold-400)' }}>
          Southern Africa Regional Economic Growth Office
        </div>

        <h1
          className="display fade-up fade-up-1"
          style={{
            marginTop: 'var(--space-4)',
            maxWidth: 1100,
            color: 'var(--ivory-50)',
            fontWeight: 400,
          }}
        >
          The institutional platform for{' '}
          <span style={{ fontStyle: 'italic', color: 'var(--gold-400)' }}>
            cross-border capital
          </span>{' '}
          across Southern Africa.
        </h1>

        <p
          className="fade-up fade-up-2"
          style={{
            marginTop: 'var(--space-5)',
            maxWidth: 640,
            fontSize: 17,
            color: 'var(--ink-300)',
            lineHeight: 1.65,
          }}
        >
          SAREGO connects governments, development finance institutions, private investors,
          corporates, and project developers across SADC and the broader continent —
          structuring trade, investment, and bankable project flow on a single, verified rail.
        </p>

        <div
          className="flex gap-3 fade-up fade-up-3"
          style={{ marginTop: 'var(--space-6)', flexWrap: 'wrap' }}
        >
          <Link to="/login?mode=register" className="btn btn-gold">
            Request Platform Access
            <ArrowUpRight size={16} />
          </Link>
          <a href="#marketplace" className="btn btn-ghost-light">
            Explore the Pipeline
          </a>
        </div>

        {/* Stat strip */}
        <div
          className="fade-up fade-up-5"
          style={{
            marginTop: 'var(--space-12)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--space-6)',
            paddingTop: 'var(--space-6)',
            borderTop: '1px solid var(--ink-800)',
          }}
        >
          {STATS.map((s, i) => (
            <div key={s.label} style={{ borderLeft: i > 0 ? '1px solid var(--ink-800)' : 'none', paddingLeft: i > 0 ? 24 : 0 }}>
              <div
                className="display"
                style={{
                  fontSize: 'clamp(40px, 5vw, 64px)',
                  color: 'var(--gold-400)',
                  fontWeight: 500,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                {s.figure}
              </div>
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-300)',
                  marginTop: 12,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          section > .container > div:last-child {
            grid-template-columns: 1fr !important;
            gap: var(--space-5) !important;
          }
          section > .container > div:last-child > div {
            border-left: none !important;
            padding-left: 0 !important;
            border-top: 1px solid var(--ink-800);
            padding-top: 20px;
          }
        }
      `}</style>
    </section>
  );
}

/* ----------------------------- PIPELINE ----------------------------------- */
function PipelineSection() {
  return (
    <section id="marketplace" style={{ padding: 'var(--space-12) 0' }} className="paper-grain">
      <div className="container">
        <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-8)', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="eyebrow">Investment Marketplace</div>
            <h2 style={{ marginTop: 12, maxWidth: 640 }}>
              Bankable opportunities,{' '}
              <span style={{ fontStyle: 'italic' }}>verified at the source.</span>
            </h2>
          </div>
          <Link to="/login" className="btn btn-ghost">
            View All Projects
            <ArrowUpRight size={16} />
          </Link>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'var(--space-5)',
          }}
        >
          {FEATURED_PROJECTS.map((p, idx) => (
            <ProjectCard key={p.title} project={p} index={idx} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectCard({ project, index }) {
  return (
    <article
      className="card"
      style={{
        padding: 0,
        position: 'relative',
        transition: 'transform 250ms ease, border-color 250ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.borderColor = 'var(--gold-600)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      {/* Card header strip */}
      <div
        style={{
          padding: '14px 22px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div className="text-xs uppercase muted" style={{ letterSpacing: '0.16em' }}>
          {String(index + 1).padStart(2, '0')} / Featured
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.16em',
            color: 'var(--gold-700)',
            textTransform: 'uppercase',
          }}
        >
          {project.stage}
        </div>
      </div>

      <div style={{ padding: 'var(--space-5) 22px var(--space-5)' }}>
        <div className="flex items-center gap-2" style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
          <span style={{ fontSize: 18 }}>{project.flag}</span>
          {project.country} · {project.sector}
        </div>
        <h3 style={{ marginTop: 14, fontSize: 26, lineHeight: 1.15 }}>{project.title}</h3>

        <div
          style={{
            marginTop: 'var(--space-5)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 0,
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ padding: '14px 0', borderRight: '1px solid var(--border)', paddingRight: 16 }}>
            <div className="text-xs uppercase muted" style={{ letterSpacing: '0.14em' }}>
              Capital Required
            </div>
            <div className="mono" style={{ fontSize: 22, marginTop: 6, fontWeight: 500 }}>
              {project.capital}
            </div>
          </div>
          <div style={{ padding: '14px 0 14px 16px' }}>
            <div className="text-xs uppercase muted" style={{ letterSpacing: '0.14em' }}>
              Target IRR
            </div>
            <div className="mono" style={{ fontSize: 22, marginTop: 6, fontWeight: 500, color: 'var(--gold-700)' }}>
              {project.irr}
            </div>
          </div>
        </div>
      </div>

      <a
        href="#"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 22px',
          borderTop: '1px solid var(--border)',
          fontSize: 12,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--ink-950)',
          fontWeight: 500,
        }}
      >
        Open Teaser
        <ArrowUpRight size={14} />
      </a>
    </article>
  );
}

/* ----------------------------- ROLES ----------------------------------- */
function RolesSection() {
  return (
    <section
      style={{
        background: 'var(--ivory-100)',
        padding: 'var(--space-12) 0',
      }}
    >
      <div className="container">
        <div className="eyebrow">Who SAREGO Serves</div>
        <h2 style={{ marginTop: 12, maxWidth: 720 }}>
          A single rail for{' '}
          <span style={{ fontStyle: 'italic' }}>every counterparty</span> in a regional deal.
        </h2>

        <div
          style={{
            marginTop: 'var(--space-8)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 0,
            border: '1px solid var(--ivory-200)',
            background: 'var(--bg-elev)',
          }}
        >
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.label}
                style={{
                  padding: 'var(--space-6)',
                  borderRight: '1px solid var(--ivory-200)',
                  borderBottom: '1px solid var(--ivory-200)',
                  position: 'relative',
                  transition: 'background 200ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ivory-50)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-elev)')}
              >
                <Icon size={28} strokeWidth={1.4} color="var(--gold-700)" />
                <h3 style={{ marginTop: 18, fontSize: 24 }}>{role.label}</h3>
                <p style={{ marginTop: 12, fontSize: 14, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
                  {role.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- MAP ----------------------------------- */
function MapSection() {
  return (
    <section
      style={{
        background: 'var(--ink-950)',
        color: 'var(--ivory-50)',
        padding: 'var(--space-12) 0',
        overflow: 'hidden',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.1fr',
            gap: 'var(--space-10)',
            alignItems: 'center',
          }}
          data-map-grid
        >
          <div>
            <div className="eyebrow" style={{ color: 'var(--gold-400)' }}>
              Regional Footprint
            </div>
            <h2 style={{ marginTop: 12, color: 'var(--ivory-50)' }}>
              Built for SADC.{' '}
              <span style={{ fontStyle: 'italic', color: 'var(--gold-400)' }}>
                Designed for the continent.
              </span>
            </h2>
            <p style={{ marginTop: 24, color: 'var(--ink-300)', fontSize: 16, lineHeight: 1.65, maxWidth: 480 }}>
              SAREGO's geographic mandate is the 16 member states of the Southern African
              Development Community, with active linkages into ECOWAS, EAC, and COMESA — built
              for the deal flow that crosses borders.
            </p>

            <div style={{ marginTop: 'var(--space-6)', display: 'grid', gap: 16 }}>
              <FeatureLine icon={Globe2}>22 active country profiles</FeatureLine>
              <FeatureLine icon={ShieldCheck}>KYC-grade verified counterparties</FeatureLine>
              <FeatureLine icon={Layers}>Multi-stage pipeline tracking</FeatureLine>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <AfricaMap />
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 880px) {
          [data-map-grid] {
            grid-template-columns: 1fr !important;
            gap: var(--space-6) !important;
          }
        }
      `}</style>
    </section>
  );
}

function FeatureLine({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-3" style={{ paddingBottom: 14, borderBottom: '1px solid var(--ink-800)' }}>
      <Icon size={18} strokeWidth={1.5} color="var(--gold-400)" />
      <span style={{ fontSize: 14, letterSpacing: '0.02em' }}>{children}</span>
    </div>
  );
}

/* ----------------------------- PILLARS ----------------------------------- */
function PillarsSection() {
  const pillars = [
    {
      n: '01',
      title: 'Investment Marketplace',
      icon: TrendingUp,
      body:
        'A curated pipeline of bankable projects from governments, developers, and corporates — filtered by sector, stage, and capital structure.',
    },
    {
      n: '02',
      title: 'Trade Facilitation Hub',
      icon: Globe2,
      body:
        'Cross-border opportunities, RFPs, and partnership listings purpose-built for SADC trade corridors and regional value chains.',
    },
    {
      n: '03',
      title: 'Government Interface',
      icon: Landmark,
      body:
        'A direct channel for ministries and investment agencies to publish national priorities and engage vetted institutional capital.',
    },
    {
      n: '04',
      title: 'Project Pipeline Management',
      icon: FileText,
      body:
        'Stage-aware project tracking from origination through bankable, financing, and execution — with deal rooms and audit trails throughout.',
    },
  ];

  return (
    <section style={{ padding: 'var(--space-12) 0' }}>
      <div className="container">
        <div className="eyebrow">Four Pillars</div>
        <h2 style={{ marginTop: 12, maxWidth: 800 }}>
          One platform.{' '}
          <span style={{ fontStyle: 'italic' }}>Four mandates.</span>
        </h2>

        <div style={{ marginTop: 'var(--space-8)' }}>
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.n}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 60px',
                  gap: 'var(--space-6)',
                  padding: 'var(--space-6) 0',
                  borderTop: '1px solid var(--ivory-200)',
                  alignItems: 'start',
                  position: 'relative',
                  transition: 'padding-left 250ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.paddingLeft = '12px')}
                onMouseLeave={(e) => (e.currentTarget.style.paddingLeft = '0')}
                data-pillar-row
              >
                <div
                  className="mono"
                  style={{ fontSize: 14, color: 'var(--gold-700)', letterSpacing: '0.16em' }}
                >
                  {p.n}
                </div>
                <div>
                  <h3 style={{ fontSize: 28 }}>{p.title}</h3>
                  <p style={{ marginTop: 12, fontSize: 15, color: 'var(--fg-muted)', maxWidth: 640 }}>
                    {p.body}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Icon size={24} strokeWidth={1.4} color="var(--ink-950)" />
                </div>
              </div>
            );
          })}
          <div style={{ borderTop: '1px solid var(--ivory-200)' }} />
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          [data-pillar-row] {
            grid-template-columns: 60px 1fr !important;
          }
          [data-pillar-row] > div:last-child {
            grid-column: 1 / -1;
            text-align: left !important;
          }
        }
      `}</style>
    </section>
  );
}

/* ----------------------------- CTA ----------------------------------- */
function CTASection() {
  return (
    <section
      style={{
        background: 'var(--ivory-100)',
        padding: 'var(--space-12) 0',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative serif quote mark */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 30,
          right: 60,
          fontSize: 320,
          fontFamily: 'var(--font-display)',
          color: 'var(--gold-200)',
          opacity: 0.6,
          lineHeight: 0.8,
          fontWeight: 500,
          pointerEvents: 'none',
        }}
      >
        §
      </div>

      <div className="container" style={{ position: 'relative', maxWidth: 880 }}>
        <div className="eyebrow">Membership Inquiry</div>
        <h2 style={{ marginTop: 16, fontSize: 'clamp(36px, 5vw, 60px)', maxWidth: 720, lineHeight: 1.05 }}>
          The pipeline that moves the region forward —{' '}
          <span style={{ fontStyle: 'italic' }}>requested by invitation.</span>
        </h2>

        <p style={{ marginTop: 24, fontSize: 17, color: 'var(--fg-muted)', maxWidth: 580, lineHeight: 1.6 }}>
          SAREGO is access-controlled. Each account is verified to institutional standards
          before joining the marketplace. Submit your organization's profile to begin onboarding.
        </p>

        <div className="flex gap-3" style={{ marginTop: 32, flexWrap: 'wrap' }}>
          <Link to="/login?mode=register" className="btn btn-primary">
            Request Access
            <ArrowUpRight size={16} />
          </Link>
          <a href="#" className="btn btn-ghost">
            <Lock size={14} />
            Compliance & Governance
          </a>
        </div>
      </div>
    </section>
  );
}
