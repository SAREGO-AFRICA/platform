import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { query } from '../db/index.js';
import { createClient } from '@supabase/supabase-js';

const router = Router();

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function userRoleInConversation(conv, userId) {
  if (conv.owner_user_id === userId) return 'owner';
  if (conv.party_user_id === userId) return 'party';
  return null;
}

router.post('/from-interest/:interest_id', requireAuth, async (req, res) => {
  const { interest_id } = req.params;
  const requestingUserId = req.user.id;
  try {
    const { rows: [interest] } = await query(
      `SELECT i.*, u.id AS owner_user_id
       FROM opportunity_interests i
       JOIN users u ON (
         CASE i.opportunity_type
           WHEN 'project' THEN u.id = (SELECT created_by FROM projects WHERE id = i.opportunity_id)
           WHEN 'trade_opportunity' THEN u.id = (SELECT created_by FROM trade_opportunities WHERE id = i.opportunity_id)
           ELSE FALSE END)
       WHERE i.id = $1`,
      [interest_id]
    );
    if (!interest) return res.status(404).json({ error: 'Interest not found' });
    if (requestingUserId !== interest.owner_user_id && requestingUserId !== interest.user_id)
      return res.status(403).json({ error: 'Forbidden' });
    const { rows: [conv] } = await query(
      `INSERT INTO conversations (listing_type, listing_id, owner_user_id, party_user_id, interest_id)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (listing_type, listing_id, party_user_id) DO UPDATE SET interest_id = EXCLUDED.interest_id
       RETURNING *`,
      [interest.opportunity_type, interest.opportunity_id, interest.owner_user_id, interest.user_id, interest_id]
    );
    res.status(201).json({ conversation: conv });
  } catch (err) {
    console.error('from-interest error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await query(
      `SELECT c.*, owner.full_name AS owner_name, owner.email AS owner_email,
         party.full_name AS party_name, party.email AS party_email,
         m.body AS last_message_body, m.sender_user_id AS last_message_sender_id,
         CASE
           WHEN c.owner_user_id = $1 THEN
             (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id
              AND created_at > COALESCE(c.owner_last_seen_at, '1970-01-01'))
           ELSE
             (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id
              AND created_at > COALESCE(c.party_last_seen_at, '1970-01-01'))
         END AS unread_count
       FROM conversations c
       JOIN users owner ON owner.id = c.owner_user_id
       JOIN users party ON party.id = c.party_user_id
       LEFT JOIN LATERAL (
         SELECT body, sender_user_id FROM messages
         WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
       ) m ON true
       WHERE c.owner_user_id = $1 OR c.party_user_id = $1
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
      [userId]
    );
    res.json({ conversations: rows });
  } catch (err) {
    console.error('list conversations error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows: [conv] } = await query(
      `SELECT c.*, owner.full_name AS owner_name, party.full_name AS party_name
       FROM conversations c
       JOIN users owner ON owner.id = c.owner_user_id
       JOIN users party ON party.id = c.party_user_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!userRoleInConversation(conv, userId)) return res.status(403).json({ error: 'Forbidden' });
    const { rows: messages } = await query(
      `SELECT m.*, u.full_name AS sender_name FROM messages m
       JOIN users u ON u.id = m.sender_user_id
       WHERE m.conversation_id = $1 ORDER BY m.created_at ASC`,
      [conv.id]
    );
    res.json({ conversation: conv, messages });
  } catch (err) {
    console.error('get conversation error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const sendMessageSchema = z.object({
  body:                  z.string().min(1).max(10000).optional(),
  attachment_path:       z.string().optional(),
  attachment_filename:   z.string().optional(),
  attachment_size_bytes: z.number().int().positive().optional(),
  attachment_mime_type:  z.string().optional(),
}).refine(d => d.body || d.attachment_path, { message: 'Message must have body or attachment' });

router.post('/:id/messages', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const { rows: [conv] } = await query('SELECT * FROM conversations WHERE id = $1', [req.params.id]);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!userRoleInConversation(conv, userId)) return res.status(403).json({ error: 'Forbidden' });
    const d = parsed.data;
    const { rows: [msg] } = await query(
      `INSERT INTO messages (conversation_id, sender_user_id, body, attachment_path, attachment_filename, attachment_size_bytes, attachment_mime_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [conv.id, userId, d.body ?? null, d.attachment_path ?? null, d.attachment_filename ?? null, d.attachment_size_bytes ?? null, d.attachment_mime_type ?? null]
    );
    res.status(201).json({ message: msg });
  } catch (err) {
    console.error('send message error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/attachment-upload-url', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { filename, mime_type } = req.body;
  if (!filename || !mime_type) return res.status(400).json({ error: 'filename and mime_type required' });
  if (mime_type !== 'application/pdf') return res.status(400).json({ error: 'Only PDF attachments are supported' });
  try {
    const { rows: [conv] } = await query('SELECT * FROM conversations WHERE id = $1', [req.params.id]);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!userRoleInConversation(conv, userId)) return res.status(403).json({ error: 'Forbidden' });
    const messageId = crypto.randomUUID();
    const storagePath = `conversations/${conv.id}/${messageId}/${filename}`;
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from('conversation-attachments').createSignedUploadUrl(storagePath);
    if (error) { console.error('signed upload URL error', error); return res.status(500).json({ error: 'Could not generate upload URL' }); }
    res.json({ upload_url: data.signedUrl, storage_path: storagePath, message_id_hint: messageId });
  } catch (err) {
    console.error('attachment upload url error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/messages/:msg_id/attachment-download-url', requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows: [conv] } = await query('SELECT * FROM conversations WHERE id = $1', [req.params.id]);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!userRoleInConversation(conv, userId)) return res.status(403).json({ error: 'Forbidden' });
    const { rows: [msg] } = await query(
      'SELECT * FROM messages WHERE id = $1 AND conversation_id = $2', [req.params.msg_id, conv.id]
    );
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    if (!msg.attachment_path) return res.status(400).json({ error: 'Message has no attachment' });
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from('conversation-attachments').createSignedUrl(msg.attachment_path, 300);
    if (error) { console.error('signed download URL error', error); return res.status(500).json({ error: 'Could not generate download URL' }); }
    res.json({ download_url: data.signedUrl, expires_in: 300 });
  } catch (err) {
    console.error('attachment download url error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/seen', requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows: [conv] } = await query('SELECT * FROM conversations WHERE id = $1', [req.params.id]);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const role = userRoleInConversation(conv, userId);
    if (!role) return res.status(403).json({ error: 'Forbidden' });
    const col = role === 'owner' ? 'owner_last_seen_at' : 'party_last_seen_at';
    await query(`UPDATE conversations SET ${col} = now(), updated_at = now() WHERE id = $1`, [conv.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('seen error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
