# Nabbit — Technical Build Plan

> Phased build instructions for Nabbit (bug-hunt drills on dev videos + spaced recall).
> Design = Direction B (Modern SaaS), kept as a **swappable token layer**.
> Target: working, deployed MVP in ~1.5 days of build, built on the Recap base.

---

## 0. Guiding principles

1. **Design is loosely coupled.** Every color, font, radius, shadow and spacing value lives in ONE place (`src/theme/tokens.css`). Components reference tokens only — never a raw hex or px for a themed value. Swapping to Direction A or C later = replace the token file, zero component changes.
2. **Deterministic core.** Grading is a pure equality check (chosen option vs `correctOption`). No code sandbox, no LLM at request time.
3. **Content is data, not code.** Challenges are JSON, loaded from the backend. Authoring new content never means editing components.
4. **Deploy on day one.** A live Vercel URL from the first hour; every phase stays deployable.
5. **Reuse the Recap base.** Port its spaced-recall engine and Gemini/Express wiring; replace its screens and content.

---

## 1. Architecture

```
Browser (React + Vite SPA)
  theme/        <- swappable design layer (tokens + base css)
  components/   <- primitives (Button, Card, CodeBlock, OptionCard, Badge)
  screens/      <- Library, Challenge, Reveal, Dashboard
  lib/          <- api client, recall logic, types
        | REST (/api/*)
Express server (serverless on Vercel)
  routes/       <- videos, challenges, attempts, recall
  store/        <- Vercel KV adapter (single interface, swappable)
  content/      <- curated challenge packs (JSON)
```

**Folder layout**

```
nabbit/
├─ src/
│  ├─ theme/
│  │  ├─ tokens.css        # THE design layer (Direction B). Swap this to re-skin.
│  │  └─ base.css          # resets + element defaults that consume tokens
│  ├─ components/
│  │  ├─ Button.tsx  Card.tsx  Badge.tsx
│  │  ├─ CodeBlock.tsx      # syntax-highlighted, reads --code-* tokens
│  │  └─ OptionCard.tsx
│  ├─ screens/
│  │  ├─ Library.tsx  Challenge.tsx  Reveal.tsx  Dashboard.tsx
│  ├─ lib/
│  │  ├─ api.ts            # fetch wrappers
│  │  ├─ recall.ts         # spaced-repetition scheduling (ported from Recap)
│  │  └─ types.ts          # Video, Challenge, Attempt, RecallItem
│  ├─ App.tsx  main.tsx  router.tsx
├─ server/
│  ├─ index.ts             # Express app
│  ├─ routes/              # videos.ts challenges.ts attempts.ts recall.ts
│  ├─ store/
│  │  ├─ index.ts          # Store interface
│  │  └─ kv.ts             # Vercel KV implementation (+ memory.ts for local dev)
│  └─ content/
│     └─ react-mosh.json   # curated pack
├─ .env.example
├─ vercel.json
└─ package.json
```

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| UI | React 19 + Vite + TypeScript | from the Recap base |
| Routing | react-router (4 routes) | or a tiny hash router |
| Styling | plain CSS + CSS variables (tokens) | framework-agnostic = easiest to swap; Tailwind v4 `@theme` is an option if you keep Tailwind |
| Server | Node + Express | serverless function on Vercel |
| Persistence | Vercel KV (Upstash Redis) | behind a `Store` interface |
| Content authoring | Gemini (offline) | not called at request time |
| Hosting | Vercel | |

---

## 3. The design layer (how swapping works)

**`src/theme/tokens.css`** — the single source of visual truth (Direction B shown):

```css
:root {
  /* color */
  --color-bg:#fafafa;      --color-surface:#ffffff;  --color-border:#ececec;
  --color-text:#0a0a0a;    --color-muted:#6b7280;
  --color-accent:#6366f1;  --color-accent-weak:#eef2ff;  --color-accent-ink:#ffffff;
  --color-good:#10b981;    --color-danger:#ef5350;
  /* code block */
  --code-bg:#0f1320; --code-text:#e6e9f2; --code-kw:#c792ea; --code-fn:#82aaff;
  --code-num:#f78c6c; --code-tag:#7fdbca; --code-punc:#8b93a7; --code-bug:rgba(239,83,80,.13);
  /* type */
  --font-ui:'Inter',system-ui,sans-serif; --font-mono:'JetBrains Mono',ui-monospace,monospace;
  /* shape + depth */
  --radius-sm:8px; --radius:11px; --radius-lg:14px;
  --shadow-sm:0 1px 2px rgba(10,10,10,.04); --shadow:0 2px 10px rgba(10,10,10,.05);
  /* spacing scale */
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px; --space-8:32px;
}
```

**Rules that keep it swappable**
- Components use `var(--token)` only (or utility classes mapped to tokens). Grep for `#` in `components/` should return nothing.
- The syntax highlighter emits semantic classes (`.tok-kw`, `.tok-fn`, …) styled from `--code-*` tokens — so a new theme recolors code for free.
- Optional: support multiple themes via `:root[data-theme="devdark"] { … }` blocks, toggled by a `data-theme` attribute. Direction A/C become extra token blocks, not forks.
- **Swap test (acceptance):** changing only `tokens.css` re-skins the whole app with no component edits.

---

## 4. Data model + API contract

**Types** (`lib/types.ts`)
```ts
type Video      = { id: string; title: string; channel: string; stack: string; conceptCount: number };
type Challenge  = { id: string; videoId: string; concept: string; chapter: string;
                    buggyCode: string; buggyLines: number[];
                    fixOptions: string[]; correctOption: number; explanation: string };
type Attempt    = { challengeId: string; chosen: number; correct: boolean; at: number };
type RecallItem = { challengeId: string; concept: string; interval: 1|3|7|14|30;
                    nextReviewAt: number; history: Attempt[] };
```

**API** (Express)
| Method | Route | Purpose |
|---|---|---|
| GET | `/api/videos` | list curated videos |
| GET | `/api/videos/:id/challenges` | challenges for a video |
| POST | `/api/attempts` | record an attempt `{challengeId, chosen}` → `{correct, explanation}` |
| GET | `/api/recall/due` | items due today + streak + revisit rate |
| POST | `/api/recall/:challengeId/review` | mark reviewed, advance interval |

**Store interface** (`server/store/index.ts`) — one interface, two impls (`kv.ts`, `memory.ts`):
```ts
interface Store {
  getAttempts(): Promise<Attempt[]>;
  addAttempt(a: Attempt): Promise<void>;
  getRecall(): Promise<RecallItem[]>;
  upsertRecall(r: RecallItem): Promise<void>;
}
```
Local dev uses `memory.ts`; Vercel uses `kv.ts`. Swapping persistence = swapping the impl.

---

## Phase 1 — Scaffolding  *(the only phase detailed to the step)*

**Goal:** a deployed Nabbit shell — the 4 screens routed and empty, the design-token layer in place, the Express server answering a health check, live on Vercel. No real content yet.

**Steps**
1. **Start from the Recap base** (fastest; keeps the recall engine + Gemini wiring). In your `nabbit` clone, copy the Recap source in, then:
   - Rename app/brand strings to Nabbit; delete the PM-specific screens and content.
   - *(Alternative: fresh `npm create vite@latest nabbit -- --template react-ts` and port `recall.ts` in Phase 3 — cleaner, slightly slower.)*
2. **Deploy a hello-world to Vercel NOW** — connect the repo in the Vercel dashboard, confirm a live URL before writing more. This kills end-of-week deploy panic.
3. **Add the design layer:** create `src/theme/tokens.css` (Section 3) and `base.css`; import both in `main.tsx`. Add the Google Fonts `<link>` (Inter + JetBrains Mono) to `index.html`.
4. **Primitives:** build `Button`, `Card`, `Badge`, `OptionCard`, `CodeBlock` consuming tokens only. `CodeBlock` takes `code` + `buggyLines` and renders semantic syntax classes.
5. **Routing + screen shells:** `react-router` with `/` (Library), `/challenge/:id`, `/reveal/:id`, `/recall`. Each screen renders its header + layout from Direction B, with placeholder content.
6. **Server skeleton:** Express app with `GET /api/health` → `{ok:true}`, the `Store` interface + `memory.ts` impl, and `vercel.json` routing `/api/*` to the serverless function, everything else to the SPA.
7. **Env:** `.env.example` with `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `GEMINI_API_KEY` (optional). Wire `kv.ts` but don't require it yet.

**Phase 1 acceptance**
- Live Vercel URL loads the Library shell in Direction B styling.
- All 4 routes render without errors; nav works.
- `GET /api/health` returns ok in production.
- Editing `tokens.css` visibly re-skins the shell (swap test passes).

---

## Phase 2 — Core loop (the bug hunt)  *(plan)*

**Delivers:** a playable challenge end to end on local/static data.
- Load `react-mosh.json` (the 4 challenges you already have) via `GET /api/videos/:id/challenges`.
- `Challenge` screen: concept panel + `CodeBlock` with `buggyLines` highlighted + `OptionCard` list + Check button.
- Grading: `POST /api/attempts` returns `{correct, explanation}`; client routes to `Reveal`.
- `Reveal` screen: verdict, the correct fix, the explanation, "Next".
- **Acceptance:** a stranger can solve a challenge and see the right explanation; wrong answers explained too.

## Phase 3 — Persistence + recall engine  *(plan)*

**Delivers:** progress that survives, and the recall loop.
- Swap the store to `kv.ts`; verify attempts persist across Vercel cold starts.
- Port Recap's spaced-repetition scheduling into `recall.ts` (intervals 1/3/7/14/30).
- On a correct solve, create/advance a `RecallItem`.
- `Dashboard`: revisit rate (north-star), streak, "due today", "at risk".
- **Acceptance:** solve → item scheduled → appears in "due" on its date; data still there after redeploy.

## Phase 4 — Library + navigation polish  *(plan)*

**Delivers:** the full browse + flow.
- `Library`: curated video cards from `GET /api/videos`; "paste URL" present but disabled (roadmap).
- Wire navigation Library → Challenge → Reveal → (next / Dashboard).
- Cold/empty states; loading + error states on every fetch.
- **Acceptance:** complete loop start to finish with no dead ends.

## Phase 5 — Content  *(plan)*

**Delivers:** the 3-video demo set.
- Ship `react-mosh.json` (done), author `js-async.json` and `react-useeffect.json` the same way (Gemini draft → hand-verify).
- Content quality gate per challenge: exactly one correct option; real, concept-tied flaw; explanation names *why*; a second person solves it.
- **Acceptance:** 3 videos, 10+ verified challenges, all solvable.

## Phase 6 — Polish + demo-readiness  *(plan)*

**Delivers:** a demo that won't break.
- Responsive down to laptop/tablet; accessibility pass (focus states, labels, contrast).
- A "reset demo data" action (no auth for MVP; data is shared/global — fine for a demo, note it).
- Keep AI credit headroom for testers.
- Final deploy; record a screen-capture backup of the 5-minute demo.
- **Acceptance:** runs cold in incognito, on phone and laptop; every button works; demo rehearsed once.

---

## Roadmap (post-buildathon)

PR-review format → more judgment formats (predict-output, spot-the-flaw, tradeoff, drag-drop flow) → auto-generation from arbitrary videos → more stacks/languages → accounts + mastery map + XP.

---

## Build order summary

`Phase 1 scaffold (deploy early)` → `2 core loop` → `3 persistence + recall` → `4 library/nav` → `5 content` → `6 polish`. Each phase ends deployable. Swap-the-design stays a one-file change throughout.
