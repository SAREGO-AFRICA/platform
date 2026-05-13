// src/routes/dealRooms.js
// Deal Room endpoints. One room per (project, investor) pair (enforced at app level).
// Roles: 'owner' (sponsor), 'editor', 'viewer'. Owner has full control.
// All actions are written to deal_room_access_log.

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import {
  uploadDealRoomDocument,
  signedUrlForDealRoomDoc,
  deleteDealRoomDocument,
} from '../utils/storage.js';
import { email } from '../utils/email.js';

const router = Router();

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/zip',
  'application/x-zip-compressed',
]);

const ELIGIBLE_TIERS = new Set(['verified', 'institutional']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

// ---------- helpers ----------

async function logAccess({ roomId, userId, action, documentId, req }) {
  await query(
    `INSERT INTO deal_room_access_log
       (deal_room_id, user_id, action, document_id, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      roomId,
      userId,
      action,
      documentId ?? null,
      req?.ip || null,
      req?.headers?.['user-agent'] || null,
    ]
  );
}

async function getMembership(roomId, userId) {
  const r = await query(
    `SELECT room_role
       FROM deal_room_members
      WHERE deal_room_id = $1 AND user_id = $2`,
    [roomId, userId]
  );
  return r.rows[0] || null;
}

async function requireMembership(roomId, userId) {
  const m = await getMembership(roomId, userId);
  if (!m) throw new HttpError(403, 'You are not a member of this deal room.');
  return m;
}

async function requireOwner(roomId, userId) {
  const m = await requireMembership(roomId, userId);
  if (m.room_role !== 'owner') throw new HttpError(403, 'Owner only.');
  return m;
}

async function getRoom(roomId) {
  const r = await query(
    `SELECT id, project_id, name, description, created_by, is_active, created_at
       FROM deal_rooms
      WHERE id = $1`,
    [roomId]
  );
  return r.rows[0] || null;
}

// =====================================================================
// POST /api/deal-rooms
// Create a room. Body: { investment_interest_id, name?, description? }
// Caller must be the project owner. Auto-invites the interest's investor.
// =====================================================================

const createSchema = z.object({
  investment_interest_id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
});

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);

    const interestRes = await query(
      `SELECT i.id, i.investor_id, i.project_id, i.status,
              p.title AS project_title, p.owner_user_id AS project_owner_id,
              u.trust_tier AS investor_trust_tier
         FROM investment_interests i
         JOIN projects p ON p.id = i.project_id
         JOIN users u ON u.id = i.investor_id
        WHERE i.id = $1`,
      [body.investment_interest_id]
    );
    const interest = interestRes.rows[0];
    if (!interest) throw new HttpError(404, 'Interest not found.');

    if (interest.project_owner_id !== req.user.id) {
      throw new HttpError(403, 'Only the project owner can open a deal room.');
    }
    if (!ELIGIBLE_TIERS.has(interest.investor_trust_tier)) {
      throw new HttpError(
        409,
        'Investor must be KYC-verified before a deal room can be opened.'
      );
    }

    // Enforce one room per (project, investor)
    const existing = await query(
      `SELECT r.id
         FROM deal_rooms r
         JOIN deal_room_members m ON m.deal_room_id = r.id
        WHERE r.project_id = $1
          AND r.is_active = true
          AND m.user_id = $2
        LIMIT 1`,
      [interest.project_id, interest.investor_id]
    );
    if (existing.rows[0]) {
      throw new HttpError(409, 'A deal room already exists for this investor and project.');
    }

    const name = body.name || `${interest.project_title} - Deal Room`;
    const description = body.description ?? null;

    const inserted = await query(
      `INSERT INTO deal_rooms (project_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, project_id, name, description, created_by, is_active, created_at`,
      [interest.project_id, name, description, req.user.id]
    );
    const room = inserted.rows[0];

    // Sponsor as owner, investor as editor
    await query(
      `INSERT INTO deal_room_members (deal_room_id, user_id, room_role, invited_by)
       VALUES ($1, $2, 'owner', $2)`,
      [room.id, req.user.id]
    );
    await query(
      `INSERT INTO deal_room_members (deal_room_id, user_id, room_role, invited_by)
       VALUES ($1, $2, 'editor', $3)`,
      [room.id, interest.investor_id, req.user.id]
    );

    // Mark the interest as accepted
    await query(
      `UPDATE investment_interests
          SET status = 'accepted'
        WHERE id = $1`,
      [interest.id]
    );

    await logAccess({
      roomId: room.id,
      userId: req.user.id,
      action: 'create',
      req,
    });

    

    res.status(201).json({ room });
  })
);

// =====================================================================
// GET /api/deal-rooms
// List rooms the current user is a member of.
// =====================================================================

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const r = await query(
      `SELECT r.id, r.project_id, r.name, r.description, r.is_active, r.created_at,
              m.room_role,
              p.title AS project_title, p.slug AS project_slug,
              (SELECT COUNT(*)::int FROM deal_room_members WHERE deal_room_id = r.id) AS member_count,
              (SELECT COUNT(*)::int FROM deal_room_documents WHERE deal_room_id = r.id) AS document_count
         FROM deal_rooms r
         JOIN deal_room_members m ON m.deal_room_id = r.id
         JOIN projects p ON p.id = r.project_id
        WHERE m.user_id = $1
          AND r.is_active = true
        ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json({ rooms: r.rows });
  })
);

// =====================================================================
// GET /api/deal-rooms/:id
// Room details + members + documents. Member only.
// =====================================================================

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const room = await getRoom(req.params.id);
    if (!room) throw new HttpError(404, 'Deal room not found.');
    const me = await requireMembership(room.id, req.user.id);

    const project = await query(
      `SELECT id, title, slug FROM projects WHERE id = $1`,
      [room.project_id]
    );

    const members = await query(
      `SELECT m.user_id, m.room_role, m.joined_at,
              u.full_name, u.email, u.role AS user_role, u.trust_tier,
              o.name AS organization_name
         FROM deal_room_members m
         JOIN users u ON u.id = m.user_id
         LEFT JOIN organizations o ON o.id = u.organization_id
        WHERE m.deal_room_id = $1
        ORDER BY (m.room_role = 'owner') DESC, m.joined_at ASC`,
      [room.id]
    );

    const documents = await query(
      `SELECT d.id, d.title, d.size_bytes, d.mime_type, d.created_at,
              d.uploaded_by, u.full_name AS uploaded_by_name
         FROM deal_room_documents d
         JOIN users u ON u.id = d.uploaded_by
        WHERE d.deal_room_id = $1
        ORDER BY d.created_at DESC`,
      [room.id]
    );

    res.json({
      room: { ...room, project: project.rows[0] || null },
      my_role: me.room_role,
      members: members.rows,
      documents: documents.rows,
    });
  })
);

// =====================================================================
// POST /api/deal-rooms/:id/invite
// Owner adds a member by email. Optional role.
// =====================================================================

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['editor', 'viewer']).optional(),
});

router.post(
  '/:id/invite',
  requireAuth,
  asyncHandler(async (req, res) => {
    const room = await getRoom(req.params.id);
    if (!room) throw new HttpError(404, 'Deal room not found.');
    if (!room.is_active) throw new HttpError(409, 'Deal room is inactive.');
    await requireOwner(room.id, req.user.id);

    const body = inviteSchema.parse(req.body);
    const role = body.role || 'viewer';

    const userRes = await query(
      `SELECT id, full_name, email, trust_tier FROM users WHERE LOWER(email) = LOWER($1)`,
      [body.email]
    );
    const invitee = userRes.rows[0];
    if (!invitee) throw new HttpError(404, 'No SAREGO user found with that email.');
    if (!ELIGIBLE_TIERS.has(invitee.trust_tier)) {
      throw new HttpError(
        409,
        'Only KYC-verified users can be added to a deal room.'
      );
    }

    const existing = await getMembership(room.id, invitee.id);
    if (existing) throw new HttpError(409, 'User is already a member.');

    await query(
      `INSERT INTO deal_room_members (deal_room_id, user_id, room_role, invited_by)
       VALUES ($1, $2, $3, $4)`,
      [room.id, invitee.id, role, req.user.id]
    );

    await logAccess({
      roomId: room.id,
      userId: req.user.id,
      action: 'invite',
      req,
    });



        res.status(201).json({
      member: {
        user_id: invitee.id,
        full_name: invitee.full_name,
        email: invitee.email,
        room_role: role,
      },
    });
  })
);

// =====================================================================
// DELETE /api/deal-rooms/:id/members/:userId
// Owner removes a member. Cannot remove last owner.
// =====================================================================

router.delete(
  '/:id/members/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const room = await getRoom(req.params.id);
    if (!room) throw new HttpError(404, 'Deal room not found.');
    await requireOwner(room.id, req.user.id);

    const target = await getMembership(room.id, req.params.userId);
    if (!target) throw new HttpError(404, 'Member not found.');

    if (target.room_role === 'owner') {
      const ownerCountRes = await query(
        `SELECT COUNT(*)::int AS c
           FROM deal_room_members
          WHERE deal_room_id = $1 AND room_role = 'owner'`,
        [room.id]
      );
      if (ownerCountRes.rows[0].c <= 1) {
        throw new HttpError(409, 'Cannot remove the last owner.');
      }
    }

    await query(
      `DELETE FROM deal_room_members
        WHERE deal_room_id = $1 AND user_id = $2`,
      [room.id, req.params.userId]
    );

    await logAccess({
      roomId: room.id,
      userId: req.user.id,
      action: 'remove',
      req,
    });

    res.json({ ok: true });
  })
);

// =====================================================================
// POST /api/deal-rooms/:id/documents
// Upload a document. Owner or editor only.
// =====================================================================

const uploadDocBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

router.post(
  '/:id/documents',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const room = await getRoom(req.params.id);
    if (!room) throw new HttpError(404, 'Deal room not found.');
    if (!room.is_active) throw new HttpError(409, 'Deal room is inactive.');

    const me = await requireMembership(room.id, req.user.id);
    if (me.room_role !== 'owner' && me.room_role !== 'editor') {
      throw new HttpError(403, 'Viewers cannot upload documents.');
    }

    if (!req.file) throw new HttpError(400, 'file is required');
    if (!ALLOWED_MIME.has(req.file.mimetype)) {
      throw new HttpError(
        400,
        `Unsupported file type ${req.file.mimetype}.`
      );
    }

    const body = uploadDocBodySchema.parse(req.body);
    const title = body.title?.trim() || req.file.originalname || 'Untitled';

    const { storageKey } = await uploadDealRoomDocument({
      roomId: room.id,
      fileBuffer: req.file.buffer,
      contentType: req.file.mimetype,
      originalName: req.file.originalname,
    });

    const inserted = await query(
      `INSERT INTO deal_room_documents
         (deal_room_id, title, storage_key, size_bytes, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, size_bytes, mime_type, uploaded_by, created_at`,
      [
        room.id,
        title,
        storageKey,
        req.file.size,
        req.file.mimetype,
        req.user.id,
      ]
    );
    const doc = inserted.rows[0];

    await logAccess({
      roomId: room.id,
      userId: req.user.id,
      action: 'upload',
      documentId: doc.id,
      req,
    });


    res.status(201).json({ document: doc });
  })
);

// =====================================================================
// GET /api/deal-rooms/:id/documents/:docId
// Signed URL for download/view. Any room member.
// =====================================================================

router.get(
  '/:id/documents/:docId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const room = await getRoom(req.params.id);
    if (!room) throw new HttpError(404, 'Deal room not found.');
    await requireMembership(room.id, req.user.id);

    const docRes = await query(
      `SELECT id, storage_key, deal_room_id
         FROM deal_room_documents
        WHERE id = $1`,
      [req.params.docId]
    );
    const doc = docRes.rows[0];
    if (!doc || doc.deal_room_id !== room.id) {
      throw new HttpError(404, 'Document not found.');
    }

    const url = await signedUrlForDealRoomDoc(doc.storage_key, 300);

    await logAccess({
      roomId: room.id,
      userId: req.user.id,
      action: 'view',
      documentId: doc.id,
      req,
    });

    res.json({ url, expires_in: 300 });
  })
);

// =====================================================================
// DELETE /api/deal-rooms/:id/documents/:docId
// Uploader or room owner. Removes from storage and DB.
// =====================================================================

router.delete(
  '/:id/documents/:docId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const room = await getRoom(req.params.id);
    if (!room) throw new HttpError(404, 'Deal room not found.');
    const me = await requireMembership(room.id, req.user.id);

    const docRes = await query(
      `SELECT id, storage_key, uploaded_by, deal_room_id
         FROM deal_room_documents
        WHERE id = $1`,
      [req.params.docId]
    );
    const doc = docRes.rows[0];
    if (!doc || doc.deal_room_id !== room.id) {
      throw new HttpError(404, 'Document not found.');
    }

    const isUploader = doc.uploaded_by === req.user.id;
    const isOwner = me.room_role === 'owner';
    if (!isUploader && !isOwner) {
      throw new HttpError(403, 'Only the uploader or room owner can delete this document.');
    }

    try {
      await deleteDealRoomDocument(doc.storage_key);
    } catch (e) {
      // Log but proceed with DB delete to avoid orphan rows pointing to missing files.
      console.warn('[deal-rooms] storage delete failed, removing DB row anyway:', e.message);
    }

    // Log before deleting (FK constraint requires document still exists)
    await logAccess({
      roomId: room.id,
      userId: req.user.id,
      action: 'delete',
      documentId: doc.id,
      req,
    });

    await query(
      `DELETE FROM deal_room_documents WHERE id = $1`,
      [doc.id]
    );

    res.json({ ok: true });
  })
);

// =====================================================================
// GET /api/deal-rooms/:id/activity
// Recent access log. Member only. Capped at 100 most recent.
// =====================================================================

router.get(
  '/:id/activity',
  requireAuth,
  asyncHandler(async (req, res) => {
    const room = await getRoom(req.params.id);
    if (!room) throw new HttpError(404, 'Deal room not found.');
    await requireMembership(room.id, req.user.id);

    const r = await query(
      `SELECT l.id, l.action, l.document_id, l.created_at,
              u.id AS user_id, u.full_name AS user_name,
              d.title AS document_title
         FROM deal_room_access_log l
         JOIN users u ON u.id = l.user_id
         LEFT JOIN deal_room_documents d ON d.id = l.document_id
        WHERE l.deal_room_id = $1
        ORDER BY l.created_at DESC
        LIMIT 100`,
      [room.id]
    );
    res.json({ activity: r.rows });
  })
);

export default router;
