import React from 'react';
import { Challenge } from '../../lib/types';
import { Pencil } from 'lucide-react';

export interface BlindFixPanelProps {
  challenge: Challenge;
  patch: string;
  onChangePatch: (next: string) => void;
  disabled?: boolean;
}

/**
 * Phase 8 v2 — Blind-fix. User writes the fix as text; grading uses
 * Levenshtein similarity on whitespace-normalised strings (see
 * src/lib/grading.ts) with ≥ 0.9 full-correct, ≥ 0.7 partial.
 */
export const BlindFixPanel: React.FC<BlindFixPanelProps> = ({
  challenge,
  patch,
  onChangePatch,
  disabled,
}) => (
  <div className="space-y-3 pt-2">
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-accent-border)] bg-[var(--color-accent-weak)] px-3 py-2 flex items-start gap-2 text-xs">
      <Pencil className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--color-accent)]" />
      <span className="text-[var(--color-text)]">
        <strong>Blind fix:</strong> write the corrected code yourself. Whitespace and trailing
        punctuation are ignored — close matches still count.
      </span>
    </div>

    <label className="text-xs font-semibold text-[var(--color-text)] block">
      Your fix (reads line{challenge.buggyLines.length === 1 ? '' : 's'}{' '}
      {challenge.buggyLines.join(', ')}):
    </label>

    <textarea
      value={patch}
      onChange={e => onChangePatch(e.target.value)}
      disabled={disabled}
      rows={6}
      spellCheck={false}
      placeholder={'// write the fixed code here'}
      className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--code-bg)] text-[var(--code-text)] font-mono text-[13px] leading-[1.65] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
    />

    <p className="text-[11px] font-mono text-[var(--color-muted)]">
      {patch.trim().length} character{patch.trim().length === 1 ? '' : 's'}
    </p>
  </div>
);
