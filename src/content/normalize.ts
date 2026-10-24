import { Challenge } from '../lib/types';

/**
 * Phase 8 v1 — runtime defaults so every drill plays in every v1 format
 * without hand-authoring per-drill fields. Hand-authored values on the
 * Challenge always win. The offline Gemini backfill (see
 * `scripts/backfill-challenge-fields.ts`) can later replace these defaults
 * with higher-quality seed data written directly into `data.ts`.
 *
 *   buggyLineAnswer  default: challenge.buggyLines[0]
 *   seedDistribution default: correct option ~0.42, three decoys ~0.22/0.20/0.16
 *   rankedFixes      NOT defaulted — ranking is quality-sensitive and must be
 *                    authored (hand or Gemini). Drills without it stay out of
 *                    the rank-fixes format.
 */

const DEFAULT_WRONG_SHARE = [0.22, 0.2, 0.16, 0.14, 0.12];

function defaultSeedDistribution(correctOption: number, n: number): number[] {
  if (n <= 0) return [];
  const wrongPicks = DEFAULT_WRONG_SHARE.slice(0, Math.max(0, n - 1));
  const used = wrongPicks.reduce((a, b) => a + b, 0);
  const correctShare = Math.max(0, 1 - used);
  const dist = new Array(n).fill(0);
  let w = 0;
  for (let i = 0; i < n; i++) {
    if (i === correctOption) dist[i] = correctShare;
    else dist[i] = wrongPicks[w++] ?? 0;
  }
  return dist;
}

export function normalizeChallenge(c: Challenge): Challenge {
  const hasBuggyLineAnswer = typeof c.buggyLineAnswer === 'number';
  const hasSeedDist =
    Array.isArray(c.seedDistribution) && c.seedDistribution.length === c.fixOptions.length;
  const hasCanonicalPatch = Boolean(c.canonicalPatch && typeof c.canonicalPatch.newText === 'string');

  if (hasBuggyLineAnswer && hasSeedDist && hasCanonicalPatch) return c;

  return {
    ...c,
    buggyLineAnswer: hasBuggyLineAnswer
      ? c.buggyLineAnswer
      : c.buggyLines[0], // may be undefined if buggyLines is empty — grading guards for that
    seedDistribution: hasSeedDist
      ? c.seedDistribution
      : defaultSeedDistribution(c.correctOption, c.fixOptions.length),
    // Phase 8 v2 — derive a canonical patch from the drill's correctCode so
    // blind-fix lights up on every drill. The whole fixed snippet counts as the
    // "patch" — grading uses Levenshtein on whitespace-normalised text, so an
    // exact character match isn't needed. Gemini pass #2 will author tighter,
    // single-line patches drill-by-drill.
    canonicalPatch: hasCanonicalPatch
      ? c.canonicalPatch
      : { oldLines: c.buggyLines, newText: c.correctCode },
  };
}

export function normalizeChallenges(cs: Challenge[]): Challenge[] {
  return cs.map(normalizeChallenge);
}
