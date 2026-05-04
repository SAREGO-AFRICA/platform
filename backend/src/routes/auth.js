import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query, withTransaction } from '../db/index.js';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  compareRefreshToken,
  refreshTokenExpiryDate,
} from '../utils/auth.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts. Try again later.' },
});

// ---------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------
const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(10).max(128),
  full_name: z.string().min(2).max(160),
  role: z.enum(['government', 'investor', 'corporate', 'sme', 'project_developer']),
  organization_name: z.string().max(200).optional(),
  country_iso: z.string().length(2).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ---------------------------------------------------------------------
// Cookie config
// ---------------------------------------------------------------------
function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: '/api/auth',
    expires: refreshTokenExpiryDate(),
  };
}

// ---------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------
router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);

    const result = await withTransaction(async (client) => {
      // Optionally create an organization first
      let orgId = null;
      if (data.organization_name) {
        let countryId = null;
        if (data.country_iso) {
          const c = await client.query('SELECT id FROM countries WHERE iso_code = $1', [
            data.country_iso.toUpperCase(),
          ]);
          countryId = c.rows[0]?.id ?? null;
        }
        const orgRes = await client.query(
          `INSERT INTO organizations (name, org_type, country_id)
           VALUES ($1, $2, $3) RETURNING id`,
          [data.organization_name, data.role, countryId]
        );
        orgId = orgRes.rows[0].id;
      }

      const passwordHash = await hashPassword(data.password);

      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role, organization_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, full_name, role, trust_tier, organization_id, created_at`,
        [data.email.toLowerCase(), passwordHash, data.full_name, data.role, orgId]
      );

      // For investor accounts, seed an investor_profiles row
      if (data.role === 'investor') {
        await client.query(
          `INSERT INTO investor_profiles (user_id, investor_type) VALUES ($1, 'other')`,
          [userRes.rows[0].id]
        );
      }

      return userRes.rows[0];
    });

    return res.status(201).json({ user: result });
  })
);

// ---------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------
router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const result = await query(
      `SELECT id, email, password_hash, full_name, role, trust_tier, is_active
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    const user = result.rows[0];

    if (!user || !user.is_active) {
      throw new HttpError(401, 'Invalid credentials');
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) throw new HttpError(401, 'Invalid credentials');

    // Issue tokens
    const accessToken = signAccessToken(user);
    const refreshTokenPlain = generateRefreshToken();
    const refreshTokenHashed = await hashRefreshToken(refreshTokenPlain);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        refreshTokenHashed,
        refreshTokenExpiryDate(),
        req.headers['user-agent']?.slice(0, 500) ?? null,
        req.ip,
      ]
    );

    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

    res.cookie('sarego_refresh', refreshTokenPlain, refreshCookieOptions());
    return res.json({
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        trust_tier: user.trust_tier,
      },
    });
  })
);

// ---------------------------------------------------------------------
// POST /api/auth/refresh
// ---------------------------------------------------------------------
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.sarego_refresh;
    if (!refreshToken) throw new HttpError(401, 'No refresh token');

    // Look up live tokens — we have to compare against each since they're hashed
    const candidates = await query(
      `SELECT rt.id, rt.user_id, rt.token_hash, rt.expires_at, rt.revoked_at,
              u.id as uid, u.email, u.full_name, u.role, u.trust_tier
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.revoked_at IS NULL
         AND rt.expires_at > now()
       ORDER BY rt.created_at DESC
       LIMIT 200`
    );

    let matched = null;
    for (const row of candidates.rows) {
      // eslint-disable-next-line no-await-in-loop
      if (await compareRefreshToken(refreshToken, row.token_hash)) {
        matched = row;
        break;
      }
    }
    if (!matched) throw new HttpError(401, 'Invalid refresh token');

    // Rotate: revoke old, issue new
    const newRefresh = generateRefreshToken();
    const newRefreshHash = await hashRefreshToken(newRefresh);

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`,
        [matched.id]
      );
      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          matched.user_id,
          newRefreshHash,
          refreshTokenExpiryDate(),
          req.headers['user-agent']?.slice(0, 500) ?? null,
          req.ip,
        ]
      );
    });

    const accessToken = signAccessToken({
      id: matched.uid,
      role: matched.role,
      trust_tier: matched.trust_tier,
    });

    res.cookie('sarego_refresh', newRefresh, refreshCookieOptions());
    return res.json({
      access_token: accessToken,
      user: {
        id: matched.uid,
        email: matched.email,
        full_name: matched.full_name,
        role: matched.role,
        trust_tier: matched.trust_tier,
      },
    });
  })
);

// ---------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.sarego_refresh;
    if (refreshToken) {
      // Best-effort revocation
      const candidates = await query(
        `SELECT id, token_hash FROM refresh_tokens
         WHERE revoked_at IS NULL AND expires_at > now()
         ORDER BY created_at DESC LIMIT 200`
      );
      for (const row of candidates.rows) {
        // eslint-disable-next-line no-await-in-loop
        if (await compareRefreshToken(refreshToken, row.token_hash)) {
          // eslint-disable-next-line no-await-in-loop
          await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [row.id]);
          break;
        }
      }
    }
    res.clearCookie('sarego_refresh', { path: '/api/auth' });
    return res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const r = await query(
      `SELECT u.id, u.email, u.full_name, u.role, u.trust_tier, u.organization_id,
              u.job_title, u.created_at,
              o.name AS organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!r.rows[0]) throw new HttpError(404, 'User not found');
    return res.json({ user: r.rows[0] });
  })
);

export default router;
