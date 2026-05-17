import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown } from 'lucide-react';
import { SaregoMark } from './Brand.jsx';

const LANGUAGES = [
  { code: 'en', labelKey: 'common.english' },
  { code: 'fr', labelKey: 'common.french' },
  { code: 'pt', labelKey: 'common.portuguese' },
];

function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLang = LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) || LANGUAGES[0];

  function changeLanguage(code) {
    i18n.changeLanguage(code);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
          border: '1px solid var(--ink-800)',
          color: 'var(--ivory-50)',
          padding: '8px 14px',
          borderRadius: 4,
          fontSize: 13,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <Globe size={14} />
        {t(currentLang.labelKey)}
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            right: 0,
            background: 'var(--ink-950)',
            border: '1px solid var(--ink-800)',
            borderRadius: 4,
            minWidth: 160,
            overflow: 'hidden',
            zIndex: 10,
          }}
        >
          {LANGUAGES.map((lang) => {
            const isCurrent = lang.code === i18n.resolvedLanguage;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => changeLanguage(lang.code)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  background: isCurrent ? 'rgba(220, 192, 104, 0.1)' : 'transparent',
                  color: isCurrent ? 'var(--gold-400)' : 'var(--ivory-50)',
                  border: 'none',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 150ms',
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) e.currentTarget.style.background = 'transparent';
                }}
              >
                {t(lang.labelKey)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Footer() {
  const { t } = useTranslation();

  const cols = [
    {
      titleKey: 'footer.columns.platform.title',
      links: [
        { labelKey: 'footer.columns.platform.links.marketplace', href: '#marketplace' },
        { labelKey: 'footer.columns.platform.links.tradeFacilitation', href: '#trade' },
        { labelKey: 'footer.columns.platform.links.pipeline', href: '#marketplace' },
        { labelKey: 'footer.columns.platform.links.dealRooms', href: '#' },
      ],
    },
    {
      titleKey: 'footer.columns.for.title',
      links: [
        { labelKey: 'footer.columns.for.links.governments', href: '#governments' },
        { labelKey: 'footer.columns.for.links.investors', href: '#investors' },
        { labelKey: 'footer.columns.for.links.corporates', href: '#' },
        { labelKey: 'footer.columns.for.links.smes', href: '#' },
        { labelKey: 'footer.columns.for.links.developers', href: '#' },
      ],
    },
    {
      titleKey: 'footer.columns.institution.title',
      links: [
        { labelKey: 'footer.columns.institution.links.about', href: '#' },
        { labelKey: 'footer.columns.institution.links.mandate', href: '#' },
        { labelKey: 'footer.columns.institution.links.governance', href: '#' },
        { labelKey: 'footer.columns.institution.links.press', href: '#' },
        { labelKey: 'footer.columns.institution.links.careers', href: '#' },
      ],
    },
    {
      titleKey: 'footer.columns.resources.title',
      links: [
        { labelKey: 'footer.columns.resources.links.insights', href: '#' },
        { labelKey: 'footer.columns.resources.links.sectorBriefs', href: '#' },
        { labelKey: 'footer.columns.resources.links.countryProfiles', href: '#' },
        { labelKey: 'footer.columns.resources.links.api', href: '#' },
        { labelKey: 'footer.columns.resources.links.contact', href: 'mailto:support@sarego.africa' },
      ],
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
              {t('footer.about')}
            </p>
          </div>

          {cols.map((col) => (
            <div key={col.titleKey}>
              <div
                className="eyebrow"
                style={{ color: 'var(--gold-400)', marginBottom: 16 }}
              >
                {t(col.titleKey)}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {col.links.map((link) => (
                  <li key={link.labelKey} style={{ marginBottom: 10 }}>
                    <a
                      href={link.href}
                      style={{
                        fontSize: 13,
                        color: 'var(--ivory-50)',
                        opacity: 0.75,
                        transition: 'opacity 150ms',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.75)}
                    >
                      {t(link.labelKey)}
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
            {t('footer.copyright', { year: new Date().getFullYear() })} · {t('footer.tagline')}
          </div>
          <div className="flex items-center gap-5 text-xs" style={{ color: 'var(--ink-500)', flexWrap: 'wrap' }}>
            <a href="#" style={{ letterSpacing: '0.1em' }}>{t('footer.legal.privacy')}</a>
            <a href="#" style={{ letterSpacing: '0.1em' }}>{t('footer.legal.terms')}</a>
            <a href="#" style={{ letterSpacing: '0.1em' }}>{t('footer.legal.security')}</a>
            <a href="#" style={{ letterSpacing: '0.1em' }}>{t('footer.legal.compliance')}</a>
            <LanguageSwitcher />
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
