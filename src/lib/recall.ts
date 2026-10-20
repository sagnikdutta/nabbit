import { Attempt, RecallItem, RecallStats } from './types';
import { CURATED_CHALLENGES } from '../content/data';

const INTERVAL_LADDER: (1 | 3 | 7 | 14 | 30)[] = [1, 3, 7, 14, 30];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function getSimulatedNow(offsetDays: number = 0): number {
  return Date.now() + offsetDays * ONE_DAY_MS;
}

export function computeNextInterval(currentInterval: 1 | 3 | 7 | 14 | 30, correct: boolean): 1 | 3 | 7 | 14 | 30 {
  if (!correct) return 1;
  const currentIndex = INTERVAL_LADDER.indexOf(currentInterval);
  if (currentIndex === -1 || currentIndex >= INTERVAL_LADDER.length - 1) {
    return 30;
  }
  return INTERVAL_LADDER[currentIndex + 1];
}

export function calculateRecallSchedule(
  existingItem: RecallItem | undefined,
  challengeId: string,
  concept: string,
  videoId: string,
  attempt: Attempt,
  offsetDays: number = 0
): RecallItem {
  const now = getSimulatedNow(offsetDays);

  if (!existingItem) {
    const interval: 1 | 3 | 7 | 14 | 30 = attempt.correct ? 1 : 1;
    const nextReviewAt = now + interval * ONE_DAY_MS;
    return {
      challengeId,
      concept,
      videoId,
      interval,
      nextReviewAt,
      lastReviewedAt: now,
      streak: attempt.correct ? 1 : 0,
      history: [attempt],
    };
  }

  const nextInterval = computeNextInterval(existingItem.interval, attempt.correct);
  const nextReviewAt = now + nextInterval * ONE_DAY_MS;
  const newStreak = attempt.correct ? existingItem.streak + 1 : 0;

  return {
    ...existingItem,
    interval: nextInterval,
    nextReviewAt,
    lastReviewedAt: now,
    streak: newStreak,
    history: [...existingItem.history, attempt],
  };
}

export function computeStats(items: RecallItem[], attempts: Attempt[], offsetDays: number = 0): RecallStats {
  const now = getSimulatedNow(offsetDays);

  const dueItems = items.filter(item => item.nextReviewAt <= now);
  const atRiskItems = items.filter(item => {
    // Overdue by more than 24 hours or failed in last attempt
    const isOverdueLong = now - item.nextReviewAt > ONE_DAY_MS;
    const lastAttempt = item.history[item.history.length - 1];
    const failedRecently = lastAttempt && !lastAttempt.correct;
    return isOverdueLong || failedRecently;
  });

  const masteredItems = items.filter(item => item.interval >= 14);

  // Revisit rate: items with > 1 attempt divided by total solved items
  const totalSolved = items.length;
  const revisitedCount = items.filter(item => item.history.length > 1).length;
  const revisitRate = totalSolved > 0 ? Math.round((revisitedCount / totalSolved) * 100) : 0;

  // Streak: consecutive successful attempts ending at most recent
  let currentStreak = 0;
  for (let i = attempts.length - 1; i >= 0; i--) {
    if (attempts[i].correct) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    revisitRate,
    currentStreak,
    totalSolved,
    dueCount: dueItems.length,
    atRiskCount: atRiskItems.length,
    masteredCount: masteredItems.length,
    simulatedOffsetDays: offsetDays,
  };
}

// Generate initial sample seed items so the dashboard is immediately demonstrable
export function getInitialSeedRecall(): { items: RecallItem[]; attempts: Attempt[] } {
  const now = Date.now();
  const c1 = CURATED_CHALLENGES[0];
  const c2 = CURATED_CHALLENGES[1];

  const attempts: Attempt[] = [
    { challengeId: c1.id, chosen: c1.correctOption, correct: true, at: now - 3 * ONE_DAY_MS },
    { challengeId: c1.id, chosen: c1.correctOption, correct: true, at: now - 2 * ONE_DAY_MS },
    { challengeId: c2.id, chosen: c2.correctOption, correct: true, at: now - 1 * ONE_DAY_MS },
  ];

  const items: RecallItem[] = [
    {
      challengeId: c1.id,
      concept: c1.concept,
      videoId: c1.videoId,
      interval: 3,
      // Due today!
      nextReviewAt: now - 2 * 60 * 60 * 1000,
      lastReviewedAt: now - 2 * ONE_DAY_MS,
      streak: 2,
      history: [attempts[0], attempts[1]],
    },
    {
      challengeId: c2.id,
      concept: c2.concept,
      videoId: c2.videoId,
      interval: 1,
      // Due tomorrow
      nextReviewAt: now + 18 * 60 * 60 * 1000,
      lastReviewedAt: now - 1 * ONE_DAY_MS,
      streak: 1,
      history: [attempts[2]],
    },
  ];

  return { items, attempts };
}
