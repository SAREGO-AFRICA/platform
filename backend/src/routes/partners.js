import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';

const router = Router();

// Generate a unique referral code
async function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code, exists;
  do {
    code = Array.from({length:8}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
    const { rows } = await query('SELECT id FROM partner_profiles WHERE referral_code=$1', [code]);
    exists = rows.length > 0;
  } while (exists);
  return code;
}

// Calculate tier from lifetime referrals
function calcTier(lifetime) {
  if (lifetime >= 100) return 'strategic_partner';
  if (lifetime >= 51)  return 'ecosystem_partner';
  if (lifetime >= 11)  return 'ambassador';
  return 'connector';
}

// ── GET /api/partners/me ─────────────────────────────────────────────
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  let { rows: [profile] } = await query('SELECT * FROM partner_profiles WHERE user_id=$1', [userId]);

  if (!profile) {
    const code = await generateReferralCode();
    const { rows: [p] } = await query(
      `INSERT INTO partner_profiles (user_id, referral_code) VALUES ($1,$2) RETURNING *`,
      [userId, code]
    );
    profile = p;
  }

  res.json({ profile, referral_url: 'https://sarego.africa/register?ref=' + profile.referral_code });
}));

// ── GET /api/partners/referrals ──────────────────────────────────────
router.get('/referrals', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT r.*, u.email AS referred_email, u.full_name AS referred_name,
            o.name AS org_name, m.tier AS membership_tier
     FROM partner_referrals r
     LEFT JOIN users u ON u.id = r.referred_user_id
     LEFT JOIN organizations o ON o.id = (SELECT id FROM organizations WHERE id = u.id LIMIT 1)
     LEFT JOIN memberships m ON m.user_id = r.referred_user_id
     WHERE r.referrer_user_id = $1
     ORDER BY r.created_at DESC`,
    [req.user.id]
  );
  res.json({ referrals: rows });
}));

// ── GET /api/partners/commissions ────────────────────────────────────
router.get('/commissions', requireAuth, asyncHandler(async (req, res) => {
  const { type } = req.query;
  let sql = `SELECT c.*, r.referred_email FROM partner_commissions c
             LEFT JOIN partner_referrals r ON r.id = c.referral_id
             WHERE c.partner_user_id = $1`;
  const params = [req.user.id];
  if (type) { sql += ` AND c.revenue_type = $2`; params.push(type); }
  sql += ` ORDER BY c.created_at DESC`;
  const { rows } = await query(sql, params);
  res.json({ commissions: rows });
}));

// ── GET /api/partners/stats ──────────────────────────────────────────
router.get('/stats', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [profile, commSummary] = await Promise.all([
    query('SELECT * FROM partner_profiles WHERE user_id=$1', [userId]),
    query(
      `SELECT status, SUM(commission_amount)::numeric AS total
       FROM partner_commissions WHERE partner_user_id=$1 GROUP BY status`,
      [userId]
    ),
  ]);
  const p = profile.rows[0];
  const summary = {};
  commSummary.rows.forEach(r => { summary[r.status] = Number(r.total); });
  res.json({
    profile: p,
    commissions: {
      pending:  summary.pending  || 0,
      approved: summary.approved || 0,
      paid:     summary.paid     || 0,
      total:    (summary.pending||0) + (summary.approved||0) + (summary.paid||0),
    },
  });
}));

// ── POST /api/partners/join ──────────────────────────────────────────
// Enroll current user as a partner
router.post('/join', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const existing = await query('SELECT id FROM partner_profiles WHERE user_id=$1', [userId]);
  if (existing.rows.length > 0) return res.json({ already_enrolled: true });
  const code = await generateReferralCode();
  const { rows: [profile] } = await query(
    `INSERT INTO partner_profiles (user_id, referral_code) VALUES ($1,$2) RETURNING *`,
    [userId, code]
  );
  res.status(201).json({ profile, referral_url: 'https://sarego.africa/register?ref=' + profile.referral_code });
}));

// ── POST /api/partners/track-referral ────────────────────────────────
// Called during registration when ?ref= param is present
router.post('/track-referral', asyncHandler(async (req, res) => {
  const { referral_code, referred_user_id, referred_email } = req.body || {};
  if (!referral_code) return res.status(400).json({ error: 'referral_code required' });

  // Find partner
  const { rows: [partner] } = await query(
    'SELECT user_id FROM partner_profiles WHERE referral_code=$1 AND is_active=true',
    [referral_code]
  );
  if (!partner) return res.status(404).json({ error: 'Invalid referral code' });

  // Don't self-refer
  if (partner.user_id === referred_user_id) return res.status(400).json({ error: 'Self-referral not allowed' });

  // Check not already referred
  if (referred_user_id) {
    const dup = await query('SELECT id FROM partner_referrals WHERE referred_user_id=$1', [referred_user_id]);
    if (dup.rows.length > 0) return res.json({ already_tracked: true });
  }

  const { rows: [referral] } = await query(
    `INSERT INTO partner_referrals (referrer_user_id, referred_user_id, referral_code, referred_email, status)
     VALUES ($1,$2,$3,$4,'registered') RETURNING *`,
    [partner.user_id, referred_user_id||null, referral_code, referred_email||null]
  );

  // Update partner lifetime count
  await query(
    `UPDATE partner_profiles SET lifetime_referrals=lifetime_referrals+1, active_referrals=active_referrals+1,
     tier=$1::partner_tier, updated_at=now() WHERE user_id=$2`,
    [calcTier((await query('SELECT lifetime_referrals FROM partner_profiles WHERE user_id=$1', [partner.user_id])).rows[0]?.lifetime_referrals + 1), partner.user_id]
  );

  res.status(201).json({ referral });
}));

export default router;
