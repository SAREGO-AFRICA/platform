import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/index.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const mandateSchema = z.object({
  investor_type: z
    .enum([
      'dfi',
      'private_equity',
      'venture_capital',
      'family_office',
      'sovereign_wealth',
      'corporate_strategic',
      'angel',
      'other',
    ])
    .optional(),
  ticket_size_min_usd: z.number().int().nonnegative().optional(),
  ticket_size_max_usd: z.number().int().nonnegative().optional(),
  aum_usd: z.number().int().nonnegative().optional(),
  thesis: z.string().max(2000).optional(),
  sector_slugs: z.array(z.string()).max(20).optional(),
  country_isos: z.array(z.string().length(2)).max(60).optional(),
});

// ---------------------------------------------------------------------
// GET /api/investor/mandate
// ---------------------------------------------------------------------
router.get(
  '/mandate',
  requireAuth,
  requireRole('investor'),
  asyncHandler(async (req, res) => {
    const profile = await query(
      `SELECT investor_type, ticket_size_min_usd, ticket_size_max_usd, aum_usd, thesis
       FROM investor_profiles WHERE user_id = $1`,
      [req.user.id]
    );
    const sectors = await query(
      `SELECT s.slug, s.name FROM investor_sectors isec
       JOIN sectors s ON s.id = isec.sector_id WHERE isec.user_id = $1`,
      [req.user.id]
    );
    const countries = await query(
      `SELECT c.iso_code, c.name, c.flag_emoji FROM investor_countries ic
       JOIN countries c ON c.id = ic.country_id WHERE ic.user_id = $1`,
      [req.user.id]
    );

    return res.json({
      mandate: profile.rows[0] ?? null,
      sectors: sectors.rows,
      countries: countries.rows,
    });
  })
);

// ---------------------------------------------------------------------
// PUT /api/investor/mandate
// ---------------------------------------------------------------------
router.put(
  '/mandate',
  requireAuth,
  requireRole('investor'),
  asyncHandler(async (req, res) => {
    const data = mandateSchema.parse(req.body);

    if (
      data.ticket_size_min_usd != null &&
      data.ticket_size_max_usd != null &&
      data.ticket_size_min_usd > data.ticket_size_max_usd
    ) {
      throw new HttpError(400, 'ticket_size_min_usd must be <= ticket_size_max_usd');
    }

    await withTransaction(async (client) => {
      // Upsert profile
      await client.query(
        `INSERT INTO investor_profiles (user_id, investor_type, ticket_size_min_usd,
                                        ticket_size_max_usd, aum_usd, thesis)
         VALUES ($1, COALESCE($2, 'other'), $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE
         SET investor_type = COALESCE(EXCLUDED.investor_type, investor_profiles.investor_type),
             ticket_size_min_usd = EXCLUDED.ticket_size_min_usd,
             ticket_size_max_usd = EXCLUDED.ticket_size_max_usd,
             aum_usd = EXCLUDED.aum_usd,
             thesis = EXCLUDED.thesis`,
        [
          req.user.id,
          data.investor_type ?? null,
          data.ticket_size_min_usd ?? null,
          data.ticket_size_max_usd ?? null,
          data.aum_usd ?? null,
          data.thesis ?? null,
        ]
      );

      if (data.sector_slugs) {
        await client.query('DELETE FROM investor_sectors WHERE user_id = $1', [req.user.id]);
        const matched = await client.query('SELECT id FROM sectors WHERE slug = ANY($1)', [
          data.sector_slugs,
        ]);
        for (const s of matched.rows) {
          // eslint-disable-next-line no-await-in-loop
          await client.query(
            'INSERT INTO investor_sectors (user_id, sector_id) VALUES ($1, $2)',
            [req.user.id, s.id]
          );
        }
      }
      if (data.country_isos) {
        await client.query('DELETE FROM investor_countries WHERE user_id = $1', [req.user.id]);
        const matched = await client.query(
          'SELECT id FROM countries WHERE iso_code = ANY($1)',
          [data.country_isos.map((s) => s.toUpperCase())]
        );
        for (const c of matched.rows) {
          // eslint-disable-next-line no-await-in-loop
          await client.query(
            'INSERT INTO investor_countries (user_id, country_id) VALUES ($1, $2)',
            [req.user.id, c.id]
          );
        }
      }
    });

    return res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------
// GET /api/investor/matches — simple rules-based matchmaking v0
// Score = sector overlap (3 pts each) + country overlap (2 pts each)
//        + ticket-size fit (5 pts) + stage preference (1 pt for bankable+)
// ---------------------------------------------------------------------
router.get(
  '/matches',
  requireAuth,
  requireRole('investor'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    const r = await query(
      `WITH my_sectors AS (
         SELECT sector_id FROM investor_sectors WHERE user_id = $1
       ),
       my_countries AS (
         SELECT country_id FROM investor_countries WHERE user_id = $1
       ),
       my_profile AS (
         SELECT ticket_size_min_usd, ticket_size_max_usd
         FROM investor_profiles WHERE user_id = $1
       )
       SELECT p.id, p.title, p.slug, p.summary, p.capital_required_usd,
              p.expected_irr_pct, p.stage, c.iso_code, c.name AS country_name,
              c.flag_emoji,
              (
                3 * (SELECT COUNT(*) FROM project_sectors ps
                      WHERE ps.project_id = p.id
                        AND ps.sector_id IN (SELECT sector_id FROM my_sectors))
                +
                2 * CASE WHEN p.country_id IN (SELECT country_id FROM my_countries)
                         THEN 1 ELSE 0 END
                +
                5 * CASE
                  WHEN (SELECT ticket_size_min_usd FROM my_profile) IS NOT NULL
                   AND (SELECT ticket_size_max_usd FROM my_profile) IS NOT NULL
                   AND p.capital_required_usd BETWEEN
                       (SELECT ticket_size_min_usd FROM my_profile)
                       AND (SELECT ticket_size_max_usd FROM my_profile) * 5
                  THEN 1 ELSE 0
                END
                +
                CASE WHEN p.stage IN ('bankable', 'financing') THEN 1 ELSE 0 END
              ) AS match_score
       FROM projects p
       JOIN countries c ON c.id = p.country_id
       WHERE p.status = 'published'
         AND p.owner_user_id <> $1
       ORDER BY match_score DESC, p.published_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );

    return res.json({ matches: r.rows });
  })
);

export default router;
