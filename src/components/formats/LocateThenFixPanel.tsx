import React from 'react';
import { Challenge } from '../../lib/types';
import { OptionCard } from '../OptionCard';
import { Crosshair, CheckCircle2 } from 'lucide-react';

export interface LocateThenFixPanelProps {
  challenge: Challenge;
  selectedLine: number | null;
  selectedOption: number | null;
  onChangeOption: (idx: number) => void;
  disabled?: boolean;
  /**
   * Phase 8 v3 — Red-herring (Pro) mode. When true, the preamble warns about
   * a planted decoy at challenge.secondFlaw.line. Grading uses the red-herring
   * case in grading.ts (same correctness rules; the decoy only exists in the
   * reviewer's mind).
   */
  distractorMode?: boolean;
}

/**
 * Phase 8 v1 — Locate-then-fix. Two-step verb: first pick the buggy line
 * (clickable rows in CodeBlock, state owned by ChallengeScreen), then pick the
 * fix. Partial credit (line right, fix wrong) is handled by grading.ts.
 */
export const LocateThenFixPanel: React.FC<LocateThenFixPanelProps> = ({
  challenge,
  selectedLine,
  selectedOption,
  onChangeOption,
  disabled,
  distractorMode = false,
}) => {
  const lineLocked = selectedLine !== null;

  return (
    <div className="space-y-3 pt-2">
      {distractorMode && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-warning-border)] bg-[var(--color-warning-weak)] px-3 py-2 flex items-start gap-2 text-xs">
          <Crosshair className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--color-warning-ink)]" />
          <span className="text-[var(--color-warning-ink)]">
            <strong>Red herring:</strong> one of the suspicious-looking lines is a decoy. Only the
            true bug line counts; a wrong line is a full miss (no partial credit).
          </span>
        </div>
      )}

      <div
        className={`rounded-[var(--radius-sm)] border px-3 py-2 flex items-center gap-2 text-xs transition-colors ${
          lineLocked
            ? 'bg-[var(--color-good-weak)] border-[var(--color-good-border)] text-[var(--color-good-ink)]'
            : 'bg-[var(--color-accent-weak)] border-[var(--color-accent-border)] text-[var(--color-text)]'
        }`}
      >
        {lineLocked ? (
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Crosshair className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>
          {lineLocked ? (
            <>
              Line <strong className="font-mono">{selectedLine}</strong> marked as the suspect — now pick the fix below.
            </>
          ) : (
            <>
              <strong>Step 1:</strong> click the suspect line in the code above.
            </>
          )}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[var(--color-text)]">
          Step 2: pick the correct fix
        </label>
        <span className="text-[11px] text-[var(--color-muted)] font-mono">
          Press [1-4] to select
        </span>
      </div>

      <div className={`space-y-2.5 transition-opacity ${lineLocked ? 'opacity-100' : 'opacity-50'}`}>
        {challenge.fixOptions.map((option, idx) => (
          <OptionCard
            key={idx}
            index={idx}
            text={option}
            isSelected={selectedOption === idx}
            onClick={() => lineLocked && !disabled && onChangeOption(idx)}
            disabled={!lineLocked || disabled}
          />
        ))}
      </div>
    </div>
  );
};
