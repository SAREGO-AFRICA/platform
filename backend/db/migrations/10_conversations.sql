-- ============================================================
-- Migration 10: Conversations + Messages (Session J Phase 1)
-- ============================================================
-- Adds the Institutional Coordination Layer:
--   - conversations: per (listing × interested party) - private 1:1 threads
--   - messages: text + optional single attachment per message
--
-- Architecture decisions (locked Session J start):
--   A1: per-party threads (unique constraint enforces 1 thread per party per listing)
--   B2: auto-created on shortlist (logic in backend, NOT in trigger)
--   C2: per-thread last-seen timestamps (owner_last_seen_at, party_last_seen_at)
--   E1: per-message attachments (attachment_* columns on messages, nullable)
--
-- Safe to re-run: uses IF NOT EXISTS.
-- ============================================================

-- ============================================================
-- conversations table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The listing this conversation relates to
  listing_type    opportunity_type NOT NULL,
  listing_id      UUID NOT NULL,

  -- The two parties (always exactly two: owner + interested party)
  owner_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  party_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Link back to the originating interest entry (the reason this conversation exists)
  interest_id     UUID NOT NULL REFERENCES opportunity_interests(id) ON DELETE CASCADE,

  -- Last-seen timestamps for unread state (C2)
  owner_last_seen_at  TIMESTAMPTZ,
  party_last_seen_at  TIMESTAMPTZ,

  -- Activity tracking
  last_message_at TIMESTAMPTZ,
  message_count   INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A1: enforce one thread per (listing × party)
  CONSTRAINT conversations_listing_party_unique
    UNIQUE (listing_type, listing_id, party_user_id),

  -- Defensive: owner and party must differ
  CONSTRAINT conversations_distinct_parties
    CHECK (owner_user_id <> party_user_id)
);

-- Indexes for the common access patterns
CREATE INDEX IF NOT EXISTS conversations_owner_idx
  ON public.conversations (owner_user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_party_idx
  ON public.conversations (party_user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_listing_idx
  ON public.conversations (listing_type, listing_id);
CREATE INDEX IF NOT EXISTS conversations_interest_idx
  ON public.conversations (interest_id);


-- ============================================================
-- messages table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,

  -- Content
  body            TEXT,  -- nullable so a message can be attachment-only

  -- Single attachment per message (E1). All nullable - no attachment by default.
  attachment_path       TEXT,         -- Supabase Storage object path (e.g. 'conversations/abc/msg-xyz/file.pdf')
  attachment_filename   TEXT,         -- Original display name from upload
  attachment_size_bytes BIGINT,       -- For display + audit
  attachment_mime_type  TEXT,         -- Currently 'application/pdf' per G1

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- At least one of body or attachment must be present
  CONSTRAINT messages_has_content
    CHECK (
      (body IS NOT NULL AND length(trim(body)) > 0)
      OR attachment_path IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx
  ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_sender_idx
  ON public.messages (sender_user_id);


-- ============================================================
-- Trigger: update conversation.last_message_at + message_count on new message
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
     SET last_message_at = NEW.created_at,
         message_count   = message_count + 1,
         updated_at      = NEW.created_at
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_update_conversation_trigger ON public.messages;
CREATE TRIGGER messages_update_conversation_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_message();


-- ============================================================
-- RLS: enable, no policies (backend bypasses via postgres role)
-- Consistent with the rest of SAREGO's schema architecture.
-- ============================================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- Verification
-- ============================================================
-- SELECT table_name, column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name IN ('conversations', 'messages')
--  ORDER BY table_name, ordinal_position;
--
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('conversations', 'messages');
-- ============================================================
