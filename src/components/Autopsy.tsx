import React from 'react';
import { Challenge } from '../lib/types';
import { Users } from 'lucide-react';

export interface AutopsyProps {
  challenge: Challenge;
  chosenOption: number | null;
}

/**
 * Phase 8 v1b — Autopsy strip. Horizontal distribution bar across the fix options
 * showing what others picked, with the user's pick + the correct option marked.
 * Pre-v2 data comes from `challenge.seedDistribution`; real attempt counts land
 * when progress sync ships. Hidden if the drill has no seed yet.
 */
export const Autopsy: React.FC<AutopsyProps> = ({ challenge, chosenOption }) => {
  const dist = challenge.seedDistribution;
  if (!dist || dist.length !== challenge.fixOptions.length) return null;

  const letter = (i: number) => ['A', 'B', 'C', 'D'][i] || String(i + 1);
  const total = dist.reduce((a, b) => a + b, 0) || 1;

  return (
    <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[var(--color-accent)]" />
          <h3 className="text-sm font-bold text-[var(--color-text)]">
            Autopsy — what everyone else picked
          </h3>
        </div>
        <span className="text-[11px] font-mono text-[var(--color-muted)]">
          seeded distribution
        </span>
      </div>

      {/* Stacked horizontal bar */}
      <div
        className="w-full h-5 rounded-full overflow-hidden flex border border-[var(--color-border)]"
        role="img"
        aria-label="Distribution of picks across options"
      >
        {dist.map((v, i) => {
          const pct = Math.max(0, (v / total) * 100);
          const isCorrect = i === challenge.correctOption;
          const isChosen = i === chosenOption;
          const bg = isCorrect
            ? 'var(--color-good)'
            : isChosen
            ? 'var(--color-danger)'
            : 'var(--color-surface-subtle)';
          return (
            <div
              key={i}
              title={`Option ${letter(i)}: ${Math.round(pct)}%`}
              style={{ width: `${pct}%`, background: bg }}
              className={`h-full ${
                isCorrect || isChosen ? '' : 'border-r border-[var(--color-border)]'
              }`}
            />
          );
        })}
      </div>

      {/* Per-option legend */}
      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {dist.map((v, i) => {
          const pct = Math.round((v / total) * 100);
          const isCorrect = i === challenge.correctOption;
          const isChosen = i === chosenOption;
          return (
            <li
              key={i}
              className={`flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border px-2 py-1 ${
                isCorrect
                  ? 'border-[var(--color-good-border)] bg-[var(--color-good-weak)]'
                  : isChosen
                  ? 'border-[var(--color-danger-border)] bg-[var(--color-danger-weak)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)]'
              }`}
            >
              <span className="font-mono text-[11px] text-[var(--color-muted)]">
                [{letter(i)}]{isChosen ? ' · you' : ''}{isCorrect ? ' · correct' : ''}
              </span>
              <span className="font-mono text-[11px] font-semibold tabular-nums">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
