-- 0013_lock_generated_packs_rpc.sql
-- Security audit follow-up: lock down cache writes.
--
-- Before: upsert_generated_pack (security definer) was granted to anon and
-- authenticated. That meant anyone holding the public anon key could write
-- any well-shaped pack to any youtube_id, bypassing the import flow. The
-- shape check in the RPC catches only the dumbest forgery, not malicious
-- content.
--
-- After: only service_role (server-side only, never shipped to the client)
-- can execute the RPC. The server reads SUPABASE_SERVICE_ROLE_KEY from env
-- and uses a dedicated service-role Supabase client for cache writes;
-- reads continue to go through the anon client (public SELECT policy).
--
-- Client-side cache poisoning is now structurally impossible — all writes
-- MUST originate from a trusted server with the service-role key.

revoke execute on function public.upsert_generated_pack(text, jsonb, text)
  from anon, authenticated;

-- service_role always bypasses grants (and RLS), so writes keep working
-- through the server without needing an explicit grant.
