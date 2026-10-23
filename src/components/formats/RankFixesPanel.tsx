import React from 'react';
import { Challenge } from '../../lib/types';
import { ChevronUp, ChevronDown, ListOrdered } from 'lucide-react';

export interface RankFixesPanelProps {
  challenge: Challenge;
  /** Permutation of [0..fixOptions.length-1]; worst → best left to right. */
  order: number[];
  onChangeOrder: (next: number[]) => void;
  disabled?: boolean;
}

/**
 * Phase 8 v1 — Rank-fixes. Reorder the four options worst → best. Grading uses
 * Kendall-tau correlation against the author's canonical ranking (challenge.rankedFixes).
 */
export const RankFixesPanel: React.FC<RankFixesPanelProps> = ({
  challenge,
  order,
  onChangeOrder,
  disabled,
}) => {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChangeOrder(next);
  };

  const letter = (idx: number) => ['A', 'B', 'C', 'D'][idx] || String(idx + 1);

  return (
    <div className="space-y-3 pt-2">
      <div className="rounded-[var(--radius-sm)] border border-[var(--color-accent-border)] bg-[var(--color-accent-weak)] px-3 py-2 flex items-center gap-2 text-xs">
        <ListOrdered className="w-3.5 h-3.5 shrink-0 text-[var(--color-accent)]" />
        <span className="text-[var(--color-text)]">
          Rank the fixes <strong>worst → best</strong>. Use the arrows to reorder.
        </span>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[var(--color-text)]">
          Your ranking (position 1 = worst, position {order.length} = best):
        </label>
      </div>

      <ol className="space-y-2">
        {order.map((optIdx, i) => (
          <li
            key={optIdx}
            className="flex items-start gap-3 p-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)]"
          >
            <div
              aria-hidden="true"
              className="w-6 h-6 rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-xs font-mono font-semibold text-[var(--color-muted)] flex items-center justify-center shrink-0"
            >
              {i + 1}
            </div>
            <div className="flex-1 min-w-0 text-[13.5px] leading-snug text-[var(--color-text)] pt-0.5">
              <span className="font-mono text-[11px] text-[var(--color-muted)] mr-2">
                [{letter(optIdx)}]
              </span>
              {challenge.fixOptions[optIdx]}
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={disabled || i === 0}
                aria-label={`Move option ${letter(optIdx)} up`}
                className="w-6 h-6 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center transition-colors"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={disabled || i === order.length - 1}
                aria-label={`Move option ${letter(optIdx)} down`}
                className="w-6 h-6 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};
