import React from 'react';
import { FastForward, RotateCcw, Calendar, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface TimeTravelBarProps {
  offsetDays: number;
  onSetOffset: (days: number) => void;
  onResetData: () => void;
  dueCount: number;
}

export const TimeTravelBar: React.FC<TimeTravelBarProps> = ({
  offsetDays,
  onSetOffset,
  onResetData,
  dueCount,
}) => {
  const simulatedDate = new Date(Date.now() + offsetDays * 86400000);
  const formattedDate = simulatedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });

  const jumpOptions = [
    { label: 'Today', days: 0 },
    { label: '+1 Day', days: 1 },
    { label: '+3 Days', days: 3 },
    { label: '+7 Days', days: 7 },
    { label: '+14 Days', days: 14 },
    { label: '+30 Days', days: 30 },
  ];

  return (
    <div className="w-full bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-2 text-xs">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[var(--color-accent)] font-semibold">
            <FastForward className="w-3.5 h-3.5" />
            <span>Time-Travel Engine</span>
          </div>
          <span className="text-[var(--color-border)]">|</span>
          <div className="flex items-center gap-1.5 text-[var(--color-text)]">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-muted)]" />
            <span className="font-mono tabular-nums font-medium">{formattedDate}</span>
            {offsetDays > 0 ? (
              <span className="text-[11px] font-mono text-amber-500 font-medium">
                (+{offsetDays} {offsetDays === 1 ? 'day' : 'days'})
              </span>
            ) : (
              <span className="text-[11px] text-[var(--color-muted)]">(Real-time)</span>
            )}
          </div>
          <span className="text-[var(--color-border)]">|</span>
          <span className="text-[var(--color-muted)] font-mono tabular-nums">
            <strong className="text-[var(--color-text)]">{dueCount}</strong> due now
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-[var(--color-muted)] mr-1 hidden sm:inline">Simulate Date:</span>
          {jumpOptions.map(opt => {
            const isActive = offsetDays === opt.days;
            return (
              <button
                key={opt.days}
                onClick={() => onSetOffset(opt.days)}
                className={`px-2 py-1 rounded-[var(--radius-sm)] text-[11px] font-mono transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[var(--color-accent)] text-white font-medium shadow-[var(--shadow-sm)]'
                    : 'bg-[var(--color-surface-subtle)] text-[var(--color-text)] hover:bg-[var(--color-border)] border border-[var(--color-border)]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}

          <div className="h-4 w-px bg-[var(--color-border)] mx-1" />

          <button
            onClick={onResetData}
            className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-[11px] text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-weak)] transition-colors cursor-pointer"
            title="Reset progress to default seed state"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Seed</span>
          </button>
        </div>
      </div>
    </div>
  );
};
