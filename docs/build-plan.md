# Nabbit — Technical Build Plan

> Bug-hunt drills on dev videos + spaced recall. Design = Direction B (Modern SaaS),
> kept as a swappable token layer. Companion: `user-journey.md` (AARRR experience spec).

> **Status (21 Oct):** MVP working locally. Phases 1–5 done. Shipped & verified in-browser:
> B0, B1, B2, B3 (+ the N1 fix), B4, B5 (difficulty part), B7, plus Phase 6 polish.
> Remaining buildable: B5 session-length, B6, B8 (all roadmap-tier). Operational: hosted deploy + demo recording.
> Source of truth for **progress** = **client localStorage**; **identity + leads** live in **Supabase** (see "Accounts & leads — shipped 22 Oct" below). The SPA still deploys statically; Supabase is reached with the anon key + RLS.
>
> **Status (23 Oct):** **Phase 8 — Challenge Engine v2** planned (see section below). Full build, staged v1/v2/v3. Expands today's single-verb MCQ into a 4-pillar engine (more formats, confidence × speed × Elo × streaks, Daily Drill + distribution + shareable grid, Pro-gated hard modes). Pulls Phase 7 progress sync forward. Decisions locked: additive `Challenge` type + Gemini offline backfill; Supabase tables now; Pro = Boss drills + Seasons/ranked ladder + Impostor + Red herring.
>
> **Status (23 Oct, later):** **Phase 8 v1 shipped locally** (commits `982b463` v1a + `e131a6b` v1b + `827e85d` v1c + v1d finishing touches; unpushed). All ten v1 bullets done; browser-verified end-to-end on `react-state-batching` (Spot-fix, Locate-then-fix, Rank-fixes); **50 tests pass** (`npm test`); typecheck clean (`npm run lint`). Every curated drill now plays all three v1 formats — `rankedFixes` placeholders authored via `npm run backfill -- --defaults --with-rankings` (quality upgrade: `--gemini`). Passive weekly streak freeze shipped (`src/lib/streak-freeze.ts`), consumed in `recordAttempt`, surfaced silently by `computeStats`. **v2 and v3 remain** — backend go-live (migrations `0004`–`0008`, SupabaseStore, Daily Drill, per-concept Elo, Blind-fix) then Pro + narrative (Diff-review, Impostor, Red-herring, prod-incident skin, Boss drills, Seasons, community drafts).
>
> **Status (24 Oct):** **Phase 8 v2 shipped locally** across commits `f2835e9` (v2a — migrations 0004–0008 + RPCs) · `d5537ec` (v2b — SupabaseStore + routing + merge flow) · `65a454f` (v2c — Daily Drill card, mastery list, Elo delta chip on Reveal, ShareGrid Elo row) · `9f41823` (v2d — BlindFixPanel + Levenshtein, Pro-gated Boss drill card + Seasons leaderboard) · v2e (Edge Function + Gemini pass #2 + build-plan). Browser-verified end-to-end against the live nabbit Supabase project: `apply_attempt` returned `newRating: 1223` / `eloDelta: +11` / `globalStreak: 3`; data landed in `attempts`, `concept_elo`, `streaks`, `recall_items`; Reveal shows Rating chip + ShareGrid Elo row; Boss + Leaderboard surfaces render the lock badge for the current non-Pro `tester@example.com`; Blind-fix on `effect-missing-cleanup` scored `+353`. **64 tests pass**. Pulled v3's Boss-drill and Seasons UI shells forward (the gate itself is what proves the Pro surface). **v3 remains** — Diff-review, Impostor + Red-herring (Pro), prod-incident skin, community drafts (migration 0009 + queue + auto-publish), Gemini pass #3 (human-reviewed Impostor/Red-herring content).

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

## Phase 8 — Challenge Engine v2 ("make it addictive") — v1 SHIPPED LOCALLY; v2/v3 PLANNED

> **Status (23 Oct):** planned, not yet in flight. Expands the current single-verb MCQ ("spot the flaw → pick the fix") into a 4-pillar engine: more interaction formats, a real progression loop (confidence × speed × per-concept Elo × streaks × combos), a social surface (Daily Drill with distribution reveal, Wordle-grid share card, user-authored community drills), and sharper framing on hard drills ("prod incident" skin, Boss drills). Pulls Phase 7 progress sync forward.
>
> **Status (23 Oct, later):** v1 complete on `main` in commits `982b463` / `e131a6b` / `827e85d` (unpushed). Browser-verified: Locate-then-fix on `react-state-batching` graded `Score: +235` (Base 100 × conf 2 × speed 1.07 × combo 1.1); Rank-fixes with canonical order graded `+322` and rendered 🟩🟩🟩🟩 share tiles + 42/18/22/18 Autopsy distribution. `npm test` → 35 pass. v2 and v3 remain.

### Why
Today's engine has **one axis** — correctness, 4 options, one verb. The content asset we already own (`Challenge`: one artifact + one planted flaw + fix options + explanation) generalizes to many more verbs and a richer feedback loop *without* re-authoring the library. User feedback: "the challenge engine is quite weak and one-dimensional in my opinion. Only 4–5 questions."

### Decisions locked (23 Oct)
- **Scope** = full build, staged v1 → v2 → v3. All 4 pillars planned in depth; nothing dropped.
- **Content strategy** = extend `Challenge` additively with optional per-format fields; **Gemini offline backfill** fills those fields over the existing curated library. No reauthoring from zero. Deterministic-core principle (no LLM at request time) stays intact.
- **Backend** = Supabase, now. New tables + RLS + RPCs for Daily Drill, Elo, Seasons, Boss drills, Streaks. Progress sync (Phase 7 `attempts` + `recall_items`) pulled forward in the same migration batch — Daily Drill + cross-device Elo would be lonely without it.
- **Pro gating** = **Boss drills, Seasons/ranked ladder, Impostor rounds, Red herring** are Pro. Everything else (new formats, Daily Drill, Elo, streaks, confidence × speed, shareable grid, autopsy, user-authored drills) stays free.

### Non-goals
- Real-money ladders or tournaments.
- Chat / DMs between users (comments on drills are moderated, flat).
- Reactive LLM grading at request time.
- Replacing the SRS schedule in `src/lib/recall.ts`. Elo and SRS co-exist: **SRS = "when to review"**, **Elo = "how strong you are on this concept"**. Confidence affects *score* only, not Elo or SRS, to keep the learning signal honest.

---

### Pillar 1 — Interaction variety (new verbs on the same drill)

Current verb: pick 1 of 4 fixes. New verbs below. Each new format is an **optional capability** on an existing `Challenge`; a drill becomes playable in format X only when the required field is present.

| Format                | Required new field(s) on `Challenge`                                   | Gating | Target version |
|-----------------------|------------------------------------------------------------------------|--------|----------------|
| Spot-fix (today)      | `buggyLines`, `fixOptions`, `correctOption`                            | Free   | shipped        |
| **Locate-then-fix**   | `buggyLineAnswer: number` (canonical bug line; one of `buggyLines`)    | Free   | v1             |
| **Rank-fixes**        | `rankedFixes: number[]` (indices of `fixOptions`, worst → best)        | Free   | v1             |
| **Blind fix**         | `canonicalPatch: { oldLines: number[]; newText: string }`              | Free   | v2             |
| **Diff review**       | `diffHunks: Hunk[]` + `reviewVerdict: 'approve'\|'request-changes'\|'comment'` | Free | v3     |
| **Impostor**          | `impostorOption: string` (LLM-generated 5th option, subtly wrong)      | Pro    | v3             |
| **Red herring**       | `secondFlaw: { line: number; label: string }`                          | Pro    | v3             |

**Type extension** — `src/lib/types.ts`:
```ts
export type ChallengeFormat =
  | 'spot-fix'
  | 'locate-then-fix'
  | 'rank-fixes'
  | 'blind-fix'
  | 'diff-review'
  | 'impostor'
  | 'red-herring';

export interface Hunk {
  file: string;
  startLine: number;
  oldLines: string[];
  newLines: string[];
}

export interface Challenge {
  // ...existing fields unchanged...

  // v1 additions (optional — drill is only playable in a format when its field is present):
  buggyLineAnswer?: number;        // locate-then-fix
  rankedFixes?: number[];          // rank-fixes

  // v2 additions:
  canonicalPatch?: { oldLines: number[]; newText: string };

  // v3 additions:
  diffHunks?: Hunk[];
  reviewVerdict?: 'approve' | 'request-changes' | 'comment';
  impostorOption?: string;         // Pro
  secondFlaw?: { line: number; label: string };  // Pro

  // Derived at load time from field presence; also author-overridable:
  availableFormats?: ChallengeFormat[];

  // Seeded distribution (used by Autopsy until v2 real data lands):
  seedDistribution?: number[];     // length = fixOptions.length, sums to 1
}
```

**Attempt input** (new discriminated union, `src/lib/types.ts`):
```ts
export type AttemptInput =
  | { format: 'spot-fix';         chosen: number }
  | { format: 'locate-then-fix';  line: number; chosen: number }
  | { format: 'rank-fixes';       order: number[] }
  | { format: 'blind-fix';        patch: string }
  | { format: 'diff-review';      verdict: 'approve' | 'request-changes' | 'comment'; chosen?: number }
  | { format: 'impostor';         chosen: number }
  | { format: 'red-herring';      chosenLine: number; chosen: number };
```

**Grading** — new pure module `src/lib/grading.ts`, called from `LocalStore.recordAttempt` and from the server-side `apply_attempt` RPC (via a tiny JS runtime in Supabase Edge, or re-implemented in SQL for simple formats):
- `spot-fix`: `input.chosen === challenge.correctOption` (today).
- `locate-then-fix`: both `input.line === challenge.buggyLineAnswer` AND `input.chosen === challenge.correctOption`. Partial credit (0.5) if the line is right but the fix is wrong — passes to SRS as "half success" (streak preserved, interval doesn't advance).
- `rank-fixes`: Kendall-tau distance between `input.order` and `challenge.rankedFixes`; ≥ 0.8 counts as correct for SRS, score scales linearly.
- `blind-fix`: normalize whitespace + trailing punctuation; Levenshtein ratio ≥ 0.9 against `challenge.canonicalPatch.newText` → correct.
- `diff-review`: `input.verdict === challenge.reviewVerdict`; if the verdict is `request-changes`, also require `input.chosen === challenge.correctOption`.
- `impostor`: planted bug is a decoy; the correct answer is the index of the fix whose text equals `challenge.impostorOption`.
- `red-herring`: `challenge.secondFlaw.line` is a decoy; grade as locate-then-fix on `buggyLineAnswer`.

All grading remains deterministic and client-runnable.

**Component changes** (`src/screens/ChallengeScreen.tsx`):
- Replace the current fixed MCQ pane with a **format router**. The right column renders one of:
  - `src/components/formats/SpotFixPanel.tsx` (extracted from today's `ChallengeScreen` body)
  - `src/components/formats/LocateThenFixPanel.tsx` *(v1)*
  - `src/components/formats/RankFixesPanel.tsx` *(v1)*
  - `src/components/formats/BlindFixPanel.tsx` *(v2)*
  - `src/components/formats/DiffReviewPanel.tsx` *(v3)*
  - `src/components/formats/ImpostorPanel.tsx` *(v3)*
  - (red-herring reuses `LocateThenFixPanel` with a `distractorMode` prop)
- A **format chooser** pill group above the right column, showing only formats whose required fields are present and (for Pro formats) only when the user is Pro — otherwise shown with a lock badge that opens the existing B7 Pro teaser. Keyboard `F` cycles.
- `onSubmitAttempt` prop widens from `(chosen: number)` → `(input: AttemptInput)`.
- `src/screens/RevealScreen.tsx` — reveal pane learns to render per-format feedback (correct line, correct order, correct patch diff, etc.), and gains the score + combo + Elo-delta chips and the Autopsy distribution bar.

---

### Pillar 2 — Progression loop (make every answer have a story)

**Mechanics** (free except where noted):
- **Confidence × speed scoring.** Before submit, user picks 🤔 Guess (×1) / 😎 Sure (×1.5) / 🔥 Certain (×2). Score formula:
  `score = base × confidence × speedFactor × comboMultiplier`
  where `speedFactor = clamp(1 + (medianTimeMs − timeMs) / medianTimeMs, 0.5, 2)` and `base = 100` for correct, `−40` for wrong. Wrong + 🔥 doubles the loss. Shown on reveal with a short breakdown.
- **Streaks.** Already computed in `recall.ts` (`currentStreak`); surface it as a 🔥 flame + count in the `Navbar`. Add a soft **streak freeze** (one miss protected per calendar week, auto-applied so people don't speed-click).
- **Combos.** Chain of correct answers within one session (library browse or Daily Drill run): `comboMultiplier = min(1 + 0.1 × combo, 2)`. Visible in `RevealScreen` as "Combo ×1.4 (4 in a row)".
- **Per-concept Elo.** Each `concept` string gets its own rating.
  - Start: 1200. K-factor: 32 for the user's first 10 games on that concept, then 16.
  - Opponent rating = the drill's effective difficulty: `Beginner → 1100`, `Intermediate → 1400`, `Advanced → 1700` (overridable per-drill via a new optional `baseRating?: number` field).
  - Outcome in {0, 0.5, 1} — 0.5 for the partial-credit cases above.
  - Elo delta computed on every attempt. Confidence does **not** affect Elo.
  - Visible on `RecallDashboardScreen` as a sortable mastery list; inline on each drill after submit ("Your rating: 1420 → 1428 ↑8"); inline bucket badge (Silver/Gold/Platinum/Diamond) earned at the thresholds below.
- **Seasons** *(Pro — placement is Pro, badge is visible to all)*. 6-week ladders, Elo-based placement at season end: top 25% / 50% / 75% / rest → **Diamond / Platinum / Gold / Silver**. Public leaderboard page gated to Pro. Season rollover applies a soft reset: `newRating = 1200 + (oldRating − 1200) × 0.6`.
- **Boss drills** *(Pro)*. Weekly. Server picks the user's 3 weakest concepts (lowest Elo, tie-broken by oldest overdue in SRS), bundles 5 drills across them in the hardest format each supports (prefer Impostor, else Locate-then-fix, else Spot-fix), no hints, 10-minute wall-clock. One attempt per week. "This week's boss" card on `LibraryScreen` with countdown.

**Type additions** — `src/lib/types.ts`:
```ts
export type Confidence = 'guess' | 'sure' | 'certain';  // ×1 / ×1.5 / ×2

export interface Attempt {
  challengeId: string;
  chosen: number;
  correct: boolean;
  at: number;
  // v2 additions:
  format: ChallengeFormat;
  confidence: Confidence;
  timeMs: number;
  score: number;         // after all multipliers
  comboAtTime: number;
}

export interface ConceptElo {
  concept: string;
  rating: number;        // starts 1200
  games: number;
  updatedAt: number;
  seasonId?: string;
}

export type EloBucket = 'Diamond' | 'Platinum' | 'Gold' | 'Silver';

export interface SeasonPlacement {
  seasonId: string;
  startRating: number;
  endRating: number;
  bucket: EloBucket;
}
```

**Elo math** — new `src/lib/elo.ts`:
```ts
export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}
export function updateRating(ra: number, rb: number, outcome: 0 | 0.5 | 1, k: number): number {
  return Math.round(ra + k * (outcome - expectedScore(ra, rb)));
}
export function kFactor(games: number): 32 | 16 {
  return games < 10 ? 32 : 16;
}
```

---

### Pillar 3 — Social / viral

- **Daily Drill.** One global drill per day, same for everyone, picked by a cron (or an owner-only admin UI) at least a week ahead. After submit, show the **distribution** of what others picked across the four fix options plus the global solve-rate ("61% picked B — you picked C — correct was A · 1,842 others played today"). One attempt per user per day.
- **Shareable Wordle-grid card.** On reveal, generate a 3-row grid:
  - Row 1 — today's drill: 4 tiles, one per fix option, filled left-to-right in rank order from the global distribution. 🟩 = the one the user picked AND it was correct; 🟢 = correct option (not picked by user); 🟨 = user's wrong pick that still had the right *line* (locate-then-fix / red-herring); 🟥 = all other wrong picks.
  - Row 2 — streak: `🔥×N` glyphs for current streak.
  - Row 3 — Elo delta: `↑+8  ⚛️React Hooks  1420→1428` (one row per concept touched this session, up to 3).
  Shares as text + the existing `?dare=` deep link (reuses B4 plumbing, no new infra).
- **Autopsy.** On reveal, show a horizontal distribution bar across the 4 fix options with counts and the top-voted comment on each distractor ("I nearly picked C because of…"). Comments are flat, moderated (community flag + Pro users = pre-filtered). Comment schema sketched in the backend section; shipping the comment write path is v3.
- **User-authored drills** *(v3, free)*. Paste YouTube URL + planted-flaw concept → Gemini generates a draft `Challenge` (`buggyCode`, 4 fix options, `correctOption`, `explanation`) → user approves → row written to `community_drafts` → surfaces in a community queue → auto-published to the live library once it hits N upvotes (threshold scales with the submitter's Elo). Replaces the current disabled Pro teaser for pasted-URL in a free, slower, moderated path. B8 (full auto-gen for arbitrary videos) remains Pro.

---

### Pillar 4 — Framing / stakes

Not new mechanics — a **visual skin** that lights up above a difficulty/Elo threshold. Deterministic. No logic change.

- **"Prod incident" skin** on hard drills. The drill chrome swaps to a dark incident-report theme (`--incident-*` tokens in `src/theme/tokens.css`), the Concept Spotlight card is reframed as "**Postmortem** — this shipped. 03:14 UTC. Here's what the dashboard looked like." The hint drawer becomes "Rollback candidate".
  - Applied when `difficulty === 'Advanced'` **OR** the user's rating on `challenge.concept` is ≥ 1500.
  - Opt-out toggle in the profile menu for users who dislike the vibe.
- **Boss drill framing** *(Pro)* — the entry card on `LibraryScreen` and the drill container itself inherit the same skin (see Pillar 2).

---

### Backend — Supabase schema (v2)

New migrations, slotted after `0003_leads_sharer_ref.sql`:

**`0004_progress_sync_and_pro.sql`** — pulls Phase 7 forward and adds the Pro flag.
```sql
-- Pro flag on existing public.users
alter table public.users add column if not exists is_pro boolean not null default false;

create table public.attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  challenge_id  text not null,
  format        text not null,
  chosen        int,
  correct       boolean not null,
  confidence    text not null check (confidence in ('guess','sure','certain')),
  time_ms       int not null,
  score         numeric not null,
  payload       jsonb,            -- format-specific extras (ranked order, patch text, …)
  at            timestamptz not null default now()
);
create index on public.attempts (user_id, at desc);
alter table public.attempts enable row level security;
create policy "own attempts rw" on public.attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.recall_items (
  user_id          uuid not null references auth.users(id) on delete cascade,
  challenge_id     text not null,
  concept          text not null,
  video_id         text not null,
  interval_days    int not null,
  next_review_at   timestamptz not null,
  last_reviewed_at timestamptz not null,
  streak           int not null default 0,
  primary key (user_id, challenge_id)
);
alter table public.recall_items enable row level security;
create policy "own recall rw" on public.recall_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**`0005_elo.sql`**
```sql
create table public.concept_elo (
  user_id    uuid not null references auth.users(id) on delete cascade,
  concept    text not null,
  rating     int not null default 1200,
  games      int not null default 0,
  updated_at timestamptz not null default now(),
  season_id  text,
  primary key (user_id, concept)
);
alter table public.concept_elo enable row level security;
create policy "own elo rw" on public.concept_elo
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**`0006_daily_drill.sql`**
```sql
create table public.daily_drill (
  for_date     date primary key,
  challenge_id text not null,
  created_at   timestamptz not null default now()
);
alter table public.daily_drill enable row level security;
create policy "read daily" on public.daily_drill for select using (true);

create table public.daily_pick (
  user_id    uuid not null references auth.users(id) on delete cascade,
  for_date   date not null references public.daily_drill(for_date),
  chosen     int not null,
  confidence text not null,
  time_ms    int not null,
  correct    boolean not null,
  at         timestamptz not null default now(),
  primary key (user_id, for_date)
);
alter table public.daily_pick enable row level security;
create policy "own pick insert" on public.daily_pick for insert with check (auth.uid() = user_id);
create policy "read own picks"   on public.daily_pick for select using (auth.uid() = user_id);
-- aggregate distribution is served via the submit_daily_pick RPC, not direct reads
```

**`0007_seasons.sql`**
```sql
create table public.seasons (
  id         text primary key,
  name       text not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null
);
alter table public.seasons enable row level security;
create policy "read seasons" on public.seasons for select using (true);

create table public.season_placement (
  user_id      uuid not null references auth.users(id) on delete cascade,
  season_id    text not null references public.seasons(id),
  start_rating int not null,
  end_rating   int not null,
  bucket       text not null check (bucket in ('Diamond','Platinum','Gold','Silver')),
  primary key (user_id, season_id)
);
alter table public.season_placement enable row level security;
create policy "read placements"    on public.season_placement for select using (true);
create policy "own placement rw"   on public.season_placement
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**`0008_streaks_and_boss.sql`**
```sql
create table public.streaks (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  current    int not null default 0,
  best       int not null default 0,
  freezes    int not null default 1,
  last_day   date,
  updated_at timestamptz not null default now()
);
alter table public.streaks enable row level security;
create policy "own streaks rw" on public.streaks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.boss_drills (
  user_id       uuid not null references auth.users(id) on delete cascade,
  week_start    date not null,
  challenge_ids text[] not null,
  completed_at  timestamptz,
  score         numeric,
  primary key (user_id, week_start)
);
alter table public.boss_drills enable row level security;
create policy "own boss rw" on public.boss_drills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**`0009_community_drafts.sql`** *(v3)*
```sql
create table public.community_drafts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references auth.users(id) on delete cascade,
  draft        jsonb not null,     -- a Challenge-shaped payload
  upvotes      int not null default 0,
  status       text not null default 'queued' check (status in ('queued','published','rejected')),
  created_at   timestamptz not null default now(),
  published_at timestamptz
);
alter table public.community_drafts enable row level security;
create policy "read queue"   on public.community_drafts for select using (true);
create policy "author write" on public.community_drafts
  for insert with check (auth.uid() = author_id);
```

**RPCs** (`security definer`; validate `auth.uid()` inside each):
- `submit_daily_pick(for_date date, chosen int, confidence text, time_ms int)` — inserts into `daily_pick` (unique per user+date; raises on retry) and returns `{ counts: int[], solved_rate: numeric, total_picks: int }` for the running distribution.
- `get_daily_drill(for_date date)` → `{ challenge_id: text, user_pick: jsonb | null }`.
- `apply_attempt(payload jsonb)` → writes to `attempts`, updates `recall_items` (SRS schedule), updates `concept_elo` (Elo delta), updates `streaks`. Returns `{ attempt_id, correct, score, new_rating, delta, next_review_at }`. **All grading in SQL where possible** (spot-fix, impostor, locate-then-fix) and in Supabase Edge for the fuzzy ones (blind-fix Levenshtein).
- `merge_local_progress(payload jsonb)` — one-shot: migrates a signed-in user's existing local attempts + recall items into the server tables on first sync. Idempotent (dedup on `(user_id, challenge_id, at)`).
- `generate_boss_drill(user_id uuid)` → selects 3 weakest concepts (lowest `concept_elo.rating`, tie-break on oldest `recall_items.next_review_at`), picks 5 drills, writes `boss_drills` row, returns it. Rejects callers whose `public.users.is_pro = false`.
- `season_leaderboard(season_id text, limit int)` — top N users with their `end_rating` + `display_name`. Pro-only (checks `public.users.is_pro`).
- `submit_community_draft(draft jsonb)` → inserts into `community_drafts` with `author_id = auth.uid()`; returns the row id.

**Client store refactor** (`src/lib/store.ts`, new):
```ts
export interface Store {
  getAttempts(): Promise<Attempt[]>;
  getRecallItems(): Promise<RecallItem[]>;
  getConceptElo(): Promise<ConceptElo[]>;
  applyAttempt(input: AttemptInput, challenge: Challenge): Promise<ApplyAttemptResult>;
  // …plus daily-drill, streaks, boss, seasons…
}
```
Two adapters: `LocalStore` (today's class, kept for anonymous trial + offline) and `SupabaseStore` (wraps the RPCs). `api.ts` picks the adapter per call based on `isSupabaseConfigured() && currentUser`. Writes go through `SupabaseStore` and are mirrored into `LocalStore` as a read-through cache + offline queue (flushed on reconnect). Screens are unchanged.

---

### Content ops — Gemini backfill

One-off Node script `scripts/backfill-challenge-fields.ts` (offline, uses `GEMINI_API_KEY` from `.env`, NOT at request time). Runs over every challenge in `src/content/data.ts`:

| Pass | Fields written                                                                 | Blocking           |
|------|---------------------------------------------------------------------------------|--------------------|
| 1    | `buggyLineAnswer`, `rankedFixes`, `availableFormats`, `seedDistribution`        | v1                 |
| 2    | `canonicalPatch`, `diffHunks`                                                   | v2 (blind-fix) / v3 (diff-review) |
| 3    | `impostorOption`, `secondFlaw` (Pro only; **mandatory human review per drill**) | v3                 |

Each pass writes back to `src/content/data.ts` via a code-mod (ts-morph). Validation: a Vitest suite round-trips every challenge through `grade()` for every format in its `availableFormats` and asserts the canonical answer grades correct.

---

### Staged rollout

**v1 — "A second verb"** (pure client; demo-friendly; no new backend) — SHIPPED ✅
- [x] Extend `Challenge` type with v1 fields; `AttemptInput` discriminated union; `src/lib/grading.ts`.
- [x] Extract today's MCQ into `SpotFixPanel`; add `LocateThenFixPanel`, `RankFixesPanel`.
- [x] Format chooser pill group on `ChallengeScreen` (keyboard `F` cycles).
- [x] Confidence picker (🤔/😎/🔥) in the submission bar + score + breakdown shown on `RevealScreen`.
- [x] Session combo counter + multiplier shown on reveal (combo chip appears from ≥ 2 in a row).
- [x] Streak flame in `Navbar` — was already present (`src/components/Navbar.tsx:118`); passive weekly freeze implemented client-side in `src/lib/streak-freeze.ts` (one wrong per ISO-week absorbed, chronologically-first, silently — matches plan's "passive"). Server-side carry lands with v2's `streaks` table.
- [x] `src/components/ShareGrid.tsx` — Wordle-grid share card on reveal; reuses B4's `navigator.share` + copy-link fallback. Elo-delta row deferred to v2.
- [x] Autopsy section on reveal powered by `challenge.seedDistribution` (swapped for real in v2).
- [x] Gemini backfill pass #1 over the curated library — ships as `scripts/backfill-challenge-fields.ts` with `--defaults` and `--gemini` modes. Runtime `src/content/normalize.ts` fills missing fields at load time; defaults mode has been run on all 9 unseeded drills.
- [x] Vitest-style round-trip suite for grading — `src/lib/grading.test.ts` via `node:test` + `tsx` (chose this over installing vitest to avoid a new devDep). 50 tests passing: every curated drill × every advertised format, Kendall-tau, score formula, speedFactor clamp, confidence multiplier, locate-then-fix partial credit, weekly streak freeze (ISO-week math, absorption, cross-week reset), and "every drill plays all three formats".

**Acceptance**: every curated drill plays in all three v1 formats ✅ (Spot-fix + Locate-then-fix on every drill via `normalize.ts` + backfill `--defaults`; Rank-fixes on every drill via backfill `--with-rankings` placeholder — `react-state-batching` was hand-authored, the rest are heuristic placeholders meant to be upgraded by `--gemini`); reveal shows score + combo + grid card ✅; share grid copies the correct glyph string ✅; `npm run lint` passes ✅; `npm test` → 50/50 ✅; the challenge screen holds 375 px wide ✅ (same pre-existing 5px body overflow as before this phase).

**v2 — "Everyone's playing"** (backend go-live; progress sync; Daily Drill; Elo) — SHIPPED ✅
- [x] Migrations `0004`–`0008` applied — user ran them in the live nabbit Supabase project; files live at `supabase/migrations/0004_progress_sync_and_pro.sql` through `0008_streaks_and_boss.sql`. Idempotent (drop-then-create for apply_attempt as its signature evolves across migrations).
- [x] `SupabaseStore` adapter + `api.ts` routing; `apply_attempt` RPC used on every signed-in submit. Anonymous trial stays on LocalStore.
- [x] First-sign-in flow: `api.mergeLocalProgressIntoSupabase()` runs on auth-form success and on restored sessions; `merge_local_progress` RPC dedupes server-side on `(user_id, challenge_id, at)`; one-time local flag per user per browser.
- [x] Daily Drill card on `LibraryScreen` (`DailyDrillCard.tsx`); `submit_daily_pick` + `get_daily_distribution` RPCs. Card hides when no row seeded for today — owner inserts via SQL editor (helper comment at top of the component).
- [x] Per-concept Elo visible: `MasteryList.tsx` on `RecallDashboardScreen` (buckets: Diamond ≥ 1700, Platinum ≥ 1500, Gold ≥ 1300, else Silver); inline "1200 → 1212 ↑+12" chip on `RevealScreen`.
- [x] Shareable grid upgraded with Elo delta row and uses server-authoritative `globalStreak` for the flame row. Real daily distribution flows into Autopsy when the drill is today's Daily Drill (plumbing in place; full switch is a one-line follow-up when Daily seeds are routine).
- [x] Daily reminders Edge Function at `supabase/functions/daily-reminders/index.ts`. Queries overdue `recall_items` on cron and emits a per-user summary. Delivery (push / email) is a `DELIVERY_PLACEHOLDER` — wire your provider there; a `reminder_log(user_id, for_date)` dedupe table lands with the first provider.
- [x] `BlindFixPanel.tsx` + Levenshtein grader in `grading.ts` (whitespace-normalised similarity: ≥ 0.9 full-correct, ≥ 0.7 partial). Lights up on every drill via `normalize.ts` fallback (`canonicalPatch` defaults to `correctCode`).
- [x] Gemini backfill pass #2 — `scripts/backfill-challenge-fields.ts` now authors `canonicalPatch` on `--gemini` and `--with-patches` (defaults mode writes the normalize-equivalent fallback to disk for reviewability).

**Acceptance**: Daily Drill writes to prod ✅ (RPCs live); two separate accounts in different browsers see each other's picks in the distribution ⬜ (plumbing works end-to-end but hasn't been multi-browser demo'd — depends on `daily_drill` rows being seeded); concept Elo persists across devices ✅ (verified end-to-end on `tester@example.com`); local-only trial still works for anonymous users ✅ (routing branches on `useSupabase()`).

**v3 — "Depth and heat"** (Pro formats + narrative + community)
- [ ] `DiffReviewPanel` (free).
- [ ] `ImpostorPanel` + red-herring mode on `LocateThenFixPanel`, **Pro-gated** with lock badge + CTA into the B7 Pro teaser.
- [ ] Prod-incident skin — `--incident-*` tokens in `src/theme/tokens.css`; auto-applied at `difficulty === 'Advanced' || userElo >= 1500`; profile toggle.
- [~] Boss drills (Pro) — **UI shell + RPC pulled into v2d.** `BossDrillCard` on `LibraryScreen` with Pro gate (lock badge + "Unlock with Pro" CTA for non-Pro; Pro users call `generate_boss_drill` RPC). What remains for v3: feed completion back into `apply_attempt` with a `is_boss` flag so the week's completion shows a "Boss cleared" state; a dedicated multi-drill boss flow instead of launching the first candidate.
- [~] Seasons (Pro) — **UI shell + RPC pulled into v2d.** `#/leaderboard` page renders `season_leaderboard` for Pro users and the locked state otherwise. `close_season(ending, next)` admin helper applies percentile buckets + soft Elo reset (newRating = 1200 + (old − 1200) × 0.6). What remains for v3: season banner on Library (countdown + current + target bucket); the end-of-season rollover job on cron (currently manual via SQL editor); seeding at least two placements so leaderboard isn't empty.
- [ ] User-authored drills (free queue) — migration `0009`; paste-URL in Library writes to `community_drafts`; `#/community` moderation queue; auto-publish ≥ N upvotes.
- [ ] Gemini backfill pass #3 — fills `impostorOption` + `secondFlaw`; **every row human-reviewed before the Pro formats light up on it**.

**Acceptance**: Pro gate works end-to-end (badge on gated items + Pro CTA opens the existing B7 teaser); Boss drill delivers 5 drills from the user's weakest concepts within one week-boundary; season leaderboard shows ≥ 2 bucketed users in staging; prod-incident skin fires on at least one real Advanced drill.

---

### Risks & mitigations
- **Content divergence between formats** — single `Challenge` type with field-presence derivation; CI round-trips every drill through `grade()` for each declared format.
- **Daily Drill answer leaks on Discord/Reddit** — expected and fine; the distribution reveal is social proof, not a secret. Rotate every 24 h; don't block, don't rate-limit.
- **Elo cold-start variance** — K=32 for the first 10 concept-games, then 16. Opponent rating uses the drill's declared difficulty, not peer rating; that stabilizes early games.
- **Over-gamification diluting the learning signal** — confidence affects *score* only (never Elo or SRS); streak freezes are soft so people don't speed-click to protect them; Boss drills still write to SRS.
- **RLS surface area** — all writes go through RPCs (`apply_attempt`, `submit_daily_pick`, `merge_local_progress`, `submit_community_draft`); clients never `insert` into `attempts` / `recall_items` / `concept_elo` directly.
- **Supabase cost at scale** — each submit = one RPC + bounded writes; distribution reveal reads an aggregate inside the RPC. If reads balloon, materialize `daily_pick_distribution` on an hourly cron.
- **Impostor / red-herring content quality** — the Pro value prop; strictly human-reviewed. Pro formats stay dark on a drill until its impostor/decoy row is approved.

### Dependencies / sequencing
1. Phase 7 progress sync is a **soft prerequisite** for v2 — we're pulling it forward in `0004_progress_sync_and_pro.sql`.
2. v1 lands fully behind the existing auth and store; no new tables, zero infra change beyond typecheck.
3. The Pro flag (`public.users.is_pro`) is added in `0004` even though it's only lit up in v3, to avoid a late migration.
4. v3 Pro formats cannot light up on a drill until Gemini backfill pass #3 has been human-reviewed for that drill.

### Open questions (deferred — don't block v1)
- **Pricing/payment** for Pro — Boss + Seasons + Impostor + Red herring are gated now; the actual Stripe-or-equivalent flow stays Roadmap. For buildathon demo, flip `is_pro` manually via SQL.
- **Daily Drill selection**: cron vs. owner-only admin UI vs. community vote. v2 ships with a hand-picked week-ahead schedule; revisit at v3.
- **Comments on drills** (Autopsy user comments beyond the seeded ones): schema and moderation path TBD in v3.
- **Reactive LLM for user-authored draft generation** at paste-URL time — fine as *author-time* for the submitter; still off the request path for solvers.

---

## Roadmap (post-buildathon)

PR-review format → more judgment formats (predict-output, tradeoff, drag-drop flow) → auto-gen (B8) → more stacks/domains (B6) → ~~accounts + Supabase~~ (identity done) → real cross-device progress sync (Phase 7, pulled forward by Phase 8 v2) → **Phase 8 v2/v3 (challenge-engine addictive mechanics)** → B2B team dashboards → mastery map + XP (now partially covered by per-concept Elo).

---

## Phase 6 — Demo polish

- ✅ Responsive (no body overflow at 375px on all four screens; navbar, submit bar, reveal actions, code blocks).
- ✅ Accessibility pass (`aria-current`/`aria-pressed`, labels on icon-only controls, `sr-only` state cues, global `:focus-visible`).
- ✅ Loading/error states (challenge-route loading guard; thumbnail `onError` fallback).
- ✅ Demo-reset action (Recall dashboard).
- ✅ Hosted deploy on Vercel (with the two `VITE_SUPABASE_*` vars and the SQL migrations applied). ⬜ **Remaining (operational):** a screen-recording backup of the 5-minute demo.

**Acceptance:** runs cold in incognito, on phone and laptop; every button works; demo rehearsed once.
