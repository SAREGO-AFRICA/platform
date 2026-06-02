import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, LogOut } from 'lucide-react';
import { SaregoMark } from './Brand.jsx';
import { getAccessToken, setAccessToken } from '../lib/api.js';

export default function Header({ variant = 'light' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isDark = variant === 'dark';

  useEffect(() => {
    setSignedIn(!!getAccessToken());
    setMenuOpen(false);
  }, [pathname]);

  const [unreadCount, setUnreadCount] = useState(0);

  // Parse role and tier from JWT for conditional nav
  const { userRole, userTier } = (() => {
    try {
      const token = getAccessToken();
      if (!token) return { userRole: null, userTier: null };
      const payload = JSON.parse(atob(token.split('.')[1]));
      return { userRole: payload.role, userTier: payload.tier };
    } catch { return { userRole: null, userTier: null }; }
  })();
  const showKyc = signedIn && userTier !== 'verified' && userRole !== 'admin';
  const showProviderProfile = signedIn && ['investor', 'corporate', 'sme'].includes(userRole);

  useEffect(() => {
    if (!signedIn) { setUnreadCount(0); return; }
    const token = getAccessToken();
    const BASE_URL = import.meta.env.VITE_API_URL || '';
    fetch(`${BASE_URL}/api/conversations`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        const total = (d.conversations || []).reduce((sum, c) => sum + Number(c.unread_count || 0), 0);
        setUnreadCount(total);
      })
      .catch(() => {});
  }, [pathname, signedIn]);

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
    // SAREGO-OPP-PAGE-NAV
    { href: '/opportunities', label: t('header.nav.opportunities') },
    { href: '/provider/browse', label: 'Capital Providers' },
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
              {/* Account dropdown trigger */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setMenuOpen(p => !p)}
                  className={`btn ${isDark ? 'btn-ghost-light' : 'btn-ghost'}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  Account
                  {unreadCount > 0 && (
                    <span style={{ background: '#b8962e', color: '#0d0d0d', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700, lineHeight: 1.4 }}>{unreadCount}</span>
                  )}
                  <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
                </button>

                {menuOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                      onClick={() => setMenuOpen(false)}
                    />
                    {/* Dropdown panel */}
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 10px)',
                      right: 0,
                      zIndex: 99,
                      background: isDark ? '#0f1114' : '#fff',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      borderRadius: 12,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                      padding: '20px',
                      width: 280,
                    }}>
                      {/* Grid of links */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                        {[
                          { to: '/dashboard', icon: '⊞', label: 'Dashboard' },
                          { to: '/my-listings', icon: '📋', label: 'My Listings' },
                          { to: '/conversations', icon: '💬', label: 'Conversations', badge: unreadCount },
                          { to: '/deal-rooms', icon: '🔒', label: 'Deal Rooms' },
                          ...(showProviderProfile ? [{ to: '/my-provider-profile', icon: '🏦', label: 'Provider Profile' }] : []),
                          ...(showKyc ? [{ to: '/kyc', icon: '✓', label: 'KYC Verification' }] : []),
                        ].map(item => (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setMenuOpen(false)}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 6,
                              padding: '14px 8px',
                              borderRadius: 8,
                              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                              textDecoration: 'none',
                              color: isDark ? '#e8e0d0' : '#1a1a1a',
                              fontSize: 12,
                              fontWeight: 500,
                              transition: 'background 0.15s',
                              position: 'relative',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(184,150,46,0.12)' : 'rgba(184,150,46,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}
                          >
                            <span style={{ fontSize: 20 }}>{item.icon}</span>
                            <span>{item.label}</span>
                            {item.badge > 0 && (
                              <span style={{ position: 'absolute', top: 8, right: 8, background: '#b8962e', color: '#0d0d0d', borderRadius: 10, padding: '1px 5px', fontSize: 10, fontWeight: 700 }}>{item.badge}</span>
                            )}
                          </Link>
                        ))}
                      </div>
                      {/* Sign out */}
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); handleSignOut(); }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          padding: '10px',
                          borderRadius: 8,
                          border: '1px solid rgba(184,150,46,0.3)',
                          background: 'transparent',
                          color: '#b8962e',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <LogOut size={14} /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
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
                <Link
                  to="/conversations"
                  onClick={() => setOpen(false)}
                  className={`btn ${isDark ? 'btn-ghost-light' : 'btn-ghost'}`}
                  style={{ flex: 1, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  Conversations
                  {unreadCount > 0 && (
                    <span style={{ background: '#b8962e', color: '#0d0d0d', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{unreadCount}</span>
                  )}
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
