import { Router } from 'express';
import { query } from '../db/index.js';
import { asyncHandler } from '../middleware/errors.js';

const router = Router();

router.get(
  '/countries',
  asyncHandler(async (_req, res) => {
    const r = await query(
      `SELECT iso_code, iso_code_3, name, region, is_sadc, flag_emoji
       FROM countries ORDER BY is_sadc DESC, name ASC`
    );
    return res.json({ countries: r.rows });
  })
);

router.get(
  '/sectors',
  asyncHandler(async (_req, res) => {
    const r = await query(`SELECT id, slug, name, parent_id FROM sectors ORDER BY name ASC`);
    return res.json({ sectors: r.rows });
  })
);

export default router;
