import React from 'react';
import { ChallengeFormat } from '../lib/types';
import { MousePointerClick, Crosshair, ListOrdered } from 'lucide-react';

const META: Record<ChallengeFormat, { label: string; icon: React.ReactNode; hint: string }> = {
  'spot-fix':         { label: 'Spot-fix',        icon: <MousePointerClick className="w-3.5 h-3.5" />, hint: 'Pick the correct fix.' },
  'locate-then-fix':  { label: 'Locate + fix',    icon: <Crosshair className="w-3.5 h-3.5" />,          hint: 'Pick the buggy line, then the fix.' },
  'rank-fixes':       { label: 'Rank fixes',      icon: <ListOrdered className="w-3.5 h-3.5" />,        hint: 'Order fixes worst → best.' },
  // v2/v3 placeholders — not shown in v1a but kept so the mapping compiles.
  'blind-fix':        { label: 'Blind fix',       icon: null, hint: 'Write the patch.' },
  'diff-review':      { label: 'Diff review',     icon: null, hint: 'Approve or request changes.' },
  'impostor':         { label: 'Impostor',        icon: null, hint: 'Pro drill.' },
  'red-herring':      { label: 'Red herring',     icon: null, hint: 'Pro drill.' },
};

export interface FormatChooserProps {
  available: ChallengeFormat[];
  active: ChallengeFormat;
  onChange: (next: ChallengeFormat) => void;
}

/**
 * Phase 8 v1 — format pill group. Hidden when only one format is available
 * (every drill supports spot-fix today, so a solo spot-fix list is noise).
 */
export const FormatChooser: React.FC<FormatChooserProps> = ({ available, active, onChange }) => {
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
        return (
          <button
            key={fmt}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(fmt)}
            title={meta.hint}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors cursor-pointer border ${
              selected
                ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)]'
                : 'bg-[var(--color-surface)] text-[var(--color-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]'
            }`}
          >
            {meta.icon}
            <span>{meta.label}</span>
          </button>
        );
      })}
      <span className="text-[10px] font-mono text-[var(--color-muted)] ml-1">Press F to cycle</span>
    </div>
  );
};
