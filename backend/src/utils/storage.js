// src/utils/storage.js
// Thin wrapper around Supabase Storage so the rest of the backend doesn't
// need to know about the underlying client library.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KYC_BUCKET = process.env.KYC_BUCKET || 'kyc-documents';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[storage] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set - KYC uploads will fail until they are.'
  );
}

let _client = null;
function client() {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase storage env vars not configured');
  }
  _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export async function uploadKycDocument({
  userId,
  documentType,
  fileBuffer,
  contentType,
  originalName,
}) {
  const safeName = sanitizeFilename(originalName);
  const stamp = Date.now();
  const storageKey = `${userId}/${documentType}/${stamp}-${safeName}`;

  const { error } = await client()
    .storage
    .from(KYC_BUCKET)
    .upload(storageKey, fileBuffer, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    const msg = error.message || 'storage upload failed';
    const err = new Error(msg);
    err.cause = error;
    throw err;
  }

  return { storageKey };
}

export async function signedUrlFor(storageKey, ttlSeconds = 300) {
  const { data, error } = await client()
    .storage
    .from(KYC_BUCKET)
    .createSignedUrl(storageKey, ttlSeconds);

  if (error) {
    const err = new Error(error.message || 'signed url failed');
    err.cause = error;
    throw err;
  }
  return data.signedUrl;
}

export async function deleteStoredFile(storageKey) {
  const { error } = await client()
    .storage
    .from(KYC_BUCKET)
    .remove([storageKey]);
  if (error) {
    const err = new Error(error.message || 'storage delete failed');
    err.cause = error;
    throw err;
  }
}

function sanitizeFilename(name) {
  if (!name) return 'file';
  return String(name)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'file';
}
