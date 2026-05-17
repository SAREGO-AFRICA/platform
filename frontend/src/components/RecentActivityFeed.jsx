import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api.js';
import OpportunityCard from './OpportunityCard.jsx';

/**
 * RecentActivityFeed — polls /api/activity every 30 seconds and renders a
 * scrollable feed of recent opportunity events. Audience-aware.
 *
 * Props:
 *   audience    'investors' | 'governments' | 'trade' | null
 *   limit       int default 12
 *   compact     bool — denser cards
 *   title       string — feed header (default: "Live activity")
 *   pollInterval number ms (default 30000)
 *   maxHeight   number|string — for fixed-height scrollable feed (e.g. 520)
 */
export default function RecentActivityFeed({
  audience = null,
  limit = 12,
  compact = false,
  title = 'Live activity',
  pollInterval = 30000,
  maxHeight = null,
}) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    async function fetchFeed() {
      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (audience) params.set('audience', audience);
        const data = await api(`/api/activity?${params.toString()}`);
        if (cancelledRef.current) return;
        setEvents(data.events || []);
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        if (cancelledRef.current) return;
        setError(err.message || 'Could not load activity');
        setEvents((prev) => prev ?? []);
      }
    }

    fetchFeed();
    const intervalId = setInterval(fetchFeed, pollInterval);
    return () => {
      cancelledRef.current = true;
      clearInterval(intervalId);
    };
  }, [audience, limit, pollInterval]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--gold-400, #dcc068)',
              marginBottom: 4,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            <LiveDot /> {lastUpdated ? `Updated ${formatTimeAgo(lastUpdated)}` : 'Loading…'}
          </div>
        </div>
      </div>

      {/* Feed */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxHeight: maxHeight || undefined,
          overflowY: maxHeight ? 'auto' : 'visible',
          paddingRight: maxHeight ? 4 : 0,
        }}
      >
        {events === null && <SkeletonFeed count={4} />}
        {events !== null && events.length === 0 && !error && (
          <div
            style={{
              padding: 18,
              fontSize: 13,
              color: 'rgba(255,255,255,0.5)',
              textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: 8,
            }}
          >
            No recent activity yet.
          </div>
        )}
        {events !== null && events.length > 0 && events.map((event) => (
          <OpportunityCard key={event.id} event={event} compact={compact} />
        ))}
        {error && events !== null && events.length === 0 && (
          <div
            style={{
              padding: 14,
              fontSize: 12,
              color: '#c97b7b',
              border: '1px solid rgba(201,123,123,0.3)',
              borderRadius: 6,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function LiveDot() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: '#7fb069',
        marginRight: 6,
        boxShadow: '0 0 0 0 rgba(127,176,105,0.6)',
        animation: 'sarego-pulse 2s infinite',
        verticalAlign: 'middle',
      }}
    >
      <style>{`
        @keyframes sarego-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(127,176,105,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(127,176,105, 0);  }
          100% { box-shadow: 0 0 0 0   rgba(127,176,105, 0);  }
        }
      `}</style>
    </span>
  );
}

function SkeletonFeed({ count = 4 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ width: '40%', height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }} />
          <div style={{ width: '85%', height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginTop: 4 }} />
          <div style={{ width: '60%', height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginTop: 4 }} />
        </div>
      ))}
    </>
  );
}

function formatTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}
