// Phase 8 v1 — deterministic grading + score formula.
// Pure functions, no I/O, no LLM. Safe to run client-side on every attempt.

import { Challenge, AttemptInput, Confidence, ScoreBreakdown } from './types';

export interface GradeResult {
  correct: boolean;        // full-correct — advances SRS interval, increments combo/streak
  outcome: 0 | 0.5 | 1;    // SRS/Elo signal (0.5 = partial credit: streak preserved, interval unchanged)
  basePoints: number;      // 100 full / 50 partial / -40 wrong — before any multipliers
}

// v1 anchor: a static median time until we have real per-drill attempt data.
// Advanced drills get a longer anchor so speed scoring stays fair.
export function medianTimeMs(difficulty: Challenge['difficulty']): number {
  switch (difficulty) {
    case 'Beginner': return 20_000;
    case 'Intermediate': return 35_000;
    case 'Advanced': return 60_000;
  }
}

export function confidenceMultiplier(c: Confidence): 1 | 1.5 | 2 {
  if (c === 'guess') return 1;
  if (c === 'sure') return 1.5;
  return 2;
}

export function speedFactor(timeMs: number, median: number): number {
  const raw = 1 + (median - timeMs) / median;
  return Math.max(0.5, Math.min(2, raw));
}

/**
 * Formats available for this drill, derived from field presence (author can override
 * with `challenge.availableFormats`). Keep in sync with AttemptInput's union.
 */
export function availableFormats(challenge: Challenge) {
  if (challenge.availableFormats && challenge.availableFormats.length) {
    return challenge.availableFormats;
  }
  const formats: ('spot-fix' | 'locate-then-fix' | 'rank-fixes')[] = ['spot-fix'];
  if (typeof challenge.buggyLineAnswer === 'number') formats.push('locate-then-fix');
  if (Array.isArray(challenge.rankedFixes) && challenge.rankedFixes.length === challenge.fixOptions.length) {
    formats.push('rank-fixes');
  }
  return formats;
}

/**
 * Grade an attempt. Deterministic — client and server agree on the result.
 */
export function grade(challenge: Challenge, input: AttemptInput): GradeResult {
  switch (input.format) {
    case 'spot-fix': {
      const correct = input.chosen === challenge.correctOption;
      return {
        correct,
        outcome: correct ? 1 : 0,
        basePoints: correct ? 100 : -40,
      };
    }
    case 'locate-then-fix': {
      // Partial credit: line right, fix wrong → half success. Preserves streak,
      // doesn't advance the SRS interval.
      const lineRight = typeof challenge.buggyLineAnswer === 'number'
        && input.line === challenge.buggyLineAnswer;
      const fixRight = input.chosen === challenge.correctOption;
      if (lineRight && fixRight) {
        return { correct: true, outcome: 1, basePoints: 100 };
      }
      if (lineRight) {
        return { correct: false, outcome: 0.5, basePoints: 50 };
      }
      return { correct: false, outcome: 0, basePoints: -40 };
    }
    case 'rank-fixes': {
      // Deferred in v1a — ships in a later slice. Fail closed if called.
      return { correct: false, outcome: 0, basePoints: -40 };
    }
  }
}

/**
 * Compose the score from the grading result + the submit-time context.
 *
 * score = base × confidence × speed × combo (rounded)
 *
 *  - confidence: 1 / 1.5 / 2 (never affects outcome — score-only)
 *  - speed: clamp(1 + (median - time) / median, 0.5, 2)
 *  - combo: min(1 + 0.1 × comboAfter, 2); 1 when wrong (combo breaks)
 *  - wrong + certain doubles the loss (handled below)
 */
export function computeScore(
  grade: GradeResult,
  challenge: Challenge,
  meta: { confidence: Confidence; timeMs: number; comboAfter: number },
): ScoreBreakdown {
  const conf = confidenceMultiplier(meta.confidence);
  const speed = speedFactor(meta.timeMs, medianTimeMs(challenge.difficulty));

  if (grade.basePoints < 0) {
    // Wrong: loss scales with confidence (certain doubles it); speed/combo don't help.
    const score = Math.round(grade.basePoints * conf);
    return {
      basePoints: grade.basePoints,
      confidenceMultiplier: conf,
      speedFactor: 1,
      comboMultiplier: 1,
      score,
    };
  }

  const comboMult = Math.min(1 + 0.1 * meta.comboAfter, 2);
  const score = Math.round(grade.basePoints * conf * speed * comboMult);
  return {
    basePoints: grade.basePoints,
    confidenceMultiplier: conf,
    speedFactor: Number(speed.toFixed(2)),
    comboMultiplier: Number(comboMult.toFixed(2)),
    score,
  };
}
