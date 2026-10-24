import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { Flame, Users, Play } from 'lucide-react';

export interface DailyDrillCardProps {
  onOpenChallenge: (challengeId: string) => void;
}

interface DailyState {
  challengeId: string | null;
  userPicked: boolean;
  totalPicks: number;
}

/**
 * Phase 8 v2 — Daily Drill card. One global drill per calendar date.
 * Hides gracefully when no row exists in public.daily_drill for today
 * (daily drills are hand-picked a week ahead by the owner for now).
 *
 * To seed today's drill from the Supabase SQL editor:
 *   insert into public.daily_drill (for_date, challenge_id)
 *   values (current_date, 'react-state-batching');
 */
export const DailyDrillCard: React.FC<DailyDrillCardProps> = ({ onOpenChallenge }) => {
  const [state, setState] = useState<DailyState | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase) { setState({ challengeId: null, userPicked: false, totalPicks: 0 }); return; }
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: drillRow }, { data: distRow }] = await Promise.all([
        supabase.rpc('get_daily_drill', { for_date: today }),
        supabase.rpc('get_daily_distribution', { for_date: today }),
      ]);
      if (!alive) return;
      const drill = Array.isArray(drillRow) ? drillRow[0] : drillRow;
      const dist  = Array.isArray(distRow)  ? distRow[0]  : distRow;
      setState({
        challengeId: drill?.challenge_id ?? null,
        userPicked: Boolean(drill?.user_pick),
        totalPicks: Number(dist?.total_picks ?? 0),
      });
    })().catch(() => alive && setState({ challengeId: null, userPicked: false, totalPicks: 0 }));
    return () => { alive = false; };
  }, []);

  if (!state || !state.challengeId) return null;

  return (
    <section className="rounded-[var(--radius)] border border-[var(--color-accent-border)] bg-[var(--color-accent-weak)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] flex items-center justify-center shrink-0">
          <Flame className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-[var(--color-text)]">
            Today's bug — Daily Drill
          </p>
          <p className="text-xs text-[var(--color-muted)] flex items-center gap-2">
            <Users className="w-3.5 h-3.5" aria-hidden="true" />
            {state.totalPicks > 0
              ? <>{state.totalPicks} {state.totalPicks === 1 ? 'other has' : 'others have'} played today.</>
              : <>Be the first to play today's drill.</>}
            {state.userPicked && <span className="text-[var(--color-good)] font-semibold ml-2">You've played ✓</span>}
          </p>
        </div>
      </div>

      <Button
        variant="primary"
        size="md"
        className="w-full sm:w-auto justify-center shrink-0"
        onClick={() => onOpenChallenge(state.challengeId!)}
        icon={<Play className="w-4 h-4" />}
      >
        {state.userPicked ? 'See the result' : 'Play today\'s drill'}
      </Button>
    </section>
  );
};
