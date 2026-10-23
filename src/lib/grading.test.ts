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
import { AttemptInput, ChallengeFormat } from './types';

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
