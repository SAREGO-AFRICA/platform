import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL_DAYS = parseInt(process.env.JWT_REFRESH_TTL_DAYS || '7', 10);

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  // eslint-disable-next-line no-console
  console.warn(
    '⚠ JWT secrets are not set. Auth will not work until you populate JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.'
  );
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      tier: user.trust_tier,
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL, issuer: 'sarego' }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET, { issuer: 'sarego' });
}

export function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

export async function hashRefreshToken(token) {
  return bcrypt.hash(token, 10);
}

export async function compareRefreshToken(token, hash) {
  return bcrypt.compare(token, hash);
}

export function refreshTokenExpiryDate() {
  return new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}
