import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';

const router = Router();

const TIER_PRICES = {
  free:              { monthly: 0,   annual: 0 },
  verified_business: { monthly: 29,  annual: 290 },
  institutional:     { monthly: 149, annual: 1490 },
  enterprise:        { monthly: 499, annual: 4990 },
};

const TIER_FEATURES = {
  free:              { monthly_interest_limit: 10,     deal_rooms: false, basic_analytics: false, advanced_analytics: false, featured_profile: false, priority_placement: false },
  verified_business: { monthly_interest_limit: 999999, deal_rooms: true,  basic_analytics: true,  advanced_analytics: false, featured_profile: false, priority_placement: false },
  institutional:     { monthly_interest_limit: 999999, deal_rooms: true,  basic_analytics: true,  advanced_analytics: true,  featured_profile: true,  priority_placement: true  },
  enterprise:        { monthly_interest_limit: 999999, deal_rooms: true,  basic_analytics: true,  advanced_analytics: true,  featured_profile: true,  priority_placement: true  },
};

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  let { rows: [membership] } = await query('SELECT * FROM memberships WHERE user_id = $1', [userId]);
  if (!membership) {
    const r = await query(`INSERT INTO memberships (user_id, tier, status) VALUES ($1, 'free', 'active') RETURNING *`, [userId]);
    membership = r.rows[0];
  }
  const features = TIER_FEATURES[membership.tier] || TIER_FEATURES.free;
  res.json({ membership, features, prices: TIER_PRICES });
}));

router.get('/check/:feature', requireAuth, asyncHandler(async (req, res) => {
  const { rows: [membership] } = await query('SELECT tier FROM memberships WHERE user_id = $1', [req.user.id]);
  const tier = membership?.tier || 'free';
  const features = TIER_FEATURES[tier] || TIER_FEATURES.free;
  const value = features[req.params.feature];
  res.json({ allowed: value === true || value > 0, tier, feature: req.params.feature, value: value ?? false });
}));

const UPGRADE_SCHEMA = z.object({
  tier: z.enum(['free','verified_business','institutional','enterprise']),
  billing_period: z.enum(['monthly','annual']).optional().default('monthly'),
  payment_reference: z.string().optional(),
  payment_provider: z.string().optional(),
});

router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const body = UPGRADE_SCHEMA.parse(req.body || {});
  const price = TIER_PRICES[body.tier]?.[body.billing_period] ?? 0;
  const periodEnd = new Date();
  body.billing_period === 'annual' ? periodEnd.setFullYear(periodEnd.getFullYear() + 1) : periodEnd.setMonth(periodEnd.getMonth() + 1);
  const { rows: [membership] } = await query(
    `INSERT INTO memberships (user_id, tier, status, billing_period, current_period_start, current_period_end, price_usd, payment_provider, payment_reference)
     VALUES ($1,$2,'active',$3,now(),$4,$5,$6,$7)
     ON CONFLICT (user_id) DO UPDATE SET tier=EXCLUDED.tier, status='active', billing_period=EXCLUDED.billing_period,
     current_period_start=now(), current_period_end=EXCLUDED.current_period_end, price_usd=EXCLUDED.price_usd,
     payment_provider=EXCLUDED.payment_provider, payment_reference=EXCLUDED.payment_reference, updated_at=now()
     RETURNING *`,
    [userId, body.tier, body.billing_period, periodEnd.toISOString(), price, body.payment_provider||null, body.payment_reference||null]
  );
  if (price > 0) {
    await query(
      `INSERT INTO billing_records (user_id, record_type, description, amount_usd, status, payment_provider, payment_reference)
       VALUES ($1,'subscription',$2,$3,'paid',$4,$5)`,
      [userId, `${body.tier} - ${body.billing_period}`, price, body.payment_provider||null, body.payment_reference||null]
    );
  }
  res.json({ membership, features: TIER_FEATURES[membership.tier] || TIER_FEATURES.free });
}));

router.post('/increment-interests', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { rows: [m] } = await query('SELECT * FROM memberships WHERE user_id = $1', [userId]);
  if (!m) return res.status(404).json({ error: 'Membership not found' });
  const limit = TIER_FEATURES[m.tier]?.monthly_interest_limit ?? 10;
  const now = new Date();
  const resetAt = m.interests_reset_at ? new Date(m.interests_reset_at) : null;
  const needsReset = !resetAt || resetAt.getMonth() !== now.getMonth() || resetAt.getFullYear() !== now.getFullYear();
  if (needsReset) {
    await query(`UPDATE memberships SET interests_used_this_month=1, interests_reset_at=now(), updated_at=now() WHERE user_id=$1`, [userId]);
    return res.json({ allowed: true, used: 1, limit });
  }
  if (m.interests_used_this_month >= limit) return res.json({ allowed: false, used: m.interests_used_this_month, limit });
  await query(`UPDATE memberships SET interests_used_this_month=interests_used_this_month+1, updated_at=now() WHERE user_id=$1`, [userId]);
  res.json({ allowed: true, used: m.interests_used_this_month + 1, limit });
}));

export default router;
