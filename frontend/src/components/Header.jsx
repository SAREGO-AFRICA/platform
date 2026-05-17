import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, LogOut } from 'lucide-react';
import { SaregoMark } from './Brand.jsx';
import { getAccessToken, setAccessToken } from '../lib/api.js';

export default function Header({ variant = 'light' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isDark = variant === 'dark';

  useEffect(() => {
    setSignedIn(!!getAccessToken());
  }, [pathname]);

  async function handleSignOut() {
    try {
      const BASE_URL = import.meta.env.VITE_API_URL || '';
      await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setSignedIn(false);
    setOpen(false);
    navigate('/');
  }

  const links = [
    { href: '/#marketplace',  label: t('header.nav.marketplace') },
    { href: '/trade-hub',     label: t('header.nav.tradeHub') },
    { href: '/governments',   label: t('header.nav.forGovernments') },
    { href: '/investors',     label: t('header.nav.forInvestors') },
  ];

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: isDark
          ? 'rgba(11, 13, 16, 0.85)'
          : 'rgba(250, 246, 238, 0.88)',
        backdropFilter: 'blur(18px) saturate(140%)',
        WebkitBackdropFilter: 'blur(18px) saturate(140%)',
        borderBottom: `1px solid ${isDark ? 'rgba(38, 45, 57, 0.6)' : 'var(--ivory-200)'}`,
      }}
    >
      <div
        className="container flex items-center justify-between"
        style={{ height: 78 }}
      >
        <Link to="/" style={{ display: 'flex' }}>
          <SaregoMark size={26} light={isDark} />
        </Link>

        <nav
          className="flex items-center gap-6"
          style={{ display: 'none' }}
          data-desktop-nav
        >
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              style={{
                fontSize: 13,
                letterSpacing: '0.06em',
                color: isDark ? 'var(--ivory-50)' : 'var(--ink-950)',
                opacity: 0.85,
                transition: 'opacity 150ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = 0.85)}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3" data-desktop-actions>
          {signedIn ? (
            <>
              <Link to="/dashboard" className={`btn ${isDark ? 'btn-ghost-light' : 'btn-ghost'}`}>
                {t('header.actions.dashboard')}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="btn btn-gold"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <LogOut size={14} /> {t('header.actions.signOut')}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={`btn ${isDark ? 'btn-ghost-light' : 'btn-ghost'}`}>
                {t('header.actions.signIn')}
              </Link>
              <Link to="/login?mode=register" className="btn btn-gold">
                {t('header.actions.requestAccess')}
              </Link>
            </>
          )}
        </div>

        <button
          aria-label={t('header.menu')}
          onClick={() => setOpen(!open)}
          data-mobile-toggle
          style={{
            display: 'none',
            background: 'transparent',
            border: 'none',
            color: isDark ? 'var(--ivory-50)' : 'var(--ink-950)',
            padding: 8,
          }}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div
          style={{
            background: isDark ? 'var(--ink-950)' : 'var(--ivory-50)',
            borderTop: `1px solid ${isDark ? 'var(--ink-800)' : 'var(--ivory-200)'}`,
            padding: 'var(--space-4) var(--space-5)',
          }}
        >
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                padding: '12px 0',
                color: isDark ? 'var(--ivory-50)' : 'var(--ink-950)',
                fontSize: 15,
                borderBottom: `1px solid ${isDark ? 'var(--ink-800)' : 'var(--ivory-200)'}`,
              }}
            >
              {l.label}
            </a>
          ))}
          <div className="flex gap-3" style={{ marginTop: 16 }}>
            {signedIn ? (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className={`btn ${isDark ? 'btn-ghost-light' : 'btn-ghost'}`}
                  style={{ flex: 1 }}
                >
                  {t('header.actions.dashboard')}
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="btn btn-gold"
                  style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <LogOut size={14} /> {t('header.actions.signOut')}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className={`btn ${isDark ? 'btn-ghost-light' : 'btn-ghost'}`}
                  style={{ flex: 1 }}
                >
                  {t('header.actions.signIn')}
                </Link>
                <Link
                  to="/login?mode=register"
                  onClick={() => setOpen(false)}
                  className="btn btn-gold"
                  style={{ flex: 1 }}
                >
                  {t('header.actions.requestAccess')}
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 880px) {
          [data-desktop-nav]    { display: flex !important; }
          [data-desktop-actions]{ display: flex !important; }
          [data-mobile-toggle]  { display: none !important; }
        }
        @media (max-width: 879px) {
          [data-desktop-nav]    { display: none !important; }
          [data-desktop-actions]{ display: none !important; }
          [data-mobile-toggle]  { display: inline-flex !important; }
        }
      `}</style>
    </header>
  );
}
