import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { email } from '../utils/email.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

// =====================================================================
// KYC VERIFICATION
// =====================================================================

// ---------------------------------------------------------------------
// GET /api/admin/verification-queue — pending KYC docs (with org context)
// ---------------------------------------------------------------------
router.get(
  '/verification-queue',
  asyncHandler(async (_req, res) => {
    const r = await query(
      `SELECT v.id, v.document_type, v.status, v.created_at, v.storage_key,
              u.id AS user_id, u.email, u.full_name, u.role, u.trust_tier,
              u.created_at AS user_created_at,
              o.name AS organization_name,
              c.name AS country_name, c.flag_emoji
       FROM verification_documents v
       JOIN users u ON u.id = v.user_id
       LEFT JOIN organizations o ON o.id = u.organization_id
       LEFT JOIN countries c ON c.id = o.country_id
       WHERE v.status = 'pending'
       ORDER BY v.created_at ASC`
    );
    return res.json({ queue: r.rows });
  })
);

// ---------------------------------------------------------------------
// POST /api/admin/verification/:docId — approve or reject KYC document
// ---------------------------------------------------------------------
const verificationReviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  promote_to_tier: z.enum(['basic', 'verified', 'institutional']).optional(),
  notes: z.string().max(2000).optional(),
});

router.post(
  '/verification/:docId',
  asyncHandler(async (req, res) => {
    const data = verificationReviewSchema.parse(req.body);

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

     // Notify the user of the decision
      const userRes = await query(
        `SELECT u.email, u.full_name, v.document_type AS dt
           FROM users u
           JOIN verification_documents v ON v.user_id = u.id
          WHERE v.id = $1`,
        [doc.rows[0].id]
      );
      if (userRes.rows[0]) {
        email.kycDecided({
          to: userRes.rows[0].email,
          fullName: userRes.rows[0].full_name,
          documentType: userRes.rows[0].dt,
          decision: data.decision,
          notes: data.notes,
          promotedTier: data.decision === 'approve' ? data.promote_to_tier : null,
        });
      }

    return res.json({ ok: true });
  })
);

// =====================================================================
// PROJECT MODERATION
// =====================================================================

// ---------------------------------------------------------------------
// GET /api/admin/projects/pending — projects awaiting moderation (rich)
// ---------------------------------------------------------------------
router.get(
  '/projects/pending',
  asyncHandler(async (_req, res) => {
    const r = await query(
      `SELECT p.id, p.title, p.slug, p.summary, p.description,
              p.capital_required_usd, p.expected_irr_pct, p.stage,
              p.location_text, p.created_at, p.status,
              c.name AS country_name, c.flag_emoji,
              u.full_name AS owner_name, u.email AS owner_email,
              u.role AS owner_role, u.trust_tier AS owner_tier,
              o.name AS organization_name,
              COALESCE(json_agg(DISTINCT jsonb_build_object('slug', s.slug, 'name', s.name))
                FILTER (WHERE s.id IS NOT NULL), '[]') AS sectors
       FROM projects p
       JOIN countries c ON c.id = p.country_id
       JOIN users u ON u.id = p.owner_user_id
       LEFT JOIN organizations o ON o.id = p.organization_id
       LEFT JOIN project_sectors ps ON ps.project_id = p.id
       LEFT JOIN sectors s ON s.id = ps.sector_id
       WHERE p.status = 'pending_review'
       GROUP BY p.id, c.name, c.flag_emoji, u.full_name, u.email, u.role, u.trust_tier, o.name
       ORDER BY p.created_at ASC`
    );
    return res.json({ projects: r.rows });
  })
);

// ---------------------------------------------------------------------
// POST /api/admin/projects/:id/review — approve (publish) or reject (return)
// ---------------------------------------------------------------------
const projectReviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  notes: z.string().max(2000).optional(),
});

router.post(
  '/projects/:id/review',
  asyncHandler(async (req, res) => {
    const data = projectReviewSchema.parse(req.body);

    const project = await query(
      `SELECT id, status, owner_user_id, title FROM projects WHERE id = $1`,
      [req.params.id]
    );
    if (!project.rows[0]) throw new HttpError(404, 'Project not found');
    if (project.rows[0].status !== 'pending_review') {
      throw new HttpError(400, 'Project is not awaiting review');
    }

    const newStatus = data.decision === 'approve' ? 'published' : 'rejected';
    const publishedAt = data.decision === 'approve' ? new Date() : null;

    const updated = await query(
      `UPDATE projects
       SET status = $1,
           published_at = COALESCE($2, published_at)
       WHERE id = $3
       RETURNING *`,
      [newStatus, publishedAt, project.rows[0].id]
    );

    await query(
      `INSERT INTO audit_log (actor_id, action, entity, entity_id, metadata)
       VALUES ($1, $2, 'projects', $3, $4)`,
      [
        req.user.id,
        `project.${data.decision}`,
        project.rows[0].id,
        JSON.stringify({
          notes: data.notes ?? null,
          owner_id: project.rows[0].owner_user_id,
          title: project.rows[0].title,
        }),
      ]
    );

    return res.json({ project: updated.rows[0] });
  })
);

// ---------------------------------------------------------------------
// GET /api/admin/projects/:id — admin can view any project (including drafts)
// ---------------------------------------------------------------------
router.get(
  '/projects/:id',
  asyncHandler(async (req, res) => {
    const r = await query(
      `SELECT p.*, c.iso_code, c.name AS country_name, c.flag_emoji,
              u.full_name AS owner_name, u.email AS owner_email,
              u.trust_tier AS owner_tier,
              o.name AS organization_name,
              COALESCE(json_agg(DISTINCT jsonb_build_object('slug', s.slug, 'name', s.name))
                FILTER (WHERE s.id IS NOT NULL), '[]') AS sectors
       FROM projects p
       JOIN countries c ON c.id = p.country_id
       JOIN users u ON u.id = p.owner_user_id
       LEFT JOIN organizations o ON o.id = p.organization_id
       LEFT JOIN project_sectors ps ON ps.project_id = p.id
       LEFT JOIN sectors s ON s.id = ps.sector_id
       WHERE p.id = $1
       GROUP BY p.id, c.iso_code, c.name, c.flag_emoji, u.full_name, u.email, u.trust_tier, o.name`,
      [req.params.id]
    );
    if (!r.rows[0]) throw new HttpError(404, 'Project not found');
    return res.json({ project: r.rows[0] });
  })
);

// =====================================================================
// AUDIT LOG
// =====================================================================

// ---------------------------------------------------------------------
// GET /api/admin/audit-log — recent privileged actions
// ---------------------------------------------------------------------
router.get(
  '/audit-log',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const action = req.query.action?.toString();

    const conditions = [];
    const params = [];
    if (action) {
      params.push(action);
      conditions.push(`a.action = $${params.length}`);
    }
    params.push(limit);

    const r = await query(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.metadata, a.ip_address,
              a.created_at,
              u.id AS actor_id, u.full_name AS actor_name, u.email AS actor_email
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
       ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
       ORDER BY a.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    return res.json({ entries: r.rows });
  })
);

// =====================================================================
// USERS
// =====================================================================

// ---------------------------------------------------------------------
// GET /api/admin/users — paginated user list with filters
// ---------------------------------------------------------------------
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const tier = req.query.tier?.toString();
    const role = req.query.role?.toString();
    const search = req.query.search?.toString();

    const conditions = [];
    const params = [];

    if (tier) {
      params.push(tier);
      conditions.push(`u.trust_tier = $${params.length}`);
    }
    if (role) {
      params.push(role);
      conditions.push(`u.role = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(u.email ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`);
    }

    params.push(limit);
    params.push(offset);

    const r = await query(
      `SELECT u.id, u.email, u.full_name, u.role, u.trust_tier,
              u.is_active, u.last_login_at, u.created_at,
              o.name AS organization_name
       FROM users u
       LEFT JOIN organizations o ON o.id = u.organization_id
       ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
       ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return res.json({ users: r.rows, limit, offset });
  })
);

// ---------------------------------------------------------------------
// PATCH /api/admin/users/:id/tier — manually adjust a user's trust tier
// ---------------------------------------------------------------------
const tierUpdateSchema = z.object({
  trust_tier: z.enum(['unverified', 'basic', 'verified', 'institutional']),
  notes: z.string().max(1000).optional(),
});

router.patch(
  '/users/:id/tier',
  asyncHandler(async (req, res) => {
    const data = tierUpdateSchema.parse(req.body);

    const target = await query('SELECT id, trust_tier FROM users WHERE id = $1', [req.params.id]);
    if (!target.rows[0]) throw new HttpError(404, 'User not found');

    await query('UPDATE users SET trust_tier = $1 WHERE id = $2', [
      data.trust_tier,
      target.rows[0].id,
    ]);

    await query(
      `INSERT INTO audit_log (actor_id, action, entity, entity_id, metadata)
       VALUES ($1, 'user.tier_change', 'users', $2, $3)`,
      [
        req.user.id,
        target.rows[0].id,
        JSON.stringify({
          from: target.rows[0].trust_tier,
          to: data.trust_tier,
          notes: data.notes ?? null,
        }),
      ]
    );

    return res.json({ ok: true });
  })
);

// =====================================================================
// STATS
// =====================================================================

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
        (SELECT COUNT(*) FROM users WHERE created_at > now() - interval '7 days') AS new_users_week,
        (SELECT COUNT(*) FROM projects WHERE status = 'published') AS active_projects,
        (SELECT COUNT(*) FROM projects WHERE status = 'pending_review') AS pending_projects,
        (SELECT COUNT(*) FROM projects WHERE status = 'draft') AS draft_projects,
        (SELECT COALESCE(SUM(capital_required_usd),0) FROM projects WHERE status = 'published') AS total_capital_usd,
        (SELECT COUNT(*) FROM verification_documents WHERE status = 'pending') AS pending_kyc,
        (SELECT COUNT(*) FROM deal_rooms WHERE is_active) AS active_deal_rooms,
        (SELECT COUNT(*) FROM investment_interests WHERE status = 'open') AS open_interests
    `);
    return res.json({ stats: stats.rows[0] });
  })
);

export default router;
