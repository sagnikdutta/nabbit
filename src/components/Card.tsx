import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'subtle' | 'accent' | 'danger' | 'good';
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  interactive = false,
  className = '',
  ...props
}) => {
  const variantStyles = {
    default:
      'bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-sm)]',
    subtle:
      'bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)]',
    accent:
      'bg-[var(--color-surface)] border border-[var(--color-accent-border)] ring-1 ring-[var(--color-accent-weak)]',
    danger:
      'bg-[var(--color-danger-weak)] border border-[var(--color-danger-border)]',
    good:
      'bg-[var(--color-good-weak)] border border-[var(--color-good-border)]',
  }[variant];

  const interactiveStyles = interactive
    ? 'hover:border-[var(--color-accent-border)] hover:shadow-[var(--shadow)] transition-all cursor-pointer'
    : '';

  return (
    <div
      className={`rounded-[var(--radius)] p-6 ${variantStyles} ${interactiveStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
