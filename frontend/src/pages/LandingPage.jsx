import React, { useEffect, useState } from 'react';
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
import LiveCounter from '../components/LiveCounter.jsx';
import RecentActivityFeed from '../components/RecentActivityFeed.jsx';
import FeaturedOpportunitiesGrid from '../components/FeaturedOpportunitiesGrid.jsx';
import { api } from '../lib/api.js';
import { usePlatformStats } from '../lib/usePlatformStats.js';

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
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedSectors, setSelectedSectors] = useState([]);

  function toggleSector(slug) {
    setSelectedSectors((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  return (
    <div>
      <Header variant="dark" />
      <Hero />
      <LiveActivitySection />
      <PipelineSection selectedCountry={selectedCountry} selectedSectors={selectedSectors} />
      <RolesSection />
      <MapSection
        selectedCountry={selectedCountry}
        selectedSectors={selectedSectors}
        onSelectCountry={setSelectedCountry}
        onSelectSector={toggleSector}
      />
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
        paddingTop: 'var(--space-8)',
        paddingBottom: 'var(--space-8)',
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Subtle glow backdrop (replacing the decorative compass) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 75% 30%, rgba(220,192,104,0.08), transparent 50%)',
          pointerEvents: 'none',
        }}
      />

      <div className="container" style={{ position: 'relative' }}>
        <div className="eyebrow fade-up" style={{ color: 'var(--gold-400)' }}>
          Southern Africa Regional Economic Growth Office
        </div>

        <h1
          className="display fade-up fade-up-1"
          style={{
            marginTop: 'var(--space-4)',
            maxWidth: 1000,
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
            maxWidth: 620,
            fontSize: 17,
            color: 'var(--ink-300)',
            lineHeight: 1.6,
          }}
        >
          Connecting governments, development finance institutions, private investors, and
          project developers across SADC — on a single, verified rail.
        </p>

        <div
          className="flex gap-3 fade-up fade-up-3"
          style={{ marginTop: 'var(--space-6)', flexWrap: 'wrap' }}
        >
          <Link to="/trade-hub" className="btn btn-gold">
            Explore Opportunities
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- LIVE ACTIVITY SECTION --------------------- */
function LiveActivitySection() {
  const { stats } = usePlatformStats();

  return (
    <section
      id="live-activity"
      style={{
        background: 'var(--ink-950)',
        color: 'var(--ivory-50)',
        paddingTop: 'var(--space-8)',
        paddingBottom: 'var(--space-10)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="container">
        {/* Section header */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold-400, #dcc068)', marginBottom: 10, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <LivePulse /> Live across the region
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 3vw, 36px)', fontWeight: 500, color: 'var(--ivory-50)', margin: 0, letterSpacing: '-0.015em', maxWidth: 720, lineHeight: 1.2 }}>
            Active economic flow across SADC, updated in real time.
          </h2>
        </div>

        {/* Counter strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 'var(--space-6)',
            padding: '24px 0',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <LiveCounter
            value={stats?.activeOpportunities ?? 0}
            loading={!stats}
            label="Active Opportunities"
            format="number"
          />
          <LiveCounter
            value={stats?.byVertical?.tenders ?? 0}
            loading={!stats}
            label="Government Tenders"
            format="number"
          />
          <LiveCounter
            value={stats?.byVertical?.logisticsLoads ?? 0}
            loading={!stats}
            label="Logistics Loads"
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
            label="Countries Participating"
            format="number"
          />
          <LiveCounter
            value={stats?.verifiedCounterparties ?? 0}
            loading={!stats}
            label="Verified Counterparties"
            format="number"
          />
        </div>

        {/* Featured grid + Activity feed (2-col on desktop, stacked on mobile) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.45fr 1fr',
            gap: 'var(--space-8)',
            alignItems: 'flex-start',
          }}
          data-live-grid
        >
          <div>
            <FeaturedOpportunitiesGrid />
          </div>
          <aside data-live-aside>
            <RecentActivityFeed
              title="Live activity"
              limit={8}
              compact
              maxHeight={620}
            />
          </aside>
        </div>
      </div>

      <style>{`
        @media (max-width: 920px) {
          [data-live-grid] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function LivePulse() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: '#7fb069',
        boxShadow: '0 0 0 0 rgba(127,176,105,0.6)',
        animation: 'sarego-landing-pulse 2s infinite',
      }}
    >
      <style>{`
        @keyframes sarego-landing-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(127,176,105,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(127,176,105, 0);  }
          100% { box-shadow: 0 0 0 0   rgba(127,176,105, 0);  }
        }
      `}</style>
    </span>
  );
}

/* ----------------------------- PIPELINE ----------------------------------- */
function PipelineSection({ selectedCountry = null, selectedSectors = [] }) {
  const [projects, setProjects] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ limit: '12' });
        if (selectedCountry) params.set('country', selectedCountry);
        const data = await api('/api/projects?' + params.toString());
        if (cancelled) return;
        const real = (data.projects || []).map(normalizeProject);
        // If we have at least one real published project, show real data.
        // Otherwise, fall back to demo data so the page never looks empty.
        setProjects(real.length > 0 ? real : FEATURED_PROJECTS);
      } catch {
        // On network/API failure, gracefully fall back to demo data.
        if (!cancelled) setProjects(FEATURED_PROJECTS);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCountry]);

  return (
    <section id="marketplace" style={{ padding: 'var(--space-10) 0' }} className="paper-grain">
      <div className="container">
        <div className="eyebrow" style={{ color: 'var(--ink-700)' }}>
          Established pipeline
        </div>
        <h2
          style={{
            marginTop: 'var(--space-3)',
            fontSize: 'clamp(28px, 3vw, 38px)',
            maxWidth: 760,
            lineHeight: 1.15,
            color: 'var(--ink-950)',
            letterSpacing: '-0.01em',
          }}
        >
          Bankable infrastructure, industrial, and agribusiness projects across the region.
        </h2>
        <p style={{ marginTop: 'var(--space-3)', color: 'var(--ink-700)', maxWidth: 620, fontSize: 15, lineHeight: 1.6 }}>
          Verified project sponsors. Indicative capital structures, ticket sizes, and engagement
          pathways for institutional participation.
        </p>

        <div
          style={{
            marginTop: 'var(--space-8)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-5)',
          }}
        >
          {(projects ?? FEATURED_PROJECTS).map((p, i) => (
            <ProjectCard key={p.slug || p.title} project={p} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function normalizeProject(p) {
  return {
    slug: p.slug,
    title: p.title,
    country: p.country_name || p.country,
    flag: '',
    sector: titleCase(p.primary_sector || ''),
    capital: formatUSDShort(p.capital_required_usd),
    irr: p.target_irr ? `${p.target_irr}%` : '—',
    stage: titleCase(p.stage || ''),
  };
}

function formatUSDShort(value) {
  if (value == null) return '—';
  const n = Number(value);
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function titleCase(s) {
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function ProjectCard({ project, index }) {
  return (
    <div
      style={{
        background: 'var(--ivory-50)',
        border: '1px solid var(--ink-200)',
        borderRadius: 6,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transition: 'border-color 150ms, transform 150ms',
        position: 'relative',
        animation: `sarego-fade-in 0.5s ${index * 0.08}s both`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--gold-400)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--ink-200)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          {project.flag && <div style={{ fontSize: 26, marginBottom: 6 }}>{project.flag}</div>}
          <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-600)' }}>
            {project.country}
          </div>
        </div>
        {project.stage && (
          <span
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid var(--ink-200)',
              color: 'var(--ink-700)',
            }}
          >
            {project.stage}
          </span>
        )}
      </div>

      <h3
        style={{
          fontSize: 18,
          lineHeight: 1.3,
          color: 'var(--ink-950)',
          margin: 0,
          fontWeight: 500,
          minHeight: 48,
        }}
      >
        {project.title}
      </h3>

      <div style={{ fontSize: 13, color: 'var(--ink-700)' }}>{project.sector}</div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: 14,
        borderTop: '1px solid var(--ink-200)',
        fontSize: 13,
      }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-600)' }}>Capital</div>
          <div style={{ marginTop: 4, fontWeight: 500, color: 'var(--ink-950)' }}>{project.capital}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-600)' }}>Target IRR</div>
          <div style={{ marginTop: 4, fontWeight: 500, color: 'var(--ink-950)' }}>{project.irr}</div>
        </div>
      </div>

      {project.slug && (
        <Link
          to={`/projects/${project.slug}`}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            textIndent: '-9999px',
            overflow: 'hidden',
          }}
          aria-label={`Open ${project.title}`}
        >
          {project.title}
        </Link>
      )}

      <style>{`
        @keyframes sarego-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ----------------------------- ROLES SECTION ----------------------------- */
function RolesSection() {
  return (
    <section
      id="trade"
      style={{
        background: 'var(--ink-950)',
        color: 'var(--ivory-50)',
        padding: 'var(--space-10) 0',
      }}
    >
      <div className="container">
        <div className="eyebrow" style={{ color: 'var(--gold-400)' }}>Built for institutions</div>
        <h2
          style={{
            marginTop: 'var(--space-3)',
            fontSize: 'clamp(28px, 3vw, 38px)',
            maxWidth: 760,
            lineHeight: 1.15,
            color: 'var(--ivory-50)',
            letterSpacing: '-0.01em',
          }}
        >
          Trusted access for every participant in the regional economy.
        </h2>

        <div
          style={{
            marginTop: 'var(--space-8)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--space-5)',
          }}
        >
          {ROLES.map((role, i) => {
            const Icon = role.icon;
            return (
              <div
                key={role.label}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  padding: 22,
                }}
              >
                <div style={{ color: 'var(--gold-400)', marginBottom: 14 }}>
                  <Icon size={22} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: 'var(--ivory-50)' }}>
                  {role.label}
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, margin: 0 }}>
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

/* ----------------------------- MAP SECTION ------------------------------- */
function MapSection({ selectedCountry, selectedSectors, onSelectCountry, onSelectSector }) {
  return (
    <section
      id="governments"
      style={{
        background: 'var(--ink-950)',
        color: 'var(--ivory-50)',
        padding: 'var(--space-10) 0',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-8)', alignItems: 'center' }} data-map-grid>
          <div>
            <div className="eyebrow" style={{ color: 'var(--gold-400)' }}>Regional footprint</div>
            <h2 style={{
              marginTop: 'var(--space-3)',
              fontSize: 'clamp(28px, 3vw, 38px)',
              lineHeight: 1.15,
              letterSpacing: '-0.01em',
            }}>
              Built for SADC.{' '}
              <span style={{ fontStyle: 'italic', color: 'var(--gold-400)' }}>Designed for the continent.</span>
            </h2>
            <p style={{ marginTop: 'var(--space-4)', color: 'var(--ink-300)', fontSize: 15, lineHeight: 1.6, maxWidth: 480 }}>
              SAREGO's geographic mandate is the 16 member states of the Southern African Development
              Community, with active linkages into ECOWAS, EAC, and COMESA — built for the deal flow
              that crosses borders.
            </p>
            <ul style={{ marginTop: 'var(--space-5)', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FeatureLine icon={Globe2}>22 active country profiles</FeatureLine>
              <FeatureLine icon={ShieldCheck}>KYC-grade verified counterparties</FeatureLine>
              <FeatureLine icon={Layers}>Multi-stage pipeline tracking</FeatureLine>
            </ul>
          </div>
          <div>
            <AfricaMap
              selectedCountry={selectedCountry}
              selectedSectors={selectedSectors}
              onSelectCountry={onSelectCountry}
              onSelectSector={onSelectSector}
            />
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 920px) {
          [data-map-grid] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function FeatureLine({ icon: Icon, children }) {
  return (
    <li style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'var(--ink-300)' }}>
      <Icon size={16} style={{ color: 'var(--gold-400)' }} />
      {children}
    </li>
  );
}

/* ----------------------------- PILLARS SECTION --------------------------- */
function PillarsSection() {
  const pillars = [
    {
      icon: FileText,
      title: 'Verified pipeline',
      body: 'Every project sponsor and counterparty completes institutional KYC before listing.',
    },
    {
      icon: Lock,
      title: 'Confidential deal rooms',
      body: 'Document trails, member roles, and audit-grade access control for serious diligence.',
    },
    {
      icon: TrendingUp,
      title: 'Cross-border by design',
      body: 'Engineered for capital, trade, and infrastructure flows that move across SADC.',
    },
  ];

  return (
    <section id="investors" style={{ padding: 'var(--space-10) 0' }}>
      <div className="container">
        <div className="eyebrow" style={{ color: 'var(--ink-700)' }}>Why SAREGO</div>
        <h2
          style={{
            marginTop: 'var(--space-3)',
            fontSize: 'clamp(28px, 3vw, 38px)',
            maxWidth: 760,
            lineHeight: 1.15,
            color: 'var(--ink-950)',
            letterSpacing: '-0.01em',
          }}
        >
          Institutional infrastructure for regional economic participation.
        </h2>

        <div
          style={{
            marginTop: 'var(--space-8)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-5)',
          }}
        >
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                style={{
                  background: 'var(--ivory-50)',
                  border: '1px solid var(--ink-200)',
                  borderRadius: 6,
                  padding: 24,
                }}
              >
                <div style={{ color: 'var(--gold-400)', marginBottom: 14 }}>
                  <Icon size={22} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 500, marginBottom: 10, color: 'var(--ink-950)' }}>
                  {p.title}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--ink-700)', lineHeight: 1.6, margin: 0 }}>
                  {p.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- CTA SECTION ------------------------------- */
function CTASection() {
  return (
    <section
      style={{
        background: 'var(--ink-950)',
        color: 'var(--ivory-50)',
        padding: 'var(--space-10) 0',
        textAlign: 'center',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="container">
        <h2 style={{ fontSize: 'clamp(28px, 3vw, 40px)', maxWidth: 720, margin: '0 auto', lineHeight: 1.15 }}>
          A single window into the SADC pipeline.
        </h2>
        <p style={{ marginTop: 'var(--space-4)', color: 'var(--ink-300)', maxWidth: 560, margin: '18px auto 0', fontSize: 16, lineHeight: 1.55 }}>
          Verified counterparties. Confidential deal rooms. Live opportunity flow across the region.
        </p>
        <div style={{ marginTop: 'var(--space-7)', display: 'inline-flex', gap: 14, flexWrap: 'wrap' }}>
          <Link to="/trade-hub" className="btn btn-gold">
            Explore Opportunities
            <ArrowUpRight size={16} />
          </Link>
          <Link to="/login?mode=register" className="btn btn-ghost-light">
            Request Platform Access
          </Link>
        </div>
      </div>
    </section>
  );
}
