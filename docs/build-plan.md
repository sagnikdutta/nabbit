# Nabbit — Technical Build Plan

> Bug-hunt drills on dev videos + spaced recall. Design = Direction B (Modern SaaS),
> kept as a swappable token layer. Companion: `user-journey.md` (AARRR experience spec).

> **Status (21 Oct):** MVP working locally. Phases 1–5 done. Shipped & verified in-browser:
> B0, B1, B2, B3 (+ the N1 fix), B4, B5 (difficulty part), B7, plus Phase 6 polish.
> Remaining buildable: B5 session-length, B6, B8 (all roadmap-tier). Operational: hosted deploy + demo recording.
> Source of truth = **client localStorage**; deploys as a **static SPA** (no DB required yet).

---

## 0. Guiding principles

1. **Design is loosely coupled** — every visual token lives in `src/theme/tokens.css`; components use `var(--token)` only. Re-skin = swap the token file.
2. **Deterministic core** — grading is `chosen === correctOption`. No sandbox, no LLM at request time.
3. **Content is data** — challenges live in `src/content/data.ts`. New content ≠ new components.
4. **One source of truth** — progress in the client (`localStore` → localStorage). Static SPA, no backend state to reset.
5. **Deploy early, stay deployable.**

---

## 1. Architecture (as built)

```
Browser (React + Vite SPA)  — source of truth
  theme/        tokens.css (Direction B) + base.css
  components/   Button, Card, Badge, CodeBlock, OptionCard, Navbar, VideoPlayer, TimeTravelBar, NameOnboarding, ConceptTimeline
  screens/      Library, Challenge (+ inline Reveal), RecallDashboard
  lib/          api (localStore, single source of truth), recall (scheduling + stats), reminders, types
  routing/      hash router in App.tsx (#/, #/challenge/:id, #/recall) + ?dare= deep links
  content/      data.ts (curated videos + challenges)
Express (server.ts) — OPTIONAL; mirrors logic, serves the SPA. Not required for state (see B0).
```

Tech: React 19 · Vite · TS · Tailwind v4 + CSS tokens · localStorage · Gemini (offline authoring only, **not at runtime**) · static hosting (Vercel static / Render).

---

## Phases 1–5 — DONE ✅
Scaffold · core loop · persistence + recall · library + nav · content (React + JS-async + useEffect packs).

## Recently shipped ✅ (all verified in-browser)
- **B1 — inline reveal** (`phase: answering → revealed`, same-page; separate Reveal route dropped).
- **B2 — real YouTube thumbnails** (`img.youtube.com/vi/<id>/hqdefault.jpg`; every `youtubeId` verified via oEmbed — the old useEffect id 404'd → real Web Dev Simplified video; real channels; cue timestamps clamped to runtime). Plus the returning-user progress strip (streak · due · continue).
- **B3 — local name profile** (localStorage, skippable, no login wall). **N1 fix:** the prompt now appears *after the first attempt* (value before any gate), once; correct verdict personalizes to "Nice catch, {name}!".
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
- **Deep link `?dare=<challengeId>`** (a server-readable query param, not `?c=`) opens that exact drill, then cleans to `#/challenge/:id`.
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
- **Nabbit Pro preview** in the Library: a **disabled** paste-any-video input + Pro feature list (auto-gen, more formats, stacks, mastery) + a **For-teams/B2B** line. No transactions, no payment/credential capture (intentionally — demo-safe).
- Revenue ranking (unchanged): **B2B seats > premium sub > affiliate > sponsored packs.** Skip display ads.
- ⬜ Real payments, the actual Pro unlock, analytics/mastery, and B2B team view remain roadmap.

### B8 — Auto-generate from any video  *(Acquisition + Revenue — premium hook)*
Pipeline: paste URL → fetch transcript + metadata → detect concept → generate buggy snippet + options + explanation → verify. Honest limit: transcripts miss on-screen code for screencasts; fall back to concept-level predict/spot-the-flaw for arbitrary videos. *(Roadmap; the premium promise.)* **A disabled paste-URL entry already ships in the Library as the Pro teaser (B7).**

---

## Phase 7 — Accounts + Database (post-buildathon)

Needed only when adding: login, cross-device sync, shared/team/leaderboard data, or saving user-generated challenges. **Pick: Supabase** (Postgres + Auth + RLS), accessed from the static Vercel SPA via the **anon key + Row-Level Security**, or from serverless functions with the service key. Env vars (`SUPABASE_URL`, anon key) set in Vercel.

- **Store interface** with two adapters: `localStore` (anonymous) + `supabaseStore` (signed-in). `localStore` is already an abstraction, so this is localized.
- **Sync model:** anonymous users stay on localStorage; on sign-in, push local progress up — activation stays login-free, accounts become an optional cross-device upgrade.
- **Auth:** Supabase Auth handles signup/login/sessions (no hand-built auth).
- **Schema sketch:**
  - `users` (id, name, created_at)
  - `attempts` (id, user_id, challenge_id, chosen, correct, at)
  - `recall_items` (id, user_id, challenge_id, concept, interval, next_review_at, last_reviewed_at)
  - (B2B) `teams`, `team_members`
  - RLS: every row scoped to `auth.uid()`.

---

## Roadmap (post-buildathon)

PR-review format → more judgment formats (predict-output, tradeoff, drag-drop flow) → auto-gen (B8) → more stacks/domains (B6) → accounts + Supabase (Phase 7) → real cross-device sync → B2B team dashboards → mastery map + XP.

---

## Phase 6 — Demo polish

- ✅ Responsive (no body overflow at 375px on all four screens; navbar, submit bar, reveal actions, code blocks).
- ✅ Accessibility pass (`aria-current`/`aria-pressed`, labels on icon-only controls, `sr-only` state cues, global `:focus-visible`).
- ✅ Loading/error states (challenge-route loading guard; thumbnail `onError` fallback).
- ✅ Demo-reset action (Recall dashboard).
- ⬜ **Remaining (operational):** final hosted deploy + a screen-recording backup of the 5-minute demo.

**Acceptance:** runs cold in incognito, on phone and laptop; every button works; demo rehearsed once.
