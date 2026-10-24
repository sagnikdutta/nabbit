import React from 'react';
import { Challenge } from '../../lib/types';
import { OptionCard } from '../OptionCard';
import { Ghost } from 'lucide-react';

export interface ImpostorPanelProps {
  challenge: Challenge;
  selectedOption: number | null;
  onChangeOption: (idx: number) => void;
  disabled?: boolean;
}

/**
 * Phase 8 v3 — Impostor (Pro). Same 4 fixes as spot-fix, plus a 5th
 * challenge.impostorOption that LOOKS right but is subtly wrong. The correct
 * answer is still challenge.correctOption; the impostor sits at the extra
 * trailing index and acts as a seasoned-dev decoy.
 */
export const ImpostorPanel: React.FC<ImpostorPanelProps> = ({
  challenge,
  selectedOption,
  onChangeOption,
  disabled,
}) => {
  const options = [...challenge.fixOptions];
  if (challenge.impostorOption) options.push(challenge.impostorOption);
  const impostorIdx = challenge.fixOptions.length;

  return (
    <div className="space-y-3 pt-2">
      <div className="rounded-[var(--radius-sm)] border border-[var(--color-warning-border)] bg-[var(--color-warning-weak)] px-3 py-2 flex items-start gap-2 text-xs">
        <Ghost className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--color-warning-ink)]" />
        <span className="text-[var(--color-warning-ink)]">
          <strong>Impostor round:</strong> one of these fixes <em>looks</em> correct but is subtly
          wrong. There are {options.length} options instead of the usual {challenge.fixOptions.length}.
        </span>
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[var(--color-text)]">
          Spot the real fix:
        </label>
        <span className="text-[11px] text-[var(--color-muted)] font-mono">
          Press [1-{options.length}] to select
        </span>
      </div>

      <div className="space-y-2.5">
        {options.map((option, idx) => (
          <OptionCard
            key={idx}
            index={idx}
            text={option + (idx === impostorIdx ? '' : '')}
            isSelected={selectedOption === idx}
            onClick={() => !disabled && onChangeOption(idx)}
          />
        ))}
      </div>
    </div>
  );
};
