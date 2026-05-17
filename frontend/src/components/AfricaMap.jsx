import React, { useState, useEffect, useMemo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps';
import { api } from '../lib/api.js';

/**
 * Real-Africa TopoJSON map for the SAREGO marketplace.
 *
 * Features:
 *  - Country borders via react-simple-maps + Natural Earth TopoJSON (CDN)
 *  - Choropleth: countries colored by number of published projects
 *  - Markers: one per project at the country centroid, size = capital required
 *  - Sector filter chips (toggle which sectors render)
 *  - Hover tooltip (country name + project count + total capital)
 *  - Click country -> calls onSelectCountry(iso) so parent can filter the list
 *
 * Props:
 *   selectedCountry  string | null  - currently filtered country (highlighted)
 *   selectedSectors  string[]       - sector slugs currently active (empty = all)
 *   onSelectCountry  fn(iso)        - called when a country is clicked
 *   onSelectSector   fn(slug)       - called when a sector chip is toggled
 *   height           number         - SVG height (default 560)
 */

// World-atlas TopoJSON uses UN M49 numeric codes. Map them to ISO-2 codes
// for the African countries we care about. (Subset; non-African codes are
// filtered out before we even render Geographies.)
const NUM_TO_ISO2 = {
  '012': 'DZ', '024': 'AO', '072': 'BW', '108': 'BI', '120': 'CM', '132': 'CV',
  '140': 'CF', '148': 'TD', '174': 'KM', '178': 'CG', '180': 'CD',
  '204': 'BJ', '226': 'GQ', '231': 'ET', '232': 'ER', '262': 'DJ',
  '266': 'GA', '270': 'GM', '288': 'GH', '324': 'GN', '384': 'CI',
  '404': 'KE', '426': 'LS', '430': 'LR', '434': 'LY', '450': 'MG',
  '454': 'MW', '466': 'ML', '478': 'MR', '480': 'MU', '504': 'MA',
  '508': 'MZ', '516': 'NA', '562': 'NE', '566': 'NG', '624': 'GW',
  '646': 'RW', '678': 'ST', '686': 'SN', '690': 'SC', '694': 'SL',
  '706': 'SO', '710': 'ZA', '716': 'ZW', '728': 'SS', '729': 'SD',
  '748': 'SZ', '768': 'TG', '788': 'TN', '800': 'UG', '818': 'EG',
  '834': 'TZ', '854': 'BF', '894': 'ZM',
};
const AFRICAN_NUMERIC_CODES = new Set(Object.keys(NUM_TO_ISO2));

// Approximate country centroids (lng, lat) for marker placement.
// These are tweaked for visual readability rather than perfect geographic accuracy.
const COUNTRY_CENTROIDS = {
  DZ: [2.6, 28], AO: [17.5, -12], BW: [24, -22.3], BI: [29.9, -3.4], CM: [12.5, 5.7],
  CV: [-24, 16], CF: [20.9, 6.6], TD: [18.7, 15.5], KM: [43.9, -11.9],
  CG: [15.2, -1], CD: [23.7, -2.9], BJ: [2.3, 9.3], GQ: [10.3, 1.6],
  ET: [40.5, 9.1], ER: [39.8, 15.2], DJ: [42.6, 11.6], GA: [11.6, -0.6],
  GM: [-15.5, 13.4], GH: [-1.1, 7.9], GN: [-10.9, 10.5], CI: [-5.5, 7.5],
  KE: [37.9, 0.5], LS: [28.2, -29.5], LR: [-9.4, 6.4], LY: [17.2, 26.3],
  MG: [46.9, -19], MW: [34.2, -13.2], ML: [-3.9, 17.6], MR: [-10.9, 21],
  MU: [57.5, -20.3], MA: [-7, 31.8], MZ: [35.5, -18.7], NA: [18.5, -22.6],
  NE: [8.1, 17.6], NG: [8, 9.6], GW: [-15.2, 11.8], RW: [29.9, -2],
  ST: [6.6, 0.2], SN: [-14.5, 14.5], SC: [55.5, -4.7], SL: [-11.8, 8.5],
  SO: [46.2, 5.2], ZA: [25, -29], ZW: [29.9, -19], SS: [31.3, 7.9],
  SD: [30.2, 16], SZ: [31.5, -26.5], TG: [0.8, 8.6], TN: [9.5, 33.9],
  UG: [32.3, 1.4], EG: [30.8, 26.8], TZ: [34.9, -6.4], BF: [-1.6, 12.3],
  ZM: [27.8, -13.5],
};

// SADC member countries (for "regional focus" highlight)
const SADC = new Set([
  'AO', 'BW', 'CD', 'KM', 'LS', 'MG', 'MW', 'MU', 'MZ', 'NA',
  'SC', 'ZA', 'SZ', 'TZ', 'ZM', 'ZW',
]);

// Hosted Africa TopoJSON. world-atlas at jsdelivr is well-cached + reliable.
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Sector -> distinct accent colors. Match SAREGO palette + add fallbacks.
const SECTOR_COLORS = {
  'energy-power': '#dcc068',     // gold (primary brand)
  energy: '#dcc068',
  mining: '#b08a3a',
  agriculture: '#7fb069',
  infrastructure: '#5d8aa8',
  manufacturing: '#c97b7b',
  finance: '#a888c2',
  tourism: '#e2a45e',
  technology: '#6ec3c9',
  healthcare: '#d77f9e',
  default: '#9aa3b2',
};
function colorForSector(slug) {
  if (!slug) return SECTOR_COLORS.default;
  return SECTOR_COLORS[slug] || SECTOR_COLORS.default;
}

// Capital -> marker radius (logarithmic-ish so $1B doesn't overwhelm $1M)
function radiusForCapital(usd) {
  if (!usd || usd <= 0) return 4;
  const m = usd / 1_000_000; // in $M
  if (m < 1) return 4;
  if (m < 10) return 5;
  if (m < 50) return 6;
  if (m < 200) return 8;
  if (m < 1000) return 10;
  return 12;
}

function formatUSDShort(n) {
  if (!n || n <= 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

export default function AfricaMap({
  selectedCountry = null,
  selectedSectors = [],
  onSelectCountry,
  onSelectSector,
  height = 560,
}) {
  const [projects, setProjects] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [hoverIso, setHoverIso] = useState(null);
  const [tooltip, setTooltip] = useState(null); // { x, y, content }
  const [loaded, setLoaded] = useState(false);

  // Fetch published projects + sector list on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [projData, sectorData] = await Promise.all([
          api('/api/projects?limit=50'),
          api('/api/reference/sectors').catch(() => ({ sectors: [] })),
        ]);
        if (cancelled) return;
        setProjects(projData.projects || []);
        setSectors(sectorData.sectors || []);
      } catch {
        // Render empty map gracefully on API failure
        if (!cancelled) {
          setProjects([]);
          setSectors([]);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Filter projects by active sectors (if any)
  const visibleProjects = useMemo(() => {
    if (!selectedSectors || selectedSectors.length === 0) return projects;
    const active = new Set(selectedSectors);
    return projects.filter((p) => {
      const slugs = (p.sectors || []).map((s) => s.slug);
      return slugs.some((s) => active.has(s));
    });
  }, [projects, selectedSectors]);

  // Group visible projects by country ISO for choropleth + tooltip
  const projectsByCountry = useMemo(() => {
    const map = {};
    for (const p of visibleProjects) {
      const iso = p.iso_code;
      if (!iso) continue;
      if (!map[iso]) map[iso] = { projects: [], totalCapital: 0 };
      map[iso].projects.push(p);
      map[iso].totalCapital += Number(p.capital_required_usd) || 0;
    }
    return map;
  }, [visibleProjects]);

  // Choropleth scale: 0 projects = base ink, more = brighter gold
  function fillForCountry(iso) {
    const data = projectsByCountry[iso];
    const count = data?.projects?.length || 0;
    const isSadc = SADC.has(iso);
    const isSelected = selectedCountry === iso;
    const isHovered = hoverIso === iso;

    if (isSelected) return '#dcc068';
    if (count === 0) {
      return isSadc ? (isHovered ? '#2a2f3a' : '#1d2128') : (isHovered ? '#22262e' : '#161a20');
    }
    // Scale gold intensity with count
    if (count >= 5) return isHovered ? '#e8d088' : '#dcc068';
    if (count >= 3) return isHovered ? '#c4a85c' : '#b08a3a';
    return isHovered ? '#a08240' : '#735a28';
  }

  function strokeForCountry(iso) {
    if (selectedCountry === iso) return '#faf6ee';
    if (SADC.has(iso)) return '#3a3a3a';
    return '#262d39';
  }

  function handleCountryClick(iso, name) {
    if (!onSelectCountry) return;
    if (selectedCountry === iso) onSelectCountry(null); // toggle off
    else onSelectCountry(iso);

    // Smooth-scroll to the marketplace pipeline after a tick
    setTimeout(() => {
      const el = document.getElementById('marketplace');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function handleCountryHover(iso, name, evt) {
    setHoverIso(iso);
    const data = projectsByCountry[iso];
    const count = data?.projects?.length || 0;
    const capital = data?.totalCapital || 0;
    setTooltip({
      x: evt.clientX,
      y: evt.clientY,
      content: (
        <>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#faf6ee' }}>{name}</div>
          {count > 0 ? (
            <>
              <div style={{ fontSize: 11, color: '#dcc068', marginTop: 2 }}>
                {count} {count === 1 ? 'project' : 'projects'}
              </div>
              <div style={{ fontSize: 11, color: '#9aa3b2', marginTop: 2 }}>
                {formatUSDShort(capital)} total capital
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              No published projects
            </div>
          )}
          {SADC.has(iso) && (
            <div style={{ fontSize: 10, color: '#dcc068', marginTop: 4, letterSpacing: 1 }}>
              SADC MEMBER
            </div>
          )}
        </>
      ),
    });
  }

  function handleCountryLeave() {
    setHoverIso(null);
    setTooltip(null);
  }

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* Sector filter chips */}
      {sectors.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 16,
            justifyContent: 'center',
          }}
        >
          {sectors.map((s) => {
            const active = selectedSectors.includes(s.slug);
            return (
              <button
                key={s.slug}
                type="button"
                onClick={() => onSelectSector?.(s.slug)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: `1px solid ${active ? '#dcc068' : '#3a3a3a'}`,
                  background: active ? 'rgba(220, 192, 104, 0.14)' : 'transparent',
                  color: active ? '#dcc068' : '#9aa3b2',
                  fontSize: 12,
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: colorForSector(s.slug),
                    marginRight: 6,
                    verticalAlign: 'middle',
                  }}
                />
                {s.name}
              </button>
            );
          })}
          {selectedSectors.length > 0 && (
            <button
              type="button"
              onClick={() => selectedSectors.forEach((s) => onSelectSector?.(s))}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                border: '1px solid transparent',
                background: 'transparent',
                color: '#6b7280',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* The map */}
      <div style={{ maxWidth: 720, margin: '0 auto', height }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 380,
            center: [20, 0],
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies
                .filter((geo) => AFRICAN_NUMERIC_CODES.has(geo.id))
                .map((geo) => {
                  const iso = NUM_TO_ISO2[geo.id];
                  const name = geo.properties.name;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fillForCountry(iso)}
                      stroke={strokeForCountry(iso)}
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none', cursor: 'pointer', transition: 'fill 200ms' },
                        hover:   { outline: 'none' },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={(evt) => handleCountryHover(iso, name, evt)}
                      onMouseMove={(evt) => setTooltip((t) => t ? { ...t, x: evt.clientX, y: evt.clientY } : t)}
                      onMouseLeave={handleCountryLeave}
                      onClick={() => handleCountryClick(iso, name)}
                    />
                  );
                })
            }
          </Geographies>

          {/* Project markers */}
          {loaded && visibleProjects.map((p) => {
            const coords = COUNTRY_CENTROIDS[p.iso_code];
            if (!coords) return null;
            const primarySector = p.sectors?.[0]?.slug;
            const r = radiusForCapital(p.capital_required_usd);
            // Jitter to spread markers in the same country
            const idx = visibleProjects.filter((x) => x.iso_code === p.iso_code).indexOf(p);
            const jitterX = (idx % 3) * 1.4 - 1.4;
            const jitterY = (Math.floor(idx / 3)) * 1.4 - 0.7;
            return (
              <Marker
                key={p.id || p.slug}
                coordinates={[coords[0] + jitterX, coords[1] + jitterY]}
              >
                <circle
                  r={r}
                  fill={colorForSector(primarySector)}
                  fillOpacity={0.85}
                  stroke="#0b0d10"
                  strokeWidth={1.2}
                  style={{ pointerEvents: 'none', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}
                />
              </Marker>
            );
          })}
        </ComposableMap>
      </div>

      {/* Tooltip (rendered as floating div) */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 12,
            top: tooltip.y + 12,
            background: 'rgba(11, 13, 16, 0.95)',
            border: '1px solid #262d39',
            borderRadius: 6,
            padding: '10px 14px',
            pointerEvents: 'none',
            zIndex: 100,
            minWidth: 140,
          }}
        >
          {tooltip.content}
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          justifyContent: 'center',
          marginTop: 16,
          flexWrap: 'wrap',
          fontSize: 11,
          color: '#9aa3b2',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, background: '#dcc068', borderRadius: 2 }} />
          5+ projects
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, background: '#b08a3a', borderRadius: 2 }} />
          3–4 projects
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, background: '#735a28', borderRadius: 2 }} />
          1–2 projects
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, background: '#1d2128', border: '1px solid #3a3a3a', borderRadius: 2 }} />
          SADC member
        </div>
      </div>
    </div>
  );
}
