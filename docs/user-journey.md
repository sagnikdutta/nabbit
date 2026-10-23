# Nabbit — User Journey (AARRR)

> The end-to-end Nabbit experience mapped to the AARRR growth framework
> (Acquisition · Activation · Retention · Referral · Revenue), so every screen
> and feature has a clear job in the funnel. Engineering detail lives in
> `build-plan.md`; this is the experience spec behind it.
>
> **Updated 22 Oct** — accounts (Supabase Auth + `public.users`), signed-out *trial
> mode*, a separate signed-in *dashboard*, and lead capture on shared links are now in.
> See "Status vs. this spec" at the bottom for what is still open.

## Who sees what (since accounts shipped)

| Visitor | Home | Challenges | Spaced Recall | Progress saved? |
|---|---|---|---|---|
| **Signed out** | Landing page (pitch + curated packs, no progress; **Create free account** + **Try a free bug hunt** CTAs; navbar **Sign up free** / Sign in) | **Public trial** — open any drill / shared dare, no login | Hidden | **No** |
| **Signed in** | Dashboard (Today card, stats, library, collapsed YouTube import) | Full | Yes | Yes — per account, in this browser (see open items) |

Finishing a **trial** drill grades it locally, saves nothing, and sends the visitor
to **sign-up** (banner: "Nice catch!" / "Not quite" + "create an account to see the
full explanation, save progress and get recall reviews"). After signing up they land
back on that drill, signed in.

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
- **Nabbit does:** opens directly on the drill (deep link) in **trial mode** — no
  signup wall *before* the attempt; a slim "what is this?" strip. Records a **lead**
  (anonymous visitor id + challenge id + UTM tags + referrer + sharer ref) in
  Supabase `public.leads` for later retargeting/ads.
- **Share-link tags:** in-app dares carry `utm_source=share`, `utm_medium=bug-dare`,
  `utm_campaign=dare-<challengeId>` and `ref=<anonymous sharer id>`. Hand-made links
  (LinkedIn post, newsletter…) can set their own `utm_*`.
- **Screens:** Challenge (deep-linked, trial) · Landing (signed-out home).
- **Metrics:** share→click CTR · new visitors · % attempting the first drill ·
  leads by `utm_source` / `utm_campaign` / challenge.
- **Drop-off risks:** a signup/landing wall before the drill; slow first paint.

## 2. Activation — *the first "aha"*

- **Goal:** a satisfying first win + "why" inside 2 minutes.
- **User does:** submits an answer, sees correct/wrong + the explanation tied to
  the video's concept.
- **Nabbit does (signed in):** instant deterministic verdict; **inline reveal (same
  page)**; before/after + explanation; personalized "Nice catch, {name}" (name comes
  from the account email — the old skippable name prompt no longer fires).
- **Nabbit does (trial / signed out):** grades locally, then redirects to **sign-up**
  with a verdict-only teaser. **The full explanation is behind sign-up** — a
  deliberate conversion gate, and the main tension with this stage's "no gate before
  value" principle (see open items).
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
- **Screens:** **Dashboard** (the signed-in home: a "Today" card — *N due for review →
  Start review*, or *Continue* when nothing is due — three quiet stats, in-progress
  packs first, YouTube import collapsed) · Recall dashboard · time-travel simulator
  (demo device to show resurfacing without waiting days).
- **Accounts:** email + password (+ **optional** phone) via Supabase Auth; every
  registration is mirrored into `public.users` by a DB trigger. Spaced Recall and the
  streak are members-only. Auth errors are shown in plain product language (e.g.
  "Please use a valid email address from a real domain"), and no screen names the
  auth provider.
- **Fresh start:** a new account begins at zero (no pre-filled progress); the Today
  card reads "Ready for your first bug hunt?" with a **Start** button. Progress is tied
  to the account that created it, so a different account on the same browser starts
  clean.
- **No verification UI:** the demo "enter codes" flow, "Pending" labels and banner were
  removed; demo/test users can sign up with any real-domain address when email
  confirmation is off in the auth settings.
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
- **Attribution:** each share link carries the sharer's anonymous `ref`; the
  `public.lead_sharers` view shows per user: trial visits → completed → signed up.
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
| Login / accounts (Supabase Auth + `public.users`) — **required to save progress**; trial drills work without it | Activation (conversion gate) | Retention |
| Signed-out trial mode (no saved progress → sign-up redirect) | Acquisition | Activation |
| Signed-in dashboard (Today card, stats) | Retention | — |
| Lead capture (`public.leads`) + sharer attribution (`lead_sharers`) | Acquisition | Referral |

## North-star & guardrail metrics

- **North-star:** revisit rate — share of solved concepts the user comes back and re-solves.
- **Acquisition:** share→try CTR · **Activation:** % first-drill complete < 2 min ·
  **Retention:** D7 return, streak · **Referral:** shares / active user ·
  **Revenue:** free→paid %.

---

## Status vs. this spec

**Done:** Supabase Auth + `public.users` mirror (`0001`) · signed-out trial mode ·
signup redirect after a trial drill · signed-in dashboard · UTM-tagged share links ·
`public.leads` capture (`0002`) · sharer ref + `lead_sharers` view (`0003`) ·
landing CTAs (Create free account / Sign up free) · optional phone · friendly,
provider-free auth errors · new accounts start at zero · per-account progress on a
shared browser · verification banner/labels/drawer removed from the UI · deployed on
Vercel with the Supabase env vars.

**Open / mismatching**
1. **Migrations / settings:** `0002` and `0003` were run manually; confirm via an
   end-to-end test (signup → `public.users` row; trial link → `leads` row). The auth
   "Confirm email" setting is off for demo — **turn it back on (and add CAPTCHA)
   before a real launch**, and add a "check your email" notice at that point.
2. **Explanation behind sign-up vs. "no gate before value":** trial users never see
   the *why* unless they register. Decide: keep (stronger conversion) or show the
   reveal first and put the sign-up prompt on its buttons.
3. **Progress is not in Supabase yet.** Attempts and recall items still live in
   browser `localStorage`; only identity is in Supabase. So: **no cross-device sync**
   (the sign-in copy no longer promises it), and progress is isolated per account only
   within one browser — clearing site data loses it. The planned `attempts` /
   `recall_items` tables are still pending (build-plan Phase 7).
4. ~~New accounts start with seeded demo progress~~ — **fixed**. Browsers that already
   hold old demo data keep it until **Reset** (Recall page) or clearing site data.
5. **Verification is minimal:** the UI was removed; email confirmation (when enabled)
   is the auth provider's own, and phone verification has no SMS provider. Pending:
   a resend-confirmation affordance and a post-signup notice if confirmation is
   switched back on. The old verify/resend code in `api.ts` and
   `VerificationDrawer.tsx` is now unused.
6. **Premium vs. free:** build-plan has paste-any-video as a *disabled Pro teaser*,
   but the YouTube importer is live for every signed-in user — decide whether it
   stays free or moves behind Pro.
7. **Leftovers:** local/Express mock auth (`/api/auth/*`, demo sign-in fill) is still
   in the code as a fallback; the NameOnboarding prompt is effectively dormant. (The
   "HelloPM Buildathon Entry" hero label was removed.)
8. **Vercel limits:** per-challenge OG previews and the **YouTube importer** (Gemini
   call lives in `server.ts`) don't run on the static deploy — the importer needs a
   serverless function (`GEMINI_API_KEY` as a non-`VITE_` env var); previews need an
   edge/serverless OG function.

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
