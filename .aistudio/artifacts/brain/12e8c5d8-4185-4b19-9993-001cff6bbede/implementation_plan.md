# Nabbit — Bug-Hunt Code Review Drills & Spaced Recall

Nabbit transforms passive dev tutorial watching into active code-review judgment drills. By pairing curated tutorial clips with realistic AI-plausible buggy snippets and an interval-based spaced recall engine, Nabbit ensures key architectural and syntax concepts stick.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following core design and architectural decisions were confirmed during interactive clarification and shape the system build:

- **Theme & Aesthetic**: Direction B (Modern SaaS) implemented via a strict, single-source CSS variable layer (`src/theme/tokens.css`). Includes a live theme switcher supporting **Direction B Clean SaaS** (off-white surface, indigo accents) and **Dev Dark IDE** (slate backdrop, Monokai code palette) without altering component markup.
- **Tutorial Presentation**: Synchronized YouTube video player rendered side-by-side with the code challenge, automatically cued to the exact concept timestamp with interactive playback controls.
- **Recall Simulation & Time-Travel**: Interactive "Time Travel" utility in the Spaced Recall Dashboard allowing users to fast-forward days (+1d, +3d, +7d, +14d) to test interval scheduling, resurfacing, and streak health in real time.
- **Persistence & Fallback**: Dual-layer Store architecture providing full Express API endpoints (`/api/videos`, `/api/attempts`, `/api/recall`) backed by an in-memory/JSON store on the server with synchronous local storage sync on the client for zero-flicker resilience.

---

### 1. Overview & Core Concept

- **What It Does**: Nabbit provides a laser-focused, 2-minute drill loop: an engineer selects a curated dev video, observes the highlighted concept taught in that clip, reviews an AI-written code snippet containing a subtle real-world flaw, pinpoints the buggy line, and chooses the correct fix from four choices. On submission, they receive an immediate verdict, line-by-line concept breakdown, and automatic enrollment into an Ebbinghaus-style spaced repetition schedule (1 / 3 / 7 / 14 / 30 days).
- **Target Audience / Persona**: "Arin", a full-stack or backend engineer who watches dev tutorials and increasingly reviews AI-generated code (Pull Requests, Copilot/Claude output). Judged on catching subtle bugs, preventing silent production errors, and retaining foundational patterns.
- **Key Value**: Closes the retention gap where passive tutorial watching creates the illusion of competence without training code verification judgment.

---

### 2. User Experience & Visual Design

#### Key User Flows

1. **Library & Concept Discovery (`/`)**:
   - Header with brand wordmark, quick view switcher, active streak counter, and Recall Due alert badge.
   - Curated video packs organized by stack (React Fundamentals, Modern Asynchronous JavaScript, React Hooks & Effects Deep Dive).
   - Each card displays video metadata (channel, duration, concept count, solved ratio, and progress ring).
   - Instant "Start Quick Drill" CTA launching the next uncompleted challenge.
2. **Challenge Stage (`/challenge/:id`)**:
   - 2-column balanced workspace on desktop:
     - **Left Column**: Synchronized video player cued to the tutorial timestamp, collapsible concept recap card, and "Watch Segment" shortcut.
     - **Right Column**: Syntax-highlighted code editor with line numbers, subtle red hairline indicator on candidate lines, and 4 clean option cards.
   - Interactive options with hover states and keyboard shortcut selection (1–4 or A–D).
   - Primary action: "Check Fix" button.
3. **Verdict & Concept Reveal (`/reveal/:id`)**:
   - Instant visual feedback: Emerald banner for correct solve, Coral banner for incorrect catch.
   - Explanatory diff view showing the buggy code versus the corrected pattern.
   - Deep concept breakdown explaining *why* the bug occurs (e.g., stale state snapshots, reference mutation, rendering 0 with `&&`).
   - Action strip: "Advance to Next Challenge", "Review Video Concept", or "View Recall Schedule".
4. **Spaced Recall Dashboard (`/recall`)**:
   - Retention metrics: Revisit Rate (North-Star metric), Current Streak, Solved Count, and At-Risk Concepts.
   - "Due Today" queue with one-click review launch.
   - Interval pipeline visualizer showing items across 1d, 3d, 7d, 14d, and 30d stages.
   - Time-Travel testing bar (+1 Day, +3 Days, +7 Days, Reset) to verify scheduled concept resurfacing.

#### Visual Identity & Design Tokens

- **Aesthetic Direction**: Direction B — Modern Developer SaaS. Clean, structured, unboxed typography with subtle hairline dividers (`1px solid var(--color-border)`).
- **Color Palette & Contrast**:
  - Light Canvas: `#FAFAFA` background, `#FFFFFF` card surfaces, `#ECECEC` hairline borders.
  - Dark Canvas: `#0B0F19` background, `#111827` card surfaces, `#1F2937` borders.
  - Accent: Indigo `#6366F1` with soft tint `#EEF2FF` for active states.
  - Semantic: Emerald `#10B981` (correct fix), Crimson `#EF4444` (planted bug).
  - Code Block: Dark navy background (`#0F1320`), syntax tokens for keywords (`#C792EA`), functions (`#82AAFF`), numbers/strings (`#F78C6C`), and tags (`#7FDBCA`).
- **Typography**:
  - UI Display & Body: Inter and system neo-grotesque font stack.
  - Code & Telemetry: JetBrains Mono / ui-monospace with `tabular-nums` for all metrics, line numbers, and timestamps.
- **Zero-Pill Restraint**: Metadata rendered as quiet unboxed text separated by `·` (e.g., `Mosh Hamedani · 14:20 · 4 Concepts`).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Deterministic MCQ Bug Hunt vs. Code Sandbox**
  - *Chosen Approach*: Deterministic 4-option bug identification and fix selection.
  - *Why*: Eliminates flaky sandbox compilation, browser security restrictions, and network latency. Enables instantaneous sub-100ms feedback and cold incognito demo execution.
- **Decision 2: Swappable CSS Token Layer**
  - *Chosen Approach*: All themed values live exclusively in `src/theme/tokens.css` via CSS custom properties.
  - *Why*: Allows instantaneous re-theming (Direction B to Dark IDE) with zero component changes, passing the strict token isolation test.
- **Decision 3: Synchronized YouTube Embed**
  - *Chosen Approach*: Side-by-side responsive iframe player with exact start timestamp parameters (`start=X`).
  - *Why*: Contextualizes the drill without forcing the user to navigate away or lose their code review place.
- **Decision 4: Spaced Recall Engine (Ebbinghaus Intervals)**
  - *Chosen Approach*: Deterministic interval progression: 1 day $\to$ 3 days $\to$ 7 days $\to$ 14 days $\to$ 30 days. Correct answers advance the interval; incorrect answers reset back to 1 day.
  - *Why*: Mirrors the proven SuperMemo/Anki spaced retrieval dynamics to convert passive tutorial memory into permanent code review instincts.

---

### 4. Technical Architecture & Data Strategy

#### System & Component Architecture

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
│                                                                        │
│   store/index.ts     ──► Store Interface (getAttempts, addAttempt...)  │
│   store/memory.ts    ──► Fast In-Memory + JSON seed persistence        │
└────────────────────────────────────────────────────────────────────────┘
```

#### Core Data Entities

- **Video**: `id`, `title`, `channel`, `stack`, `youtubeId`, `duration`, `conceptCount`, `chapters`.
- **Challenge**: `id`, `videoId`, `concept`, `chapter`, `timestamp`, `buggyCode`, `buggyLines`, `fixOptions`, `correctOption`, `explanation`.
- **Attempt**: `challengeId`, `chosen`, `correct`, `at` (epoch timestamp).
- **RecallItem**: `challengeId`, `concept`, `interval` (1|3|7|14|30), `nextReviewAt`, `history: Attempt[]`.

#### Curated Content Packs (Pre-authored)

1. **React for Beginners (Mosh)**:
   - State batching: Stale snapshot in consecutive `setCount(count + 1)` calls.
   - Missing list key: Rendering list without unique ID; trap is `key={index}`.
   - The `&&` zero trap: `{items.length && ...}` rendering literal `0`.
   - Handler invoked on render: `onClick={handleClick()}` triggering infinite loops.
2. **Modern Asynchronous JavaScript & Promises**:
   - `forEach` async trap: `async` callback inside `forEach` does not await sequential executions.
   - Unhandled promise rejection: Missing `.catch` / `try-catch` wrapper around fetch.
   - `Promise.all` fast-fail vs `Promise.allSettled`: One rejection dropping all results.
3. **React useEffect & Lifecycle**:
   - Missing dependency in effect closure: Stale state inside timer/interval.
   - Missing cleanup function: Event listener / subscription memory leak on unmount.
   - Infinite update loop: Updating state observed in effect dependency array without guard.
