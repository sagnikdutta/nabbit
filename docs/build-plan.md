# Nabbit — Technical Build Plan

> Bug-hunt drills on dev videos + spaced recall. Design = Direction B (Modern SaaS),
> kept as a swappable token layer. Companion: `user-journey.md` (AARRR experience spec).

> **Status (21 Oct):** MVP working locally. Phases 1–5 done. Shipped & verified in-browser:
> B0, B1, B2, B3 (+ the N1 fix), B4, B5 (difficulty part), B7, plus Phase 6 polish.
> Remaining buildable: B5 session-length, B6, B8 (all roadmap-tier). Operational: hosted deploy + demo recording.
> Source of truth for **progress** = **client localStorage**; **identity + leads** live in **Supabase** (see "Accounts & leads — shipped 22 Oct" below). The SPA still deploys statically; Supabase is reached with the anon key + RLS.

---

## 0. Guiding principles

1. **Design is loosely coupled** — every visual token lives in `src/theme/tokens.css`; components use `var(--token)` only. Re-skin = swap the token file.
2. **Deterministic core** — grading is `chosen === correctOption`. No sandbox, no LLM at request time.
3. **Content is data** — challenges live in `src/content/data.ts`. New content ≠ new components.
4. **One source of truth per concern** — progress in the client (`localStore` → localStorage); accounts (`auth.users` + `public.users`) and leads (`public.leads`) in Supabase. Progress is not yet synced to Supabase (Phase 7).
5. **Deploy early, stay deployable.**

---

## 1. Architecture (as built)

```
Browser (React + Vite SPA)  — source of truth
  theme/        tokens.css (Direction B) + base.css
  components/   Button, Card, Badge, CodeBlock, OptionCard, Navbar, VideoPlayer, TimeTravelBar, NameOnboarding, ConceptTimeline
  screens/      Library (landing for visitors / dashboard for members), Auth, Challenge (+ inline Reveal), RecallDashboard
  lib/          api (localStore for progress), supabase (client + user mapping), leads (trial lead capture), recall (scheduling + stats), reminders, types
  routing/      hash router in App.tsx (#/, #/challenge/:id, #/recall, #/auth) + ?dare= deep links; auth-aware (see below)
  content/      data.ts (curated videos + challenges)
Supabase — Auth + Postgres (RLS): auth.users, public.users, public.leads (+ lead_sharers view)
Express (server.ts) — OPTIONAL; serves the SPA + per-challenge OG tags. Still contains legacy mock /api/auth/* routes (unused when Supabase is configured).
```

### Routing by auth state
| State | `#/` | `#/challenge/:id` | `#/recall` | `#/auth` |
|---|---|---|---|---|
| Signed out | Landing (pitch + packs) | **Public trial** — grades locally, saves nothing, then redirects to sign-up | → Landing | Sign-up / sign-in |
| Signed in | Dashboard | Full (saved) | Yes | → Dashboard |

Tech: React 19 · Vite · TS · Tailwind v4 + CSS tokens · localStorage · Gemini (offline authoring only, **not at runtime**) · static hosting (Vercel static / Render).

---

## Phases 1–5 — DONE ✅
Scaffold · core loop · persistence + recall · library + nav · content (React + JS-async + useEffect packs).

## Accounts & leads — shipped 22 Oct ✅ *(code complete; typechecks; not all browser-verified)*
- **Supabase Auth** (email + password, phone as metadata) in `src/lib/supabase.ts` + `api.signUp/signIn/signOut`; falls back to local/mock auth when keys are missing.
- **`0001_users.sql`** — `public.users` mirrors `auth.users` via triggers (insert → row, update → email/verified flags), RLS: users read/update only their own row; backfill included. ✅ verified (registration row + login confirmed).
- **Auth-aware routing** (table above). Signed-out visitors get the landing page and public **trial** drills; finishing a trial drill → sign-up with a verdict-only banner; after sign-up they return to that drill.
- **Signed-in dashboard** — `LibraryScreen mode="dashboard"`: Today card (N due → Start review; else Continue; "Ready for your first bug hunt? → Start" at zero), 3 stats, in-progress packs first, collapsed YouTube import. Landing keeps the hero, now with **Create free account** / **Try a free bug hunt** CTAs and a **Sign up free** / Sign in navbar; the buildathon label, "YouTube URL Import Active" block and footer taglines were removed.
- **Auth polish (23 Oct):** phone is **optional**; auth errors go through `friendlyAuthError()` in `api.ts` (plain product language; raw error only in the console); no user-facing text names the auth provider.
- **Fresh start + per-account progress:** the demo seed is no longer loaded (new browsers and **Reset** start empty). `LocalStore.claimProgress()` stores a `nabbit_progress_owner_v1` key; a different account signing in on the same browser starts clean, and `App.tsx` reloads data/name when the user changes. *Browsers holding old seeded data keep it until Reset / clearing site data.*
- **Verification UI removed:** banner, "Pending" labels, amber/green dots, profile-menu item and `VerificationDrawer` are no longer rendered (code left in place: `VerificationDrawer.tsx`, `verifyContact` / `resendVerification` in `api.ts`).
- **Deployed:** Vercel (`nabbit-ten.vercel.app`) with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as Config vars; migrations `0002`/`0003` run manually; "Confirm email" off for demo users; Site URL + redirect URLs set.
- **`0002_leads.sql`** — `public.leads` (one row per visitor × challenge: visitor id, challenge id, UTM, referrer, completed/correct, converted user). No direct table access; written via `log_lead` / `complete_lead` / `claim_leads` RPCs (security definer).
- **`0003_leads_sharer_ref.sql`** — adds `sharer_ref` + new `log_lead` signature + `lead_sharers` view. Share links now carry `utm_source=share&utm_medium=bug-dare&utm_campaign=dare-<id>&ref=<sha256(user id)[:10]>`.
- ✅ `0002` and `0003` run in the nabbit Supabase project (manually). ⬜ End-to-end re-test on the live site (signup → `public.users`; trial link → `leads`) is on the owner's list.

## Recently shipped ✅ (all verified in-browser)
- **B1 — inline reveal** (`phase: answering → revealed`, same-page; separate Reveal route dropped).
- **B2 — real YouTube thumbnails** (`img.youtube.com/vi/<id>/hqdefault.jpg`; every `youtubeId` verified via oEmbed — the old useEffect id 404'd → real Web Dev Simplified video; real channels; cue timestamps clamped to runtime). Plus the returning-user progress strip (streak · due · continue).
- **B3 — local name profile** (localStorage, skippable, no login wall) — *now largely superseded: signed-in users' names come from their email and trial users aren't saved.* **N1 fix:** the prompt now appears *after the first attempt* (value before any gate), once; correct verdict personalizes to "Nice catch, {name}!".
- **B0 — one store** (localStorage is sole source of truth; `/api/*` state routes + double-write removed; `server.ts` only serves the SPA + `/api/health`).
- **B4 — shareable bug-dare** — see the backlog item below for the as-built details.
- **B5 (difficulty)** — level badge on drill chips + a difficulty filter in the Library; quick-start lands on a *winnable* (unsolved Beginner) drill. *(Session-length + adaptive still pending — see B5.)*
- **B7 — freemium + native recommendation** — see the backlog item below.
- **Hash router + shareable URLs** — `#/`, `#/challenge/:id`, `#/recall`; refresh / back-forward / deep links work.
- **"What is this?" strip** — dismissible context banner on the challenge screen for first-time / cold-dare arrivals (persisted).
- **Concept timeline** — per-video summary + ordered concepts (jump nav) on the challenge screen. Satisfies the "basic summary/timeline" free-tier promise.
- **Review reminders (client slice)** — opt-in browser notification when concepts are due on open. *(Scheduled email/push = Phase 7 / backend.)*
- **Token hygiene** — `--code-border` token added; confetti reads tokens at runtime; no raw hex/rgba in components or screens.
- **Phase 6 polish** — responsive (no overflow at 375px), accessibility pass, loading/error states, demo-reset. *(Deploy + recording remain — see Phase 6.)*

---

## Backlog — prioritized (validated against AARRR; see `user-journey.md`)

### B0 — Consolidate to one store  *(reliability)* — DONE ✅
`localStore` is the sole source of truth; the server/client double-write and the `/api/*` state routes are gone; `server.ts` only serves the SPA (+ `/api/health`). No divergence to reset.

### B4 — Shareable bug-dare  *(Referral + Acquisition — highest growth ROI)* — DONE ✅
As built (differs slightly from the original sketch):
- Share CTA on the reveal using **`navigator.share`** (native sheet on mobile) with a **copy-link** fallback — instead of per-network LinkedIn/X/WhatsApp intent buttons.
- **Deep link `?dare=<challengeId>`** (a server-readable query param, not `?c=`) opens that exact drill, then cleans to `#/challenge/:id`. Links now also carry UTM tags + the sharer `ref` (see Accounts & leads).
- Pre-written copy: *"I just caught a {concept} bug on Nabbit — can you spot it?"*.
- **Per-challenge OG**: `server.ts` injects real `<title>`/description/`og:image` (the real thumbnail) for a `?dare=` request — a real link preview, not just a static card.
- **Caveat:** OG injection needs the Node server. A pure-static host (Vercel static) serves the generic `index.html`, so per-challenge previews there would need a serverless/edge OG function. *(The share UX + deep link work everywhere.)*
- **Done:** a win shares as a dare; the link opens that challenge directly. ✅

### B5 — Difficulty + session length  *(Activation + Retention)* — PARTIAL
- ✅ `difficulty: 'Beginner' | 'Intermediate' | 'Advanced'` per challenge → badge on drill chips + a difficulty filter (hides packs with no matching drill); quick-start picks a *winnable* unsolved Beginner.
- ⬜ **Session config:** drill **3 / 5 / 10** questions (slice the list) — still pending.
- ⬜ Optional later: adaptive difficulty after a correct streak.

### B6 — Multi-domain challenge formats  *(Acquisition + Revenue — expansion)*
The judgment format generalizes to **"one artifact, one planted flaw, pick the fix."**
- **Code (React/JS/Python):** bug-hunt (current).
- **AWS / cloud:** spot-the-misconfiguration (e.g. SG `CidrIp: 0.0.0.0/0` on port 22; public S3 policy; `"Action": "*"` IAM).
- **System design:** spot-the-bottleneck / predict-failure-at-scale / which-component-is-missing / tradeoff (SQL vs NoSQL).
- **Neo4j / SQL:** spot-the-query-bug (cartesian product, wrong direction, missing index / N+1).
- **Docker / K8s:** spot-the-flaw in a Dockerfile/manifest.
- Each = one snippet with a single planted flaw + 4 options + explanation. Author a few examples per domain in `data.ts` shape. *(Roadmap for build; strong pitch/vision item.)*

### B7 — Freemium + native recommendation  *(Revenue)* — DONE ✅ *(illustrative, labeled)*
- **Free:** curated drills + recall + sharing + summary/timeline. ✅
- **Native recommendation card** at the pain moment (a miss; stronger copy once missed ≥2×): "Struggling with {concept}?" with a real **Rewatch-the-chapter** link (actual video at the timestamp) + a "Pro — coming soon" note. Native, not a banner. ✅
- ⚠️ **Mismatch:** the YouTube importer is now **live (Gemini) for every signed-in user**, not a disabled Pro teaser — decide whether it stays free or moves behind Pro. (The original teaser below describes the earlier build.)
- **Nabbit Pro preview** in the Library: a **disabled** paste-any-video input + Pro feature list (auto-gen, more formats, stacks, mastery) + a **For-teams/B2B** line. No transactions, no payment/credential capture (intentionally — demo-safe).
- Revenue ranking (unchanged): **B2B seats > premium sub > affiliate > sponsored packs.** Skip display ads.
- ⬜ Real payments, the actual Pro unlock, analytics/mastery, and B2B team view remain roadmap.

### B8 — Auto-generate from any video  *(Acquisition + Revenue — premium hook)*
Pipeline: paste URL → fetch transcript + metadata → detect concept → generate buggy snippet + options + explanation → verify. Honest limit: transcripts miss on-screen code for screencasts; fall back to concept-level predict/spot-the-flaw for arbitrary videos. *(Roadmap; the premium promise.)* **A disabled paste-URL entry already ships in the Library as the Pro teaser (B7).**

---

## Phase 7 — Accounts + Database — PARTIAL (identity + leads done; progress sync pending)

**Pick: Supabase** (Postgres + Auth + RLS), accessed from the static SPA via the **anon key + Row-Level Security** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; never the service-role key in the client).

✅ Done: Supabase Auth, `public.users`, `public.leads`, auth-aware routing (see "Accounts & leads").

⬜ Pending:
- **Progress sync:** `attempts` / `recall_items` still live only in browser localStorage → no cross-device sync (progress is isolated per account within one browser, but clearing site data loses it). Needs the **store interface** with `localStore` + `supabaseStore` adapters (`localStore` is already an abstraction).
- **Sync model (changed):** activation is no longer fully login-free — **trial drills are public but unsaved**; saving progress requires an account. Decide whether to push existing local progress up on first sign-in.
- ~~New accounts start with seeded demo progress~~ — **done** (new accounts start at zero).
- **Verification:** UI removed (see above); phone still has no SMS provider. When email confirmation is re-enabled for launch, add a "check your email" notice and a resend-confirmation button, and delete the unused verify/resend code.
- **Launch hardening:** turn "Confirm email" back on and add CAPTCHA (currently off so demo users can sign up with any real-domain address).
- **Vercel serverless:** move the Gemini importer call from `server.ts` into a Vercel function (`api/`), with `GEMINI_API_KEY` as a non-`VITE_` variable; per-challenge OG previews need an edge/serverless function too.
- **Decision:** the trial reveal gates the *explanation* behind sign-up (conflicts with "no gate before value" in `user-journey.md`) — keep or show the reveal first.
- **Remove legacy mock auth** (`/api/auth/*` in `server.ts`, demo sign-in fill) once Supabase is the only path.
- **Schema sketch:**
  - `users` (id, name, created_at) — *built as `public.users`: id, email, phone, display_name, verified flags, timestamps*
  - `attempts` (id, user_id, challenge_id, chosen, correct, at)
  - `recall_items` (id, user_id, challenge_id, concept, interval, next_review_at, last_reviewed_at)
  - (B2B) `teams`, `team_members`
  - RLS: every row scoped to `auth.uid()`.

---

## Roadmap (post-buildathon)

PR-review format → more judgment formats (predict-output, tradeoff, drag-drop flow) → auto-gen (B8) → more stacks/domains (B6) → ~~accounts + Supabase~~ (identity done) → real cross-device progress sync (Phase 7) → B2B team dashboards → mastery map + XP.

---

## Phase 6 — Demo polish

- ✅ Responsive (no body overflow at 375px on all four screens; navbar, submit bar, reveal actions, code blocks).
- ✅ Accessibility pass (`aria-current`/`aria-pressed`, labels on icon-only controls, `sr-only` state cues, global `:focus-visible`).
- ✅ Loading/error states (challenge-route loading guard; thumbnail `onError` fallback).
- ✅ Demo-reset action (Recall dashboard).
- ✅ Hosted deploy on Vercel (with the two `VITE_SUPABASE_*` vars and the SQL migrations applied). ⬜ **Remaining (operational):** a screen-recording backup of the 5-minute demo.

**Acceptance:** runs cold in incognito, on phone and laptop; every button works; demo rehearsed once.
