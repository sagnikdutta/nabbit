# V2-C: flipping the default to V2

Runbook for making V2 the default UI, sunsetting V1 and deleting its code.
Nothing here has been run. Steps marked **(you)** touch staging/production or
need a product decision; step 5 is the only code change and should not land
until step 4 has passed.

## How the default is chosen today

- `public.ui_versions` has one row per version; the row with `"default" = true` wins.
- **Server** (`server.ts`, `resolveDefaultVersion`): `GET /` redirects to `/v1/` or `/v2/`.
  The lookup is cached in-process for 30 s, and any failure (no env vars, missing
  table, no default row) falls back to **v1**.
- **Static hosts / Vercel** (`src/AppRouter.tsx`, `fetchDefaultVersion`): the same
  lookup runs client-side as a safety net, also falling back to v1.
- `AppRouter` sends any unknown `/v2/<path>` to V1. All V2 pages that exist today
  (dashboard, auth, challenge, recall, leaderboard, community, import, library,
  progress, achievements, settings) are routed explicitly.

Because both fallbacks are v1, an outage of the lookup after the flip silently
serves V1. That is the right failure mode during the transition and a bug after V1
is deleted (step 5 removes it).

## 1. Pre-flight (you)

- [x] OAuth deferred: the Google/GitHub buttons are hidden (`OAUTH_ENABLED = false`
      in `src/v2/pages/Auth.tsx`). To enable later: turn on both providers in
      Supabase Auth, add `<origin>/v2/` to the redirect allow-list, set the flag to `true`.
- [ ] Signed-in and Pro checklist from the parity-cards work passed (Daily Drill,
      Boss launch, Season banner, Mastery, Community tile, combo chaining).
- [ ] 6 local commits pushed and deployed to staging.
- [ ] Staging has the `0011_ui_versions` migration applied and both rows present:

```sql
select * from public.ui_versions;   -- expect v1 default=true, v2 default=false
```

## 2. Side-by-side on staging (you)

Run both defaults against the same staging build and compare.

1. With `v1` default: open `/` — expect a redirect to `/v1/`. Smoke-test sign-in,
   a drill, recall.
2. Flip staging (SQL below), wait >30 s for the server cache, reload `/` — expect
   `/v2/`. Run the same smoke test.
3. Deep links that must keep working after the flip: `/v2/challenge/<id>` (shared
   drill links), `/v2/auth?mode=signup`, `/v2/leaderboard`, `/v2/community`.
4. Check the places V1 users have state: progress made on V1 (local storage and
   Supabase attempts) must show on V2 — both read the same `api` layer, so
   confirm streak, XP and recall items match between `/v1/` and `/v2/` for the
   same account.
5. Anything V2 lacks that V1 has (known gaps): Settings and Achievements are
   "coming soon" pages; the Pro purchase flow is not built in either version.

## 3. The flip (you)

```sql
-- production flip
update public.ui_versions set "default" = (version = 'v2');
```

Verify: `select * from public.ui_versions;` shows v2 `true`, v1 `false`.
Takes effect within ~30 s on the Node server; immediately on the next page load
for the Vercel client-side path.

**Rollback** (instant, no deploy):

```sql
update public.ui_versions set "default" = (version = 'v1');
```

Watch for the first day: sign-in success rate, OAuth errors, import failures,
and the support inbox. If anything is wrong, roll back first and debug after.

## 4. Sunset V1 (you decide the date)

**V1 sunset date: 27 October 2026.** Delete the V1 code (step 5) on or after this
date, and only if the flip has been live without needing the rollback. If the flip
slips, the date slips with it — V1 must stay available until V2 has served as the
default for the whole window.

Suggested shape (adjust to your user base): keep `/v1/` reachable but not default
for a fixed window after the flip, announce the date in-app, then delete.
Do not delete V1 until: the window has elapsed, the rollback was not needed for
that whole window, and `/v1/` traffic is negligible.

## 5. Delete V1 (code change — do after step 4)

Do this on a branch, as one reviewable PR, so it is a single revert if needed.

### Delete

| Path | Why |
| --- | --- |
| `src/App.tsx` | V1 app shell (hash-routed) |
| `src/screens/*` | `AuthScreen`, `ChallengeScreen`, `CommunityScreen`, `LeaderboardScreen`, `LibraryScreen`, `RecallDashboardScreen`, `RevealScreen` — V2 has its own pages |
| `src/components/*` and `src/components/formats/*` | Only imported by `App.tsx` and `screens/` (V2 imports nothing from here) |

### Edit

| File | Change |
| --- | --- |
| `src/AppRouter.tsx` | Drop `import App`, the `v1` choice and its branch; make `/v1/*` redirect to `/v2/`; make unknown `/v2/<path>` a V2 not-found (not V1); `fetchDefaultVersion` and the `resolving` state become a plain redirect to `/v2/` (or remove the table lookup entirely) |
| `server.ts` | Replace `redirectBaseUrl` / `resolveDefaultVersion` with a fixed `/` → `/v2/` redirect; drop the Supabase `ui_versions` client if nothing else uses it. Also fix the startup log that claims the fallback is `/v2/` (the code falls back to v1 today) |
| `src/v2/pages/Auth.tsx` | The "back to V1" link (`window.location.href = '/v1/#/'`) must go |
| `src/index.css` | Imports `theme/tokens.css` and `theme/base.css` (V1 theme); V2 uses `src/v2/theme/tokens.css`. Remove if nothing in V2 depends on the base styles — check visually before deleting |
| `README.md`, `docs/build-plan.md` | Update mentions of V1 / the version toggle |

### Check before deleting (not obviously V1-only)

- `src/lib/leads.ts`, `src/lib/incident-skin.ts`: imported only by V1 files when
  last checked. Confirm with `grep` after the V1 files are gone; remove if unused.
- `src/content/data.ts`: imported by `api.ts` — **keep** (shared seed data).
- `src/lib/*` otherwise is shared with V2 — **keep**.
- `public.ui_versions` table: leave in place until the code no longer reads it,
  then drop in a follow-up migration (`0012_drop_ui_versions.sql`).

### After deleting

```bash
npx tsc --noEmit
npm run build
```

Then repeat the staging smoke test from step 2 against the V2-only build before
deploying to production.

## Open decisions

- Sunset date (step 4).
- Whether `/v1/*` should redirect to `/v2/` forever or show a "this version has
  retired" page for a while.
- Whether to keep `ui_versions` as a general kill-switch for future redesigns
  instead of dropping it.
