import React, { useState } from 'react';

/**
 * Stylized Africa map. Production version should swap in a real TopoJSON
 * (e.g. from natural earth) — this scaffold uses an artistic representation
 * that is recognizable and serves the institutional aesthetic.
 *
 * Country positions are approximate latitude/longitude projected to the SVG.
 * The continent silhouette is a hand-tuned path inspired by Africa's outline.
 */

// Approximate plot points for major countries (lat, lng → SVG coords)
// projected onto our 600x720 viewBox where Africa fits.
const COUNTRIES = [
  // SADC members
  { iso: 'ZA', name: 'South Africa', x: 320, y: 600, sadc: true },
  { iso: 'NA', name: 'Namibia', x: 285, y: 545, sadc: true },
  { iso: 'BW', name: 'Botswana', x: 320, y: 535, sadc: true },
  { iso: 'ZW', name: 'Zimbabwe', x: 360, y: 510, sadc: true },
  { iso: 'ZM', name: 'Zambia', x: 350, y: 470, sadc: true },
  { iso: 'MW', name: 'Malawi', x: 395, y: 480, sadc: true },
  { iso: 'MZ', name: 'Mozambique', x: 395, y: 540, sadc: true },
  { iso: 'TZ', name: 'Tanzania', x: 405, y: 430, sadc: true },
  { iso: 'AO', name: 'Angola', x: 290, y: 480, sadc: true },
  { iso: 'CD', name: 'DR Congo', x: 340, y: 410, sadc: true },
  { iso: 'MG', name: 'Madagascar', x: 460, y: 540, sadc: true },
  { iso: 'MU', name: 'Mauritius', x: 510, y: 555, sadc: true },
  { iso: 'LS', name: 'Lesotho', x: 340, y: 605, sadc: true },
  { iso: 'SZ', name: 'Eswatini', x: 365, y: 590, sadc: true },
  // Other African
  { iso: 'KE', name: 'Kenya', x: 425, y: 400, sadc: false },
  { iso: 'NG', name: 'Nigeria', x: 245, y: 360, sadc: false },
  { iso: 'GH', name: 'Ghana', x: 215, y: 370, sadc: false },
  { iso: 'EG', name: 'Egypt', x: 360, y: 220, sadc: false },
  { iso: 'ET', name: 'Ethiopia', x: 420, y: 340, sadc: false },
  { iso: 'RW', name: 'Rwanda', x: 385, y: 415, sadc: false },
  { iso: 'MA', name: 'Morocco', x: 175, y: 215, sadc: false },
  { iso: 'SN', name: 'Senegal', x: 130, y: 320, sadc: false },
];

// A stylized continent path — not geographically perfect, but recognizable
// and consistent with the editorial aesthetic.
const AFRICA_PATH = `
M 240 130
C 215 135, 195 165, 185 195
C 175 220, 165 245, 155 270
C 150 295, 140 318, 130 340
C 120 360, 110 380, 110 400
C 110 420, 125 435, 145 445
C 165 455, 180 475, 190 500
C 200 525, 215 545, 230 565
C 245 585, 265 600, 285 615
C 305 630, 325 645, 350 650
C 380 655, 405 645, 420 625
C 435 605, 445 580, 455 555
C 470 530, 485 510, 490 480
C 495 450, 480 425, 470 400
C 460 375, 450 350, 445 325
C 440 300, 435 275, 430 250
C 425 230, 415 210, 400 195
C 385 180, 370 170, 355 165
C 340 160, 325 162, 310 158
C 295 153, 280 148, 265 142
C 252 138, 240 130, 240 130
Z
`;

export default function AfricaMap({ onSelect, height = 560 }) {
  const [hoveredIso, setHoveredIso] = useState(null);

  return (
    <div style={{ width: '100%', maxWidth: 640, margin: '0 auto', position: 'relative' }}>
      <svg
        viewBox="0 0 600 720"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto', maxHeight: height, overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="continentFill" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#1a1f28" />
            <stop offset="100%" stopColor="#0b0d10" />
          </radialGradient>
          <radialGradient id="sadcGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#dcc068" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#dcc068" stopOpacity="0" />
          </radialGradient>
          <pattern id="dots" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.5" fill="#dcc068" opacity="0.18" />
          </pattern>
        </defs>

        {/* Glow over the SADC region */}
        <ellipse cx="350" cy="530" rx="180" ry="140" fill="url(#sadcGlow)" />

        {/* Continent silhouette */}
        <path d={AFRICA_PATH} fill="url(#continentFill)" stroke="#262d39" strokeWidth="0.5" />
        <path d={AFRICA_PATH} fill="url(#dots)" />

        {/* Equator + tropic guide lines */}
        <line x1="80" y1="395" x2="520" y2="395" stroke="#b08a3a" strokeWidth="0.4" strokeDasharray="2 6" opacity="0.5" />
        <line x1="80" y1="290" x2="520" y2="290" stroke="#b08a3a" strokeWidth="0.3" strokeDasharray="2 8" opacity="0.3" />
        <line x1="80" y1="500" x2="520" y2="500" stroke="#b08a3a" strokeWidth="0.3" strokeDasharray="2 8" opacity="0.3" />

        {/* Country dots */}
        {COUNTRIES.map((c) => {
          const isHovered = hoveredIso === c.iso;
          const r = isHovered ? 7 : c.sadc ? 4.5 : 3;
          const fill = c.sadc ? '#dcc068' : '#9aa3b2';
          return (
            <g
              key={c.iso}
              onMouseEnter={() => setHoveredIso(c.iso)}
              onMouseLeave={() => setHoveredIso(null)}
              onClick={() => onSelect?.(c)}
              style={{ cursor: 'pointer' }}
            >
              {c.sadc && (
                <circle cx={c.x} cy={c.y} r={isHovered ? 14 : 9} fill="#dcc068" opacity={isHovered ? 0.18 : 0.08} />
              )}
              <circle
                cx={c.x}
                cy={c.y}
                r={r}
                fill={fill}
                stroke="#0b0d10"
                strokeWidth="0.8"
                style={{ transition: 'r 200ms ease' }}
              />
              {(isHovered || c.iso === 'ZA') && (
                <text
                  x={c.x + 10}
                  y={c.y + 4}
                  fill="#faf6ee"
                  fontSize="11"
                  fontFamily="Inter Tight, sans-serif"
                  fontWeight="500"
                  style={{ pointerEvents: 'none' }}
                >
                  {c.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Legend (top right) */}
        <g transform="translate(420, 60)">
          <text fontSize="9" fill="#dcc068" letterSpacing="2.4" fontFamily="Inter Tight">
            REGIONAL FOCUS
          </text>
          <circle cx="6" cy="22" r="4" fill="#dcc068" />
          <text x="18" y="26" fontSize="11" fill="#faf6ee" fontFamily="Inter Tight">
            SADC member
          </text>
          <circle cx="6" cy="42" r="3" fill="#9aa3b2" />
          <text x="18" y="46" fontSize="11" fill="#9aa3b2" fontFamily="Inter Tight">
            Broader Africa
          </text>
        </g>
      </svg>
    </div>
  );
}
