import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Challenge } from '../lib/types';
import { Button } from './Button';
import { Flame, Lock, Sparkles, Trophy } from 'lucide-react';

export interface BossDrillCardProps {
  /** True when the signed-in user has is_pro = true on public.users. */
  isPro: boolean;
  /** All drills the client knows about; the RPC picks 5 from the ids we send. */
  allChallenges: Challenge[];
  onLaunchDrill: (challengeId: string) => void;
}

interface BossRow {
  week_start: string;
  challenge_ids: string[];
}

/**
 * Phase 8 v2 — "This week's boss" card (Pro).
 *
 * Pro users: generate_boss_drill RPC picks 5 drills from the user's weakest
 * concepts (lowest Elo); the card shows the countdown + launch button.
 *
 * Non-Pro users: lock badge + "Unlock with Pro" CTA (deliberately opens no
 * modal — Pro purchase flow is roadmap, hard rules require the gate to be
 * visible as a tease, not a 404).
 */
export const BossDrillCard: React.FC<BossDrillCardProps> = ({ isPro, allChallenges, onLaunchDrill }) => {
  const [row, setRow] = useState<BossRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isPro || !supabase) return;
    const monday = mondayISO(new Date());
    const candidates = allChallenges.map(c => c.id);
    supabase
      .rpc('generate_boss_drill', { payload: { week_start: monday, candidate_challenge_ids: candidates } })
      .then(
        ({ data, error }) => {
          if (error) {
            if (error.message?.toLowerCase().includes('pro_required')) {
              setErr(null); // treat as "not pro" — fall through to locked view
            } else {
              setErr(error.message || 'failed to load boss drill');
            }
            return;
          }
          const r = Array.isArray(data) ? data[0] : data;
          if (r) setRow({ week_start: r.week_start, challenge_ids: r.challenge_ids });
        },
        (e: unknown) => setErr(String((e as any)?.message || e)),
      );
  }, [isPro, allChallenges.length]);

  if (!isPro) {
    return (
      <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 opacity-95">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] flex items-center justify-center shrink-0 relative">
            <Trophy className="w-5 h-5" aria-hidden="true" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--color-warning)] text-white flex items-center justify-center">
              <Lock className="w-2.5 h-2.5" aria-hidden="true" />
            </span>
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[var(--color-text)]">This week's Boss drill</p>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-warning-weak)] text-[var(--color-warning-ink)] uppercase tracking-wide">Pro</span>
            </div>
            <p className="text-xs text-[var(--color-muted)]">
              5 drills from your three weakest concepts. No hints, 10-minute clock. One attempt per week.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="md"
          className="w-full sm:w-auto justify-center shrink-0"
          icon={<Sparkles className="w-4 h-4" />}
          disabled
          title="Pro — coming soon"
        >
          Unlock with Pro
        </Button>
      </section>
    );
  }

  if (err) {
    return (
      <section className="rounded-[var(--radius)] border border-[var(--color-danger-border)] bg-[var(--color-danger-weak)] p-4 text-xs text-[var(--color-danger-ink)]">
        Boss drill: {err}
      </section>
    );
  }
  if (!row) {
    return (
      <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs text-[var(--color-muted)] font-mono">
        Preparing this week's Boss drill…
      </section>
    );
  }

  const first = row.challenge_ids[0];
  return (
    <section className="rounded-[var(--radius)] border border-[var(--color-accent-border)] bg-[var(--color-accent-weak)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] flex items-center justify-center shrink-0">
          <Flame className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-[var(--color-text)]">
            This week's Boss drill
            <span className="ml-2 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-warning-weak)] text-[var(--color-warning-ink)] uppercase tracking-wide">Pro</span>
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            {row.challenge_ids.length} drill{row.challenge_ids.length === 1 ? '' : 's'} from your weakest concepts · week of {row.week_start}
          </p>
        </div>
      </div>
      <Button
        variant="primary"
        size="md"
        className="w-full sm:w-auto justify-center shrink-0"
        onClick={() => first && onLaunchDrill(first)}
        icon={<Flame className="w-4 h-4" />}
      >
        Start Boss drill
      </Button>
    </section>
  );
};

function mondayISO(d: Date): string {
  const utc = new Date(d);
  const dow = utc.getUTCDay();
  const daysSinceMonday = (dow + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - daysSinceMonday);
  utc.setUTCHours(0, 0, 0, 0);
  return utc.toISOString().slice(0, 10);
}
