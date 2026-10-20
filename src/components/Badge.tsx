import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'accent' | 'good' | 'danger' | 'warning';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
}) => {
  const styles = {
    neutral: 'bg-[var(--color-surface-subtle)] text-[var(--color-muted)] border border-[var(--color-border)]',
    accent: 'bg-[var(--color-accent-weak)] text-[var(--color-accent)] border border-[var(--color-accent-border)] font-medium',
    good: 'bg-[var(--color-good-weak)] text-[var(--color-good-hover)] border border-[var(--color-good-border)] font-medium',
    danger: 'bg-[var(--color-danger-weak)] text-[var(--color-danger-hover)] border border-[var(--color-danger-border)] font-medium',
    warning: 'bg-[var(--color-warning-weak)] text-[var(--color-warning-hover)] border border-[var(--color-warning-border)] font-medium',
  }[variant];

  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1 rounded-[var(--radius-sm)] font-mono tabular-nums leading-none tracking-tight ${sizeClass} ${styles}`}>
      {children}
    </span>
  );
};
