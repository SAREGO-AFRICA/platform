import React from 'react';

/* The SAREGO mark: a stylized monogram suggesting a continent contour
   inside a roundel, paired with the wordmark. Pure SVG, no images. */
export function SaregoMark({ size = 28, light = false, withWordmark = true }) {
  const stroke = light ? '#ecdca4' : '#0b0d10';
  const gold = '#b08a3a';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="22" fill="none" stroke={stroke} strokeWidth="1.4" />
        <circle cx="24" cy="24" r="17" fill="none" stroke={gold} strokeWidth="0.8" opacity="0.7" />
        {/* Stylized continent silhouette */}
        <path
          d="M22 8c-3 1-5 4-6 7-1 2 0 4-1 6-1 2-3 3-3 5 0 3 2 4 3 7 1 3 1 6 3 7 2 1 4 0 6 1 2 1 3 4 5 4 3 0 5-3 6-6 1-3 0-7 2-9 1-2 4-2 4-5 0-2-2-3-3-5-1-3-2-6-5-8-3-2-7-3-11-3z"
          fill={stroke}
          opacity="0.92"
        />
        {/* Compass tick at the equator */}
        <line x1="3" y1="24" x2="6" y2="24" stroke={gold} strokeWidth="1.2" />
        <line x1="42" y1="24" x2="45" y2="24" stroke={gold} strokeWidth="1.2" />
      </svg>
      {withWordmark && (
        <span
          style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontWeight: 600,
            fontSize: size * 0.78,
            letterSpacing: '0.16em',
            color: light ? '#faf6ee' : '#0b0d10',
            textTransform: 'uppercase',
          }}
        >
          Sarego
        </span>
      )}
    </span>
  );
}
