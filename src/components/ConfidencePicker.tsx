import React from 'react';
import { Confidence } from '../lib/types';

const OPTIONS: { value: Confidence; emoji: string; label: string; mult: string }[] = [
  { value: 'guess',   emoji: '🤔', label: 'Guess',   mult: '×1' },
  { value: 'sure',    emoji: '😎', label: 'Sure',    mult: '×1.5' },
  { value: 'certain', emoji: '🔥', label: 'Certain', mult: '×2' },
];

export interface ConfidencePickerProps {
  value: Confidence;
  onChange: (next: Confidence) => void;
  disabled?: boolean;
}

/**
 * Phase 8 v1 — pre-submit confidence pills. Multiplier affects SCORE only.
 * Wrong + Certain also doubles the loss (see grading.ts).
 */
export const ConfidencePicker: React.FC<ConfidencePickerProps> = ({ value, onChange, disabled }) => (
  <div
    className="inline-flex rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5"
    role="radiogroup"
    aria-label="How confident are you?"
  >
    {OPTIONS.map(opt => {
      const selected = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={selected}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          title={`${opt.label} (${opt.mult} score)`}
          className={`px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors flex items-center gap-1.5 ${
            selected
              ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
              : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span aria-hidden="true">{opt.emoji}</span>
          <span>{opt.label}</span>
          <span className="font-mono text-[10px] opacity-70">{opt.mult}</span>
        </button>
      );
    })}
  </div>
);
