import React from 'react';
import { SaregoMark } from './Brand.jsx';

export default function Footer() {
  const cols = [
    {
      title: 'Platform',
      links: ['Investment Marketplace', 'Trade Facilitation', 'Project Pipeline', 'Deal Rooms'],
    },
    {
      title: 'For',
      links: ['Governments', 'Investors', 'Corporates', 'SMEs', 'Project Developers'],
    },
    {
      title: 'Institution',
      links: ['About SAREGO', 'Mandate', 'Governance', 'Press', 'Careers'],
    },
    {
      title: 'Resources',
      links: ['Insights', 'Sector Briefs', 'Country Profiles', 'API', 'Contact'],
    },
  ];

  return (
    <footer
      style={{
        background: 'var(--ink-950)',
        color: 'var(--ivory-50)',
        paddingTop: 'var(--space-10)',
        paddingBottom: 'var(--space-6)',
        marginTop: 'var(--space-12)',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr repeat(4, 1fr)',
            gap: 'var(--space-6)',
            marginBottom: 'var(--space-10)',
          }}
        >
          <div>
            <SaregoMark size={28} light />
            <p
              style={{
                marginTop: 24,
                fontSize: 14,
                color: 'var(--ink-300)',
                maxWidth: 320,
                lineHeight: 1.6,
              }}
            >
              Southern Africa Regional Economic Growth Office. The institutional platform
              for cross-border trade, investment, and project pipeline across SADC and
              broader Africa.
            </p>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <div
                className="eyebrow"
                style={{ color: 'var(--gold-400)', marginBottom: 16 }}
              >
                {col.title}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {col.links.map((link) => (
                  <li key={link} style={{ marginBottom: 10 }}>
                    <a
                      href="#"
                      style={{
                        fontSize: 13,
                        color: 'var(--ivory-50)',
                        opacity: 0.75,
                        transition: 'opacity 150ms',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.75)}
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <hr
          style={{
            border: 'none',
            borderTop: '1px solid var(--ink-800)',
            margin: 0,
          }}
        />
        <div
          className="flex items-center justify-between"
          style={{ paddingTop: 'var(--space-5)', flexWrap: 'wrap', gap: 16 }}
        >
          <div className="text-xs" style={{ color: 'var(--ink-500)', letterSpacing: '0.1em' }}>
            © {new Date().getFullYear()} SAREGO · ESTABLISHED FOR THE SADC REGION
          </div>
          <div className="flex gap-5 text-xs" style={{ color: 'var(--ink-500)' }}>
            <a href="#" style={{ letterSpacing: '0.1em' }}>PRIVACY</a>
            <a href="#" style={{ letterSpacing: '0.1em' }}>TERMS</a>
            <a href="#" style={{ letterSpacing: '0.1em' }}>SECURITY</a>
            <a href="#" style={{ letterSpacing: '0.1em' }}>COMPLIANCE</a>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 880px) {
          footer > .container > div:first-child {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 520px) {
          footer > .container > div:first-child {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}
