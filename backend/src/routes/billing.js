import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';

const router = Router();

const FEATURE_PRICES = { featured_opportunity: 25, homepage_featured: 100, sector_spotlight: 50 };
const VERIFICATION_PRICES = { business: 49, institutional: 249 };

router.get('/history', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT * FROM billing_records WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [req.user.id]);
  res.json({ records: rows });
}));

router.get('/featured/active', asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT listing_type, listing_id, feature_type, sector, ends_at FROM featured_listings WHERE is_active=true AND ends_at>now() ORDER BY feature_type, starts_at DESC`);
  res.json({ featured: rows });
}));

router.get('/featured', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT * FROM featured_listings WHERE owner_user_id=$1 ORDER BY created_at DESC`, [req.user.id]);
  res.json({ featured: rows });
}));

const FEATURED_SCHEMA = z.object({
  listing_type: z.string(),
  listing_id: z.string().uuid(),
  feature_type: z.enum(['featured_opportunity','homepage_featured','sector_spotlight']),
  sector: z.string().optional(),
  payment_reference: z.string().optional(),
  payment_provider: z.string().optional(),
});

router.post('/featured', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const body = FEATURED_SCHEMA.parse(req.body || {});
  const price = FEATURE_PRICES[body.feature_type];
  const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { rows: [billing] } = await query(
    `INSERT INTO billing_records (user_id, record_type, description, amount_usd, status, payment_provider, payment_reference) VALUES ($1,'featured_listing',$2,$3,'paid',$4,$5) RETURNING id`,
    [userId, `${body.feature_type} - ${body.listing_type}`, price, body.payment_provider||null, body.payment_reference||null]
  );
  const { rows: [featured] } = await query(
    `INSERT INTO featured_listings (listing_type, listing_id, owner_user_id, feature_type, sector, ends_at, price_usd, billing_record_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [body.listing_type, body.listing_id, userId, body.feature_type, body.sector||null, endsAt, price, billing.id]
  );
  res.status(201).json({ featured });
}));

const VERIFICATION_SCHEMA = z.object({
  verification_type: z.enum(['business','institutional']),
  org_id: z.string().uuid().optional(),
  payment_reference: z.string().optional(),
  payment_provider: z.string().optional(),
});

router.post('/verification', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const body = VERIFICATION_SCHEMA.parse(req.body || {});
  const price = VERIFICATION_PRICES[body.verification_type];
  const { rows: [billing] } = await query(
    `INSERT INTO billing_records (user_id, record_type, description, amount_usd, status, payment_provider, payment_reference) VALUES ($1,'verification_fee',$2,$3,'paid',$4,$5) RETURNING id`,
    [userId, `${body.verification_type} verification`, price, body.payment_provider||null, body.payment_reference||null]
  );
  const { rows: [order] } = await query(
    `INSERT INTO verification_orders (user_id, org_id, verification_type, amount_usd, status, payment_provider, payment_reference, billing_record_id) VALUES ($1,$2,$3,$4,'paid',$5,$6,$7) RETURNING *`,
    [userId, body.org_id||null, body.verification_type, price, body.payment_provider||null, body.payment_reference||null, billing.id]
  );
  res.status(201).json({ order });
}));

router.get('/verification', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(`SELECT * FROM verification_orders WHERE user_id=$1 ORDER BY created_at DESC`, [req.user.id]);
  res.json({ orders: rows });
}));

export default router;
