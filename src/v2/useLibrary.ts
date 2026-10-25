import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Challenge, RecallItem, RecallStats, Video } from '../lib/types';
import { ShellStats, shellStatsFromDashboard } from './useShellData';

/*
 * Library snapshot for the V2 Import / My Library / Progress pages: videos,
 * their drills and per-video progress derived from the user's recall items.
 * (The Dashboard keeps its own loader; this is the shared version for the
 * pages that were nav stubs.)
 */

export interface LibraryCard {
  video: Video;
  challenges: Challenge[];
  drillsDone: number;
  drillsTotal: number;
  progress: number;
  tags: string[];
  lastAttemptAt: number;
  /** First unsolved drill (or the first drill when everything is solved). */
  nextChallengeId: string | null;
}

type RecallRow = RecallItem & { challenge?: Challenge };

const EMPTY_STATS: RecallStats = {
  revisitRate: 0,
  currentStreak: 0,
  totalSolved: 0,
  dueCount: 0,
  atRiskCount: 0,
  masteredCount: 0,
  simulatedOffsetDays: 0,
};

export function useV2Library() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [challengesByVideo, setChallengesByVideo] = useState<Map<string, Challenge[]>>(new Map());
  const [recallItems, setRecallItems] = useState<RecallRow[]>([]);
  const [stats, setStats] = useState<RecallStats>(EMPTY_STATS);
  const [shell, setShell] = useState<ShellStats>({ streak: 0, xp: 0, level: 1, xpProgress: 0 });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [vids, dash] = await Promise.all([api.getVideos(), api.getRecallDashboard()]);
      const map = new Map<string, Challenge[]>();
      await Promise.all(vids.map(async v => { map.set(v.id, await api.getVideoChallenges(v.id)); }));
      setVideos(vids);
      setChallengesByVideo(map);
      setRecallItems((dash.allItems || []) as RecallRow[]);
      setStats(dash.stats || EMPTY_STATS);
      setShell(shellStatsFromDashboard(dash));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    return api.onAuthChange(() => reload());
  }, [reload]);

  const cards: LibraryCard[] = useMemo(() => videos.map(video => {
    const challenges = challengesByVideo.get(video.id) || [];
    const mine = recallItems.filter(r => r.videoId === video.id);
    const drillsTotal = Math.max(challenges.length, video.conceptCount || 0, 1);
    const drillsDone = mine.length;
    const solved = new Set(mine.map(r => r.challengeId));
    const concepts = Array.from(new Set(challenges.map(c => c.concept))).slice(0, 3);
    return {
      video,
      challenges,
      drillsDone,
      drillsTotal,
      progress: Math.min(1, drillsDone / drillsTotal),
      tags: concepts.length ? concepts : [video.stack],
      lastAttemptAt: mine.reduce((max, r) => Math.max(max, r.lastReviewedAt || 0), 0),
      nextChallengeId: (challenges.find(c => !solved.has(c.id)) ?? challenges[0])?.id ?? null,
    };
  }), [videos, challengesByVideo, recallItems]);

  return { loading, cards, recallItems, stats, shell, reload };
}
