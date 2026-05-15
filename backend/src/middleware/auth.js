import { verifyAccessToken } from '../utils/auth.js';
import { query } from '../db/index.js';

/**
 * Requires a valid access token. Populates req.user = { id, role, tier }.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      tier: payload.tier,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Restricts to a set of roles.
 *   router.get('/admin', requireAuth, requireRole('admin'), ...)
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient role' });
    }
    return next();
  };
}

/**
 * Requires that the user has reached at least a given trust tier.
 * Reads trust_tier from the DB (not JWT) so KYC promotions apply immediately
 * without requiring the user to log out and log back in.
 */
const TIER_RANK = { unverified: 0, basic: 1, verified: 2, institutional: 3 };
export function requireTrustTier(minTier) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    try {
      const r = await query(`SELECT trust_tier FROM users WHERE id = $1`, [req.user.id]);
      const liveTier = r.rows[0]?.trust_tier ?? req.user.tier;
      req.user.tier = liveTier;
      if ((TIER_RANK[liveTier] ?? 0) < (TIER_RANK[minTier] ?? 0)) {
        return res
          .status(403)
          .json({ error: `Action requires ${minTier} verification tier. Complete KYC to proceed.` });
      }
      return next();
    } catch (err) {
      // On DB error, fall back to JWT tier (don't lock out users)
      if ((TIER_RANK[req.user.tier] ?? 0) < (TIER_RANK[minTier] ?? 0)) {
        return res
          .status(403)
          .json({ error: `Action requires ${minTier} verification tier. Complete KYC to proceed.` });
      }
      return next();
    }
  };
}
