/**
 * Nabbit · Phase 8 v2 · Supabase Edge Function
 *
 * Deno runtime. Deploy once with:
 *   supabase functions deploy daily-reminders
 *
 * Schedule it to run once a day via the Supabase Dashboard
 * (Database → Cron → create job → http request to this function URL).
 *
 * What it does: queries public.recall_items for due reviews grouped by user,
 * then emits a reminder per user. Delivery is pluggable — the body below
 * logs what it would send, since Nabbit doesn't yet have a push subscription
 * table or an email provider wired. When you add either, drop the delivery
 * call where DELIVERY_PLACEHOLDER sits.
 *
 * This replaces the on-open client slice in src/lib/reminders.ts for
 * signed-in users; the client-side nudge still works when a user visits
 * the SPA (defense in depth), but no longer carries the daily cadence.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-ignore — Deno-only import, resolved at deploy time.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore — Supabase SDK pinned to a Deno-safe build.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0';

interface DueRow {
  user_id: string;
  challenge_id: string;
  concept: string;
}

serve(async (_req: Request) => {
  // Service-role key is required to bypass RLS for a scheduled read across all users.
  // Set via `supabase secrets set SB_URL=… SB_SERVICE_ROLE=…` before deploy.
  // @ts-ignore — Deno global
  const url = Deno.env.get('SB_URL');
  // @ts-ignore
  const serviceKey = Deno.env.get('SB_SERVICE_ROLE');
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: 'missing env' }), { status: 500 });
  }

  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from('recall_items')
    .select('user_id, challenge_id, concept')
    .lte('next_review_at', nowIso);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  const dueByUser = new Map<string, DueRow[]>();
  for (const row of (data ?? []) as DueRow[]) {
    const list = dueByUser.get(row.user_id) ?? [];
    list.push(row);
    dueByUser.set(row.user_id, list);
  }

  const summary = Array.from(dueByUser.entries()).map(([userId, items]) => ({
    userId,
    dueCount: items.length,
    sampleConcept: items[0]?.concept ?? null,
  }));

  // DELIVERY_PLACEHOLDER — wire your push / email provider here. Each entry in
  // `summary` is one user who should be nudged. Keep it idempotent per-day so
  // reruns don't double-send; a `public.reminder_log(user_id, for_date)` table
  // with a unique constraint would be the obvious shape.
  console.log('[daily-reminders] would notify', summary.length, 'user(s)');
  for (const s of summary) {
    console.log(`  → ${s.userId.slice(0, 8)}… · ${s.dueCount} due · "${s.sampleConcept}"`);
  }

  return new Response(
    JSON.stringify({ ok: true, usersNotified: summary.length, summary }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
