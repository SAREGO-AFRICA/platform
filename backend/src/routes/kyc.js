// src/routes/kyc.js
// User-facing KYC endpoints.
// Admins use the existing /api/admin/verification-* endpoints to review.

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { uploadKycDocument, signedUrlFor } from '../utils/storage.js';
import { email } from '../utils/email.js';

const router = Router();

const DOCUMENT_TYPES = [
  'passport',
  'national_id',
  'drivers_license',
  'proof_of_address',
  'incorporation',
  'tax_cert',
  'bank_statement',
  'directors_id',
];

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

const uploadBodySchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES),
});

router.post(
  '/upload',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, 'file is required');
    }
    const body = uploadBodySchema.parse(req.body);
    const { document_type } = body;

    if (!ALLOWED_MIME.has(req.file.mimetype)) {
      throw new HttpError(
        400,
        `Unsupported file type ${req.file.mimetype}. Allowed: PDF, JPEG, PNG, WebP.`
      );
    }

    const pendingCount = await query(
      `SELECT COUNT(*)::int AS c
         FROM verification_documents
        WHERE user_id = $1 AND document_type = $2 AND status = 'pending'`,
      [req.user.id, document_type]
    );
    if (pendingCount.rows[0].c >= 3) {
      throw new HttpError(
        409,
        'You already have several pending documents of this type. Wait for review or contact support.'
      );
    }

    const { storageKey } = await uploadKycDocument({
      userId: req.user.id,
      documentType: document_type,
      fileBuffer: req.file.buffer,
      contentType: req.file.mimetype,
      originalName: req.file.originalname,
    });

    const inserted = await query(
      `INSERT INTO verification_documents
         (user_id, document_type, storage_key, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, document_type, status, created_at`,
      [req.user.id, document_type, storageKey]
    );

    email.kycSubmitted({ submittedByName: req.user.full_name || req.user.email || 'A user', documentType: document_type });
    res.status(201).json({
      document: inserted.rows[0],
    });
  })
);

router.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT id, document_type, status, review_notes, created_at, reviewed_at
         FROM verification_documents
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ documents: result.rows });
  })
);

router.get(
  '/file/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await query(
      `SELECT id, user_id, storage_key
         FROM verification_documents
        WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      throw new HttpError(404, 'document not found');
    }
    const doc = result.rows[0];

    const isOwner = doc.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new HttpError(403, 'forbidden');
    }

    const url = await signedUrlFor(doc.storage_key, 300);
    res.json({ url, expires_in: 300 });
  })
);

export default router;
