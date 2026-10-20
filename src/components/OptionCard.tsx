import React from 'react';
import { Check, X } from 'lucide-react';

export interface OptionCardProps {
  index: number;
  text: string;
  isSelected: boolean;
  isCorrect?: boolean;
  isRevealed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export const OptionCard: React.FC<OptionCardProps> = ({
  index,
  text,
  isSelected,
  isCorrect,
  isRevealed = false,
  disabled = false,
  onClick,
}) => {
  const letter = OPTION_LETTERS[index] || String(index + 1);

  let containerStyles =
    'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-accent-border)] hover:bg-[var(--color-surface-subtle)]';
  let badgeStyles =
    'bg-[var(--color-surface-subtle)] border-[var(--color-border)] text-[var(--color-muted)]';
  let indicator = null;

  if (isRevealed) {
    if (isCorrect) {
      containerStyles =
        'bg-[var(--color-good-weak)] border-[var(--color-good-border)] text-[var(--color-good-ink)] ring-1 ring-[var(--color-good-border)]';
      badgeStyles =
        'bg-[var(--color-good)] text-white border-[var(--color-good)]';
      indicator = <Check className="w-4 h-4 text-[var(--color-good)] shrink-0" />;
    } else if (isSelected && !isCorrect) {
      containerStyles =
        'bg-[var(--color-danger-weak)] border-[var(--color-danger-border)] text-[var(--color-danger-ink)]';
      badgeStyles =
        'bg-[var(--color-danger)] text-white border-[var(--color-danger)]';
      indicator = <X className="w-4 h-4 text-[var(--color-danger)] shrink-0" />;
    } else {
      containerStyles =
        'bg-[var(--color-surface)] border-[var(--color-border-subtle)] opacity-50';
    }
  } else if (isSelected) {
    containerStyles =
      'bg-[var(--color-accent-weak)] border-[var(--color-accent)] ring-1 ring-[var(--color-accent)] text-[var(--color-text)] shadow-[var(--shadow-sm)]';
    badgeStyles =
      'bg-[var(--color-accent)] text-white border-[var(--color-accent)]';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left p-3.5 rounded-[var(--radius)] border transition-all duration-150 flex items-start gap-3 cursor-pointer disabled:cursor-not-allowed select-none group ${containerStyles}`}
    >
      <div
        className={`w-6 h-6 rounded-[var(--radius-sm)] border text-xs font-mono font-semibold flex items-center justify-center shrink-0 transition-colors ${badgeStyles}`}
      >
        {letter}
      </div>

      <div className="flex-1 text-[13.5px] leading-snug font-normal text-[var(--color-text)] pt-0.5">
        {text}
      </div>

      {indicator && <div className="pt-0.5">{indicator}</div>}

      {!isRevealed && (
        <span className="hidden sm:inline-block text-[10px] font-mono text-[var(--color-muted)] opacity-40 group-hover:opacity-100 transition-opacity pt-1">
          [{index + 1}]
        </span>
      )}
    </button>
  );
};
