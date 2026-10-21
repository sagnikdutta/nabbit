# Nabbit — User Journey (AARRR)

> The end-to-end Nabbit experience mapped to the AARRR growth framework
> (Acquisition · Activation · Retention · Referral · Revenue), so every screen
> and feature has a clear job in the funnel. Engineering detail lives in
> `build-plan.md`; this is the experience spec behind it.

## The core loop (one sentence)

A shared **bug-dare** pulls a dev in (**Acquisition**) → they catch or miss a bug
from a video they watched and see *why* (**Activation**) → the concept resurfaces
on a schedule (**Retention**) → they share their own dare (**Referral**) →
premium, auto-gen and native recommendations monetize the habit (**Revenue**).

## Persona

**Arin — mid-level dev, 2–6 yrs.** Learns new stacks from YouTube tutorials and
increasingly *reviews* AI-written code rather than writing every line. Pain:
watches a tutorial, feels she got it, then misses the exact bug in a code review
days later. Reachable via LinkedIn/X, dev communities, and her team.

---

## 1. Acquisition — *they arrive*

- **Goal:** land a dev on a playable drill with zero friction.
- **Entry points:** a shared **bug-dare** on LinkedIn/X (deep-links to that exact
  challenge) · "bug of the day" posts, community shares, Show HN · the curated
  video library as a discovery/SEO surface (each video + concept = a page).
- **User does:** attempts the bug *before* knowing what Nabbit is.
- **Nabbit does:** opens directly on the drill (deep link), no signup wall; a slim
  "what is this?" strip.
- **Screens:** Challenge (deep-linked), Library (hero).
- **Metrics:** share→click CTR · new visitors · % attempting the first drill.
- **Drop-off risks:** a signup/landing wall before the drill; slow first paint.

## 2. Activation — *the first "aha"*

- **Goal:** a satisfying first win + "why" inside 2 minutes.
- **User does:** submits an answer, sees correct/wrong + the explanation tied to
  the video's concept.
- **Nabbit does:** instant deterministic verdict; **inline reveal (same page)**;
  before/after + explanation; a **skippable** name prompt *after* the first attempt
  personalizes ("Nice catch, Arin").
- **Levers:** difficulty choice keeps the first drill winnable; a free video
  summary/timeline gives quick context.
- **Screens:** Challenge → inline Reveal.
- **Metrics:** % completing the first drill · time-to-first-aha (< 2 min).
- **Drop-off risks:** first drill too hard; unclear reveal; any gate before value.

## 3. Retention — *they come back*

- **Goal:** bring the right concept back at the right time; make returning feel
  like progress.
- **Mechanics:** spaced recall (1/3/7/14/30 d); "due today", streak, "at-risk",
  revisit rate.
- **Returning triggers:** streak · due queue · (roadmap) email/push nudge.
- **Depth:** difficulty tiers + session length give a sense of leveling up.
- **Screens:** Recall dashboard (the returning-user home) · time-travel simulator
  (demo device to show resurfacing without waiting days).
- **Metrics:** **revisit rate (north-star)** · streak length · D1/D7 return.
- **Drop-off risks:** no reminder channel; static-feeling dashboard; nothing new
  to return for.

## 4. Referral — *they bring others*

- **Goal:** turn a win into new users.
- **Trigger:** a clean win or a nasty bug → "share this."
- **Artifact:** a **bug-dare card** ("caught this in 12s — can you?") + a
  streak/score card. The dare pulls the recipient into a drill → their referral
  becomes the next person's acquisition.
- **Screens:** Reveal (share CTA) · a shareable result / OG card.
- **Metrics:** shares per active user · viral coefficient (dares → attempts → users).
- **Note:** Acquisition and Referral are the **same loop** — invest once, it powers both.

## 5. Revenue — *it makes money*

- **Free:** curated drills + recall + sharing + basic summary/timeline.
- **Premium (individual):** paste-any-video auto-gen · all judgment formats · more
  stacks · analytics/mastery.
- **Native recommendation (affiliate):** at a repeatedly-missed concept —
  "struggling with useEffect? → this focused course." Native, not a banner.
- **B2B / team:** team dashboards · drills on your own codebase · "verify your
  devs' code-review judgment."
- **Screens:** an upgrade prompt at the pain moment · a recommendation card ·
  (B2B) a team view.
- **Metrics:** free→paid conversion · affiliate CTR · ARPU · B2B pipeline.

---

## Growth loop

```
 shared bug-dare ──▶ new dev tries a drill (Acquisition)
        ▲                      │
        │                      ▼
   shares own dare    solves + sees why (Activation)
     (Referral)               │
        ▲                      ▼
        └──── concept resurfaces; streak builds (Retention)

 Revenue taps the loop at the Retention / pain points:
   premium · native recommendations · B2B.
```

## Feature → AARRR mapping

| Feature | Primary | Secondary |
|---|---|---|
| Shareable bug-dare (LinkedIn/X) | Referral | Acquisition |
| Deep-linked challenge | Acquisition | Activation |
| Inline reveal + explanation | Activation | — |
| Skippable name profile | Activation | Retention |
| Difficulty + session length | Activation | Retention |
| Spaced-recall dashboard | Retention | Referral |
| Time-travel simulator (demo) | Retention (demo) | — |
| Curated library / more videos | Acquisition | Retention |
| Multi-domain formats (AWS / sys-design / Neo4j) | Acquisition | Revenue |
| Auto-generate from any video | Acquisition | Revenue |
| Premium tier | Revenue | — |
| Native recommendation | Revenue | Retention |
| B2B / team | Revenue | — |
| Login / accounts (optional, post-activation) | Retention | Revenue |

## North-star & guardrail metrics

- **North-star:** revisit rate — share of solved concepts the user comes back and re-solves.
- **Acquisition:** share→try CTR · **Activation:** % first-drill complete < 2 min ·
  **Retention:** D7 return, streak · **Referral:** shares / active user ·
  **Revenue:** free→paid %.

---

## Demo storyline (5 min, maps to this journey)

1. **Pain (0:00–0:45):** Arin watched a tutorial, missed the exact bug in review.
2. **Acquisition → Activation (0:45–2:30):** open a shared dare, solve a real
   bug-hunt, see *why*.
3. **Retention (2:30–3:30):** time-travel the recall engine to show resurfacing +
   the dashboard.
4. **Referral (3:30–4:15):** share the dare — the loop closes.
5. **Revenue + roadmap (4:15–5:00):** recommendation card + "the format adapts to
   any dev video — AWS, system design, Neo4j."
