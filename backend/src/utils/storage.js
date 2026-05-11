// src/utils/storage.js
// Thin wrapper around Supabase Storage so the rest of the backend doesn't
// need to know about the underlying client library.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KYC_BUCKET = process.env.KYC_BUCKET || 'kyc-documents';
const DEAL_ROOM_BUCKET = process.env.DEAL_ROOM_BUCKET || 'deal-room-documents';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[storage] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set - uploads will fail until they are.'
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

// ---------- Generic primitives ----------

async function uploadToBucket({ bucket, storageKey, fileBuffer, contentType }) {
  const { error } = await client()
    .storage
    .from(bucket)
    .upload(storageKey, fileBuffer, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });
  if (error) {
    const err = new Error(error.message || 'storage upload failed');
    err.cause = error;
    throw err;
  }
}

async function signedUrlForBucket(bucket, storageKey, ttlSeconds = 300) {
  const { data, error } = await client()
    .storage
    .from(bucket)
    .createSignedUrl(storageKey, ttlSeconds);
  if (error) {
    const err = new Error(error.message || 'signed url failed');
    err.cause = error;
    throw err;
  }
  return data.signedUrl;
}

async function deleteFromBucket(bucket, storageKey) {
  const { error } = await client()
    .storage
    .from(bucket)
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

// ---------- KYC (existing API, preserved) ----------

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
  await uploadToBucket({
    bucket: KYC_BUCKET,
    storageKey,
    fileBuffer,
    contentType,
  });
  return { storageKey };
}

export async function signedUrlFor(storageKey, ttlSeconds = 300) {
  return signedUrlForBucket(KYC_BUCKET, storageKey, ttlSeconds);
}

export async function deleteStoredFile(storageKey) {
  return deleteFromBucket(KYC_BUCKET, storageKey);
}

// ---------- Deal Rooms ----------

export async function uploadDealRoomDocument({
  roomId,
  fileBuffer,
  contentType,
  originalName,
}) {
  const safeName = sanitizeFilename(originalName);
  const stamp = Date.now();
  const storageKey = `${roomId}/${stamp}-${safeName}`;
  await uploadToBucket({
    bucket: DEAL_ROOM_BUCKET,
    storageKey,
    fileBuffer,
    contentType,
  });
  return { storageKey };
}

export async function signedUrlForDealRoomDoc(storageKey, ttlSeconds = 300) {
  return signedUrlForBucket(DEAL_ROOM_BUCKET, storageKey, ttlSeconds);
}

export async function deleteDealRoomDocument(storageKey) {
  return deleteFromBucket(DEAL_ROOM_BUCKET, storageKey);
}
