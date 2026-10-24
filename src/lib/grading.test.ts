/**
 * Phase 8 v1 — round-trip grading suite. Loads every curated drill, enumerates
 * every format its (possibly normalized) `availableFormats` reports, and asserts
 * the canonical answer grades correct. Catches drift between the content, the
 * normalizer and the grader.
 *
 * Run with: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Minimal localStorage shim so modules that touch it under Node don't crash.
// `src/lib/streak-freeze.ts` reaches into localStorage; the shim gives it an
// in-memory store that mirrors the browser surface used by get/mark.
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
}

import { CURATED_CHALLENGES } from '../content/data';
import { normalizeChallenge } from '../content/normalize';
import {
  grade,
  availableFormats,
  computeScore,
  confidenceMultiplier,
  speedFactor,
  medianTimeMs,
  kendallTau,
} from './grading';
import { computeStats } from './recall';
import { weekStartISO, getFreezeState, markFreezeUsed } from './streak-freeze';
import { AttemptInput, Attempt, ChallengeFormat } from './types';

/** Build the canonical "right answer" input for a given format. */
function canonicalInput(challenge: ReturnType<typeof normalizeChallenge>, format: ChallengeFormat): AttemptInput | null {
  switch (format) {
    case 'spot-fix':
      return { format: 'spot-fix', chosen: challenge.correctOption };
    case 'locate-then-fix':
      if (typeof challenge.buggyLineAnswer !== 'number') return null;
      return { format: 'locate-then-fix', line: challenge.buggyLineAnswer, chosen: challenge.correctOption };
    case 'rank-fixes':
      if (!Array.isArray(challenge.rankedFixes)) return null;
      return { format: 'rank-fixes', order: challenge.rankedFixes };
    case 'blind-fix':
      if (!challenge.canonicalPatch) return null;
      return { format: 'blind-fix', patch: challenge.canonicalPatch.newText };
    case 'diff-review':
      if (!challenge.reviewVerdict) return null;
      return challenge.reviewVerdict === 'request-changes'
        ? { format: 'diff-review', verdict: 'request-changes', chosen: challenge.correctOption }
        : { format: 'diff-review', verdict: challenge.reviewVerdict as 'approve' | 'comment' };
    case 'impostor':
      // Correct answer is still correctOption (the impostor at index == fixOptions.length is the decoy).
      return { format: 'impostor', chosen: challenge.correctOption };
    case 'red-herring':
      if (typeof challenge.buggyLineAnswer !== 'number') return null;
      return { format: 'red-herring', chosenLine: challenge.buggyLineAnswer, chosen: challenge.correctOption };
    default:
      return null;
  }
}

for (const raw of CURATED_CHALLENGES) {
  const c = normalizeChallenge(raw);
  const formats = availableFormats(c);
  for (const fmt of formats) {
    test(`${c.id} · ${fmt} · canonical answer grades correct`, () => {
      const input = canonicalInput(c, fmt);
      if (input === null) {
        // The drill advertises the format but lacks the field — availableFormats bug.
        assert.fail(`${c.id} advertises ${fmt} but has no canonical answer field`);
      }
      const g = grade(c, input);
      assert.equal(g.correct, true, `${c.id}/${fmt} should grade correct — got ${JSON.stringify(g)}`);
      assert.equal(g.outcome, 1);
      assert.equal(g.basePoints, 100);
    });
  }
}

test('normalize fills locate-then-fix on every drill (buggyLineAnswer = buggyLines[0])', () => {
  for (const raw of CURATED_CHALLENGES) {
    const c = normalizeChallenge(raw);
    const formats = availableFormats(c);
    assert.ok(
      formats.includes('locate-then-fix'),
      `${c.id} should play locate-then-fix after normalize`,
    );
    assert.equal(typeof c.buggyLineAnswer, 'number');
  }
});

test('normalize fills blind-fix on every drill (canonicalPatch defaults to correctCode)', () => {
  for (const raw of CURATED_CHALLENGES) {
    const c = normalizeChallenge(raw);
    const formats = availableFormats(c);
    assert.ok(
      formats.includes('blind-fix'),
      `${c.id} should play blind-fix after normalize`,
    );
    assert.ok(typeof c.canonicalPatch?.newText === 'string');
  }
});

test('diff-review grading: verdict match → correct; wrong fix on request-changes → partial', () => {
  const c = normalizeChallenge(CURATED_CHALLENGES[0]);
  // Canonical verdict is 'request-changes' + chosen = correctOption → correct.
  const good = grade(c, { format: 'diff-review', verdict: 'request-changes', chosen: c.correctOption });
  assert.equal(good.correct, true);
  // Right verdict, wrong fix → partial.
  const wrongFix = (c.correctOption + 1) % c.fixOptions.length;
  const partial = grade(c, { format: 'diff-review', verdict: 'request-changes', chosen: wrongFix });
  assert.equal(partial.outcome, 0.5);
  // Wrong verdict (approve on a drill with a planted bug) → wrong.
  const wrong = grade(c, { format: 'diff-review', verdict: 'approve' });
  assert.equal(wrong.outcome, 0);
});

test('blind-fix grading: ~exact patch → correct; slightly off → partial; nonsense → wrong', () => {
  const c = normalizeChallenge(CURATED_CHALLENGES[0]);
  const canonical = c.canonicalPatch!.newText;
  const perfect = grade(c, { format: 'blind-fix', patch: canonical });
  assert.equal(perfect.correct, true);
  // Slightly off — insert some trivial noise but keep most text intact.
  const slightlyOff = canonical.slice(0, Math.max(1, Math.floor(canonical.length * 0.78)));
  const partial = grade(c, { format: 'blind-fix', patch: slightlyOff });
  assert.ok(partial.outcome >= 0.5, `expected ≥ 0.5 outcome, got ${partial.outcome}`);
  const wrong = grade(c, { format: 'blind-fix', patch: 'totally unrelated text' });
  assert.equal(wrong.outcome, 0);
});

test('spot-fix grades a wrong pick as outcome 0', () => {
  const c = normalizeChallenge(CURATED_CHALLENGES[0]);
  const wrong = (c.correctOption + 1) % c.fixOptions.length;
  const g = grade(c, { format: 'spot-fix', chosen: wrong });
  assert.equal(g.correct, false);
  assert.equal(g.outcome, 0);
  assert.equal(g.basePoints, -40);
});

test('locate-then-fix partial credit: line right, fix wrong → outcome 0.5', () => {
  const c = normalizeChallenge(CURATED_CHALLENGES[0]);
  assert.equal(typeof c.buggyLineAnswer, 'number');
  const wrongFix = (c.correctOption + 1) % c.fixOptions.length;
  const g = grade(c, { format: 'locate-then-fix', line: c.buggyLineAnswer!, chosen: wrongFix });
  assert.equal(g.correct, false);
  assert.equal(g.outcome, 0.5);
  assert.equal(g.basePoints, 50);
});

test('locate-then-fix wrong line → outcome 0 even if the fix matches', () => {
  const c = normalizeChallenge(CURATED_CHALLENGES[0]);
  const wrongLine = (c.buggyLineAnswer ?? 1) + 100;
  const g = grade(c, { format: 'locate-then-fix', line: wrongLine, chosen: c.correctOption });
  assert.equal(g.correct, false);
  assert.equal(g.outcome, 0);
});

test('rank-fixes: Kendall-tau correlation thresholds', () => {
  // 4 items, canonical [3, 2, 1, 0].
  const canonical = [3, 2, 1, 0];
  assert.equal(kendallTau(canonical, canonical), 1, 'identical ordering → tau 1');
  assert.equal(kendallTau([0, 1, 2, 3], canonical), -1, 'reversed → tau -1');
  // One adjacent swap on 4 items: 5/6 concordant, 1/6 discordant → (5-1)/6 ≈ 0.667
  const oneSwap = [3, 2, 0, 1]; // swapped last two vs canonical [3,2,1,0]
  const tau = kendallTau(oneSwap, canonical);
  assert.ok(Math.abs(tau - 2 / 3) < 1e-9, `expected ~0.667, got ${tau}`);
});

test('rank-fixes grading on a seeded drill (react-state-batching)', () => {
  const raw = CURATED_CHALLENGES.find(c => c.id === 'react-state-batching');
  assert.ok(raw, 'seeded drill present');
  const c = normalizeChallenge(raw!);
  assert.ok(c.rankedFixes, 'rankedFixes authored for this drill');
  const perfect = grade(c, { format: 'rank-fixes', order: c.rankedFixes! });
  assert.equal(perfect.correct, true);
  // Fully reversed → tau -1 → outcome 0
  const reversed = grade(c, { format: 'rank-fixes', order: [...c.rankedFixes!].reverse() });
  assert.equal(reversed.correct, false);
  assert.equal(reversed.outcome, 0);
});

test('score formula: wrong + certain doubles the loss', () => {
  const c = normalizeChallenge(CURATED_CHALLENGES[0]);
  const wrong = { basePoints: -40, outcome: 0 as const, correct: false };
  const guess = computeScore(wrong, c, { confidence: 'guess', timeMs: medianTimeMs(c.difficulty), comboAfter: 0 });
  const certain = computeScore(wrong, c, { confidence: 'certain', timeMs: medianTimeMs(c.difficulty), comboAfter: 0 });
  assert.equal(guess.score, -40);
  assert.equal(certain.score, -80, 'certain × 2 on a wrong answer doubles the loss');
});

test('score formula: confidence × speed × combo on a correct answer', () => {
  const c = normalizeChallenge(CURATED_CHALLENGES[0]);
  const good = { basePoints: 100, outcome: 1 as const, correct: true };
  // At median time + guess + combo 0 → base × 1 × 1 × 1 = 100
  const base = computeScore(good, c, { confidence: 'guess', timeMs: medianTimeMs(c.difficulty), comboAfter: 0 });
  assert.equal(base.score, 100);
  // At zero time, speedFactor is clamped to 2 → base × 2 × 2 × (combo 4 = ×1.4) = 100 × 2 × 2 × 1.4 = 560
  const fast = computeScore(good, c, { confidence: 'certain', timeMs: 0, comboAfter: 4 });
  assert.equal(fast.score, 560);
});

test('speedFactor is clamped to [0.5, 2]', () => {
  assert.equal(speedFactor(0, 10_000), 2);
  assert.equal(speedFactor(10_000, 10_000), 1);
  assert.equal(speedFactor(1_000_000, 10_000), 0.5);
});

test('confidenceMultiplier maps the three levels', () => {
  assert.equal(confidenceMultiplier('guess'), 1);
  assert.equal(confidenceMultiplier('sure'), 1.5);
  assert.equal(confidenceMultiplier('certain'), 2);
});

// --- rank-fixes authored on every drill (via backfill heuristic + hand seed) ---

test('every curated drill plays all three v1 formats', () => {
  for (const raw of CURATED_CHALLENGES) {
    const c = normalizeChallenge(raw);
    const formats = availableFormats(c);
    for (const f of ['spot-fix', 'locate-then-fix', 'rank-fixes'] as const) {
      assert.ok(formats.includes(f), `${c.id} should advertise ${f}, got ${formats.join(',')}`);
    }
    // Canonical rank-fixes answer grades correct.
    const g = grade(c, { format: 'rank-fixes', order: c.rankedFixes! });
    assert.equal(g.correct, true, `${c.id} rank-fixes canonical should grade correct`);
  }
});

// --- weekStartISO + streak freeze ---

test('weekStartISO: Monday is the week anchor; Sunday rolls back to prior Monday', () => {
  // Thu 2026-10-22 → Mon 2026-10-19
  assert.equal(weekStartISO(Date.UTC(2026, 9, 22, 15, 0, 0)), '2026-10-19');
  // Sun 2026-10-18 → Mon 2026-10-12
  assert.equal(weekStartISO(Date.UTC(2026, 9, 18, 23, 59, 0)), '2026-10-12');
  // Mon 2026-10-19 00:00 → itself
  assert.equal(weekStartISO(Date.UTC(2026, 9, 19, 0, 0, 0)), '2026-10-19');
});

test('streak freeze: computeStats skips one wrong attempt per week when freeze is used', () => {
  localStorage.clear();
  const monday = Date.UTC(2026, 9, 19, 10, 0, 0); // Mon 2026-10-19
  const tue = monday + 24 * 3600 * 1000;
  const wed = monday + 2 * 24 * 3600 * 1000;
  // Three attempts this week: correct, wrong, correct. Without freeze: streak = 1.
  const attempts: Attempt[] = [
    { challengeId: 'x', chosen: 0, correct: true, at: monday },
    { challengeId: 'x', chosen: 1, correct: false, at: tue },
    { challengeId: 'x', chosen: 0, correct: true, at: wed },
  ];
  // No freeze used yet: freeze state is {used: false}, so computeStats breaks on the wrong one.
  const beforeFreeze = computeStats([], attempts, 0);
  assert.equal(beforeFreeze.currentStreak, 1, 'without freeze consumed, streak breaks on the wrong attempt');

  // Mark freeze used; stats should now count across the wrong one.
  markFreezeUsed(wed);
  const afterFreeze = computeStats([], attempts, 0);
  assert.equal(afterFreeze.currentStreak, 2, 'freeze absorbs the single wrong attempt');

  // A SECOND wrong attempt the same week still breaks the streak (freeze is one-per-week).
  const attempts2: Attempt[] = [
    ...attempts,
    { challengeId: 'x', chosen: 1, correct: false, at: wed + 3600 * 1000 },
    { challengeId: 'x', chosen: 0, correct: true, at: wed + 2 * 3600 * 1000 },
  ];
  const twoWrong = computeStats([], attempts2, 0);
  assert.equal(twoWrong.currentStreak, 1, 'second wrong attempt still breaks the streak');
  localStorage.clear();
});

test('streak freeze: resets automatically on a new ISO-week', () => {
  localStorage.clear();
  const lastWeek = Date.UTC(2026, 9, 15, 10, 0, 0); // Thu last week
  markFreezeUsed(lastWeek);
  const thisWeek = Date.UTC(2026, 9, 22, 10, 0, 0); // Thu this week
  const s = getFreezeState(thisWeek);
  assert.equal(s.used, false, 'rollover week → freeze available again');
  localStorage.clear();
});
