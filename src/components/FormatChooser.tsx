import React from 'react';
import { ChallengeFormat, PRO_FORMATS } from '../lib/types';
import { MousePointerClick, Crosshair, ListOrdered, Pencil, GitPullRequest, Ghost, Lock } from 'lucide-react';

const META: Record<ChallengeFormat, { label: string; icon: React.ReactNode; hint: string }> = {
  'spot-fix':         { label: 'Spot-fix',        icon: <MousePointerClick className="w-3.5 h-3.5" />, hint: 'Pick the correct fix.' },
  'locate-then-fix':  { label: 'Locate + fix',    icon: <Crosshair className="w-3.5 h-3.5" />,          hint: 'Pick the buggy line, then the fix.' },
  'rank-fixes':       { label: 'Rank fixes',      icon: <ListOrdered className="w-3.5 h-3.5" />,        hint: 'Order fixes worst → best.' },
  'blind-fix':        { label: 'Blind fix',       icon: <Pencil className="w-3.5 h-3.5" />,             hint: 'Write the patch yourself.' },
  'diff-review':      { label: 'Diff review',     icon: <GitPullRequest className="w-3.5 h-3.5" />,     hint: 'Approve, request changes, or comment.' },
  'impostor':         { label: 'Impostor',        icon: <Ghost className="w-3.5 h-3.5" />,              hint: 'Pro — one of the fixes is a decoy.' },
  'red-herring':      { label: 'Red herring',     icon: <Crosshair className="w-3.5 h-3.5" />,          hint: 'Pro — locate the real bug through a decoy.' },
};

export interface FormatChooserProps {
  available: ChallengeFormat[];
  active: ChallengeFormat;
  onChange: (next: ChallengeFormat) => void;
  /** Phase 8 v3 — when false, Pro formats render with a lock badge and refuse selection. */
  isPro?: boolean;
  /** Called when the user clicks a locked Pro format pill. */
  onLockedClick?: (format: ChallengeFormat) => void;
}

/**
 * Phase 8 v1 — format pill group. Hidden when only one format is available
 * (every drill supports spot-fix today, so a solo spot-fix list is noise).
 *
 * Phase 8 v3 — Pro-only formats (Impostor, Red herring) render with a lock
 * badge when the user isn't Pro; clicking the locked pill surfaces the Pro
 * teaser via onLockedClick instead of switching the format.
 */
export const FormatChooser: React.FC<FormatChooserProps> = ({ available, active, onChange, isPro = false, onLockedClick }) => {
  if (available.length < 2) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Format"
    >
      <span className="text-[11px] font-mono text-[var(--color-muted)] mr-1">Format:</span>
      {available.map(fmt => {
        const meta = META[fmt];
        const selected = fmt === active;
        const locked = PRO_FORMATS.includes(fmt) && !isPro;
        return (
          <button
            key={fmt}
            type="button"
            aria-pressed={selected}
            onClick={() => locked ? onLockedClick?.(fmt) : onChange(fmt)}
            title={locked ? `${meta.hint} (Pro — unlock to use)` : meta.hint}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors cursor-pointer border ${
              selected
                ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)]'
                : locked
                ? 'bg-[var(--color-surface-subtle)] text-[var(--color-muted)] border-[var(--color-border)]'
                : 'bg-[var(--color-surface)] text-[var(--color-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]'
            }`}
          >
            {meta.icon}
            <span>{meta.label}</span>
            {locked && <Lock className="w-3 h-3 ml-0.5 text-[var(--color-warning-ink)]" aria-label="Pro" />}
          </button>
        );
      })}
      <span className="text-[10px] font-mono text-[var(--color-muted)] ml-1">Press F to cycle</span>
    </div>
  );
};
