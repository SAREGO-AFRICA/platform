// src/routes/stats.js
// Public aggregate counts for the live activity perception layer.
// Cached in-memory 60s — no Redis dependency for v1.

import { Router } from 'express';
import { query } from '../db/index.js';
import { asyncHandler } from '../middleware/errors.js';

const router = Router();

// ---------- Tiny in-memory cache ----------
const CACHE_TTL_MS = 60 * 1000;
let _cached = null;
let _cachedAt = 0;

async function computeStats() {
  // Run all aggregations in parallel
  const [
    projectsRes,
    commodityRes,
    logisticsRes,
    agriRes,
    tendersRes,
    countriesRes,
    sectorsRes,
    verifiedUsersRes,
    capitalRes,
    activity24hRes,
  ] = await Promise.all([
    query(`SELECT count(*)::int AS c FROM projects WHERE status = 'published'`),
    query(`SELECT count(*)::int AS c FROM commodity_requests WHERE status = 'published'`),
    query(`SELECT count(*)::int AS c FROM logistics_loads WHERE status = 'published'`),
    query(`SELECT count(*)::int AS c FROM agri_offtake_requests WHERE status = 'published'`),
    query(`SELECT count(*)::int AS c FROM tenders WHERE status = 'published'`),
    // Active countries = distinct country_iso across all opportunity tables + projects
    query(`
      SELECT count(DISTINCT iso)::int AS c FROM (
        SELECT country_iso AS iso FROM projects WHERE status = 'published'
        UNION SELECT country_iso FROM commodity_requests WHERE status = 'published'
        UNION SELECT country_iso FROM logistics_loads WHERE status = 'published'
        UNION SELECT country_iso FROM agri_offtake_requests WHERE status = 'published'
        UNION SELECT country_iso FROM tenders WHERE status = 'published'
      ) u
    `),
    // Sectors represented = distinct sector slugs linked from published projects
    query(`
      SELECT count(DISTINCT s.slug)::int AS c
        FROM project_sectors ps
        JOIN sectors s ON s.id = ps.sector_id
        JOIN projects p ON p.id = ps.project_id
       WHERE p.status = 'published'
    `),
    // Verified counterparties = users with trust_tier >= verified
    query(`SELECT count(*)::int AS c FROM users WHERE trust_tier IN ('verified', 'institutional') AND is_active = true`),
    // Total capital across published projects + summed value_usd across other verticals
    query(`
      SELECT COALESCE(SUM(value)::bigint, 0) AS total FROM (
        SELECT COALESCE(capital_required_usd, 0) AS value FROM projects WHERE status = 'published'
        UNION ALL
        SELECT COALESCE(value_usd, 0) FROM commodity_requests WHERE status = 'published'
        UNION ALL
        SELECT COALESCE(value_usd, 0) FROM logistics_loads WHERE status = 'published'
        UNION ALL
        SELECT COALESCE(value_usd, 0) FROM agri_offtake_requests WHERE status = 'published'
        UNION ALL
        SELECT COALESCE(value_usd, 0) FROM tenders WHERE status = 'published'
      ) u
    `),
    // Recent activity in last 24h across all activity-generating tables
    query(`
      SELECT (
        (SELECT count(*) FROM projects WHERE created_at > now() - interval '24 hours')
      + (SELECT count(*) FROM commodity_requests WHERE published_at > now() - interval '24 hours')
      + (SELECT count(*) FROM logistics_loads WHERE published_at > now() - interval '24 hours')
      + (SELECT count(*) FROM agri_offtake_requests WHERE published_at > now() - interval '24 hours')
      + (SELECT count(*) FROM tenders WHERE published_at > now() - interval '24 hours')
      + (SELECT count(*) FROM investment_interests WHERE created_at > now() - interval '24 hours')
      )::int AS c
    `),
  ]);

  const activeOpportunities =
    commodityRes.rows[0].c +
    logisticsRes.rows[0].c +
    agriRes.rows[0].c +
    tendersRes.rows[0].c;

  return {
    activeOpportunities,
    activeProjects: projectsRes.rows[0].c,
    verifiedCounterparties: verifiedUsersRes.rows[0].c,
    totalCapitalUsd: Number(capitalRes.rows[0].total) || 0,
    activeCountries: countriesRes.rows[0].c,
    sectorsRepresented: sectorsRes.rows[0].c,
    recentActivity24h: activity24hRes.rows[0].c,
    byVertical: {
      projects: projectsRes.rows[0].c,
      commodityRequests: commodityRes.rows[0].c,
      logisticsLoads: logisticsRes.rows[0].c,
      agriOfftake: agriRes.rows[0].c,
      tenders: tendersRes.rows[0].c,
    },
    cachedAt: new Date().toISOString(),
  };
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const now = Date.now();
    if (_cached && now - _cachedAt < CACHE_TTL_MS) {
      return res.json(_cached);
    }
    _cached = await computeStats();
    _cachedAt = now;
    res.json(_cached);
  })
);

export default router;
