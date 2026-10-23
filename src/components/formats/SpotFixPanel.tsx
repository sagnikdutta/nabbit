import React from 'react';
import { Challenge } from '../../lib/types';
import { OptionCard } from '../OptionCard';

export interface SpotFixPanelProps {
  challenge: Challenge;
  selectedOption: number | null;
  onChangeOption: (idx: number) => void;
  disabled?: boolean;
}

/**
 * Phase 8 v1 — current single-verb MCQ, extracted. Any new format that reuses
 * the "pick 1 of N fixes" surface can either render this directly or compose
 * its own preamble above the options grid (see LocateThenFixPanel).
 */
export const SpotFixPanel: React.FC<SpotFixPanelProps> = ({
  challenge,
  selectedOption,
  onChangeOption,
  disabled,
}) => (
  <div className="space-y-3 pt-2">
    <div className="flex items-center justify-between">
      <label className="text-xs font-semibold text-[var(--color-text)]">
        Identify the bug and pick the correct fix:
      </label>
      <span className="text-[11px] text-[var(--color-muted)] font-mono">
        Press [1-4] to select
      </span>
    </div>

    <div className="space-y-2.5">
      {challenge.fixOptions.map((option, idx) => (
        <OptionCard
          key={idx}
          index={idx}
          text={option}
          isSelected={selectedOption === idx}
          onClick={() => !disabled && onChangeOption(idx)}
        />
      ))}
    </div>
  </div>
);
