import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/index.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { requireAuth, requireRole, requireTrustTier } from '../middleware/auth.js';
import { email } from '../utils/email.js';

const router = Router();

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function slugify(input) {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const createProjectSchema = z.object({
  title: z.string().min(4).max(200),
  summary: z.string().min(20).max(1000),
  description: z.string().max(20_000).optional(),
  country_iso: z.string().length(2),
  location_text: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  capital_required_usd: z.number().int().positive(),
  expected_irr_pct: z.number().min(0).max(100).optional(),
  stage: z
    .enum(['origination', 'preparation', 'bankable', 'financing', 'execution'])
    .default('origination'),
  sector_slugs: z.array(z.string()).min(1).max(5),
});

const expressInterestSchema = z.object({
  ticket_usd: z.number().int().positive().optional(),
  message: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------
// GET /api/projects — public, paginated, filterable
// ---------------------------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const offset = parseInt(req.query.offset, 10) || 0;
    const country = req.query.country?.toString().toUpperCase();
    const sector = req.query.sector?.toString();
    const stage = req.query.stage?.toString();

    const conditions = [`p.status = 'published'`];
    const params = [];

    if (country) {
      params.push(country);
      conditions.push(`c.iso_code = $${params.length}`);
    }
    if (stage) {
      params.push(stage);
      conditions.push(`p.stage = $${params.length}`);
    }
    if (sector) {
      params.push(sector);
      conditions.push(
        `EXISTS (SELECT 1 FROM project_sectors ps
                 JOIN sectors s ON s.id = ps.sector_id
                 WHERE ps.project_id = p.id AND s.slug = $${params.length})`
      );
    }

    params.push(limit);
    params.push(offset);

    const rows = await query(
      `SELECT p.id, p.title, p.slug, p.summary, p.country_id, p.location_text,
              p.capital_required_usd, p.capital_committed_usd, p.expected_irr_pct,
              p.stage, p.is_featured, p.published_at,
              c.iso_code, c.name AS country_name, c.flag_emoji,
              o.name AS organization_name,
              COALESCE(json_agg(DISTINCT jsonb_build_object('slug', s.slug, 'name', s.name))
                FILTER (WHERE s.id IS NOT NULL), '[]') AS sectors
       FROM projects p
       JOIN countries c ON c.id = p.country_id
       LEFT JOIN organizations o ON o.id = p.organization_id
       LEFT JOIN project_sectors ps ON ps.project_id = p.id
       LEFT JOIN sectors s ON s.id = ps.sector_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY p.id, c.iso_code, c.name, c.flag_emoji, o.name
       ORDER BY p.is_featured DESC, p.published_at DESC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ projects: rows.rows, limit, offset });
  })
);

// ---------------------------------------------------------------------
// GET /api/projects/:slug — public detail view
// ---------------------------------------------------------------------
router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const r = await query(
      `SELECT p.*, c.iso_code, c.name AS country_name, c.flag_emoji,
              o.name AS organization_name,
              COALESCE(json_agg(DISTINCT jsonb_build_object('slug', s.slug, 'name', s.name))
                FILTER (WHERE s.id IS NOT NULL), '[]') AS sectors
       FROM projects p
       JOIN countries c ON c.id = p.country_id
       LEFT JOIN organizations o ON o.id = p.organization_id
       LEFT JOIN project_sectors ps ON ps.project_id = p.id
       LEFT JOIN sectors s ON s.id = ps.sector_id
       WHERE p.slug = $1 AND p.status = 'published'
       GROUP BY p.id, c.iso_code, c.name, c.flag_emoji, o.name`,
      [req.params.slug]
    );
    if (!r.rows[0]) throw new HttpError(404, 'Project not found');

    // Increment view count, fire-and-forget
    query('UPDATE projects SET view_count = view_count + 1 WHERE id = $1', [r.rows[0].id]).catch(
      () => {}
    );

    return res.json({ project: r.rows[0] });
  })
);

// ---------------------------------------------------------------------
// POST /api/projects — create (project_developer, government, corporate)
// ---------------------------------------------------------------------
router.post(
  '/',
  requireAuth,
  requireRole('project_developer', 'government', 'corporate'),
  requireTrustTier('basic'),
  asyncHandler(async (req, res) => {
    const data = createProjectSchema.parse(req.body);

    const result = await withTransaction(async (client) => {
      const country = await client.query('SELECT id FROM countries WHERE iso_code = $1', [
        data.country_iso.toUpperCase(),
      ]);
      if (!country.rows[0]) throw new HttpError(400, 'Unknown country ISO code');

      const baseSlug = slugify(data.title);
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

      const orgRes = await client.query('SELECT organization_id FROM users WHERE id = $1', [
        req.user.id,
      ]);

      const projectRes = await client.query(
        `INSERT INTO projects
           (owner_user_id, organization_id, title, slug, summary, description,
            country_id, location_text, latitude, longitude,
            capital_required_usd, expected_irr_pct, stage, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft')
         RETURNING *`,
        [
          req.user.id,
          orgRes.rows[0]?.organization_id ?? null,
          data.title,
          slug,
          data.summary,
          data.description ?? null,
          country.rows[0].id,
          data.location_text ?? null,
          data.latitude ?? null,
          data.longitude ?? null,
          data.capital_required_usd,
          data.expected_irr_pct ?? null,
          data.stage,
        ]
      );

      // Link sectors
      const sectors = await client.query('SELECT id, slug FROM sectors WHERE slug = ANY($1)', [
        data.sector_slugs,
      ]);
      for (const s of sectors.rows) {
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `INSERT INTO project_sectors (project_id, sector_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [projectRes.rows[0].id, s.id]
        );
      }

      return projectRes.rows[0];
    });

    return res.status(201).json({ project: result });
  })
);

// ---------------------------------------------------------------------
// GET /api/projects/:id/edit — owner fetches project including draft state
// (the public GET /:slug only returns published projects)
// ---------------------------------------------------------------------
router.get(
  '/:id/edit',
  requireAuth,
  asyncHandler(async (req, res) => {
    const r = await query(
      `SELECT p.*, c.iso_code, c.name AS country_name,
              COALESCE(json_agg(DISTINCT s.slug)
                FILTER (WHERE s.id IS NOT NULL), '[]') AS sector_slugs
       FROM projects p
       JOIN countries c ON c.id = p.country_id
       LEFT JOIN project_sectors ps ON ps.project_id = p.id
       LEFT JOIN sectors s ON s.id = ps.sector_id
       WHERE p.id = $1
       GROUP BY p.id, c.iso_code, c.name`,
      [req.params.id]
    );
    const project = r.rows[0];
    if (!project) throw new HttpError(404, 'Project not found');

    const isOwner = project.owner_user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) throw new HttpError(403, 'Not allowed');

    return res.json({ project });
  })
);

// ---------------------------------------------------------------------
// PUT /api/projects/:id — owner edits a draft (rejected projects also editable)
// ---------------------------------------------------------------------
router.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = createProjectSchema.parse(req.body);

    const existing = await query(
      'SELECT id, owner_user_id, status FROM projects WHERE id = $1',
      [req.params.id]
    );
    const project = existing.rows[0];
    if (!project) throw new HttpError(404, 'Project not found');

    const isOwner = project.owner_user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) throw new HttpError(403, 'Not allowed');

    // Only draft and rejected projects can be edited by owners.
    // Admins can edit anything.
    if (!isAdmin && !['draft', 'rejected'].includes(project.status)) {
      throw new HttpError(
        400,
        'Only draft or rejected projects can be edited. Submit a change request to update a published project.'
      );
    }

    const result = await withTransaction(async (client) => {
      const country = await client.query('SELECT id FROM countries WHERE iso_code = $1', [
        data.country_iso.toUpperCase(),
      ]);
      if (!country.rows[0]) throw new HttpError(400, 'Unknown country ISO code');

      const updated = await client.query(
        `UPDATE projects SET
           title = $1,
           summary = $2,
           description = $3,
           country_id = $4,
           location_text = $5,
           latitude = $6,
           longitude = $7,
           capital_required_usd = $8,
           expected_irr_pct = $9,
           stage = $10
         WHERE id = $11
         RETURNING *`,
        [
          data.title,
          data.summary,
          data.description ?? null,
          country.rows[0].id,
          data.location_text ?? null,
          data.latitude ?? null,
          data.longitude ?? null,
          data.capital_required_usd,
          data.expected_irr_pct ?? null,
          data.stage,
          project.id,
        ]
      );

      // Replace sector links
      await client.query('DELETE FROM project_sectors WHERE project_id = $1', [project.id]);
      const sectors = await client.query('SELECT id FROM sectors WHERE slug = ANY($1)', [
        data.sector_slugs,
      ]);
      for (const s of sectors.rows) {
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          'INSERT INTO project_sectors (project_id, sector_id) VALUES ($1, $2)',
          [project.id, s.id]
        );
      }

      return updated.rows[0];
    });

    return res.json({ project: result });
  })
);

// ---------------------------------------------------------------------
// POST /api/projects/:id/publish — owner submits for review (or admin publishes)
// ---------------------------------------------------------------------
router.post(
  '/:id/publish',
  requireAuth,
  asyncHandler(async (req, res) => {
    const r = await query(
      'SELECT id, owner_user_id, status FROM projects WHERE id = $1',
      [req.params.id]
    );
    const project = r.rows[0];
    if (!project) throw new HttpError(404, 'Project not found');

    const isOwner = project.owner_user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) throw new HttpError(403, 'Not allowed');

    const newStatus = isAdmin ? 'published' : 'pending_review';
    const publishedAt = isAdmin ? new Date() : null;

    const updated = await query(
      `UPDATE projects SET status = $1, published_at = COALESCE($2, published_at)
       WHERE id = $3 RETURNING *`,
      [newStatus, publishedAt, project.id]
    );

    await query(
      `INSERT INTO audit_log (actor_id, action, entity, entity_id, metadata)
       VALUES ($1, $2, 'projects', $3, $4)`,
      [
        req.user.id,
        isAdmin ? 'project.publish' : 'project.submit_review',
        project.id,
        JSON.stringify({ ip: req.ip }),
      ]
    );

    return res.json({ project: updated.rows[0] });
  })
);

// ---------------------------------------------------------------------
// POST /api/projects/:id/interest — investor expresses interest
// ---------------------------------------------------------------------
router.post(
  '/:id/interest',
  requireAuth,
  requireRole('investor'),
  requireTrustTier('verified'),
  asyncHandler(async (req, res) => {
    const data = expressInterestSchema.parse(req.body);

    const project = await query(
      `SELECT id, owner_user_id, status FROM projects WHERE id = $1`,
      [req.params.id]
    );
    if (!project.rows[0]) throw new HttpError(404, 'Project not found');
    if (project.rows[0].status !== 'published')
      throw new HttpError(400, 'Project is not currently open for interest');
    if (project.rows[0].owner_user_id === req.user.id)
      throw new HttpError(400, 'You cannot express interest in your own project');

    const inserted = await query(
      `INSERT INTO investment_interests (investor_id, project_id, ticket_usd, message)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (investor_id, project_id)
       DO UPDATE SET ticket_usd = EXCLUDED.ticket_usd, message = EXCLUDED.message
       RETURNING *`,
      [req.user.id, project.rows[0].id, data.ticket_usd ?? null, data.message ?? null]
    );
      // Notify project owner of the interest
      const ownerDataRes = await query(
        `SELECT p.title, p.slug, ow.full_name AS owner_name, ow.email AS owner_email,
                inv.full_name AS investor_name, org.name AS investor_org
           FROM projects p
           JOIN users ow ON ow.id = p.owner_user_id
           JOIN users inv ON inv.id = 

    return res.status(201).json({ interest: inserted.rows[0] });
           LEFT JOIN organizations org ON org.id = inv.organization_id
          WHERE p.id = $2`,
        [req.user.id, project.rows[0].id]
      );
      const od = ownerDataRes.rows[0];
      if (od) {
        email.interestExpressed({
          to: od.owner_email,
          ownerName: od.owner_name,
          investorName: od.investor_name,
          investorOrg: od.investor_org,
          projectTitle: od.title,
          projectSlug: od.slug,
          ticketUsd: data.ticket_usd,
          message: data.message,
        });
      }

    return res.status(201).json({ interest: inserted.rows[0] });
  })
);

// ---------------------------------------------------------------------
// GET /api/projects/mine — projects owned by the authenticated user
// ---------------------------------------------------------------------
router.get(
  '/mine/list',
  requireAuth,
  asyncHandler(async (req, res) => {
    const r = await query(
      `SELECT p.id, p.title, p.slug, p.status, p.stage, p.capital_required_usd,
              p.capital_committed_usd, p.published_at, p.created_at,
              c.name AS country_name, c.flag_emoji
       FROM projects p
       JOIN countries c ON c.id = p.country_id
       WHERE p.owner_user_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    return res.json({ projects: r.rows });
  })
);

// ---------------------------------------------------------------------
// GET /api/projects/:id/interests - sponsor lists open interests on their project
// ---------------------------------------------------------------------
router.get(
  '/:id/interests',
  requireAuth,
  asyncHandler(async (req, res) => {
    const proj = await query(
      `SELECT id, owner_user_id FROM projects WHERE id = $1`,
      [req.params.id]
    );
    if (!proj.rows[0]) throw new HttpError(404, 'Project not found');
    const isOwner = proj.rows[0].owner_user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) throw new HttpError(403, 'Not allowed');

    const r = await query(
      `SELECT i.id, i.investor_id, i.ticket_usd, i.message, i.status, i.created_at,
              u.full_name, u.email, u.trust_tier,
              o.name AS organization_name,
              (SELECT r.id
                 FROM deal_rooms r
                 JOIN deal_room_members m ON m.deal_room_id = r.id
                WHERE r.project_id = i.project_id
                  AND m.user_id = i.investor_id
                  AND r.is_active = true
                LIMIT 1) AS existing_room_id
         FROM investment_interests i
         JOIN users u ON u.id = i.investor_id
         LEFT JOIN organizations o ON o.id = u.organization_id
        WHERE i.project_id = $1
        ORDER BY i.created_at DESC`,
      [req.params.id]
    );
    res.json({ interests: r.rows });
  })
);

export default router;
