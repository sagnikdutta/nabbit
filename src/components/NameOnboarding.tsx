import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { Target } from 'lucide-react';

export interface NameOnboardingProps {
  open: boolean;
  onSave: (name: string) => void;
  onSkip: () => void;
}

/**
 * Lightweight, local-only onboarding (B3): a single "what should we call you?"
 * field stored in localStorage. No account, no password, no server — it only
 * personalizes the UI per browser. Real auth + cross-device sync is roadmap.
 */
export const NameOnboarding: React.FC<NameOnboardingProps> = ({ open, onSave, onSkip }) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed) onSave(trimmed);
    else onSkip();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      onKeyDown={e => {
        if (e.key === 'Escape') onSkip();
      }}
    >
      <div className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow)] space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] flex items-center justify-center shadow-[var(--shadow-sm)]">
            <Target className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h2 id="onboarding-title" className="text-base font-bold text-[var(--color-text)]">
              Welcome to Nabbit
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              Catch the nit on the dev videos you watch.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="profile-name" className="text-sm font-medium text-[var(--color-text)]">
            What should we call you?
          </label>
          <input
            id="profile-name"
            ref={inputRef}
            type="text"
            value={name}
            maxLength={32}
            autoComplete="off"
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submit();
            }}
            placeholder="e.g. your first name"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent-border)] focus:ring-2 focus:ring-[var(--color-accent-weak)] transition-colors"
          />
          <p className="text-[11px] text-[var(--color-muted)]">
            Stored only in this browser — no account, no password.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip for now
          </Button>
          <Button variant="primary" size="sm" onClick={submit}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};
