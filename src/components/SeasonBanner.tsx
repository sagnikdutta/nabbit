import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Calendar } from 'lucide-react';

export interface SeasonBannerProps {
  /** Phase 8 v3 — Pro-gated; non-Pro users don't get the banner at all. */
  isPro: boolean;
  onOpenLeaderboard?: () => void;
}

interface State {
  seasonId: string | null;
  name: string | null;
  endsAt: string | null;
  avgRating: number | null;
  bucket: Bucket;
  nextBucket: Bucket | null;
  pointsToNext: number | null;
}

type Bucket = 'Diamond' | 'Platinum' | 'Gold' | 'Silver';

const THRESHOLDS: Record<Bucket, number> = {
  Silver: 0,
  Gold: 1300,
  Platinum: 1500,
  Diamond: 1700,
};

function bucketFor(r: number): Bucket {
  if (r >= THRESHOLDS.Diamond) return 'Diamond';
  if (r >= THRESHOLDS.Platinum) return 'Platinum';
  if (r >= THRESHOLDS.Gold) return 'Gold';
  return 'Silver';
}
function nextBucketOf(b: Bucket): Bucket | null {
  if (b === 'Silver') return 'Gold';
  if (b === 'Gold') return 'Platinum';
  if (b === 'Platinum') return 'Diamond';
  return null;
}

/**
 * Phase 8 v3 — season progress banner on the Library (Pro). Shows the active
 * season countdown, the user's current bucket + rating, and the gap to the
 * next bucket. Hidden entirely when the user isn't Pro or no active season
 * row exists in public.seasons.
 */
export const SeasonBanner: React.FC<SeasonBannerProps> = ({ isPro, onOpenLeaderboard }) => {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let alive = true;
    if (!isPro || !supabase) { setState(null); return; }
    (async () => {
      const nowIso = new Date().toISOString();
      const [{ data: season }, { data: elo }] = await Promise.all([
        supabase.from('seasons')
          .select('id, name, ends_at')
          .lte('starts_at', nowIso)
          .gte('ends_at', nowIso)
          .order('starts_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('concept_elo').select('rating'),
      ]);
      if (!alive) return;
      if (!season) { setState(null); return; }
      const ratings = (elo ?? []).map((r: any) => Number(r.rating)).filter(n => Number.isFinite(n));
      const avg = ratings.length === 0 ? 1200 : Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
      const b = bucketFor(avg);
      const nb = nextBucketOf(b);
      setState({
        seasonId: season.id,
        name: season.name,
        endsAt: season.ends_at,
        avgRating: avg,
        bucket: b,
        nextBucket: nb,
        pointsToNext: nb ? THRESHOLDS[nb] - avg : null,
      });
    })().catch(() => alive && setState(null));
    return () => { alive = false; };
  }, [isPro]);

  if (!state) return null;

  const daysLeft = state.endsAt
    ? Math.max(0, Math.ceil((new Date(state.endsAt).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <section
      className="rounded-[var(--radius)] border border-[var(--color-accent-border)] bg-[var(--color-surface)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-[var(--color-surface-subtle)] transition-colors"
      onClick={onOpenLeaderboard}
      role="link"
      tabIndex={0}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-[var(--color-text)]">
            {state.name ?? state.seasonId}
            <span className="ml-2 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-warning-weak)] text-[var(--color-warning-ink)] uppercase tracking-wide">Pro</span>
          </p>
          <p className="text-xs text-[var(--color-muted)] flex items-center gap-2 flex-wrap">
            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
            {daysLeft !== null && <span>{daysLeft} day{daysLeft === 1 ? '' : 's'} left</span>}
            <span className="text-[var(--color-text)] font-medium">· {state.bucket} {state.avgRating}</span>
            {state.nextBucket && state.pointsToNext !== null && state.pointsToNext > 0 && (
              <span>· {state.pointsToNext} pts → {state.nextBucket}</span>
            )}
          </p>
        </div>
      </div>
    </section>
  );
};
