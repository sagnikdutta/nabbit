import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-colors cursor-pointer select-none whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-[var(--radius-sm)]',
    md: 'text-sm px-4 py-2 gap-2 rounded-[var(--radius)]',
    lg: 'text-base px-6 py-2.5 gap-2.5 rounded-[var(--radius-lg)]',
  }[size];

  const variantClasses = {
    primary:
      'bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-hover)] shadow-[var(--shadow-sm)]',
    secondary:
      'bg-[var(--color-surface-subtle)] text-[var(--color-text)] hover:bg-[var(--color-border)] border border-[var(--color-border)]',
    outline:
      'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)] border border-[var(--color-border)]',
    ghost:
      'bg-transparent text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)]',
    danger:
      'bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-hover)] shadow-[var(--shadow-sm)]',
    success:
      'bg-[var(--color-good)] text-white hover:bg-[var(--color-good-hover)] shadow-[var(--shadow-sm)]',
  }[variant];

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
};
