// src/routes/opportunities.js
// Generic listing endpoint for opportunity verticals.
//
//   GET /api/opportunities/:type
//     :type ∈ commodity_request | logistics_load | agri_offtake | tender
//
//   GET /api/opportunities/corridors
//     Returns the trade_corridors reference table.
//
// Query params supported: country, limit, status (default 'published'),
// verified_level (min tier filter)

import { Router } from 'express';
import { query } from '../db/index.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';

const router = Router();

const TYPE_TO_TABLE = {
  commodity_request: 'commodity_requests',
  logistics_load:    'logistics_loads',
  agri_offtake:      'agri_offtake_requests',
  tender:            'tenders',
};

// Type-specific columns to include in the SELECT for each table
const TYPE_EXTRAS = {
  commodity_requests:    'commodity, quantity, quantity_unit, incoterms',
  logistics_loads:       'origin_country_iso, origin_city, destination_country_iso, destination_city, cargo_type, weight_tons, load_date',
  agri_offtake_requests: 'crop, quantity_tons, delivery_window_start, delivery_window_end',
  tenders:               'tender_reference, issuing_authority, tender_type, submission_deadline',
};

// ============================================================
// GET /api/opportunities/corridors  (trade corridors reference)
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
// GET /api/opportunities/:type
// ============================================================
router.get(
  '/:type',
  asyncHandler(async (req, res) => {
    const type = req.params.type;
    const table = TYPE_TO_TABLE[type];
    if (!table) {
      throw new HttpError(
        404,
        `Unknown opportunity type '${type}'. Allowed: ${Object.keys(TYPE_TO_TABLE).join(', ')}`
      );
    }

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
      opportunities: r.rows.map((row) => ({
        ...row,
        value_usd: row.value_usd != null ? Number(row.value_usd) : null,
      })),
    });
  })
);

export default router;
