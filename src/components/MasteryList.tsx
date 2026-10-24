import React, { useEffect, useState } from 'react';
import { supabaseStore } from '../lib/supabase-store';
import { TrendingUp } from 'lucide-react';

export interface MasteryListProps {
  /** When false, the list renders a soft "sign in to track mastery" placeholder. */
  enabled: boolean;
}

type EloRow = { concept: string; rating: number; games: number };

/**
 * Phase 8 v2 — per-concept Elo mastery list on the Recall dashboard.
 * Reads concept_elo rows directly for the signed-in Supabase user. Bucketed
 * by rating thresholds (Diamond ≥ 1700, Platinum ≥ 1500, Gold ≥ 1300, else Silver).
 *
 * Trial / local users see a quiet placeholder — Elo lives server-side.
 */
export const MasteryList: React.FC<MasteryListProps> = ({ enabled }) => {
  const [rows, setRows] = useState<EloRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!enabled) {
      setRows([]);
      return;
    }
    supabaseStore.getConceptElo()
      .then(data => { if (alive) setRows(data); })
      .catch(e => { if (alive) setErr(e?.message || 'failed to load mastery'); });
    return () => { alive = false; };
  }, [enabled]);

  if (!enabled) {
    return (
      <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 sm:p-5 space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
          <h3 className="text-sm font-bold text-[var(--color-text)]">Concept mastery</h3>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          Mastery per concept (Elo) is tracked once you sign in.
        </p>
      </section>
    );
  }

  if (err) {
    return (
      <section className="rounded-[var(--radius)] border border-[var(--color-danger-border)] bg-[var(--color-danger-weak)] p-4 text-xs text-[var(--color-danger-ink)]">
        Couldn't load mastery: {err}
      </section>
    );
  }

  if (rows === null) {
    return (
      <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-xs text-[var(--color-muted)] font-mono">
        Loading mastery…
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
          <h3 className="text-sm font-bold text-[var(--color-text)]">Concept mastery</h3>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          Nothing yet — attempt a drill and your per-concept rating starts tracking (starts at 1200).
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
          <h3 className="text-sm font-bold text-[var(--color-text)]">Concept mastery</h3>
        </div>
        <span className="text-[11px] font-mono text-[var(--color-muted)]">{rows.length} concept{rows.length === 1 ? '' : 's'}</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map(r => {
          const b = bucketFor(r.rating);
          return (
            <li
              key={r.concept}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--color-text)] truncate">{r.concept}</p>
                <p className="text-[11px] font-mono text-[var(--color-muted)]">
                  {r.games} game{r.games === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-[var(--radius-sm)] border"
                  style={{ color: b.color, borderColor: b.color }}
                >
                  {b.label}
                </span>
                <span className="text-sm font-mono font-bold text-[var(--color-text)] tabular-nums">
                  {r.rating}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

function bucketFor(rating: number): { label: 'Diamond' | 'Platinum' | 'Gold' | 'Silver'; color: string } {
  if (rating >= 1700) return { label: 'Diamond',  color: 'var(--color-accent)' };
  if (rating >= 1500) return { label: 'Platinum', color: 'var(--color-good)' };
  if (rating >= 1300) return { label: 'Gold',     color: 'var(--color-warning)' };
  return                      { label: 'Silver',   color: 'var(--color-muted)' };
}
