# Nabbit — Catch the Nit

> **Turn dev tutorials into bug-hunt drills that train your code-review judgment.**  
> *HelloPM Buildathon Entry · Cohort 52*

[![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey?logo=express&logoColor=black)](https://expressjs.com)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

---

## The Problem & The "Why Now"

Engineers watch 2–4 developer tutorials a week, feel they understood the syntax in the moment, then struggle to catch subtle flaws in that same code weeks later. Nothing brings the concept back to practice.

With generative AI writing first drafts of code, **the scarce engineering muscle is shifting from writing syntax to reading, reviewing, and verifying it**. Passive video watching creates an illusion of competence that never trains code-review judgment.

**Nabbit closes this retention gap:**
1. **Curated Video Context**: Select a video from top instructors.
2. **Side-by-Side Bug Hunt**: Review realistic, AI-plausible code containing a single planted flaw tied directly to the video chapter.
3. **Deterministic Grading**: Select the bad line and correct fix from 4 options with instant pass/fail (no code sandbox latency, no flaky LLM grading).
4. **Deep Mechanical Breakdown**: Understand *why* the bug happens with side-by-side code diffs and reviewer rules of thumb.
5. **Ebbinghaus Spaced Recall**: Solved concepts automatically resurface on an interval curve (1 / 3 / 7 / 14 / 30 days) until the intuition is permanent.

---

## Key Features

- **Side-by-Side Video & Code Workspace**: Synchronized YouTube embed cued to the exact concept timestamp with "Cue Moment" reset controls.
- **Direction B Design Token Layer (`src/theme/tokens.css`)**: Swappable design system using CSS custom variables. Supports live switching between **Clean Modern SaaS** and **Dev Dark IDE** modes with zero component changes.
- **Deterministic MCQ Engine**: High-fidelity syntax highlighter with line numbers, error gutter markers, and keyboard shortcuts (`[1-4]` to select, `Enter` to check).
- **Instant Verdict & Diff Comparison**: Pass/fail feedback with celebration confetti, visual diff of before/after snippets, and key takeaway principles.
- **Spaced Recall Dashboard**:
  - **North-Star Metric**: Revisit Rate (`% of solved concepts re-reviewed`).
  - **Review Streak & At-Risk Concepts**: Identifies overdue concepts or failed attempts.
  - **Time-Travel Simulation Bar**: Fast-forward days (`+1d`, `+3d`, `+7d`, `+14d`, `+30d`) to test the recall schedule live during demos.
- **Full-Stack Architecture**: Express server mounting Vite in development, backed by REST API routes (`/api/videos`, `/api/challenges`, `/api/attempts`, `/api/recall`) and client-side storage synchronization.

---

## Curated Demo Packs (10 Verified Challenges)

### 1. React Tutorial for Beginners (Programming with Mosh)
- **State Batching & Stale Snapshot**: Consecutive `setCount(count + 1)` calls failing to increment by 2.
- **Reconciliation & Stable List Keys**: Missing keys in mapped lists causing uncontrolled DOM state drift.
- **The `&&` Falsy Zero Leak**: `{items.length && ...}` rendering literal `0` into the DOM.
- **Immediate Function Invocation**: `onClick={handleDelete(id)}` executing during render and causing infinite re-render loops.

### 2. Modern Asynchronous JavaScript & Promises (Fireship & Modern JS)
- **Array `forEach` with Async Callbacks**: Synchronous loop discarding promises and logging success prematurely.
- **Silent Unhandled Fetch Errors**: HTTP 404/500 responses not rejecting `fetch()` promises without inspecting `response.ok`.
- **`Promise.all` Fast-Fail vs `allSettled`**: Single rejection dropping 99 valid batch results.

### 3. React useEffect & Lifecycle Deep Dive (Dan Abramov & Jack Herrington)
- **Stale Closure in Interval Effect**: Empty dependency arrays freezing timer states at initial render values.
- **Missing Event Listener Cleanup**: Unmounted components leaking global window listeners in memory.
- **Infinite Re-render Loop**: Mutating state inside an effect that unconditionally depends on that same state.

---

## Technical Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Browser (React 19 SPA)                        │
│                                                                        │
│   src/theme/tokens.css  ◄── Single visual source of truth (Tokens)    │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                         Navbar / TopBar                        │   │
│   │   [Nabbit Brand]  ·  [Library | Drills | Recall]  ·  [Theme]   │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                │                                       │
│          ┌─────────────────────┼─────────────────────┐                 │
│          ▼                     ▼                     ▼                 │
│   ┌──────────────┐     ┌──────────────┐      ┌──────────────┐          │
│   │   Library    │     │  Challenge   │      │    Recall    │          │
│   │    Screen    │     │  & Reveal    │      │  Dashboard   │          │
│   └──────┬───────┘     └──────┬───────┘      └──────┬───────┘          │
│          │                    │                     │                  │
│          └────────────────────┼─────────────────────┘                  │
│                               ▼                                        │
│                     Shared Component Layer                             │
│       CodeBlock  ·  OptionCard  ·  VideoPlayer  ·  TimeTravelBar       │
│                               │                                        │
│                     lib/api.ts  &  lib/recall.ts                       │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ REST (/api/*)
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Express Backend / Server                        │
│                                                                        │
│   routes/videos.ts  ──► Curated packs (React Mosh, JS Async, useEffect)│
│   routes/attempts.ts ──► Deterministic grading & answer validation     │
│   routes/recall.ts   ──► Due items, interval scheduling, streak metrics │
│   store/memory.ts    ──► In-Memory store + local synchronization       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
nabbit/
├── src/
│   ├── components/
│   │   ├── Badge.tsx           # Clean zero-pill metadata badge
│   │   ├── Button.tsx          # Button primitive consuming tokens
│   │   ├── Card.tsx            # Single-elevation surface container
│   │   ├── CodeBlock.tsx       # Syntax token highlighter with bug/fix lines
│   │   ├── Navbar.tsx          # 3-Zone Top Bar navigation & theme switcher
│   │   ├── OptionCard.tsx      # MCQ fix options card with keyboard badges
│   │   ├── TimeTravelBar.tsx   # Spaced repetition day-simulation toolbar
│   │   └── VideoPlayer.tsx     # Synchronized YouTube player with chapter cues
│   ├── content/
│   │   └── data.ts             # Curated video packs and 10 bug-hunt drills
│   ├── lib/
│   │   ├── api.ts              # Unified API client with local store fallback
│   │   ├── recall.ts           # Ebbinghaus interval progression and stats
│   │   └── types.ts            # Video, Challenge, Attempt, RecallItem types
│   ├── screens/
│   │   ├── ChallengeScreen.tsx # Side-by-side video + bug hunt drill
│   │   ├── LibraryScreen.tsx   # Video pack browser & stack filters
│   │   ├── RecallDashboardScreen.tsx # Retention metrics & due today queue
│   │   └── RevealScreen.tsx    # Verdict, diff comparison & explanation
│   ├── theme/
│   │   ├── base.css            # Base resets & semantic syntax token classes
│   │   └── tokens.css          # Direction B Modern SaaS tokens & dark mode
│   ├── App.tsx                 # Main application orchestrator
│   ├── index.css               # Global Tailwind CSS and token imports
│   └── main.tsx                # React DOM entry point
├── server.ts                   # Full-stack Express server with Vite middleware
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm or bun

### Installation
```bash
npm install
```

### Run Locally (Dev Server)
```bash
npm run dev
```
The application will launch on `http://localhost:3000`.

### Type Check & Build
```bash
npm run lint
npm run build
```

---

## Spaced Repetition Formula

Nabbit implements a 5-tier recall progression based on the Ebbinghaus forgetting curve:
$$\text{Intervals: } 1 \text{ day} \longrightarrow 3 \text{ days} \longrightarrow 7 \text{ days} \longrightarrow 14 \text{ days} \longrightarrow 30 \text{ days}$$

- **Correct Solve**: Advances the concept to the next interval tier and increments the review streak.
- **Incorrect Solve**: Resets the interval back to 1 day for reinforcement.
- **North-Star Metric**: Revisit Rate = $\frac{\text{Solved concepts reviewed } > 1 \text{ time}}{\text{Total solved concepts}} \times 100$.

---

## Roadmap (Post-Buildathon)

1. **PR Review Mode**: Review and approve or request changes on multi-file pull requests.
2. **Auto-Generation via Video URL**: Extract code snippets from transcripts and on-screen vision using Gemini.
3. **Additional Languages & Stacks**: Python, Go, SQL, and System Design architectural drills.
4. **Mastery Map & XP**: Visual skill graph of retained patterns.

---

## License

MIT © 2026 Nabbit
