import React, { useState, useRef, useEffect } from 'react';
import { Target, Moon, Sun, Flame, User, LogIn, LogOut, ShieldCheck, AlertCircle, ChevronDown, CheckCircle2 } from 'lucide-react';
import { UserAccount } from '../lib/types';

export interface NavbarProps {
  currentRoute: 'library' | 'challenge' | 'reveal' | 'recall' | 'auth';
  onNavigate: (route: 'library' | 'challenge' | 'recall' | 'auth', param?: string) => void;
  activeStreak: number;
  dueCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  currentUser?: UserAccount | null;
  onOpenAuth: () => void;
  onOpenVerification: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRoute,
  onNavigate,
  activeStreak,
  dueCount,
  theme,
  onToggleTheme,
  currentUser,
  onOpenAuth,
  onOpenVerification,
  onSignOut,
}) => {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isVerified = currentUser && currentUser.emailVerified && currentUser.phoneVerified;
  const isPartiallyVerified = currentUser && (!currentUser.emailVerified || !currentUser.phoneVerified);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3 sm:gap-8">
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
        <nav className="flex items-center gap-4 sm:gap-6 text-[13px] sm:text-sm font-medium">
          <button
            onClick={() => onNavigate('library')}
            aria-current={currentRoute === 'library' ? 'page' : undefined}
            className={`whitespace-nowrap cursor-pointer transition-colors pb-0.5 ${
              currentRoute === 'library'
                ? 'text-[var(--color-accent)] font-semibold border-b-2 border-[var(--color-accent)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <span className="sm:hidden">Library</span>
            <span className="hidden sm:inline">Video Library</span>
          </button>

          <button
            onClick={() => onNavigate('challenge')}
            aria-current={currentRoute === 'challenge' || currentRoute === 'reveal' ? 'page' : undefined}
            className={`whitespace-nowrap cursor-pointer transition-colors pb-0.5 ${
              currentRoute === 'challenge' || currentRoute === 'reveal'
                ? 'text-[var(--color-accent)] font-semibold border-b-2 border-[var(--color-accent)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <span className="sm:hidden">Drills</span>
            <span className="hidden sm:inline">Bug Hunt Drill</span>
          </button>

          <button
            onClick={() => onNavigate('recall')}
            aria-current={currentRoute === 'recall' ? 'page' : undefined}
            className={`whitespace-nowrap cursor-pointer transition-colors pb-0.5 flex items-center gap-1.5 ${
              currentRoute === 'recall'
                ? 'text-[var(--color-accent)] font-semibold border-b-2 border-[var(--color-accent)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            <span className="sm:hidden">Recall</span>
            <span className="hidden sm:inline">Spaced Recall</span>
            {dueCount > 0 && (
              <span
                className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[var(--color-accent)] text-white"
                aria-label={`${dueCount} due for review`}
              >
                {dueCount}
              </span>
            )}
          </button>
        </nav>

        {/* Zone 3: 1 primary action / status cluster */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Streak indicator */}
          <div
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-xs font-mono font-medium text-[var(--color-text)] select-none"
            title="Consecutive successful review streak"
          >
            <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span className="tabular-nums">{activeStreak}</span>
            <span className="hidden sm:inline text-[var(--color-muted)] font-normal text-[11px]">streak</span>
          </div>

          {/* Theme switcher */}
          <button
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-muted)] hover:text-[var(--color-text)] flex items-center justify-center transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Switch to Clean SaaS light mode' : 'Switch to Dev Dark IDE mode'}
            aria-label="Toggle visual theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* User Auth Profile Cluster */}
          {currentUser ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] text-xs text-[var(--color-text)] transition-colors cursor-pointer"
                aria-expanded={profileMenuOpen}
              >
                <div className="w-6 h-6 rounded-full bg-[var(--color-accent-weak)] text-[var(--color-accent)] font-semibold flex items-center justify-center text-[11px]">
                  {currentUser.email.slice(0, 1).toUpperCase()}
                </div>
                <span className="hidden md:inline font-mono text-[11px] max-w-[110px] truncate">
                  {currentUser.email.split('@')[0]}
                </span>
                {isPartiallyVerified && (
                  <span className="w-2 h-2 rounded-full bg-amber-500" title="Background verification pending" />
                )}
                {isVerified && (
                  <CheckCircle2 className="w-3 h-3 text-[var(--color-good)] shrink-0" />
                )}
                <ChevronDown className="w-3 h-3 text-[var(--color-muted)]" />
              </button>

              {/* Profile Dropdown */}
              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-md)] p-3 space-y-3 z-50 text-xs animate-fade-in">
                  <div className="border-b border-[var(--color-border)] pb-2.5 space-y-1">
                    <p className="font-semibold text-[var(--color-text)] truncate">
                      {currentUser.email}
                    </p>
                    <p className="text-[11px] font-mono text-[var(--color-muted)] truncate">
                      {currentUser.phoneNumber}
                    </p>
                  </div>

                  {/* Verification Status */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--color-muted)]">Email:</span>
                      <span className={currentUser.emailVerified ? 'text-[var(--color-good)] font-medium flex items-center gap-0.5' : 'text-amber-500 font-medium'}>
                        {currentUser.emailVerified ? '✓ Verified' : 'Pending in bg'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--color-muted)]">Phone:</span>
                      <span className={currentUser.phoneVerified ? 'text-[var(--color-good)] font-medium flex items-center gap-0.5' : 'text-amber-500 font-medium'}>
                        {currentUser.phoneVerified ? '✓ Verified' : 'Pending in bg'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--color-border)] space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onOpenVerification();
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-[var(--radius-sm)] text-[var(--color-accent)] hover:bg-[var(--color-accent-weak)] transition-colors flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{isVerified ? 'View Verification Details' : 'Enter Verification Codes'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-[var(--radius-sm)] text-[var(--color-danger)] hover:bg-[var(--color-danger-weak)] transition-colors flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-hover)] transition-colors text-xs font-semibold cursor-pointer shadow-[var(--shadow-sm)]"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
