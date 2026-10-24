import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Trophy, Lock, Sparkles, ArrowLeft } from 'lucide-react';

export interface LeaderboardScreenProps {
  isPro: boolean;
  onBack: () => void;
}

interface Row {
  user_id: string;
  display_name: string;
  end_rating: number;
  bucket: string;
}

const BUCKET_COLOUR: Record<string, string> = {
  Diamond:  'var(--color-accent)',
  Platinum: 'var(--color-good)',
  Gold:     'var(--color-warning)',
  Silver:   'var(--color-muted)',
};

/**
 * Phase 8 v2 — season leaderboard (Pro). Non-Pro users see a locked state;
 * Pro users see the top 25 placements for the current season from the
 * season_leaderboard RPC.
 *
 * There's no live season until close_season(…) is run at rollover, so the
 * card expects to render empty for most of a season — the gate itself is
 * what proves the Pro surface works end-to-end.
 */
export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ isPro, onBack }) => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);

  useEffect(() => {
    if (!isPro || !supabase) return;
    (async () => {
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id')
        .order('starts_at', { ascending: false })
        .limit(1);
      const sid = seasons?.[0]?.id ?? null;
      setSeasonId(sid);
      if (!sid) { setRows([]); return; }
      const { data, error } = await supabase.rpc('season_leaderboard', { season_id: sid, lim: 25 });
      if (error) {
        setErr(error.message || 'failed to load leaderboard');
        return;
      }
      setRows((data ?? []) as Row[]);
    })().catch(e => setErr(String(e?.message || e)));
  }, [isPro]);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
        <h1 className="text-sm font-semibold text-[var(--color-text)]">Season leaderboard</h1>
      </div>

      {!isPro ? (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-6 sm:p-8 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] flex items-center justify-center shrink-0 relative">
              <Trophy className="w-5 h-5" aria-hidden="true" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--color-warning)] text-white flex items-center justify-center">
                <Lock className="w-2.5 h-2.5" aria-hidden="true" />
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-[var(--color-text)]">
                Season leaderboard is a Pro feature
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                Season placements bucket you Diamond / Platinum / Gold / Silver by end-of-season Elo.
                Rank against every other Pro player — public leaderboard, soft reset to 60% between seasons.
              </p>
            </div>
          </div>
          <Button variant="outline" size="md" disabled icon={<Sparkles className="w-4 h-4" />} title="Pro — coming soon">
            Unlock with Pro
          </Button>
        </section>
      ) : err ? (
        <section className="rounded-[var(--radius)] border border-[var(--color-danger-border)] bg-[var(--color-danger-weak)] p-4 text-xs text-[var(--color-danger-ink)]">
          {err}
        </section>
      ) : rows === null ? (
        <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-xs text-[var(--color-muted)] font-mono">
          Loading leaderboard…
        </section>
      ) : rows.length === 0 ? (
        <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-xs text-[var(--color-muted)]">
          {seasonId
            ? 'No placements yet for this season. Placements land when the admin closes the season.'
            : 'No active season. The next one appears once an admin seeds a row in public.seasons.'}
        </section>
      ) : (
        <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <ol>
            {rows.map((r, i) => (
              <li
                key={r.user_id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 border-b last:border-0 border-[var(--color-border-subtle)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 text-right font-mono text-sm font-semibold tabular-nums text-[var(--color-muted)]">
                    {i + 1}.
                  </span>
                  <span className="text-sm text-[var(--color-text)] truncate">{r.display_name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-[var(--radius-sm)] border"
                    style={{ color: BUCKET_COLOUR[r.bucket] ?? 'var(--color-muted)', borderColor: BUCKET_COLOUR[r.bucket] ?? 'var(--color-muted)' }}
                  >
                    {r.bucket}
                  </span>
                  <span className="font-mono text-sm font-bold tabular-nums text-[var(--color-text)]">
                    {r.end_rating}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
};
