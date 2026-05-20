// src/routes/capital-providers.js
//
// Session E: Capital Provider profiles — institutional capability infrastructure.
//
// Architectural principle:
//   organizations = institutional identity
//   capital_provider_profiles = deployable mandate layer (1:1 with organizations)
//
// Endpoints:
//   GET    /api/capital-providers/me                      — current user's org profile
//   POST   /api/capital-providers                         — create profile for current user's org
//   PATCH  /api/capital-providers/:id                     — edit (owner org only)
//   DELETE /api/capital-providers/:id                     — soft-delete (status = suspended)
//   GET    /api/capital-providers/:id                     — public profile fetch
//   GET    /api/capital-providers/browse                  — provider's-eye browse of finance requests with match indicators
//   POST   /api/capital-providers/upgrade-org             — flip current user's organization_type → capital_provider
//
// Also exposes a helper used by opportunities.js:
//   countMatchingProvidersForFinanceRequest(request)      — for seeker-side institutional visibility panel

import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { requireAuth, requireTrustTier } from '../middleware/auth.js';

const router = Router();

// ============================================================
// Zod schemas
// ============================================================

const INSTITUTION_CATEGORIES = [
  'bank',
  'dfi',
  'trade_finance_fund',
  'commodity_finance_house',
  'alternative_lender',
  'broker',
  'family_office',
  'export_credit_institution',
  'other',
];

const FINANCE_TYPES   = ['pre_export', 'working_capital', 'invoice_finance', 'purchase_order', 'lc_facilitation'];
const SECTORS         = ['mining', 'agriculture', 'manufacturing', 'logistics', 'infrastructure', 'energy', 'commodities', 'cross_sector', 'other'];
const COLLATERAL_TYPES = ['invoice_backed', 'commodity_backed', 'po_backed', 'unsecured', 'equipment_backed'];

const CREATE_SCHEMA = z.object({
  tagline:                 z.string().trim().min(5, 'Tagline must be at least 5 characters').max(200),
  summary:                 z.string().trim().min(20, 'Summary must be at least 20 characters').max(4000),
  finance_types:           z.array(z.enum(FINANCE_TYPES)).default([]),
  sectors:                 z.array(z.enum(SECTORS)).default([]),
  countries_covered:       z.array(z.string().regex(/^[A-Z]{2}$/)).default([]),
  min_ticket_usd:          z.union([z.number().nonnegative(), z.null()]).optional(),
  max_ticket_usd:          z.union([z.number().nonnegative(), z.null()]).optional(),
  preferred_collateral:    z.array(z.enum(COLLATERAL_TYPES)).default([]),
  typical_turnaround_days: z.union([z.number().int().positive(), z.null()]).optional(),
  website_url:             z.string().trim().url().optional().nullable(),
});

const UPDATE_SCHEMA = CREATE_SCHEMA.partial();

const UPGRADE_ORG_SCHEMA = z.object({
  institution_category: z.enum(INSTITUTION_CATEGORIES),
});

const BROWSE_QUERY_SCHEMA = z.object({
  finance_type:  z.enum(FINANCE_TYPES).optional(),
  sector:        z.enum(SECTORS).optional(),
  country_iso:   z.string().regex(/^[A-Z]{2}$/).optional(),
  min_value_usd: z.coerce.number().nonnegative().optional(),
  max_value_usd: z.coerce.number().nonnegative().optional(),
  matched_only:  z.enum(['true', 'false']).optional(),
  limit:         z.coerce.number().int().min(1).max(100).optional(),
});

// ============================================================
// Helpers
// ============================================================

function normaliseProfile(row) {
  if (!row) return null;
  return {
    ...row,
    min_ticket_usd: row.min_ticket_usd != null ? Number(row.min_ticket_usd) : null,
    max_ticket_usd: row.max_ticket_usd != null ? Number(row.max_ticket_usd) : null,
  };
}

function normaliseFinanceRequest(row) {
  if (!row) return null;
  return {
    ...row,
    value_usd: row.value_usd != null ? Number(row.value_usd) : null,
  };
}

async function getOrgForUser(userId) {
  const r = await query(
    `SELECT id, name, organization_type, institution_category, verification_level
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
      WHERE u.id = $1`,
    [userId]
  );
  return r.rows[0] || null;
}

/**
 * Count provider profiles that match a single trade_finance_request.
 * Used both by the browse endpoint (via JOIN) and by the seeker-side
 * institutional visibility panel.
 *
 * Match criteria (4 hard filters, deterministic, no fuzzy scoring):
 *   1. provider.finance_types  contains request.finance_type
 *   2. provider.sectors        contains request.sector
 *   3. provider.countries_covered contains request.country_iso
 *      (also accept destination_country_iso as alternative match)
 *   4. request.value_usd within [provider.min_ticket_usd, provider.max_ticket_usd]
 *      NULL on either side = pass (informational provider hasn't constrained)
 */
export async function countMatchingProvidersForFinanceRequest(req) {
  if (!req || !req.finance_type || !req.sector || !req.country_iso) {
    return 0;
  }
  const r = await query(
    `SELECT COUNT(*)::int AS c
       FROM capital_provider_profiles p
      WHERE p.status = 'published'
        AND $1::finance_type = ANY(p.finance_types)
        AND $2::sector       = ANY(p.sectors)
        AND ($3 = ANY(p.countries_covered) OR ($4 IS NOT NULL AND $4 = ANY(p.countries_covered)))
        AND (p.min_ticket_usd IS NULL OR $5::numeric IS NULL OR $5::numeric >= p.min_ticket_usd)
        AND (p.max_ticket_usd IS NULL OR $5::numeric IS NULL OR $5::numeric <= p.max_ticket_usd)`,
    [
      req.finance_type,
      req.sector,
      req.country_iso,
      req.destination_country_iso ?? null,
      req.value_usd ?? null,
    ]
  );
  return r.rows[0]?.c ?? 0;
}

// ============================================================
// GET /api/capital-providers/me  — current user's provider profile
// ============================================================
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userRes = await query(
      `SELECT organization_id FROM users WHERE id = $1`,
      [req.user.id]
    );
    const orgId = userRes.rows[0]?.organization_id;
    if (!orgId) {
      return res.json({ profile: null, organization: null });
    }

    const [profileRes, orgRes] = await Promise.all([
      query(`SELECT * FROM capital_provider_profiles WHERE organization_id = $1 LIMIT 1`, [orgId]),
      query(`SELECT id, name, organization_type, institution_category, verification_level FROM organizations WHERE id = $1`, [orgId]),
    ]);

    res.json({
      profile: normaliseProfile(profileRes.rows[0]),
      organization: orgRes.rows[0] || null,
    });
  })
);

// ============================================================
// POST /api/capital-providers  — create profile for current user's org
// Gating: organization_type = 'capital_provider'
// Enforces 1:1 via UNIQUE constraint on organization_id
// ============================================================
router.post(
  '/',
  requireAuth,
  requireTrustTier('verified'),
  asyncHandler(async (req, res) => {
    const userRes = await query(
      `SELECT u.organization_id, o.organization_type
         FROM users u
         LEFT JOIN organizations o ON o.id = u.organization_id
        WHERE u.id = $1`,
      [req.user.id]
    );
    const userRow = userRes.rows[0];
    if (!userRow?.organization_id) {
      throw new HttpError(400, 'Your account must be associated with an organization before creating a provider profile.');
    }
    if (userRow.organization_type !== 'capital_provider') {
      throw new HttpError(
        403,
        'Only organizations registered as capital providers can publish provider profiles. Use the org-upgrade endpoint first.'
      );
    }

    const data = CREATE_SCHEMA.parse(req.body || {});

    // Inherit verified_level from user trust tier
    const tierRes = await query(`SELECT trust_tier FROM users WHERE id = $1`, [req.user.id]);
    const tier = tierRes.rows[0]?.trust_tier || 'verified';

    try {
      const r = await query(
        `INSERT INTO capital_provider_profiles
           (organization_id, tagline, summary, finance_types, sectors, countries_covered,
            min_ticket_usd, max_ticket_usd, preferred_collateral,
            typical_turnaround_days, website_url, verified_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          userRow.organization_id,
          data.tagline,
          data.summary,
          data.finance_types,
          data.sectors,
          data.countries_covered,
          data.min_ticket_usd ?? null,
          data.max_ticket_usd ?? null,
          data.preferred_collateral,
          data.typical_turnaround_days ?? null,
          data.website_url ?? null,
          tier,
        ]
      );
      res.status(201).json({ profile: normaliseProfile(r.rows[0]) });
    } catch (err) {
      if (err.code === '23505') {
        // Unique violation — profile already exists for this org
        throw new HttpError(409, 'A capital provider profile already exists for your organization. Edit the existing profile instead.');
      }
      throw err;
    }
  })
);

// ============================================================
// PATCH /api/capital-providers/:id  — edit profile (owner org only)
// ============================================================
router.patch(
  '/:id',
  requireAuth,
  requireTrustTier('verified'),
  asyncHandler(async (req, res) => {
    const profileRes = await query(
      `SELECT organization_id FROM capital_provider_profiles WHERE id = $1`,
      [req.params.id]
    );
    if (!profileRes.rows[0]) throw new HttpError(404, 'Provider profile not found');

    const userRes = await query(`SELECT organization_id FROM users WHERE id = $1`, [req.user.id]);
    if (userRes.rows[0]?.organization_id !== profileRes.rows[0].organization_id) {
      throw new HttpError(403, 'You can only edit your own organization\'s profile.');
    }

    const data = UPDATE_SCHEMA.parse(req.body || {});

    const updates = [];
    const values = [];
    let pi = 0;
    const fields = [
      'tagline', 'summary', 'finance_types', 'sectors', 'countries_covered',
      'min_ticket_usd', 'max_ticket_usd', 'preferred_collateral',
      'typical_turnaround_days', 'website_url',
    ];
    for (const f of fields) {
      if (data[f] !== undefined) {
        pi += 1;
        updates.push(`${f} = $${pi}`);
        values.push(data[f]);
      }
    }
    if (updates.length === 0) {
      const cur = await query(`SELECT * FROM capital_provider_profiles WHERE id = $1`, [req.params.id]);
      return res.json({ profile: normaliseProfile(cur.rows[0]) });
    }
    pi += 1;
    values.push(req.params.id);

    const r = await query(
      `UPDATE capital_provider_profiles
          SET ${updates.join(', ')}, updated_at = now()
        WHERE id = $${pi}
        RETURNING *`,
      values
    );
    res.json({ profile: normaliseProfile(r.rows[0]) });
  })
);

// ============================================================
// DELETE /api/capital-providers/:id  — soft-delete (status = suspended)
// ============================================================
router.delete(
  '/:id',
  requireAuth,
  requireTrustTier('verified'),
  asyncHandler(async (req, res) => {
    const profileRes = await query(
      `SELECT organization_id FROM capital_provider_profiles WHERE id = $1`,
      [req.params.id]
    );
    if (!profileRes.rows[0]) throw new HttpError(404, 'Provider profile not found');

    const userRes = await query(`SELECT organization_id FROM users WHERE id = $1`, [req.user.id]);
    if (userRes.rows[0]?.organization_id !== profileRes.rows[0].organization_id) {
      throw new HttpError(403, 'You can only suspend your own organization\'s profile.');
    }

    const r = await query(
      `UPDATE capital_provider_profiles
          SET status = 'suspended', updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [req.params.id]
    );
    res.json({ profile: normaliseProfile(r.rows[0]) });
  })
);

// ============================================================
// POST /api/capital-providers/upgrade-org  — flip current user's
// organization_type to 'capital_provider'. Self-serve in v1.
// ============================================================
router.post(
  '/upgrade-org',
  requireAuth,
  requireTrustTier('verified'),
  asyncHandler(async (req, res) => {
    const data = UPGRADE_ORG_SCHEMA.parse(req.body || {});

    const userRes = await query(
      `SELECT organization_id FROM users WHERE id = $1`,
      [req.user.id]
    );
    const orgId = userRes.rows[0]?.organization_id;
    if (!orgId) {
      throw new HttpError(400, 'Your account must be associated with an organization before upgrading.');
    }

    const r = await query(
      `UPDATE organizations
          SET organization_type = 'capital_provider',
              institution_category = $1::institution_category,
              updated_at = now()
        WHERE id = $2
        RETURNING id, name, organization_type, institution_category`,
      [data.institution_category, orgId]
    );
    res.json({ organization: r.rows[0] });
  })
);

// ============================================================
// GET /api/capital-providers/browse  — provider's-eye browse of trade_finance requests
//   * defaults to prefilled filters from the requesting user's provider profile
//   * client can override via query params
//   * returns each request with a match indicator
// ============================================================
router.get(
  '/browse',
  requireAuth,
  asyncHandler(async (req, res) => {
    const params = BROWSE_QUERY_SCHEMA.parse(req.query || {});
    const limit = params.limit || 30;

    // Load the requesting user's provider profile (if any) to use as default filters
    let profile = null;
    const userRes = await query(
      `SELECT u.organization_id FROM users u WHERE u.id = $1`,
      [req.user.id]
    );
    const orgId = userRes.rows[0]?.organization_id;
    if (orgId) {
      const pRes = await query(
        `SELECT * FROM capital_provider_profiles WHERE organization_id = $1 LIMIT 1`,
        [orgId]
      );
      profile = pRes.rows[0] || null;
    }

    // Fetch all published trade_finance requests (with optional client filters)
    const whereClauses = [`r.status = 'published'`];
    const sqlValues = [];
    let i = 0;
    if (params.finance_type) {
      i += 1; whereClauses.push(`r.finance_type = $${i}::finance_type`); sqlValues.push(params.finance_type);
    }
    if (params.sector) {
      i += 1; whereClauses.push(`r.sector = $${i}::sector`); sqlValues.push(params.sector);
    }
    if (params.country_iso) {
      i += 1; whereClauses.push(`(r.country_iso = $${i} OR r.destination_country_iso = $${i})`); sqlValues.push(params.country_iso);
    }
    if (params.min_value_usd !== undefined) {
      i += 1; whereClauses.push(`r.value_usd >= $${i}`); sqlValues.push(params.min_value_usd);
    }
    if (params.max_value_usd !== undefined) {
      i += 1; whereClauses.push(`r.value_usd <= $${i}`); sqlValues.push(params.max_value_usd);
    }

    const sql = `
      SELECT r.id, r.title, r.summary, r.country_iso, r.destination_country_iso,
             r.value_usd, r.expires_at, r.applicants_count, r.verified_level,
             r.finance_type, r.sector, r.trade_context, r.finance_timeline,
             r.collateral_type, r.contract_reference, r.published_at, r.metadata
        FROM trade_finance_requests r
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY r.published_at DESC
       LIMIT ${limit + 50}
    `;
    const rrows = await query(sql, sqlValues);

    // Compute match indicator per request
    function evaluateMatch(req_) {
      if (!profile) return { level: 'no_profile', reasons: [] };
      const matched = [];
      const missing = [];
      if (profile.finance_types?.includes(req_.finance_type))      matched.push('finance_type'); else missing.push('finance_type');
      if (profile.sectors?.includes(req_.sector))                  matched.push('sector');       else missing.push('sector');
      const geoMatch = profile.countries_covered?.includes(req_.country_iso)
                    || (req_.destination_country_iso && profile.countries_covered?.includes(req_.destination_country_iso));
      if (geoMatch) matched.push('geography'); else missing.push('geography');

      const v = req_.value_usd != null ? Number(req_.value_usd) : null;
      const minOk = profile.min_ticket_usd == null || v == null || v >= Number(profile.min_ticket_usd);
      const maxOk = profile.max_ticket_usd == null || v == null || v <= Number(profile.max_ticket_usd);
      if (minOk && maxOk) matched.push('ticket_range'); else missing.push('ticket_range');

      let level = 'outside_mandate';
      if (matched.length === 4) level = 'high';
      else if (matched.length === 3) level = 'sector_geography';
      else if (matched.length === 2) level = 'partial';
      return { level, matched, missing };
    }

    const requests = rrows.rows.map((row) => ({
      ...normaliseFinanceRequest(row),
      match: evaluateMatch(row),
    }));

    // Sort: high → sector_geography → partial → outside_mandate → no_profile
    const order = { high: 0, sector_geography: 1, partial: 2, outside_mandate: 3, no_profile: 4 };
    requests.sort((a, b) => (order[a.match.level] ?? 9) - (order[b.match.level] ?? 9));

    // matched_only filter (post-sort to preserve order)
    let filtered = requests;
    if (params.matched_only === 'true') {
      filtered = requests.filter((r) => r.match.level === 'high');
    }

    res.json({
      profile: normaliseProfile(profile),
      total: filtered.length,
      requests: filtered.slice(0, limit),
    });
  })
);

// ============================================================
// GET /api/capital-providers/:id  — public profile fetch
// Returns the provider profile + parent organization info.
// Used for the institutional context page later; for v1 no public
// directory exists, but the endpoint enables seeker-side visibility.
// ============================================================
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const r = await query(
      `SELECT cpp.*,
              o.name AS organization_name,
              o.organization_type,
              o.institution_category,
              o.verification_level AS org_verification_level
         FROM capital_provider_profiles cpp
         LEFT JOIN organizations o ON o.id = cpp.organization_id
        WHERE cpp.id = $1`,
      [req.params.id]
    );
    if (!r.rows[0]) throw new HttpError(404, 'Provider profile not found');
    res.json({ profile: normaliseProfile(r.rows[0]) });
  })
);

export default router;
