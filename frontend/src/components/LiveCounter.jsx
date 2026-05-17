import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';

/**
 * LiveCounter — animated number that counts up from 0 to `value` when it
 * scrolls into view. Designed for hero/dashboard "live activity" tiles.
 *
 * Props:
 *   value     number   target value
 *   label     string   short caption below the number
 *   format    'number' | 'usd' | 'compact'   how to render
 *   duration  number   seconds (default 1.8)
 *   prefix    string   optional prefix (e.g. '$')
 *   suffix    string   optional suffix (e.g. '+')
 *   loading   boolean  show skeleton instead of count
 *   accent    string   color for the number (default gold)
 */
export default function LiveCounter({
  value = 0,
  label = '',
  format = 'number',
  duration = 1.8,
  prefix = '',
  suffix = '',
  loading = false,
  accent = 'var(--gold-400, #dcc068)',
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -80px 0px' });
  const motionValue = useMotionValue(0);
  const [rendered, setRendered] = useState(format === 'usd' || format === 'compact' ? '0' : 0);

  useEffect(() => {
    if (loading) return;
    if (!inView) return;
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.16, 1, 0.3, 1], // ease-out-expo-ish
      onUpdate: (latest) => {
        setRendered(formatValue(latest, format));
      },
    });
    return () => controls.stop();
  }, [inView, value, loading, duration, format, motionValue]);

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          fontSize: 'clamp(28px, 3.4vw, 44px)',
          fontWeight: 600,
          color: accent,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
        }}
      >
        {loading ? (
          <span
            style={{
              display: 'inline-block',
              width: 80,
              height: 32,
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 4,
            }}
          />
        ) : (
          <>
            {prefix}{rendered}{suffix}
          </>
        )}
      </div>
      {label && (
        <div
          style={{
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.3,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

function formatValue(n, format) {
  const v = Math.round(n);
  if (format === 'usd') {
    if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  }
  if (format === 'compact') {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toLocaleString();
  }
  return v.toLocaleString();
}
