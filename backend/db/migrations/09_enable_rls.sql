-- ============================================================
-- Migration 09: Enable Row Level Security on 8 public tables
-- ============================================================
-- Supabase flagged these tables as publicly accessible via the
-- anon REST API because RLS was never enabled at creation time.
--
-- This migration enables RLS WITHOUT adding policies. The result:
--   * The anon role (via Supabase REST/realtime) CANNOT read or write
--   * The authenticated role (via Supabase REST/realtime) CANNOT read or write
--   * The backend's Postgres role (via DATABASE_URL) bypasses RLS as
--     it has the BYPASSRLS attribute by default for service-level connections
--
-- Since the SAREGO platform routes ALL data access through the Express
-- backend (using a privileged Postgres connection), this provides full
-- protection without breaking any functionality.
--
-- If a future need arises for direct frontend → Supabase reads (e.g.
-- realtime subscriptions for in-app notifications), per-table policies
-- can be added at that time.
--
-- Safe to re-run: ENABLE RLS is idempotent.
-- ============================================================

ALTER TABLE public.agri_offtake_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capital_provider_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commodity_requests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_loads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_interests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenders                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_corridors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_finance_requests      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Verification query - paste this after applying to confirm
-- ============================================================
-- SELECT
--   n.nspname AS schema,
--   c.relname AS table_name,
--   c.relrowsecurity AS rls_enabled
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relkind = 'r'
-- ORDER BY c.relrowsecurity, c.relname;
--
-- Expected: all rows show rls_enabled = true.
-- ============================================================
