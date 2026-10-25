import { ReactNode, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { UserAccount } from '../lib/types';
import './theme/tokens.css';
import './v2shell.css';

/*
 * Shared V2 layout: sidebar (brand + nav + Go Pro card) and topbar
 * (search + stats + theme toggle + auth state).
 *
 * Every V2 page (Dashboard, Challenge, Recall, …) wraps its content in
 * <V2Shell activeNav="…">…</V2Shell> instead of hand-rolling chrome. The
 * `rightRail` slot renders alongside the main content, matching the
 * Dashboard mockup's 3-column feel; pages without a rail (Challenge)
 * just leave it out and the content stretches.
 *
 * Nav items are plain <a href> links to real V2 routes so middle-click /
 * cmd-click / "open in new tab" behave the way users expect; the topbar's
 * search + notifications + sign-in state are shared across pages.
 */

export type V2NavKey =
  | 'Home'
  | 'Import Video'
  | 'My Library'
  | 'Practice'
  | 'Recall'
  | 'Progress'
  | 'Achievements'
  | 'Settings';

interface NavLink {
  key: V2NavKey;
  icon: string;
  href: string;
}

const NAV_LINKS: NavLink[] = [
  { key: 'Home',          icon: '⌂', href: '/v2/' },
  { key: 'Import Video',  icon: '▣', href: '/v2/' }, // Dashboard owns the import form
  { key: 'My Library',    icon: '▤', href: '/v2/' },
  { key: 'Practice',      icon: '♧', href: '/v2/challenge/react-state-batching' },
  { key: 'Recall',        icon: '◴', href: '/v2/recall' },
  { key: 'Progress',      icon: '📊', href: '/v2/' },
];
const NAV_SECONDARY: NavLink[] = [
  { key: 'Achievements', icon: '🏆', href: '/v2/' },
  { key: 'Settings',     icon: '⚙',       href: '/v2/' },
];

export interface V2ShellProps {
  activeNav: V2NavKey;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  /** Right-column panels (optional). Dashboard uses it; Challenge/Recall don't. */
  rightRail?: ReactNode;
  children: ReactNode;
  /** Hide the search box when the current page doesn't support it (e.g. Challenge). */
  showSearch?: boolean;
  /** Called when the user types in the shared topbar search box. */
  onSearchChange?: (q: string) => void;
  searchValue?: string;
  /** Full-page toast (optional). */
  toast?: string | null;
  /**
   * Topbar stats. Pages pass live values from the data layer; defaults keep
   * the demo chips in place so Pages that haven't been wired up yet still
   * render cleanly.
   */
  streak?: number;
  xp?: number;
  level?: number;
  /** 0..1 — fraction of the current level the user has filled. */
  xpProgress?: number;
}

export function V2Shell({
  activeNav,
  theme,
  onToggleTheme,
  rightRail,
  children,
  showSearch = true,
  onSearchChange,
  searchValue = '',
  toast,
  // Defaults keep the demo chips in place for pages (like today's Dashboard
  // + Auth) that haven't been wired to live data yet; passing real values
  // overrides them per-page.
  streak = 12,
  xp = 2450,
  level = 4,
  xpProgress = 0.61,
}: V2ShellProps) {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => api.getCurrentUser());
  useEffect(() => api.onAuthChange(setCurrentUser), []);

  return (
    <div className="v2-root v2-shell-root" data-theme={theme}>
      <div className="v2-shell-app">
        <aside className="v2-shell-sidebar">
          <a href="/v2/" className="v2-brand" aria-label="Nabbit home">
            <div className="v2-brand-mark">N</div>
            <div className="v2-brand-copy">
              <div className="v2-brand-name">Nabbit</div>
              <div className="v2-brand-tag">catch the nit</div>
            </div>
          </a>
          <nav className="v2-shell-nav" aria-label="Main navigation">
            {NAV_LINKS.map(link => (
              <a
                key={link.key}
                href={link.href}
                className={activeNav === link.key ? 'active' : ''}
                aria-current={activeNav === link.key ? 'page' : undefined}
              >
                <span className="ico">{link.icon}</span>
                <span className="v2-label">{link.key}</span>
              </a>
            ))}
            <div className="v2-shell-nav-divider" />
            {NAV_SECONDARY.map(link => (
              <a
                key={link.key}
                href={link.href}
                className={activeNav === link.key ? 'active' : ''}
                aria-current={activeNav === link.key ? 'page' : undefined}
              >
                <span className="ico">{link.icon}</span>
                <span className="v2-label">{link.key}</span>
              </a>
            ))}
          </nav>
          <div className="v2-shell-pro">
            <div className="v2-shell-pro-title">👑 Go Pro</div>
            <p>Unlock more drills, advanced analytics and custom playlists.</p>
            <a className="v2-shell-pro-cta" href="/v2/">Upgrade Now →</a>
          </div>
        </aside>

        <div className="v2-shell-main">
          <header className="v2-shell-topbar">
            {showSearch ? (
              <label className="v2-shell-search">
                <span>⌕</span>
                <input
                  placeholder="Search your videos, concepts or drills..."
                  aria-label="Search videos, concepts or drills"
                  value={searchValue}
                  onChange={e => onSearchChange?.(e.target.value)}
                />
              </label>
            ) : (
              <div className="v2-shell-search v2-shell-search--placeholder" aria-hidden />
            )}
            <div className="v2-shell-spacer" />
            <div className="v2-shell-stat" title={`${streak} day streak`}>
              🔥 {streak} day streak
            </div>
            <div className="v2-shell-stat" title={`${xp.toLocaleString()} XP`}>
              ⚡ {xp.toLocaleString()} XP
            </div>
            <div className="v2-shell-level" title={`Level ${level}`}>
              Level {level}
              <span className="v2-shell-xpbar">
                <i style={{ width: `${Math.round(Math.min(1, Math.max(0, xpProgress)) * 100)}%` }} />
              </span>
            </div>
            <button
              className="v2-shell-icon-btn"
              aria-label="Switch theme"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              onClick={onToggleTheme}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            {currentUser ? (
              <>
                <div className="v2-shell-avatar" title={currentUser.email}>
                  {(currentUser.email?.[0] || 'U').toUpperCase()}
                </div>
                <button
                  className="v2-shell-icon-btn"
                  aria-label="Sign out"
                  title="Sign out"
                  onClick={() => api.signOut()}
                >
                  ⌄
                </button>
              </>
            ) : (
              <a className="v2-shell-signin" href="/v2/auth">Sign in</a>
            )}
          </header>

          <main className={`v2-shell-workspace ${rightRail ? 'with-rail' : ''}`}>
            <div className="v2-shell-content">{children}</div>
            {rightRail && <aside className="v2-shell-rail">{rightRail}</aside>}
          </main>
        </div>
      </div>

      {toast && (
        <div className="v2-shell-toast show" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
