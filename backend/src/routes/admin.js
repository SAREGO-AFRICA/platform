import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

// ---------------------------------------------------------------------
// GET /api/admin/verification-queue — pending KYC docs
// ---------------------------------------------------------------------
router.get(
  '/verification-queue',
  asyncHandler(async (_req, res) => {
    const r = await query(
      `SELECT v.id, v.document_type, v.status, v.created_at, v.storage_key,
              u.id AS user_id, u.email, u.full_name, u.role, u.trust_tier
       FROM verification_documents v
       JOIN users u ON u.id = v.user_id
       WHERE v.status = 'pending'
       ORDER BY v.created_at ASC`
    );
    return res.json({ queue: r.rows });
  })
);

// ---------------------------------------------------------------------
// POST /api/admin/verification/:docId — approve or reject
// ---------------------------------------------------------------------
const reviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  promote_to_tier: z.enum(['basic', 'verified', 'institutional']).optional(),
  notes: z.string().max(2000).optional(),
});

router.post(
  '/verification/:docId',
  asyncHandler(async (req, res) => {
    const data = reviewSchema.parse(req.body);

    const doc = await query(
      `SELECT id, user_id FROM verification_documents WHERE id = $1`,
      [req.params.docId]
    );
    if (!doc.rows[0]) throw new HttpError(404, 'Document not found');

    const newStatus = data.decision === 'approve' ? 'approved' : 'rejected';

    await query(
      `UPDATE verification_documents
       SET status = $1, reviewed_by = $2, reviewed_at = now(), review_notes = $3
       WHERE id = $4`,
      [newStatus, req.user.id, data.notes ?? null, doc.rows[0].id]
    );

    if (data.decision === 'approve' && data.promote_to_tier) {
      await query(`UPDATE users SET trust_tier = $1 WHERE id = $2`, [
        data.promote_to_tier,
        doc.rows[0].user_id,
      ]);
    }

    await query(
      `INSERT INTO audit_log (actor_id, action, entity, entity_id, metadata)
       VALUES ($1, $2, 'verification_documents', $3, $4)`,
      [
        req.user.id,
        `kyc.${data.decision}`,
        doc.rows[0].id,
        JSON.stringify({ promoted_to: data.promote_to_tier ?? null, notes: data.notes ?? null }),
      ]
    );

    return res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------
// GET /api/admin/projects/pending — projects awaiting moderation
// ---------------------------------------------------------------------
router.get(
  '/projects/pending',
  asyncHandler(async (_req, res) => {
    const r = await query(
      `SELECT p.id, p.title, p.slug, p.summary, p.capital_required_usd,
              p.created_at, p.status, c.name AS country_name,
              u.full_name AS owner_name, u.email AS owner_email
       FROM projects p
       JOIN countries c ON c.id = p.country_id
       JOIN users u ON u.id = p.owner_user_id
       WHERE p.status = 'pending_review'
       ORDER BY p.created_at ASC`
    );
    return res.json({ projects: r.rows });
  })
);

// ---------------------------------------------------------------------
// GET /api/admin/stats — dashboard metrics
// ---------------------------------------------------------------------
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const stats = await query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM users WHERE trust_tier IN ('verified','institutional')) AS verified_users,
        (SELECT COUNT(*) FROM projects WHERE status = 'published') AS active_projects,
        (SELECT COUNT(*) FROM projects WHERE status = 'pending_review') AS pending_projects,
        (SELECT COALESCE(SUM(capital_required_usd),0) FROM projects WHERE status = 'published') AS total_capital_usd,
        (SELECT COUNT(*) FROM verification_documents WHERE status = 'pending') AS pending_kyc,
        (SELECT COUNT(*) FROM deal_rooms WHERE is_active) AS active_deal_rooms
    `);
    return res.json({ stats: stats.rows[0] });
  })
);

export default router;
