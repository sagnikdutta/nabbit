# Nabbit — Technical Build Plan

> Phased build instructions for Nabbit (bug-hunt drills on dev videos + spaced recall).
> Design = Direction B (Modern SaaS), kept as a **swappable token layer**.

> **Status (as built, 20 Oct):** MVP working and deployed locally. Phases 1–5 done.
> Remaining = Phase 6 (demo polish) + the **Backlog** below (3 changes).
> **Architecture note:** the build landed on **client-side localStorage as the single source of truth** + a static SPA — not the Vercel-KV serverless path originally sketched. The plan below is updated to match. (The Express server is now effectively optional; see Backlog B0.)

---

## 0. Guiding principles

1. **Design is loosely coupled.** Every color, font, radius, shadow and spacing value lives in ONE place (`src/theme/tokens.css`). Components reference tokens only — never a raw hex or px for a themed value. Swapping to Direction A or C later = replace the token file, zero component changes.
2. **Deterministic core.** Grading is a pure equality check (chosen option vs `correctOption`). No code sandbox, no LLM at request time.
3. **Content is data, not code.** Challenges are JSON/TS data (`src/content/data.ts`). Authoring new content never means editing components.
4. **One source of truth.** Progress lives in the client (`localStore` → localStorage). Deploy as a static SPA; it works anywhere (incl. Vercel static), persists per browser, and survives refresh — no backend state to reset.
5. **Deploy early, stay deployable.** A live URL from the first hour; every phase stays shippable.

---

## 1. Architecture (as built)

```
Browser (React + Vite SPA)  — source of truth
  theme/        <- swappable design layer (tokens + base css)
  components/   <- Button, Card, Badge, CodeBlock, OptionCard, Navbar, VideoPlayer, TimeTravelBar
  screens/      <- Library, Challenge, Reveal, RecallDashboard
  lib/          <- api (localStore + fetch fallback), recall (scheduling + stats), types
  content/      <- data.ts (curated videos + challenges)

Express server (server.ts) — OPTIONAL
  mirrors the same logic (recall.ts) over /api/*; serves the built SPA.
  Not required for state; keep for local dev / future real backend. See Backlog B0.
```

---

## 2. Tech stack (as built)

| Layer | Choice | Notes |
|---|---|---|
| UI | React 19 + Vite + TypeScript | |
| Navigation | screen state (Library / Bug Hunt / Recall) | |
| Styling | CSS variables (tokens) + Tailwind v4 | all visual tokens in `theme/tokens.css` |
| Persistence | **client localStorage** (`localStore`) | single source of truth |
| Server | Express (`server.ts`) — optional | mirrors logic; serves the SPA |
| Content authoring | Gemini (offline) | **not called at runtime** — no key needed to run |
| Hosting | **static SPA** (any static host / Vercel static / Render) | |

---

## 3. The design layer (how swapping works)

**`src/theme/tokens.css`** — the single source of visual truth (Direction B):

```css
:root {
  --color-bg:#fafafa;      --color-surface:#ffffff;  --color-border:#ececec;
  --color-text:#0a0a0a;    --color-muted:#6b7280;
  --color-accent:#6366f1;  --color-accent-weak:#eef2ff;  --color-accent-ink:#ffffff;
  --color-good:#10b981;    --color-danger:#ef5350;
  --code-bg:#0f1320; --code-text:#e6e9f2; --code-kw:#c792ea; --code-fn:#82aaff;
  --code-num:#f78c6c; --code-tag:#7fdbca; --code-punc:#8b93a7; --code-bug:rgba(239,83,80,.13);
  --font-ui:'Inter',system-ui,sans-serif; --font-mono:'JetBrains Mono',ui-monospace,monospace;
  --radius-sm:8px; --radius:11px; --radius-lg:14px;
  --shadow-sm:0 1px 2px rgba(10,10,10,.04); --shadow:0 2px 10px rgba(10,10,10,.05);
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px; --space-8:32px;
}
```

**Rules that keep it swappable** — components use `var(--token)` only; code highlighter uses `--code-*` tokens; extra themes (A/C) = `:root[data-theme="…"]` blocks, not forks. **Swap test:** changing only `tokens.css` re-skins the app.

---

## 4. Data model

```ts
type Video      = { id; title; channel; stack; conceptCount; youtubeId; thumbnailUrl };
type Challenge  = { id; videoId; concept; chapter; buggyCode; buggyLines;
                    fixOptions; correctOption; explanation };
type Attempt    = { challengeId; chosen; correct; at };
type RecallItem = { challengeId; concept; interval: 1|3|7|14|30; nextReviewAt; history };
```
Recall ladder: 1 / 3 / 7 / 14 / 30 days (`recall.ts`). Time-travel via `offsetDays` for the demo.

---

## Phases 1–5 — DONE ✅

1. **Scaffold** — token layer, primitives, screens, server skeleton. ✅
2. **Core loop** — bug-hunt challenge, deterministic grading, reveal. ✅
3. **Persistence + recall** — localStore + recall ladder + stats; dashboard (revisit rate, streak, due, at-risk). ✅
4. **Library + nav** — curated video cards, screen navigation. ✅
5. **Content** — React (Mosh) pack + JS async + useEffect packs. ✅ *(verify each `youtubeId` is the real tutorial — see B2.)*

---

## Backlog — post-MVP changes (do in this order)

### B1 — Reveal on the same page  *(P0 · quick win)*
- **Problem:** submitting routes Challenge → a separate Reveal page.
- **Change:** give `ChallengeScreen` a `phase` state (`answering` → `revealed`). On submit, **swap the options block in place** for the result (verdict, A–D breakdown, before/after, explanation) + "Next challenge" button. Fold `RevealScreen`'s content in as an inline sub-component; drop the separate route/screen.
- **Done when:** answering shows the result in place with no navigation; "Next" loads the next challenge in place.

### B2 — Real videos + adaptive home  *(P1)*
- **Thumbnails (the "dummy" bit):** `thumbnailUrl` currently points at generic **Unsplash stock**. Swap to the real YouTube thumbnail: `https://img.youtube.com/vi/<youtubeId>/hqdefault.jpg` (or `maxresdefault.jpg`). Verify each `youtubeId` is the actual tutorial, and use **real channel names** (a couple read as composite).
- **Adaptive home:** keep the hero (first-visit value statement — it earns its place with judges). For a **returning** user, add a compact **progress strip above the video library**: streak · due-for-review count · "Continue where you left off", pulling the key dashboard stats onto the landing. Keep the full **Spaced Recall** screen as its own deeper view — don't merge the dashboard away.
- **Done when:** cards show real YT thumbnails and open the right video; a returning visit shows progress + due + continue above the packs.

### B3 — Accounts: local profile now, real auth later  *(P2 · mostly deferred)*
- **Decision:** **no real auth for the MVP.** It's the deck's named "login-first" trap, adds activation friction ("value before signup"), and reintroduces the backend/DB/session complexity the static + localStorage build deliberately removed. It moves no rubric line.
- **MVP (optional):** a one-field *"what should we call you?"* onboarding stored in localStorage — personalizes the UI, no passwords, no server, per-browser.
- **Roadmap:** real auth + cross-device sync (needs a backend + DB) — present it as a roadmap strength, not a day-5 build. This is the honest answer if a reviewer asks about accounts.

### B0 — Consolidate to one store  *(P1 · reliability)*
- **Problem:** state is implemented twice (Express in-memory *and* client localStorage), and `submitAttempt` writes to both; a reachable-but-reset server can return stale state the client won't fall back from.
- **Change:** make `localStore` the sole source of truth; stop the double-write; keep the server only to serve the static build (or drop it and deploy pure static). Removes divergence; keeps the demo bulletproof.

### B4 — Production build + deploy config  *(P1 · deploy blocker)*
- **Problem:** `npm start` and `npm run dev` are the same command (`tsx server.ts`). Without `NODE_ENV=production` the server always mounts Vite dev middleware, so there's no real production path. There's also no host config (`vercel.json` or similar) and the package is still named `react-example`.
- **Change:** pick the host. For pure static (after B0): `npm run build` → deploy `dist/`, plus an SPA fallback rewrite. If the server stays: `"start": "cross-env NODE_ENV=production tsx server.ts"` after a build. Rename the package to `nabbit`.
- **Done when:** a clean clone deploys with build + start only, and the live URL loads cold in incognito.

### B5 — Shareable URLs per screen  *(P2)*
- **Problem:** navigation is `useState` in `App.tsx`, so every screen lives at `/`. Refresh drops you back on the Library, the browser back button leaves the app, and a specific challenge can't be linked in a demo or a share.
- **Change:** add a small hash router (or `react-router`): `#/`, `#/challenge/:id`, `#/recall`. Hash routing needs no server rewrite, so it suits the static deploy. (B1 removes the Reveal route.)
- **Done when:** refresh keeps you on the current screen, back/forward work, and a pasted challenge link opens that challenge.

### B6 — Token-layer leaks  *(P2 · swap-test hygiene)*
- **Problem:** two raw colors in components break the "no hex in components" rule: confetti colors in `RevealScreen.tsx` (`#6366f1`, `#10b981`, …) and the code header border `rgba(255,255,255,0.08)` in `CodeBlock.tsx`.
- **Change:** read confetti colors from tokens at runtime (`getComputedStyle(document.documentElement).getPropertyValue('--color-accent')`, etc.); add a `--code-border` token for the header border.
- **Done when:** grepping `src/components` and `src/screens` for `#[0-9a-f]` and `rgba(` finds nothing.

---

## Roadmap (post-buildathon)

PR-review format → more judgment formats (predict-output, spot-the-flaw, tradeoff, drag-drop flow) → auto-generation from arbitrary videos → more stacks/languages → **real accounts + cross-device sync** → mastery map + XP.

---

## Phase 6 — Demo polish (remaining)

Responsive (laptop/tablet) · accessibility pass (focus, labels, contrast) · demo-reset action (present) · loading/error states · final static deploy + a screen-recording backup of the 5-minute demo.
**Acceptance:** runs cold in incognito, on phone and laptop; every button works; demo rehearsed once.
