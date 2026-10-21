import React from 'react';
import { Challenge } from '../lib/types';
import { Clock } from 'lucide-react';

export interface ConceptTimelineProps {
  /** All challenges for the current video. */
  challenges: Challenge[];
  activeId: string;
  onSelect: (challengeId: string) => void;
  /** A free, one-glance summary of the video (quick context). */
  summary?: string;
}

const difficultyBadge: Record<Challenge['difficulty'], string> = {
  Beginner: 'bg-[var(--color-good-weak)] text-[var(--color-good)]',
  Intermediate: 'bg-[var(--color-accent-weak)] text-[var(--color-accent)]',
  Advanced: 'bg-[var(--color-warning-weak)] text-[var(--color-warning-ink)]',
};

/**
 * N5 — a per-video concept timeline. Gives quick context (what the video
 * covers, in order) without watching, and doubles as drill navigation. Each
 * node jumps to that drill; the current one is highlighted.
 */
export const ConceptTimeline: React.FC<ConceptTimelineProps> = ({
  challenges,
  activeId,
  onSelect,
  summary,
}) => {
  const ordered = [...challenges].sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-[var(--color-accent)]" aria-hidden="true" />
        <span className="text-xs font-mono text-[var(--color-muted)]">In this video</span>
      </div>

      {summary && (
        <p className="text-xs text-[var(--color-muted)] leading-relaxed">{summary}</p>
      )}

      <ol className="relative mt-1">
        {/* Vertical rail aligned to the node dots */}
        <span
          aria-hidden="true"
          className="absolute left-[7px] top-3 bottom-3 w-px bg-[var(--color-border)]"
        />
        {ordered.map(c => {
          const active = c.id === activeId;
          return (
            <li key={c.id} className="relative">
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={active ? 'step' : undefined}
                aria-label={`${c.timestampFormatted} — ${c.concept} (${c.difficulty})`}
                className={`w-full text-left flex gap-3 rounded-[var(--radius-sm)] pr-2 py-2 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[var(--color-accent-weak)]'
                    : 'hover:bg-[var(--color-surface-subtle)]'
                }`}
              >
                <span className="relative z-10 mt-1 shrink-0 w-4 flex justify-center">
                  <span
                    className={`w-2.5 h-2.5 rounded-full border-2 ${
                      active
                        ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                        : 'bg-[var(--color-surface)] border-[var(--color-border)]'
                    }`}
                  />
                </span>

                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] font-mono tabular-nums text-[var(--color-muted)]">
                      {c.timestampFormatted}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-sm)] ${difficultyBadge[c.difficulty]}`}
                    >
                      {c.difficulty.slice(0, 3)}
                    </span>
                  </span>
                  <span
                    className={`block text-[13px] truncate ${
                      active ? 'font-semibold text-[var(--color-text)]' : 'font-medium text-[var(--color-text)]'
                    }`}
                  >
                    {c.concept}
                  </span>
                  <span className="block text-[11px] text-[var(--color-muted)] truncate">
                    {c.chapter}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
