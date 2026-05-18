// src/lib/usePlatformStats.js
// Reusable hook for /api/stats. Page-level fetch with internal 30s freshness
// so two components on the same page don't double-fetch.

import { useEffect, useState } from 'react';
import { api } from './api.js';

// Module-level cache shared across components within the SPA tab.
let _cached = null;
let _cachedAt = 0;
const TTL_MS = 30 * 1000;
let _inflight = null;

async function fetchStats() {
  const now = Date.now();
  if (_cached && now - _cachedAt < TTL_MS) {
    return _cached;
  }
  if (_inflight) {
    return _inflight;
  }
  _inflight = (async () => {
    try {
      const data = await api('/api/stats');
      _cached = data;
      _cachedAt = Date.now();
      return data;
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

/**
 * usePlatformStats — returns { stats, loading, error }.
 *
 * Future evolution path:
 *   - swap internal fetch for websocket subscription without changing the
 *     hook signature
 *   - add a refresh interval prop
 *   - layer optimistic updates from local actions (e.g. just-expressed
 *     interest increments the live count without re-fetching)
 */
export function usePlatformStats() {
  const [stats, setStats] = useState(_cached);
  const [loading, setLoading] = useState(!_cached);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchStats();
        if (!cancelled) {
          setStats(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load platform stats');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { stats, loading, error };
}
