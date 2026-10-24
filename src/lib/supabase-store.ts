/**
 * Phase 8 v2 — Supabase-backed progress store.
 *
 * Wraps the server-side RPCs defined in supabase/migrations/0004-0008:
 *   apply_attempt         — the single write path (returns Elo + global streak)
 *   merge_local_progress  — one-shot first-sign-in push of local state
 *   Direct table reads   — attempts / recall_items / concept_elo / streaks
 *
 * `api.ts` picks between `localStore` (anon / trial) and this adapter per
 * call based on `isSupabaseConfigured() && currentUser`. Grading stays
 * client-side (deterministic, tested in src/lib/grading.test.ts); the RPC
 * re-grades spot-fix as a sanity check.
 *
 * Reads are not cached here — every call hits the network. Caching + an
 * offline queue are v2 polish items, deferred.
 */

import {
  Attempt,
  AttemptInput,
  Challenge,
  Confidence,
  RecallItem,
  RecallStats,
  ScoreBreakdown,
  ChallengeFormat,
} from './types';
import { supabase } from './supabase';
import { grade, computeScore } from './grading';

export interface SupabaseAttemptResult {
  attempt: Attempt;
  correct: boolean;
  outcome: 0 | 0.5 | 1;
  explanation: string;
  recallItem: RecallItem;
  stats: RecallStats;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  comboAfter: number;
  // v2 additions (optional on the public AttemptResult so LocalStore stays compatible):
  newRating?: number;
  eloDelta?: number;
  globalStreak?: number;
  freezesRemaining?: number;
}

export interface StreakState {
  current: number;
  best: number;
  freezes: number;
}

function baseRating(difficulty: Challenge['difficulty']): number {
  switch (difficulty) {
    case 'Beginner': return 1100;
    case 'Intermediate': return 1400;
    case 'Advanced': return 1700;
  }
}

function requireClient() {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

/**
 * Shape of a row from public.attempts, mapped onto the client Attempt type.
 */
function rowToAttempt(r: any): Attempt {
  return {
    challengeId: r.challenge_id,
    chosen: r.chosen ?? -1,
    correct: r.correct,
    at: new Date(r.at).getTime(),
    format: r.format as ChallengeFormat,
    confidence: r.confidence as Confidence,
    timeMs: r.time_ms,
    score: Number(r.score),
    comboAtTime: r.combo_at_time,
    outcome: Number(r.outcome) as 0 | 0.5 | 1,
    input: r.payload ?? undefined,
  };
}

function rowToRecallItem(r: any): RecallItem {
  return {
    challengeId: r.challenge_id,
    concept: r.concept,
    videoId: r.video_id,
    interval: r.interval_days as 1 | 3 | 7 | 14 | 30,
    nextReviewAt: new Date(r.next_review_at).getTime(),
    lastReviewedAt: new Date(r.last_reviewed_at).getTime(),
    streak: r.streak,
    history: [],   // history is computed on demand from attempts; server stores attempt rows separately
  };
}

export class SupabaseStore {
  async getAttempts(): Promise<Attempt[]> {
    const sb = requireClient();
    const { data, error } = await sb
      .from('attempts')
      .select('*')
      .order('at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToAttempt);
  }

  async getRecallItems(): Promise<RecallItem[]> {
    const sb = requireClient();
    const [{ data: items, error: iErr }, { data: attempts, error: aErr }] = await Promise.all([
      sb.from('recall_items').select('*'),
      sb.from('attempts').select('*').order('at', { ascending: true }),
    ]);
    if (iErr) throw iErr;
    if (aErr) throw aErr;
    const historyByChallenge = new Map<string, Attempt[]>();
    for (const r of attempts ?? []) {
      const a = rowToAttempt(r);
      const list = historyByChallenge.get(a.challengeId) ?? [];
      list.push(a);
      historyByChallenge.set(a.challengeId, list);
    }
    return (items ?? []).map(r => ({
      ...rowToRecallItem(r),
      history: historyByChallenge.get(r.challenge_id) ?? [],
    }));
  }

  /**
   * The single write path when signed in. Grades locally (deterministic),
   * composes the score, sends the whole payload to apply_attempt. Server
   * re-grades spot-fix for defense in depth; other formats trust the client.
   */
  async recordAttempt(
    challenge: Challenge,
    input: AttemptInput,
    meta: { confidence: Confidence; timeMs: number; combo: number },
  ): Promise<SupabaseAttemptResult> {
    const sb = requireClient();
    const g = grade(challenge, input);
    const comboAfter = g.outcome === 1
      ? meta.combo + 1
      : g.outcome === 0.5 ? meta.combo
      : 0;
    const breakdown = computeScore(g, challenge, { ...meta, comboAfter });

    const chosen =
      input.format === 'spot-fix' || input.format === 'locate-then-fix'
        ? input.chosen
        : -1;

    const payload = {
      challenge_id: challenge.id,
      concept: challenge.concept,
      video_id: challenge.videoId,
      difficulty: challenge.difficulty,
      format: input.format,
      chosen,
      correct_option: challenge.correctOption,
      confidence: meta.confidence,
      time_ms: meta.timeMs,
      outcome: g.outcome,
      score: breakdown.score,
      combo_at_time: comboAfter,
      base_rating: baseRating(challenge.difficulty),
      input,
    };

    const { data, error } = await sb.rpc('apply_attempt', { payload });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('apply_attempt returned no row');

    const attempt: Attempt = {
      challengeId: challenge.id,
      chosen,
      correct: row.correct,
      at: Date.now(),
      format: input.format,
      confidence: meta.confidence,
      timeMs: meta.timeMs,
      score: Number(row.score),
      comboAtTime: comboAfter,
      outcome: Number(row.outcome) as 0 | 0.5 | 1,
      input,
    };

    const recallItem: RecallItem = {
      challengeId: challenge.id,
      concept: challenge.concept,
      videoId: challenge.videoId,
      interval: row.interval_days as 1 | 3 | 7 | 14 | 30,
      nextReviewAt: new Date(row.next_review_at).getTime(),
      lastReviewedAt: Date.now(),
      streak: row.streak,
      history: [], // caller refetches if a full history is needed
    };

    // Minimal stats shape — api.ts recomputes richer stats from a dashboard fetch.
    const stats: RecallStats = {
      revisitRate: 0,
      currentStreak: Number(row.global_streak ?? 0),
      totalSolved: 0,
      dueCount: 0,
      atRiskCount: 0,
      masteredCount: 0,
      simulatedOffsetDays: 0,
    };

    return {
      attempt,
      correct: row.correct,
      outcome: Number(row.outcome) as 0 | 0.5 | 1,
      explanation: challenge.explanation,
      recallItem,
      stats,
      score: Number(row.score),
      scoreBreakdown: breakdown,
      comboAfter,
      newRating: row.new_rating !== undefined ? Number(row.new_rating) : undefined,
      eloDelta: row.delta !== undefined ? Number(row.delta) : undefined,
      globalStreak: row.global_streak !== undefined ? Number(row.global_streak) : undefined,
      freezesRemaining: row.freezes_remaining !== undefined ? Number(row.freezes_remaining) : undefined,
    };
  }

  async getStreakState(): Promise<StreakState | null> {
    const sb = requireClient();
    const { data, error } = await sb.from('streaks').select('*').maybeSingle();
    if (error && error.code !== 'PGRST116') throw error; // no row for this user yet
    if (!data) return null;
    return { current: data.current, best: data.best, freezes: data.freezes };
  }

  async getConceptElo(): Promise<{ concept: string; rating: number; games: number }[]> {
    const sb = requireClient();
    const { data, error } = await sb.from('concept_elo').select('concept, rating, games').order('rating', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(r => ({ concept: r.concept, rating: r.rating, games: r.games }));
  }

  async mergeLocalProgress(
    attempts: Attempt[],
    recallItems: RecallItem[],
    challengesById: Map<string, Challenge>,
  ): Promise<{ attempts_imported: number; recall_imported: number }> {
    const sb = requireClient();
    const serialisableAttempts = attempts.map(a => {
      const c = challengesById.get(a.challengeId);
      return {
        challenge_id: a.challengeId,
        concept: c?.concept ?? '',
        video_id: c?.videoId ?? '',
        difficulty: c?.difficulty ?? 'Beginner',
        format: a.format ?? 'spot-fix',
        chosen: a.chosen,
        correct: a.correct,
        outcome: a.outcome ?? (a.correct ? 1 : 0),
        confidence: a.confidence ?? 'sure',
        time_ms: a.timeMs ?? 0,
        score: a.score ?? 0,
        combo_at_time: a.comboAtTime ?? 0,
        input: a.input ?? null,
        at: a.at, // ms epoch — RPC converts via to_timestamp(bigint/1000.0)
      };
    });
    const serialisableRecall = recallItems.map(r => ({
      challenge_id: r.challengeId,
      concept: r.concept,
      video_id: r.videoId,
      interval_days: r.interval,
      next_review_at: r.nextReviewAt,
      last_reviewed_at: r.lastReviewedAt,
      streak: r.streak,
    }));
    const { data, error } = await sb.rpc('merge_local_progress', {
      payload: { attempts: serialisableAttempts, recall_items: serialisableRecall },
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return {
      attempts_imported: Number(row?.attempts_imported ?? 0),
      recall_imported: Number(row?.recall_imported ?? 0),
    };
  }
}

export const supabaseStore = new SupabaseStore();
