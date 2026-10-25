import { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, MouseEvent, ReactNode } from 'react';
import './primitives.css';

/*
 * V2 design-system primitives. Thin wrappers over the shared `.v2-*` classes
 * in primitives.css so pages compose them instead of hand-rolling styles.
 */

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

// ---------- V2Button ----------
type ButtonVariant = 'primary' | 'secondary' | 'link';
type V2ButtonProps = { variant?: ButtonVariant; size?: 'md' | 'lg' } & (
  | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
  | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
);

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'v2-primary',
  secondary: 'v2-secondary',
  link: 'v2-link-btn',
};

/** Renders an <a> when `href` is given, otherwise a <button type="button">. */
export function V2Button({ variant = 'primary', size = 'md', className, ...rest }: V2ButtonProps) {
  const cls = cx(VARIANT_CLASS[variant], size === 'lg' && 'lg', className);
  if ('href' in rest && rest.href !== undefined) {
    return <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} className={cls} />;
  }
  const btn = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return <button type="button" {...btn} className={cls} />;
}

// ---------- V2Chip ----------
export function V2Chip({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span {...rest} className={cx('v2-chip', className)} />;
}

// ---------- V2Progress ----------
/** `value` is a 0..1 fraction; clamped. */
export function V2Progress({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value || 0)) * 100);
  return (
    <div
      className={cx('v2-progress', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------- V2Panel ----------
/** Titled right-rail style panel. `action` renders on the right of the header. */
export function V2Panel({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('v2-panel', className)}>
      {(title || action) && (
        <div className="v2-panel-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// ---------- V2Card ----------
/** Bordered surface. With `href` it is a link card; with `onClick` it is interactive. */
export function V2Card({
  accent,
  href,
  onClick,
  className,
  children,
}: {
  accent?: boolean;
  href?: string;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  className?: string;
  children: ReactNode;
}) {
  const cls = cx('v2-card', accent && 'accent', (href || onClick) && 'interactive', className);
  if (href) return <a className={cls} href={href} onClick={onClick}>{children}</a>;
  return <div className={cls} onClick={onClick}>{children}</div>;
}

// ---------- V2Toast ----------
export function V2Toast({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div className="v2-shell-toast show" role="status" aria-live="polite">
      {message}
    </div>
  );
}

// ---------- V2Modal ----------
export function V2Modal({
  open,
  title,
  onClose,
  actions,
  children,
}: {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="v2-modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="v2-modal">
        <h2>{title}</h2>
        {children}
        {actions && <div className="v2-modal-actions">{actions}</div>}
      </div>
    </div>
  );
}
