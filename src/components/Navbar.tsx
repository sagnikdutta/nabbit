import React from 'react';
import { Target, Moon, Sun, Flame, Clock } from 'lucide-react';

export interface NavbarProps {
  currentRoute: 'library' | 'challenge' | 'reveal' | 'recall';
  onNavigate: (route: 'library' | 'challenge' | 'recall', param?: string) => void;
  activeStreak: number;
  dueCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onNavigate,
  activeStreak,
  dueCount,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark (single text element) */}
        <button
          onClick={() => onNavigate('library')}
          className="flex items-center gap-2 text-left cursor-pointer group select-none whitespace-nowrap shrink-0"
        >
          <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white flex items-center justify-center shadow-[var(--shadow-sm)] group-hover:bg-[var(--color-accent-hover)] transition-colors">
            <Target className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-[var(--color-text)]">
              Nabbit
            </span>
            <span className="hidden sm:inline text-xs text-[var(--color-muted)] font-normal ml-1.5 opacity-80">
              catch the nit
            </span>
          </div>
        </button>

        {/* Zone 2: Single-line navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => onNavigate('library')}
            className={`whitespace-nowrap cursor-pointer transition-colors pb-0.5 ${
              currentRoute === 'library'
                ? 'text-[var(--color-accent)] font-semibold border-b-2 border-[var(--color-accent)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Video Library
          </button>

          <button
            onClick={() => onNavigate('challenge')}
            className={`whitespace-nowrap cursor-pointer transition-colors pb-0.5 ${
              currentRoute === 'challenge' || currentRoute === 'reveal'
                ? 'text-[var(--color-accent)] font-semibold border-b-2 border-[var(--color-accent)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Bug Hunt Drill
          </button>

          <button
            onClick={() => onNavigate('recall')}
            className={`whitespace-nowrap cursor-pointer transition-colors pb-0.5 flex items-center gap-1.5 ${
              currentRoute === 'recall'
                ? 'text-[var(--color-accent)] font-semibold border-b-2 border-[var(--color-accent)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <span>Spaced Recall</span>
            {dueCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[var(--color-accent)] text-white">
                {dueCount}
              </span>
            )}
          </button>
        </nav>

        {/* Zone 3: 1 primary action / status cluster */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Streak indicator */}
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-xs font-mono font-medium text-[var(--color-text)] select-none"
            title="Consecutive successful review streak"
          >
            <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span className="tabular-nums">{activeStreak}</span>
            <span className="hidden sm:inline text-[var(--color-muted)] font-normal text-[11px]">streak</span>
          </div>

          {/* Theme switcher */}
          <button
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border)] flex items-center justify-center transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Switch to Clean SaaS light mode' : 'Switch to Dev Dark IDE mode'}
            aria-label="Toggle visual theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
