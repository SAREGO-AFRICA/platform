import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { SaregoMark } from './Brand.jsx';

export default function Header({ variant = 'light' }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const isDark = variant === 'dark';

  const links = [
    { href: '/#marketplace', label: 'Marketplace' },
    { href: '/#trade',       label: 'Trade Hub' },
    { href: '/#governments', label: 'For Governments' },
    { href: '/#investors',   label: 'For Investors' },
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
          <Link to="/login" className={`btn ${isDark ? 'btn-ghost-light' : 'btn-ghost'}`}>
            Sign In
          </Link>
          <Link to="/login?mode=register" className="btn btn-gold">
            Request Access
          </Link>
        </div>

        <button
          aria-label="Menu"
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
            <Link to="/login" className={`btn ${isDark ? 'btn-ghost-light' : 'btn-ghost'}`} style={{ flex: 1 }}>
              Sign In
            </Link>
            <Link to="/login?mode=register" className="btn btn-gold" style={{ flex: 1 }}>
              Request Access
            </Link>
          </div>
        </div>
      )}

      {/* Inline responsive tweak — nav visibility */}
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
