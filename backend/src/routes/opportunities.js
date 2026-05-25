// src/routes/opportunities.js
// Opportunity verticals endpoints.
//
//   GET    /api/opportunities/corridors
//   GET    /api/opportunities/featured                 — homepage snapshot
//   GET    /api/opportunities/mine?type=               — my own listings (auth)
//   GET    /api/opportunities/:type                    — list
//   POST   /api/opportunities/:type                    — create (auth + verified)
//   GET    /api/opportunities/:type/:id                — single fetch
//   PATCH  /api/opportunities/:type/:id                — edit (owner only)
//   DELETE /api/opportunities/:type/:id                — soft-delete (owner only)
//   POST   /api/opportunities/:type/:id/interest       — express interest

import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/index.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { requireAuth, requireTrustTier } from '../middleware/auth.js';
import { countMatchingProvidersForFinanceRequest } from './capital-providers.js';
// SAREGO-MATCHED-PROVIDERS-COUNT
import { email } from '../utils/email.js';

const router = Router();

const TYPE_TO_TABLE = {
  commodity_request: 'commodity_requests',
  logistics_load:    'logistics_loads',
  agri_offtake:      'agri_offtake_requests',
  tender:            'tenders',
  trade_finance:     'trade_finance_requests',
};

const TYPE_EXTRAS = {
  commodity_requests:     'commodity, quantity, quantity_unit, incoterms, sector',
  logistics_loads:        'origin_country_iso, origin_city, destination_country_iso, destination_city, cargo_type, weight_tons, load_date, sector',
  agri_offtake_requests:  'crop, quantity_tons, delivery_window_start, delivery_window_end, sector',
  tenders:                'tender_reference, issuing_authority, tender_type, submission_deadline, sector',
  trade_finance_requests: 'finance_type, sector, destination_country_iso, trade_context, contract_reference, finance_timeline, collateral_type',
};

function tableForType(type) {
  const table = TYPE_TO_TABLE[type];
  if (!table) {
    throw new HttpError(
      404,
      `Unknown opportunity type '${type}'. Allowed: ${Object.keys(TYPE_TO_TABLE).join(', ')}`
    );
  }
  return table;
}

function normaliseRow(row) {
  if (!row) return null;
  return {
    ...row,
    value_usd: row.value_usd != null ? Number(row.value_usd) : null,
  };
}

// ============================================================
// Zod schemas per vertical
// ============================================================
// Each vertical has a CREATE schema (full required fields) and an UPDATE
// schema (all optional). Common base fields used everywhere:
//   title, summary, country_iso, value_usd, expires_at

const COMMON_FIELDS = {
  title:       z.string().trim().min(5,  'Title must be at least 5 characters').max(200),
  summary:     z.string().trim().min(20, 'Summary must be at least 20 characters').max(2000),
  country_iso: z.string().trim().regex(/^[A-Z]{2}$/, 'Country must be a 2-letter ISO code'),
  value_usd:   z.union([z.number().nonnegative(), z.null()]).optional(),
  expires_at:  z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  sector:      z.enum(['mining', 'agriculture', 'manufacturing', 'logistics', 'infrastructure', 'energy', 'commodities', 'cross_sector', 'other'], { errorMap: () => ({ message: 'Pick a sector' }) }),
};

const CREATE_SCHEMAS = {
  commodity_request: z.object({
    ...COMMON_FIELDS,
    commodity:     z.string().trim().min(2).max(200),
    quantity:      z.union([z.number().positive(), z.null()]).optional(),
    quantity_unit: z.string().trim().max(40).optional().nullable(),
    incoterms:     z.string().trim().max(80).optional().nullable(),
  }),

  agri_offtake: z.object({
    ...COMMON_FIELDS,
    crop:                  z.string().trim().min(2).max(120),
    quantity_tons:         z.union([z.number().positive(), z.null()]).optional(),
    delivery_window_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    delivery_window_end:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  }),

  tender: z.object({
    ...COMMON_FIELDS,
    tender_reference:    z.string().trim().max(120).optional().nullable(),
    issuing_authority:   z.string().trim().min(2).max(200),
    tender_type:         z.enum(['PPP', 'procurement', 'consultancy']),
    submission_deadline: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  }),

  logistics_load: z.object({
    ...COMMON_FIELDS,
    origin_country_iso:      z.string().trim().regex(/^[A-Z]{2}$/, 'Origin country must be 2-letter ISO').optional().nullable(),
    origin_city:             z.string().trim().max(120).optional().nullable(),
    destination_country_iso: z.string().trim().regex(/^[A-Z]{2}$/, 'Destination country must be 2-letter ISO').optional().nullable(),
    destination_city:        z.string().trim().max(120).optional().nullable(),
    cargo_type:              z.string().trim().min(2).max(160),
    weight_tons:             z.union([z.number().positive(), z.null()]).optional(),
    load_date:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  }),

  trade_finance: z.object({
    ...COMMON_FIELDS,
    finance_type:            z.enum(['pre_export', 'working_capital', 'invoice_finance', 'purchase_order', 'lc_facilitation'], { errorMap: () => ({ message: 'Pick a finance type' }) }),
    destination_country_iso: z.string().trim().regex(/^[A-Z]{2}$/).optional().nullable(),
    trade_context:           z.enum(['purchase_order', 'export_contract', 'invoice', 'tender_award', 'supply_agreement', 'other'], { errorMap: () => ({ message: 'Pick a trade context' }) }),
    contract_reference:      z.string().trim().max(160).optional().nullable(),
    finance_timeline:        z.enum(['immediate', 'short_term', 'medium_term', 'rolling_facility'], { errorMap: () => ({ message: 'Pick a timeline' }) }),
    collateral_type:         z.enum(['invoice_backed', 'commodity_backed', 'po_backed', 'unsecured', 'equipment_backed'], { errorMap: () => ({ message: 'Pick a collateral type' }) }),
  }),
};

const UPDATE_SCHEMAS = {
  commodity_request: CREATE_SCHEMAS.commodity_request.partial(),
  agri_offtake:      CREATE_SCHEMAS.agri_offtake.partial(),
  tender:            CREATE_SCHEMAS.tender.partial(),
  logistics_load:    CREATE_SCHEMAS.logistics_load.partial(),
  trade_finance:     CREATE_SCHEMAS.trade_finance.partial(),
};

// Whitelist of insertable/updatable columns per vertical (prevents
// mass-assignment of system fields like applicants_count, owner_user_id)
const TYPE_COLUMN_MAP = {
  commodity_request: [
    'title', 'summary', 'country_iso', 'value_usd', 'expires_at', 'sector',
    'commodity', 'quantity', 'quantity_unit', 'incoterms',
  ],
  agri_offtake: [
    'title', 'summary', 'country_iso', 'value_usd', 'expires_at', 'sector',
    'crop', 'quantity_tons', 'delivery_window_start', 'delivery_window_end',
  ],
  tender: [
    'title', 'summary', 'country_iso', 'value_usd', 'expires_at', 'sector',
    'tender_reference', 'issuing_authority', 'tender_type', 'submission_deadline',
  ],
  logistics_load: [
    'title', 'summary', 'country_iso', 'value_usd', 'expires_at', 'sector',
    'origin_country_iso', 'origin_city', 'destination_country_iso', 'destination_city',
    'cargo_type', 'weight_tons', 'load_date',
  ],
  trade_finance: [
    'title', 'summary', 'country_iso', 'value_usd', 'expires_at', 'sector',
    'finance_type', 'destination_country_iso', 'trade_context', 'contract_reference',
    'finance_timeline', 'collateral_type',
  ],
};

// ============================================================
// GET /api/opportunities/featured  — homepage snapshot
// ============================================================
let _featuredCache = null;
let _featuredCachedAt = 0;
const FEATURED_TTL_MS = 30 * 1000;

router.get(
  '/featured',
  asyncHandler(async (_req, res) => {
    const now = Date.now();
    if (_featuredCache && now - _featuredCachedAt < FEATURED_TTL_MS) {
      return res.json(_featuredCache);
    }

    const tierOrder = `CASE verified_level
                         WHEN 'institutional' THEN 0
                         WHEN 'verified'      THEN 1
                         WHEN 'basic'         THEN 2
                         WHEN 'unverified'    THEN 3
                         ELSE 4 END`;
    const futureClause = `(expires_at IS NULL OR expires_at > now())`;

    const [commodityRes, logisticsRes, agriRes, tendersRes, tradeFinanceRes, projectsRes] = await Promise.all([
      query(`
        SELECT id, title, summary, country_iso, value_usd, status,
               verified_level, expires_at, applicants_count,
               owner_user_id, owner_org_id, source_type, metadata,
               ${TYPE_EXTRAS.commodity_requests},
               published_at
          FROM commodity_requests
         WHERE status = 'published' AND ${futureClause}
         ORDER BY ${tierOrder}, published_at DESC
         LIMIT 1
      `),
      query(`
        SELECT id, title, summary, country_iso, value_usd, status,
               verified_level, expires_at, applicants_count,
               owner_user_id, owner_org_id, source_type, metadata,
               ${TYPE_EXTRAS.logistics_loads},
               published_at
          FROM logistics_loads
         WHERE status = 'published' AND ${futureClause}
         ORDER BY ${tierOrder}, published_at DESC
         LIMIT 1
      `),
      query(`
        SELECT id, title, summary, country_iso, value_usd, status,
               verified_level, expires_at, applicants_count,
               owner_user_id, owner_org_id, source_type, metadata,
               ${TYPE_EXTRAS.agri_offtake_requests},
               published_at
          FROM agri_offtake_requests
         WHERE status = 'published' AND ${futureClause}
         ORDER BY ${tierOrder}, published_at DESC
         LIMIT 1
      `),
      query(`
        SELECT id, title, summary, country_iso, value_usd, status,
               verified_level, expires_at, applicants_count,
               owner_user_id, owner_org_id, source_type, metadata,
               ${TYPE_EXTRAS.tenders},
               published_at
          FROM tenders
         WHERE status = 'published' AND ${futureClause}
         ORDER BY ${tierOrder}, published_at DESC
         LIMIT 1
      `),
      query(`
        SELECT id, title, summary, country_iso, value_usd, status,
               verified_level, expires_at, applicants_count,
               owner_user_id, owner_org_id, source_type, metadata,
               ${TYPE_EXTRAS.trade_finance_requests},
               published_at
          FROM trade_finance_requests
         WHERE status = 'published' AND ${futureClause}
         ORDER BY ${tierOrder}, published_at DESC
         LIMIT 1
      `),
      query(`
        SELECT p.id, p.title, p.summary, c.iso_code AS country_iso,
               p.capital_required_usd AS value_usd, p.status,
               'institutional'::text AS verified_level, NULL::timestamptz AS expires_at,
               0 AS applicants_count, p.owner_user_id, p.organization_id AS owner_org_id,
               'user_generated'::text AS source_type,
               jsonb_build_object('slug', p.slug) AS metadata,
               p.created_at AS published_at
          FROM projects p
          JOIN countries c ON c.id = p.country_id
         WHERE p.status = 'published'
         ORDER BY p.created_at DESC
         LIMIT 1
      `),
    ]);

    const featured = {
      commodity_request: normaliseRow(commodityRes.rows[0]),
      logistics_load:    normaliseRow(logisticsRes.rows[0]),
      agri_offtake:      normaliseRow(agriRes.rows[0]),
      tender:            normaliseRow(tendersRes.rows[0]),
      trade_finance:     normaliseRow(tradeFinanceRes.rows[0]),
      investment_project: normaliseRow(projectsRes.rows[0]),
    };

    _featuredCache = { featured, cachedAt: new Date().toISOString() };
    _featuredCachedAt = now;
    res.json(_featuredCache);
  })
);

// ============================================================
// GET /api/opportunities/corridors
// ============================================================
router.get(
  '/corridors',
  asyncHandler(async (_req, res) => {
    const r = await query(
      `SELECT id, corridor_name, from_country_iso, to_country_iso,
              summary, active_flows_count, metadata
         FROM trade_corridors
        ORDER BY active_flows_count DESC NULLS LAST, corridor_name ASC`
    );
    res.json({ corridors: r.rows });
  })
);

// ============================================================
// GET /api/opportunities/mine  — listings owned by current user
// ============================================================
router.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const typeFilter = req.query.type?.toString();
    const types = typeFilter && TYPE_TO_TABLE[typeFilter]
      ? [typeFilter]
      : Object.keys(TYPE_TO_TABLE);

    const results = {};
    await Promise.all(types.map(async (type) => {
      const table = TYPE_TO_TABLE[type];
      const extras = TYPE_EXTRAS[table];
      const r = await query(
        `SELECT id, title, summary, country_iso, value_usd, status,
                verified_level, expires_at, applicants_count,
                owner_user_id, owner_org_id, source_type, metadata,
                ${extras},
                published_at, created_at, updated_at
           FROM ${table}
          WHERE owner_user_id = $1
          ORDER BY created_at DESC`,
        [req.user.id]
      );
      results[type] = r.rows.map(normaliseRow);
    }));

    res.json({ listings: results });
  })
);

// ============================================================
// GET /api/opportunities/:type  — list (public)
// ============================================================

// SAREGO-ROUTES-ORDERED
// (static routes /browse, /trade_finance/:id/matched-providers-count moved up
//  to precede catch-all /:type and /:type/:id per Express route ordering)

// ============================================================
// GET /api/opportunities/browse
// Session G: cross-vertical aggregate browse.
//
// Returns up to 50 listings across all 5 verticals, normalized to a common
// shape. Sorted: verification tier (institutional > verified > unverified),
// then published_at DESC. Excludes expired listings.
//
// Query params (all optional):
//   sector         — single sector value, filters all verticals
//   country_iso    — 2-letter ISO; matches country_iso for most verticals,
//                    also matches origin_country_iso/destination_country_iso
//                    for logistics_load and destination_country_iso for trade_finance
//   type           — single vertical (commodity_request, logistics_load,
//                    agri_offtake, tender, trade_finance)
//   min_value_usd  — numeric, inclusive
//   max_value_usd  — numeric, inclusive
//   verified_level — minimum tier ('verified' or 'institutional')
//
// PUBLIC endpoint — no requireAuth. Discovery is open; engagement is gated.
//
// SAREGO-OPP-BROWSE
// ============================================================
const BROWSE_QUERY_SCHEMA = z.object({
  sector:         z.enum(['mining', 'agriculture', 'manufacturing', 'logistics', 'infrastructure', 'energy', 'commodities', 'cross_sector', 'other']).optional(),
  country_iso:    z.string().regex(/^[A-Z]{2}$/).optional(),
  type:           z.enum(['commodity_request', 'logistics_load', 'agri_offtake', 'tender', 'trade_finance']).optional(),
  min_value_usd:  z.coerce.number().nonnegative().optional(),
  max_value_usd:  z.coerce.number().nonnegative().optional(),
  verified_level: z.enum(['verified', 'institutional']).optional(),
});

router.get(
  '/browse',
  asyncHandler(async (req, res) => {
    const params = BROWSE_QUERY_SCHEMA.parse(req.query || {});

    // For each vertical, build a SELECT that normalizes columns to a common shape.
    // Country matching is vertical-specific because logistics_load uses origin/destination
    // and trade_finance has both country_iso AND destination_country_iso.
    //
    // Build common WHERE fragment shared across all 5 SELECTs.
    const sqlParams = [];
    function addParam(v) { sqlParams.push(v); return `$${sqlParams.length}`; }

    // Type-agnostic filters
    const wheres = [`status = 'published'`, `(expires_at IS NULL OR expires_at >= now())`];
    if (params.sector)         wheres.push(`sector = ${addParam(params.sector)}::sector`);
    if (params.min_value_usd !== undefined) wheres.push(`value_usd >= ${addParam(params.min_value_usd)}::numeric`);
    if (params.max_value_usd !== undefined) wheres.push(`value_usd <= ${addParam(params.max_value_usd)}::numeric`);
    if (params.verified_level) {
      // Map filter value to a SQL fragment that captures tier hierarchy:
      //   'verified'      -> includes 'verified' OR 'institutional'
      //   'institutional' -> only 'institutional'
      if (params.verified_level === 'institutional') {
        wheres.push(`verified_level = 'institutional'`);
      } else {
        wheres.push(`verified_level IN ('verified', 'institutional')`);
      }
    }
    const baseWhere = wheres.join(' AND ');

    // Country matching: most verticals just use country_iso; logistics_load and
    // trade_finance can also match destination_country_iso (and origin for logistics).
    function countryWhere(table) {
      if (!params.country_iso) return baseWhere;
      const param = addParam(params.country_iso);
      if (table === 'logistics_loads') {
        return `${baseWhere} AND (country_iso = ${param} OR origin_country_iso = ${param} OR destination_country_iso = ${param})`;
      }
      if (table === 'trade_finance_requests') {
        return `${baseWhere} AND (country_iso = ${param} OR destination_country_iso = ${param})`;
      }
      return `${baseWhere} AND country_iso = ${param}`;
    }

    // Normalized SELECT shape (same columns + order across every UNION arm)
    // 'type' column distinguishes which vertical each row came from.
    const verticals = [
      { type: 'commodity_request', table: 'commodity_requests' },
      { type: 'logistics_load',    table: 'logistics_loads' },
      { type: 'agri_offtake',      table: 'agri_offtake_requests' },
      { type: 'tender',            table: 'tenders' },
      { type: 'trade_finance',     table: 'trade_finance_requests' },
    ];

    // If type filter is set, restrict to just that vertical
    const activeVerticals = params.type
      ? verticals.filter(v => v.type === params.type)
      : verticals;

    if (activeVerticals.length === 0) {
      return res.json({ total: 0, opportunities: [] });
    }

    const unionParts = activeVerticals.map(({ type, table }) => `
      SELECT
        id,
        '${type}'::text AS type,
        title,
        summary,
        country_iso,
        value_usd,
        sector::text AS sector,
        verified_level,
        applicants_count,
        published_at,
        expires_at
        FROM ${table}
       WHERE ${countryWhere(table)}
    `);

    // Tier rank for sorting (institutional=0 most prominent, then verified, then unverified)
    const sql = `
      WITH all_opportunities AS (
        ${unionParts.join('\n        UNION ALL\n')}
      )
      SELECT *,
             CASE verified_level
               WHEN 'institutional' THEN 0
               WHEN 'verified' THEN 1
               ELSE 2
             END AS tier_rank
        FROM all_opportunities
       ORDER BY tier_rank ASC, published_at DESC NULLS LAST
       LIMIT 50
    `;

    const r = await query(sql, sqlParams);

    const opportunities = r.rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      summary: row.summary,
      country_iso: row.country_iso,
      value_usd: row.value_usd != null ? Number(row.value_usd) : null,
      sector: row.sector,
      verified_level: row.verified_level,
      applicants_count: row.applicants_count,
      published_at: row.published_at,
      expires_at: row.expires_at,
    }));

    res.json({
      total: opportunities.length,
      capped_at_50: opportunities.length === 50,
      opportunities,
    });
  })
);


// ============================================================
// GET /api/opportunities/trade_finance/:id/matched-providers-count
// Session E: institutional visibility panel.
// Returns COUNT only (no provider identities) per "no public directory yet" policy.
// ============================================================
router.get(
  '/trade_finance/:id/matched-providers-count',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const r = await query(
      `SELECT id, finance_type, sector, country_iso, destination_country_iso, value_usd
         FROM trade_finance_requests
        WHERE id = $1 AND status = 'published'
        LIMIT 1`,
      [id]
    );
    if (!r.rows[0]) {
      return res.status(404).json({ error: 'Finance request not found' });
    }
    const count = await countMatchingProvidersForFinanceRequest(r.rows[0]);
    res.json({ count });
  })
);

router.get(
  '/:type',
  asyncHandler(async (req, res) => {
    const type = req.params.type;
    const table = tableForType(type);

    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const country = req.query.country?.toString().toUpperCase();
    const status = req.query.status?.toString() || 'published';

    const params = [status];
    let countryClause = '';
    if (country) {
      if (table === 'logistics_loads') {
        countryClause = `AND (country_iso = $2 OR origin_country_iso = $2 OR destination_country_iso = $2)`;
      } else {
        countryClause = `AND country_iso = $2`;
      }
      params.push(country);
    }

    const extras = TYPE_EXTRAS[table];
    const sql = `
      SELECT id, title, summary, country_iso, value_usd, status,
             verified_level, expires_at, applicants_count,
             owner_user_id, owner_org_id, source_type, metadata,
             ${extras},
             published_at, created_at, updated_at
        FROM ${table}
       WHERE status = $1
         ${countryClause}
       ORDER BY published_at DESC
       LIMIT ${limit}
    `;
    const r = await query(sql, params);
    res.json({
      type,
      total: r.rows.length,
      opportunities: r.rows.map(normaliseRow),
    });
  })
);

// ============================================================
// POST /api/opportunities/:type  — create (auth + verified)
// ============================================================
router.post(
  '/:type',
  requireAuth,
  requireTrustTier('verified'),
  asyncHandler(async (req, res) => {
    const type = req.params.type;
    const table = tableForType(type);
    const schema = CREATE_SCHEMAS[type];
    if (!schema) {
      throw new HttpError(501, `Creating '${type}' listings is not yet enabled. Coming in a future release.`);
    }

    const data = schema.parse(req.body || {});
    const allowedCols = TYPE_COLUMN_MAP[type];

    // Look up user's organization for owner_org_id attribution
    const userRes = await query(
      `SELECT organization_id, trust_tier FROM users WHERE id = $1`,
      [req.user.id]
    );
    const orgId = userRes.rows[0]?.organization_id ?? null;
    const userTier = userRes.rows[0]?.trust_tier || 'verified';

    // Build INSERT dynamically from validated payload (only whitelisted columns)
    const insertCols = [];
    const insertVals = [];
    const placeholders = [];
    let pi = 0;
    for (const col of allowedCols) {
      if (data[col] !== undefined) {
        pi += 1;
        insertCols.push(col);
        insertVals.push(data[col]);
        placeholders.push(`$${pi}`);
      }
    }

    // System-managed fields
    insertCols.push('owner_user_id', 'owner_org_id', 'source_type', 'status', 'verified_level');
    pi += 1; insertVals.push(req.user.id);       placeholders.push(`$${pi}`);
    pi += 1; insertVals.push(orgId);              placeholders.push(`$${pi}`);
    pi += 1; insertVals.push('user_generated');   placeholders.push(`$${pi}`);
    pi += 1; insertVals.push('published');        placeholders.push(`$${pi}`);
    pi += 1; insertVals.push(userTier);           placeholders.push(`$${pi}`);

    const sql = `
      INSERT INTO ${table} (${insertCols.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;
    const r = await query(sql, insertVals);
    res.status(201).json({ opportunity: normaliseRow(r.rows[0]) });
  })
);

// ============================================================
// GET /api/opportunities/:type/:id  — single record
// ============================================================
router.get(
  '/:type/:id',
  asyncHandler(async (req, res) => {
    const type = req.params.type;
    const table = tableForType(type);
    const id = req.params.id;

    const extras = TYPE_EXTRAS[table];
    const r = await query(
      `SELECT id, title, summary, country_iso, value_usd, status,
              verified_level, expires_at, applicants_count,
              owner_user_id, owner_org_id, source_type, metadata,
              ${extras},
              published_at, created_at, updated_at
         FROM ${table}
        WHERE id = $1
        LIMIT 1`,
      [id]
    );
    const row = r.rows[0];
    if (!row) throw new HttpError(404, 'Opportunity not found');

    let owner = null;
    if (row.owner_user_id) {
      const ownerRes = await query(
        `SELECT id, full_name, email, trust_tier FROM users WHERE id = $1`,
        [row.owner_user_id]
      );
      owner = ownerRes.rows[0] || null;
    }
    let ownerOrg = null;
    if (row.owner_org_id) {
      const orgRes = await query(
        `SELECT id, name, country_id FROM organizations WHERE id = $1`,
        [row.owner_org_id]
      );
      ownerOrg = orgRes.rows[0] || null;
    }

    let userInterest = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const { verifyAccessToken } = await import('../utils/auth.js');
        const payload = verifyAccessToken(authHeader.slice('Bearer '.length));
        if (payload?.sub) {
          const interestRes = await query(
            `SELECT id, status, created_at FROM opportunity_interests
              WHERE opportunity_type = $1 AND opportunity_id = $2 AND user_id = $3
              LIMIT 1`,
            [type, id, payload.sub]
          );
          userInterest = interestRes.rows[0] || null;
        }
      } catch {
        /* invalid token, ignore */
      }
    }

    res.json({
      type,
      opportunity: normaliseRow(row),
      owner,
      ownerOrg,
      userInterest,
    });
  })
);

// ============================================================
// PATCH /api/opportunities/:type/:id  — edit (owner only)
// ============================================================
router.patch(
  '/:type/:id',
  requireAuth,
  requireTrustTier('verified'),
  asyncHandler(async (req, res) => {
    const type = req.params.type;
    const table = tableForType(type);
    const id = req.params.id;
    const schema = UPDATE_SCHEMAS[type];
    if (!schema) {
      throw new HttpError(501, `Editing '${type}' listings is not yet enabled.`);
    }

    const ownerRes = await query(
      `SELECT owner_user_id FROM ${table} WHERE id = $1`,
      [id]
    );
    if (!ownerRes.rows[0]) throw new HttpError(404, 'Opportunity not found');
    if (ownerRes.rows[0].owner_user_id !== req.user.id) {
      throw new HttpError(403, 'You can only edit your own listings.');
    }

    const data = schema.parse(req.body || {});
    const allowedCols = TYPE_COLUMN_MAP[type];

    const setClauses = [];
    const values = [];
    let pi = 0;
    for (const col of allowedCols) {
      if (data[col] !== undefined) {
        pi += 1;
        setClauses.push(`${col} = $${pi}`);
        values.push(data[col]);
      }
    }

    if (setClauses.length === 0) {
      const cur = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
      return res.json({ opportunity: normaliseRow(cur.rows[0]) });
    }

    pi += 1;
    values.push(id);
    const sql = `
      UPDATE ${table}
         SET ${setClauses.join(', ')}, updated_at = now()
       WHERE id = $${pi}
       RETURNING *
    `;
    const r = await query(sql, values);
    res.json({ opportunity: normaliseRow(r.rows[0]) });
  })
);

// ============================================================
// DELETE /api/opportunities/:type/:id  — soft-delete (owner only)
// ============================================================
router.delete(
  '/:type/:id',
  requireAuth,
  requireTrustTier('verified'),
  asyncHandler(async (req, res) => {
    const type = req.params.type;
    const table = tableForType(type);
    const id = req.params.id;

    const ownerRes = await query(
      `SELECT owner_user_id, status FROM ${table} WHERE id = $1`,
      [id]
    );
    if (!ownerRes.rows[0]) throw new HttpError(404, 'Opportunity not found');
    if (ownerRes.rows[0].owner_user_id !== req.user.id) {
      throw new HttpError(403, 'You can only close your own listings.');
    }

    const r = await query(
      `UPDATE ${table}
          SET status = 'closed', updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [id]
    );
    res.json({ opportunity: normaliseRow(r.rows[0]) });
  })
);

// ============================================================
// POST /api/opportunities/:type/:id/interest  — express interest
// ============================================================
const interestSchema = z.object({
  message: z.string().max(2000).optional(),
});

router.post(
  '/:type/:id/interest',
  requireAuth,
  requireTrustTier('verified'),
  asyncHandler(async (req, res) => {
    const type = req.params.type;
    const table = tableForType(type);
    const id = req.params.id;
    const data = interestSchema.parse(req.body || {});

    const oppRes = await query(
      `SELECT id, title, owner_user_id, country_iso, status
         FROM ${table}
        WHERE id = $1
        LIMIT 1`,
      [id]
    );
    const opp = oppRes.rows[0];
    if (!opp) throw new HttpError(404, 'Opportunity not found');
    if (opp.status !== 'published') {
      throw new HttpError(400, 'Opportunity is not currently open');
    }

    let alreadyInterested = false;
    let interestRow = null;
    try {
      interestRow = await withTransaction(async (client) => {
        const userRes = await client.query(
          `SELECT organization_id FROM users WHERE id = $1`,
          [req.user.id]
        );
        const orgId = userRes.rows[0]?.organization_id ?? null;

        const inserted = await client.query(
          `INSERT INTO opportunity_interests
             (opportunity_type, opportunity_id, user_id, org_id, message, status)
           VALUES ($1, $2, $3, $4, $5, 'expressed')
           RETURNING id, status, created_at`,
          [type, id, req.user.id, orgId, data.message ?? null]
        );

        await client.query(
          `UPDATE ${table}
              SET applicants_count = applicants_count + 1,
                  updated_at = now()
            WHERE id = $1`,
          [id]
        );

        return inserted.rows[0];
      });
    } catch (err) {
      if (err.code === '23505') {
        alreadyInterested = true;
        const existing = await query(
          `SELECT id, status, created_at FROM opportunity_interests
            WHERE opportunity_type = $1 AND opportunity_id = $2 AND user_id = $3`,
          [type, id, req.user.id]
        );
        interestRow = existing.rows[0];
      } else {
        throw err;
      }
    }

    const counterRes = await query(
      `SELECT applicants_count FROM ${table} WHERE id = $1`,
      [id]
    );
    const applicantsCount = counterRes.rows[0]?.applicants_count ?? 0;

    if (!alreadyInterested && opp.owner_user_id) {
      const ownerRes = await query(
        `SELECT email, full_name FROM users WHERE id = $1`,
        [opp.owner_user_id]
      );
      const investorRes = await query(
        `SELECT u.full_name, u.email, o.name AS organization_name
           FROM users u
           LEFT JOIN organizations o ON o.id = u.organization_id
          WHERE u.id = $1`,
        [req.user.id]
      );
      const owner = ownerRes.rows[0];
      const investor = investorRes.rows[0];
      if (owner && email.opportunityInterestExpressed) {
        email.opportunityInterestExpressed({
          to: owner.email,
          ownerName: owner.full_name,
          investorName: investor?.full_name || 'A verified user',
          investorOrg: investor?.organization_name,
          opportunityTitle: opp.title,
          opportunityType: type,
          opportunityId: id,
          message: data.message,
        });
      }
    }

    res.status(alreadyInterested ? 200 : 201).json({
      interest: interestRow,
      applicants_count: applicantsCount,
      already_interested: alreadyInterested,
    });
  })
);



export default router;
