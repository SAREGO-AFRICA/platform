// SAREGO-TF-PHASE2
// src/routes/stats.js
// Public aggregate counts for the live activity perception layer.
// Cached in-memory 60s — no Redis dependency for v1.

import { Router } from 'express';
import { query } from '../db/index.js';
import { asyncHandler } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';

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
    tradeFinanceRes,
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
    query(`SELECT count(*)::int AS c FROM trade_finance_requests WHERE status = 'published'`),
    // Active countries = distinct country_iso across all opportunity tables + projects
    query(`
      SELECT count(DISTINCT iso)::int AS c FROM (
        SELECT c.iso_code AS iso FROM projects p JOIN countries c ON c.id = p.country_id WHERE p.status = 'published'
        UNION SELECT country_iso FROM commodity_requests WHERE status = 'published'
        UNION SELECT country_iso FROM logistics_loads WHERE status = 'published'
        UNION SELECT country_iso FROM agri_offtake_requests WHERE status = 'published'
        UNION SELECT country_iso FROM tenders WHERE status = 'published'
        UNION SELECT country_iso FROM trade_finance_requests WHERE status = 'published'
      ) u
    `),
    // Sectors represented = distinct sector slugs linked from published projects
    query(`
      -- Sectors represented = distinct sectors across all 5 opportunity verticals
      -- plus legacy project_sectors mappings.
      SELECT count(DISTINCT s)::int AS c FROM (
        SELECT sector::text AS s FROM commodity_requests WHERE status = 'published' AND sector IS NOT NULL
        UNION SELECT sector::text FROM logistics_loads WHERE status = 'published' AND sector IS NOT NULL
        UNION SELECT sector::text FROM agri_offtake_requests WHERE status = 'published' AND sector IS NOT NULL
        UNION SELECT sector::text FROM tenders WHERE status = 'published' AND sector IS NOT NULL
        UNION SELECT sector::text FROM trade_finance_requests WHERE status = 'published' AND sector IS NOT NULL
        UNION SELECT s.slug FROM project_sectors ps
          JOIN sectors s ON s.id = ps.sector_id
          JOIN projects p ON p.id = ps.project_id
         WHERE p.status = 'published'
      ) u
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
        UNION ALL
        SELECT COALESCE(value_usd, 0) FROM trade_finance_requests WHERE status = 'published'
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
      + (SELECT count(*) FROM trade_finance_requests WHERE published_at > now() - interval '24 hours')
      + (SELECT count(*) FROM investment_interests WHERE created_at > now() - interval '24 hours')
      )::int AS c
    `),
  ]);

  const activeOpportunities =
    commodityRes.rows[0].c +
    logisticsRes.rows[0].c +
    agriRes.rows[0].c +
    tendersRes.rows[0].c +
    tradeFinanceRes.rows[0].c;

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
      tradeFinance: tradeFinanceRes.rows[0].c,
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


router.get('/analytics', requireAuth, asyncHandler(async (req, res) => {
  const { rows: [m] } = await query('SELECT tier FROM memberships WHERE user_id = $1', [req.user.id]);
  const userTier = m?.tier || 'free';
  if (userTier === 'free') return res.status(403).json({ error: 'Premium analytics requires Verified Business or higher membership.', upgrade_url: '/pricing' });
  const isAdvanced = ['institutional','enterprise'].includes(userTier);
  const [s1,s2,s3,s4,s5] = await Promise.all([
    query(`SELECT sector::text, COUNT(*)::int as count, SUM(value_usd)::bigint as total_value FROM (SELECT sector, value_usd FROM commodity_requests WHERE status='published' AND sector IS NOT NULL UNION ALL SELECT sector, value_usd FROM logistics_loads WHERE status='published' AND sector IS NOT NULL UNION ALL SELECT sector, value_usd FROM agri_offtake_requests WHERE status='published' AND sector IS NOT NULL UNION ALL SELECT sector, value_usd FROM tenders WHERE status='published' AND sector IS NOT NULL UNION ALL SELECT sector, value_usd FROM trade_finance_requests WHERE status='published' AND sector IS NOT NULL) t GROUP BY sector ORDER BY count DESC`),
    query(`SELECT country_iso, COUNT(*)::int as opportunities, SUM(value_usd)::bigint as total_value FROM (SELECT country_iso, value_usd FROM commodity_requests WHERE status='published' UNION ALL SELECT country_iso, value_usd FROM logistics_loads WHERE status='published' UNION ALL SELECT country_iso, value_usd FROM agri_offtake_requests WHERE status='published' UNION ALL SELECT country_iso, value_usd FROM tenders WHERE status='published' UNION ALL SELECT country_iso, value_usd FROM trade_finance_requests WHERE status='published') t GROUP BY country_iso ORDER BY opportunities DESC LIMIT 15`),
    query(`SELECT finance_type::text, COUNT(*)::int as count, SUM(value_usd)::bigint as total_value FROM trade_finance_requests WHERE status='published' AND finance_type IS NOT NULL GROUP BY finance_type ORDER BY count DESC`),
    query(`SELECT DATE(created_at) as date, COUNT(*)::int as interests FROM opportunity_interests WHERE created_at > now() - interval '30 days' GROUP BY DATE(created_at) ORDER BY date ASC`),
    isAdvanced ? query(`SELECT tier, COUNT(*)::int as count FROM memberships GROUP BY tier ORDER BY count DESC`) : Promise.resolve({ rows: [] }),
  ]);
  res.json({ tier: userTier, is_advanced: isAdvanced, sector_trends: s1.rows, country_activity: s2.rows, finance_type_demand: s3.rows, interest_activity: s4.rows, membership_stats: isAdvanced ? s5.rows : null, generated_at: new Date().toISOString() });
}));

export default router;
