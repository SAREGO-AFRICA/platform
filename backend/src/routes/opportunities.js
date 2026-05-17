// src/routes/opportunities.js
// Opportunity verticals endpoints.
//
//   GET  /api/opportunities/corridors
//   GET  /api/opportunities/:type                — list
//   GET  /api/opportunities/:type/:id            — single fetch
//   POST /api/opportunities/:type/:id/interest   — express interest (auth + verified)

import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/index.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { requireAuth, requireTrustTier } from '../middleware/auth.js';
import { email } from '../utils/email.js';

const router = Router();

const TYPE_TO_TABLE = {
  commodity_request: 'commodity_requests',
  logistics_load:    'logistics_loads',
  agri_offtake:      'agri_offtake_requests',
  tender:            'tenders',
};

const TYPE_EXTRAS = {
  commodity_requests:    'commodity, quantity, quantity_unit, incoterms',
  logistics_loads:       'origin_country_iso, origin_city, destination_country_iso, destination_city, cargo_type, weight_tons, load_date',
  agri_offtake_requests: 'crop, quantity_tons, delivery_window_start, delivery_window_end',
  tenders:               'tender_reference, issuing_authority, tender_type, submission_deadline',
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
// GET /api/opportunities/:type     — list
// ============================================================
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

    // Enrich with owner info if available
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

    // Has the current user (if any) already expressed interest?
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

    // Verify the opportunity exists and is open
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

    // Atomic: insert interest + increment counter in the same transaction.
    // Unique constraint makes this idempotent on re-click.
    let alreadyInterested = false;
    let interestRow = null;
    try {
      interestRow = await withTransaction(async (client) => {
        // Look up the user's org for the org_id column (best-effort)
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

        // Counter increment in the same transaction
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
      // Postgres unique violation = user already expressed interest
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

    // Fetch the new counter value for the response
    const counterRes = await query(
      `SELECT applicants_count FROM ${table} WHERE id = $1`,
      [id]
    );
    const applicantsCount = counterRes.rows[0]?.applicants_count ?? 0;

    // Fire-and-forget email to owner (only on a new interest, and only if owner exists)
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
