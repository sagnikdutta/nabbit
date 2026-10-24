import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { UserAccount } from '../lib/types';
import './theme/tokens.css';
import './dashboard.css';
import {
  continueReactCourse,
  libReactIn1Hour,
  libJsAsyncAwait,
  libReactUseEffect,
  libReduxCrash,
  recTypescript,
  recNextJs,
  recSystemDesign,
  recDocker,
} from './thumbnails';

/*
 * V2 Dashboard — React port of docs/nabbit_interactive_dashboard.html.
 * Loosely coupled from V1: owns its own CSS tokens (see dashboard.css under
 * `.v2-root`), markup, and dummy data. Shared with V1 only via the Supabase
 * client + auth session (both wrapped elsewhere) — nothing imported from V1.
 *
 * This is the signed-in dashboard mockup. It renders the same for signed-out
 * visitors (shows the demo data) — by product decision, V2 is a design
 * preview, not an auth-gated surface.
 */

type Tab = 'Recent' | 'In Progress' | 'Completed' | 'Playlists';
type NavKey =
  | 'Home'
  | 'Import Video'
  | 'My Library'
  | 'Practice'
  | 'Recall'
  | 'Progress'
  | 'Achievements'
  | 'Settings';

type LibraryCard = {
  id: string;
  title: string;
  creator: string;
  duration: string;
  thumb: string;
  progress: number; // 0..1
  drillsDone: number;
  drillsTotal: number;
  tabs: Tab[]; // which tabs this card appears under
  tags: string[];
  searchBag: string;
};

const LIBRARY: LibraryCard[] = [
  {
    id: 'react-tut',
    title: 'React Tutorial for Beginners',
    creator: 'Programming with Mosh',
    duration: '1:02:15',
    thumb: libReactIn1Hour,
    progress: 8 / 14,
    drillsDone: 8,
    drillsTotal: 14,
    tabs: ['Recent', 'In Progress'],
    tags: ['React', 'Components', '+2'],
    searchBag: 'react tutorial beginners mosh components props',
  },
  {
    id: 'js-async',
    title: 'JavaScript Async Await Explained',
    creator: 'Fireship',
    duration: '18:24',
    thumb: libJsAsyncAwait,
    progress: 3 / 6,
    drillsDone: 3,
    drillsTotal: 6,
    tabs: ['Recent', 'In Progress'],
    tags: ['JavaScript', 'Async', '+2'],
    searchBag: 'javascript async await explained fireship promises',
  },
  {
    id: 'react-useeffect',
    title: 'React useEffect Explained',
    creator: 'Web Dev Simplified',
    duration: '13:05',
    thumb: libReactUseEffect,
    progress: 5 / 8,
    drillsDone: 5,
    drillsTotal: 8,
    tabs: ['Recent', 'In Progress'],
    tags: ['React', 'Hooks', 'Lifecycle'],
    searchBag: 'react useeffect hooks lifecycle web dev simplified',
  },
  {
    id: 'redux-crash',
    title: 'Redux Crash Course',
    creator: 'Traversy Media',
    duration: '30:25',
    thumb: libReduxCrash,
    progress: 0,
    drillsDone: 0,
    drillsTotal: 10,
    tabs: ['Recent', 'Playlists'],
    tags: ['Redux', 'State', 'Toolkit'],
    searchBag: 'redux crash course traversy state toolkit',
  },
];

const RECOMMENDED = [
  { id: 'ts-full', title: 'TypeScript', subtitle: 'Full Course', duration: '3:48:21', thumb: recTypescript },
  { id: 'next-full', title: 'Next.js', subtitle: 'Full Course', duration: '3:20:15', thumb: recNextJs },
  { id: 'sysdesign', title: 'System Design', subtitle: 'for Beginners', duration: '1:15:30', thumb: recSystemDesign },
  { id: 'docker-crash', title: 'Docker', subtitle: 'Crash Course', duration: '28:10', thumb: recDocker },
];

export default function V2Dashboard() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeNav, setActiveNav] = useState<NavKey>('Home');
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => api.getCurrentUser());
  useEffect(() => api.onAuthChange(setCurrentUser), []);
  const [activeTab, setActiveTab] = useState<Tab>('Recent');
  const [search, setSearch] = useState('');
  const [continueDrillsDone, setContinueDrillsDone] = useState(6);
  const [goals, setGoals] = useState({ drills: true, debug: true, recall: false, streak: false });
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Ready to practise?');
  const [modalBody, setModalBody] = useState('Choose a challenge to begin.');
  const [modalAction, setModalAction] = useState('Start challenge');
  const modalCallbackRef = useRef<(() => void) | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  const filteredLibrary = useMemo(() => {
    const q = search.trim().toLowerCase();
    return LIBRARY.filter(card => {
      if (q) {
        const hay = (card.searchBag + ' ' + card.title + ' ' + card.creator).toLowerCase();
        if (!hay.includes(q)) return false;
      } else if (!card.tabs.includes(activeTab)) {
        return false;
      }
      return true;
    });
  }, [search, activeTab]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    showToast(next === 'dark' ? 'Dark mode enabled' : 'Light mode enabled');
  };

  const openModal = (title: string, body: string, action: string, onConfirm: () => void) => {
    setModalTitle(title);
    setModalBody(body);
    setModalAction(action);
    modalCallbackRef.current = onConfirm;
    setModalOpen(true);
  };

  const handleModalConfirm = () => {
    modalCallbackRef.current?.();
    setModalOpen(false);
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) {
      showToast('Paste a YouTube link first.');
      return;
    }
    openModal(
      'Create drills from this video?',
      `Nabbit will scan the tutorial and generate hands-on drills from the key concepts.`,
      'Create drills',
      () => {
        showToast('Drill generation queued — we’ll notify you when it’s ready.');
        setYoutubeUrl('');
      },
    );
  };

  const continueProgress =
    continueDrillsDone >= 12 ? 1 : continueDrillsDone / 12;

  return (
    <div className="v2-root" data-theme={theme}>
      <div className="v2-app">
        <aside className="v2-sidebar">
          <div className="v2-brand">
            <div className="v2-brand-mark">N</div>
            <div className="v2-brand-copy">
              <div className="v2-brand-name">Nabbit</div>
              <div className="v2-brand-tag">catch the nit</div>
            </div>
          </div>
          <nav className="v2-nav" aria-label="Main navigation">
            {(['Home', 'Import Video', 'My Library', 'Practice', 'Recall', 'Progress'] as NavKey[]).map(key => {
              const href = navHref(key);
              const isActive = activeNav === key;
              return (
                <a
                  key={key}
                  href={href}
                  className={isActive ? 'active' : ''}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={e => {
                    if (href === '#') {
                      e.preventDefault();
                      setActiveNav(key);
                      showToast(`${key} is coming to V2 soon.`);
                    }
                  }}
                >
                  <span className="ico">{navIcon(key)}</span>
                  <span className="v2-label">{key}</span>
                </a>
              );
            })}
            <div className="v2-nav-divider" />
            {(['Achievements', 'Settings'] as NavKey[]).map(key => (
              <a
                key={key}
                href="#"
                className={activeNav === key ? 'active' : ''}
                onClick={e => {
                  e.preventDefault();
                  setActiveNav(key);
                  showToast(`${key} is coming to V2 soon.`);
                }}
              >
                <span className="ico">{navIcon(key)}</span>
                <span className="v2-label">{key}</span>
              </a>
            ))}
          </nav>
          <div className="v2-pro-card">
            <div className="v2-pro-title">👑 Go Pro</div>
            <p>Unlock more drills, advanced analytics and custom playlists.</p>
            <button className="v2-primary" onClick={() => showToast('Pro plans are coming soon.')}>
              Upgrade Now →
            </button>
          </div>
        </aside>

        <div className="v2-main">
          <header className="v2-topbar">
            <label className="v2-search">
              <span>⌕</span>
              <input
                placeholder="Search your videos, concepts or drills..."
                aria-label="Search videos, concepts or drills"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </label>
            <div className="v2-top-spacer" />
            <div className="v2-stat">🔥 12 day streak</div>
            <div className="v2-stat">⚡ 2,450 XP</div>
            <div className="v2-level-pill">
              Level 4<span className="v2-xpbar"><i /></span>
            </div>
            <button
              className="v2-icon-btn"
              aria-label="Notifications"
              onClick={() => showToast("You're all caught up.")}
            >
              🔔
            </button>
            <button
              className="v2-icon-btn"
              aria-label="Switch theme"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            {currentUser ? (
              <>
                <div className="v2-avatar" title={currentUser.email}>
                  {(currentUser.email?.[0] || 'U').toUpperCase()}
                </div>
                <button
                  className="v2-icon-btn"
                  aria-label="Sign out"
                  title="Sign out"
                  onClick={() => {
                    api.signOut();
                    showToast('Signed out.');
                  }}
                >
                  ⌄
                </button>
              </>
            ) : (
              <button
                className="v2-primary"
                style={{ padding: '8px 16px' }}
                onClick={() => (window.location.href = '/v2/auth')}
              >
                Sign in
              </button>
            )}
          </header>

          <main className="v2-workspace">
            <div className="v2-content">
              <section className="v2-hero">
                <div className="v2-hero-copy">
                  <div className="v2-eyebrow">TURN YOUTUBE VIDEOS INTO PRACTICE</div>
                  <h1>Watch. Practise. Remember.</h1>
                  <p>
                    Paste any YouTube tutorial and Nabbit will create hands-on drills to help you actually
                    retain what you learn.
                  </p>
                  <form className="v2-import-row" onSubmit={handleImportSubmit}>
                    <span className="v2-yt">▶</span>
                    <input
                      placeholder="Paste YouTube video link here..."
                      aria-label="YouTube video URL"
                      value={youtubeUrl}
                      onChange={e => setYoutubeUrl(e.target.value)}
                    />
                    <button className="v2-primary" type="submit">
                      Create Drills&nbsp;→
                    </button>
                  </form>
                  <button
                    className="v2-example"
                    onClick={() => {
                      setYoutubeUrl('https://www.youtube.com/watch?v=Ke90Tje7VS0');
                      showToast('Example React tutorial added to the import field.');
                    }}
                  >
                    ▣ &nbsp;Try an example video
                  </button>
                </div>
                <div className="v2-hero-art" aria-hidden="true">
                  <div className="v2-yt-tile">▶</div>
                  <span className="v2-art-arrow">→</span>
                  <div className="v2-concept-sheet">
                    <div className="v2-sheet-line" />
                    <div className="v2-sheet-line short" />
                    <div className="v2-sheet-line" />
                    <div className="v2-sheet-line short" />
                    <div className="v2-sheet-line" />
                  </div>
                  <div className="v2-art-stack">
                    <div className="v2-art-pill"><b>‹/›</b> Key Concepts</div>
                    <div className="v2-art-pill"><b>⌘</b> Coding Drills</div>
                    <div className="v2-art-pill"><b>?</b> Quiz Questions</div>
                    <div className="v2-art-pill"><b>◷</b> Spaced Recall</div>
                  </div>
                </div>
              </section>

              <section className="v2-section">
                <div className="v2-section-head">
                  <h2>Continue Learning</h2>
                  <span className="v2-spacer" />
                  <button className="v2-link-btn" onClick={() => showToast('All in-progress items.')}>
                    View All →
                  </button>
                </div>
                <div className="v2-continue-card">
                  <div className="v2-thumb">
                    <img src={continueReactCourse} alt="React JS Full Course for Beginners thumbnail" />
                    <span className="v2-duration">28:14</span>
                  </div>
                  <div className="v2-continue-info">
                    <h3>React JS Full Course for Beginners</h3>
                    <div className="v2-muted v2-small">Programming with Mosh ✓</div>
                    <div className="v2-progress-row">
                      <div className="v2-progress">
                        <span style={{ width: `${Math.round(continueProgress * 100)}%` }} />
                      </div>
                      <span className="v2-small v2-muted">
                        {continueDrillsDone} / 12 drills completed
                      </span>
                    </div>
                    <div className="v2-tags">
                      {['Components', 'Props', 'State', 'Event Handling', 'Conditional Rendering', '+3'].map(t => (
                        <span key={t} className="v2-chip">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="v2-continue-actions">
                    <a
                      className="v2-primary"
                      href={continueDrillsDone >= 12 ? undefined : '/v2/challenge/react-state-batching'}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        textDecoration: 'none',
                        opacity: continueDrillsDone >= 12 ? 0.6 : 1,
                        pointerEvents: continueDrillsDone >= 12 ? 'none' : 'auto',
                      }}
                    >
                      {continueDrillsDone >= 12 ? '✓ Completed' : 'Continue'}
                    </a>
                    <button
                      className="v2-secondary"
                      disabled={continueDrillsDone >= 12}
                      onClick={() => {
                        setContinueDrillsDone(12);
                        showToast('Learning item marked complete!');
                      }}
                    >
                      Mark complete
                    </button>
                  </div>
                </div>
              </section>

              <section className="v2-section">
                <div className="v2-section-head">
                  <h2>Your Learning Library</h2>
                  <span className="v2-spacer" />
                  <div className="v2-tabs">
                    {(['Recent', 'In Progress', 'Completed', 'Playlists'] as Tab[]).map(t => (
                      <button
                        key={t}
                        className={`v2-tab ${!search && activeTab === t ? 'active' : ''}`}
                        onClick={() => {
                          setActiveTab(t);
                          setSearch('');
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <button className="v2-link-btn" onClick={() => showToast('Opening full library.')}>
                    View All →
                  </button>
                </div>
                {filteredLibrary.length ? (
                  <div className="v2-library-grid">
                    {filteredLibrary.map(card => (
                      <article key={card.id} className="v2-video-card">
                        <div className="v2-video-thumb">
                          <img src={card.thumb} alt={`${card.title} thumbnail`} />
                          <button
                            className="v2-more"
                            aria-label="More options"
                            onClick={() => showToast('Card menu coming soon.')}
                          >
                            ⋯
                          </button>
                        </div>
                        <h3>{card.title}</h3>
                        <div className="v2-creator">{card.creator}</div>
                        <div className="v2-progress-row">
                          <div className="v2-progress">
                            <span style={{ width: `${Math.round(card.progress * 100)}%` }} />
                          </div>
                          <span className="v2-small v2-muted">
                            {card.drillsDone} / {card.drillsTotal} drills
                          </span>
                        </div>
                        <div className="v2-tags">
                          {card.tags.map(t => (
                            <span key={t} className="v2-chip">{t}</span>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: 30,
                      color: 'var(--muted)',
                      border: '1px dashed var(--line)',
                      borderRadius: 10,
                    }}
                  >
                    No videos match this view. Try another tab or search term.
                  </div>
                )}
              </section>

              <section className="v2-section">
                <div className="v2-section-head">
                  <h2>Recommended for You</h2>
                  <span className="v2-spacer" />
                  <button
                    className="v2-link-btn"
                    onClick={() => showToast('More recommendations will appear as you learn.')}
                  >
                    See More →
                  </button>
                </div>
                <div className="v2-recommended-grid">
                  {RECOMMENDED.map(r => (
                    <article key={r.id} className="v2-recommend-card">
                      <img src={r.thumb} alt={`${r.title} thumbnail`} />
                      <div>
                        <strong>{r.title}</strong>
                        <span>{r.subtitle}</span>
                        <span>{r.duration}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <aside className="v2-right-rail">
              <section className="v2-panel">
                <div className="v2-panel-head">
                  <h2>Your Progress</h2>
                  <button className="v2-link-btn" onClick={() => showToast('Opening progress details.')}>
                    View Details →
                  </button>
                </div>
                <div className="v2-mastery-layout">
                  <div className="v2-ring" aria-label="68% overall mastery">
                    <div className="v2-ring-center">
                      <strong>68%</strong>
                      <span>Overall Mastery</span>
                    </div>
                  </div>
                  <div className="v2-metrics">
                    {[
                      { ico: '📥', label: 'Videos processed', value: 12 },
                      { ico: '🧠', label: 'Concepts learned', value: 86 },
                      { ico: '‹/›', label: 'Drills completed', value: 62 },
                      { ico: '🏆', label: 'Concepts mastered', value: 8 },
                    ].map(m => (
                      <div key={m.label} className="v2-metric">
                        <div className="v2-metric-ico">{m.ico}</div>
                        <div>
                          <strong>{m.value}</strong>
                          <span>{m.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="v2-panel">
                <div className="v2-panel-head">
                  <h2>Today's Goals</h2>
                </div>
                <div className="v2-muted v2-small" style={{ marginBottom: 8 }}>
                  {Object.values(goals).filter(Boolean).length} of 4 completed
                </div>
                <div className="v2-goal-progress">
                  <span
                    style={{
                      width: `${(Object.values(goals).filter(Boolean).length / 4) * 100}%`,
                    }}
                  />
                </div>
                <div className="v2-goal-list">
                  {([
                    { key: 'drills', label: 'Complete 2 drills', count: '2/2' },
                    { key: 'debug', label: 'Solve 1 debug challenge', count: '1/1' },
                    { key: 'recall', label: 'Do 5 recall questions', count: '0/5' },
                    { key: 'streak', label: 'Maintain 10 min streak', count: '0/1' },
                  ] as const).map(g => (
                    <label key={g.key} className="v2-goal">
                      <input
                        type="checkbox"
                        checked={goals[g.key]}
                        onChange={e => setGoals(prev => ({ ...prev, [g.key]: e.target.checked }))}
                      />
                      <span>{g.label}</span>
                      <span className="v2-count">{g.count}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="v2-panel">
                <div className="v2-panel-head">
                  <h2>Recall Queue</h2>
                  <button className="v2-link-btn" onClick={() => showToast('Opening recall queue.')}>
                    View All →
                  </button>
                </div>
                <div className="v2-recall-list">
                  {[
                    { ico: '⚛', title: 'React State Updates', seen: '3 days ago' },
                    { ico: '◷', title: 'useEffect Cleanup', seen: '5 days ago' },
                    { ico: '⊗', title: 'Context API', seen: '1 week ago' },
                  ].map(r => (
                    <div key={r.title} className="v2-recall-item">
                      <div className="v2-recall-icon">{r.ico}</div>
                      <div>
                        <strong>{r.title}</strong>
                        <span>Last seen {r.seen}</span>
                      </div>
                      <button
                        className="v2-secondary"
                        onClick={() =>
                          openModal(
                            `Review: ${r.title}`,
                            'Start a 2-minute recall drill on this concept.',
                            'Start review',
                            () => showToast(`Review of ${r.title} queued.`),
                          )
                        }
                      >
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="v2-panel">
                <div className="v2-panel-head">
                  <h2>Recent Achievements</h2>
                  <button className="v2-link-btn" onClick={() => showToast('All achievements.')}>
                    See All →
                  </button>
                </div>
                <div className="v2-achievement-grid">
                  {[
                    { ico: '🔥', label: '7 Day Streak', cls: '' },
                    { ico: '🐞', label: 'First Debug Challenge', cls: 'red' },
                    { ico: '✓', label: 'React Mastered', cls: 'cyan' },
                    { ico: '🔒', label: 'JavaScript Mastered', cls: 'lock' },
                  ].map(b => (
                    <div key={b.label}>
                      <div className={`v2-badge-ico ${b.cls}`}>{b.ico}</div>
                      <span>{b.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </main>
        </div>
      </div>

      <div className={`v2-toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>

      {modalOpen && (
        <div
          className="v2-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: '#070b18a6',
            display: 'grid',
            placeItems: 'center',
            zIndex: 30,
            padding: 20,
          }}
          role="dialog"
          aria-modal="true"
          onClick={e => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              padding: 24,
              width: 'min(510px, 100%)',
              boxShadow: '0 25px 80px #0003',
            }}
          >
            <h2 style={{ margin: '0 0 8px' }}>{modalTitle}</h2>
            <p className="v2-muted">{modalBody}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="v2-secondary" onClick={() => setModalOpen(false)}>
                Not now
              </button>
              <button className="v2-primary" onClick={handleModalConfirm}>
                {modalAction}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function navHref(k: NavKey): string {
  switch (k) {
    case 'Home': return '/v2/';
    case 'Practice': return '/v2/challenge/react-state-batching';
    default: return '#';
  }
}

function navIcon(k: NavKey): string {
  switch (k) {
    case 'Home': return '⌂';
    case 'Import Video': return '▣';
    case 'My Library': return '▤';
    case 'Practice': return '♧';
    case 'Recall': return '◴';
    case 'Progress': return '📊';
    case 'Achievements': return '🏆';
    case 'Settings': return '⚙';
  }
}
