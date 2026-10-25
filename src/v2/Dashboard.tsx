import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Challenge, RecallItem, RecallStats, Video } from '../lib/types';
import { V2Shell } from './V2Shell';
import { useV2Theme } from './useTheme';
import { useV2IsPro } from './useShellData';
import {
  V2DailyDrillCard,
  V2BossDrillCard,
  V2SeasonCard,
  V2CommunityTile,
  V2MasteryPanel,
} from './components/DashboardCards';
import { V2Button, V2Chip, V2Modal, V2Panel, V2Progress } from './components/primitives';
import './dashboard.css';

/*
 * V2 Dashboard — the signed-in home. Wraps its content in V2Shell for the
 * shared sidebar + topbar, and reads real data from the api layer:
 *   - api.getVideos()                → library grid + "Continue learning"
 *   - api.getRecallDashboard()       → recall queue + progress metrics +
 *                                      topbar streak/XP
 *   - api.getVideoChallenges(id)     → progress-per-video + tag chips
 *   - api.generateFromYouTubeUrl(url) → hero YouTube importer (Gemini on
 *                                       the server when GEMINI_API_KEY is set,
 *                                       template fallback otherwise)
 *
 * Signed-out visitors see the same shell — Nabbit's progress lives in the
 * browser's localStorage so there's no need to gate the view. A fresh
 * install just shows empty states + the full library.
 */

type Tab = 'Recent' | 'In Progress' | 'Completed' | 'Playlists';

const EMPTY_STATS: RecallStats = {
  revisitRate: 0,
  currentStreak: 0,
  totalSolved: 0,
  dueCount: 0,
  atRiskCount: 0,
  masteredCount: 0,
  simulatedOffsetDays: 0,
};

type DashboardSnapshot = {
  videos: Video[];
  challengesByVideoId: Map<string, Challenge[]>;
  recallItems: (RecallItem & { challenge?: Challenge })[];
  dueItems: (RecallItem & { challenge: Challenge })[];
  stats: RecallStats;
};

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  videos: [],
  challengesByVideoId: new Map(),
  recallItems: [],
  dueItems: [],
  stats: EMPTY_STATS,
};

/** Light-weight per-video progress derived from the user's recall items. */
function videoProgress(
  video: Video,
  challenges: Challenge[],
  recallItems: DashboardSnapshot['recallItems'],
): { drillsDone: number; drillsTotal: number; progress: number } {
  const drillsTotal = Math.max(challenges.length, video.conceptCount || 0, 1);
  const videoRecall = recallItems.filter(r => r.videoId === video.id);
  const drillsDone = videoRecall.length;
  return { drillsDone, drillsTotal, progress: Math.min(1, drillsDone / drillsTotal) };
}

function relativeTime(ts: number): string {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const day = 86_400_000;
  if (diff < day) return 'today';
  if (diff < 2 * day) return 'yesterday';
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))} week${diff >= 2 * 7 * day ? 's' : ''} ago`;
  return `${Math.floor(diff / (30 * day))} month${diff >= 2 * 30 * day ? 's' : ''} ago`;
}

/** Pick a short glyph for a recall item based on the first word of its concept. */
function conceptGlyph(concept: string): string {
  const c = concept.toLowerCase();
  if (c.includes('react')) return '⚛';
  if (c.includes('effect') || c.includes('cleanup')) return '◷';
  if (c.includes('context')) return '⊗';
  if (c.includes('redux') || c.includes('state')) return '◉';
  if (c.includes('async') || c.includes('promise')) return '⟳';
  if (c.includes('hook')) return '✦';
  if (c.includes('type')) return 'T';
  return '●';
}

export default function V2Dashboard() {
  const [theme, toggleTheme] = useV2Theme();
  const { isPro } = useV2IsPro();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('Recent');
  const [search, setSearch] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importElapsed, setImportElapsed] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
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

  const loadAll = async () => {
    try {
      const [videos, dash] = await Promise.all([
        api.getVideos(),
        api.getRecallDashboard(),
      ]);
      const challengesByVideoId = new Map<string, Challenge[]>();
      await Promise.all(
        videos.map(async v => {
          const list = await api.getVideoChallenges(v.id);
          challengesByVideoId.set(v.id, list);
        }),
      );
      setSnapshot({
        videos,
        challengesByVideoId,
        recallItems: (dash.allItems || []) as DashboardSnapshot['recallItems'],
        dueItems: (dash.dueItems || []) as DashboardSnapshot['dueItems'],
        stats: dash.stats || EMPTY_STATS,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    return api.onAuthChange(() => loadAll());
  }, []);

  const { videos, challengesByVideoId, recallItems, dueItems, stats } = snapshot;

  // ----- Derived library cards from real videos -----
  type LibraryCard = {
    video: Video;
    drillsDone: number;
    drillsTotal: number;
    progress: number;
    tags: string[];
    lastAttemptAt: number;
    tabs: Tab[];
  };
  const libraryCards: LibraryCard[] = useMemo(() => {
    return videos.map(v => {
      const challenges = challengesByVideoId.get(v.id) || [];
      const { drillsDone, drillsTotal, progress } = videoProgress(v, challenges, recallItems);
      const videoRecall = recallItems.filter(r => r.videoId === v.id);
      const lastAttemptAt = videoRecall.reduce((max, r) => Math.max(max, r.lastReviewedAt || 0), 0);
      // Pick up to 3 unique concept chips as tags; concept names make the
      // most useful summary of "what's in this video".
      const uniqueConcepts = Array.from(new Set(challenges.map(c => c.concept))).slice(0, 3);
      const tags = uniqueConcepts.length ? uniqueConcepts : [v.stack];
      const tabs: Tab[] = [];
      if (lastAttemptAt > 0) tabs.push('Recent');
      if (drillsDone > 0 && drillsDone < drillsTotal) tabs.push('In Progress');
      if (drillsDone >= drillsTotal) tabs.push('Completed');
      if (tabs.length === 0) tabs.push('Recent'); // untouched → still show under Recent
      return { video: v, drillsDone, drillsTotal, progress, tags, lastAttemptAt, tabs };
    });
  }, [videos, challengesByVideoId, recallItems]);

  const filteredLibrary = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cards = libraryCards.filter(card => {
      if (q) {
        const hay = `${card.video.title} ${card.video.channel} ${card.video.stack} ${card.tags.join(' ')}`.toLowerCase();
        return hay.includes(q);
      }
      return card.tabs.includes(activeTab);
    });
    // Sort by most-recent activity first, falling back to video order.
    return cards.sort((a, b) => b.lastAttemptAt - a.lastAttemptAt).slice(0, 4);
  }, [libraryCards, search, activeTab]);

  // ----- Continue Learning: pick the most-recent in-progress video -----
  const continueCard: LibraryCard | null = useMemo(() => {
    const inProgress = libraryCards
      .filter(c => c.drillsDone > 0 && c.drillsDone < c.drillsTotal)
      .sort((a, b) => b.lastAttemptAt - a.lastAttemptAt);
    if (inProgress[0]) return inProgress[0];
    // Fallback to the first video so the card still invites the user in.
    return libraryCards[0] ?? null;
  }, [libraryCards]);
  const continueFirstChallengeId = useMemo(() => {
    if (!continueCard) return null;
    // Prefer the first unsolved challenge; if everything's done, the first.
    const challenges = challengesByVideoId.get(continueCard.video.id) || [];
    const solvedIds = new Set(recallItems.filter(r => r.videoId === continueCard.video.id).map(r => r.challengeId));
    const unsolved = challenges.find(c => !solvedIds.has(c.id));
    return (unsolved ?? challenges[0])?.id ?? null;
  }, [continueCard, challengesByVideoId, recallItems]);

  const allChallenges = useMemo(
    () => Array.from(challengesByVideoId.values()).flat(),
    [challengesByVideoId],
  );

  // ----- Progress panel metrics -----
  const videosProcessed = videos.length;
  const conceptsLearned = useMemo(
    () => new Set(recallItems.map(r => r.concept)).size,
    [recallItems],
  );
  const drillsCompleted = useMemo(
    () => recallItems.reduce((sum, r) => sum + r.history.length, 0),
    [recallItems],
  );
  const conceptsMastered = stats.masteredCount;
  const overallMastery = videosProcessed === 0
    ? 0
    : Math.min(100, Math.round(stats.revisitRate));

  // ----- Topbar stats derived from real data -----
  const xp = useMemo(
    () => recallItems.reduce((sum, r) => sum + r.history.filter(a => a.correct).length * 100, 0),
    [recallItems],
  );
  const level = Math.max(1, Math.floor(stats.totalSolved / 10) + 1);
  const xpInLevel = stats.totalSolved % 10;
  const xpProgress = xpInLevel / 10;

  // ----- Today's goals: derived from today's real attempts -----
  const goalRows = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const since = startOfDay.getTime();
    let drillsToday = 0;
    let correctToday = 0;
    let reviewsToday = 0;
    for (const item of recallItems) {
      for (const a of item.history) {
        if (a.at < since) continue;
        drillsToday += 1;
        if (a.correct) correctToday += 1;
        if (item.history.some(prev => prev.at < since)) reviewsToday += 1;
      }
    }
    return [
      { key: 'drills', label: 'Complete 2 drills', have: drillsToday, need: 2 },
      { key: 'debug', label: 'Solve 1 drill correctly', have: correctToday, need: 1 },
      { key: 'recall', label: 'Review 5 recall questions', have: reviewsToday, need: 5 },
      { key: 'streak', label: 'Practise today to keep your streak', have: drillsToday > 0 ? 1 : 0, need: 1 },
    ].map(g => ({ ...g, done: g.have >= g.need }));
  }, [recallItems]);

  // ----- Recommended videos: those the user hasn't started yet -----
  const recommended = useMemo(
    () =>
      libraryCards
        .filter(c => c.drillsDone === 0)
        .slice(0, 4)
        .map(c => c.video),
    [libraryCards],
  );

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

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim() || importing) {
      if (!youtubeUrl.trim()) showToast('Paste a YouTube link first.');
      return;
    }
    setImporting(true);
    setImportError(null);
    setImportElapsed(0);
    const started = Date.now();
    const tick = window.setInterval(() => setImportElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    try {
      const result = await api.generateFromYouTubeUrl(youtubeUrl.trim());
      await loadAll();
      setYoutubeUrl('');
      showToast(`Added "${result.video.title}" to your library.`);
    } catch (err: any) {
      setImportError(err?.message || 'Could not generate drills from that URL.');
    } finally {
      window.clearInterval(tick);
      setImporting(false);
    }
  };

  const launchContinue = () => {
    if (continueFirstChallengeId) {
      window.location.href = `/v2/challenge/${encodeURIComponent(continueFirstChallengeId)}`;
    } else {
      showToast('No drills loaded yet.');
    }
  };

  const launchCard = (card: LibraryCard) => {
    const challenges = challengesByVideoId.get(card.video.id) || [];
    const solvedIds = new Set(recallItems.filter(r => r.videoId === card.video.id).map(r => r.challengeId));
    const next = challenges.find(c => !solvedIds.has(c.id)) ?? challenges[0];
    if (next) window.location.href = `/v2/challenge/${encodeURIComponent(next.id)}`;
  };

  const dashboardRail = (
    <>
      <section className="v2-panel">
        <div className="v2-panel-head">
          <h2>Your Progress</h2>
          <a className="v2-link-btn" href="/v2/recall">View Details →</a>
        </div>
        <div className="v2-mastery-layout">
          <div
            className="v2-ring"
            style={{ background: `conic-gradient(var(--purple) 0 ${overallMastery}%, var(--soft) ${overallMastery}% 100%)` }}
            aria-label={`${overallMastery}% overall mastery`}
          >
            <div className="v2-ring-center">
              <strong>{overallMastery}%</strong>
              <span>Overall Mastery</span>
            </div>
          </div>
          <div className="v2-metrics">
            {[
              { ico: '📥', label: 'Videos processed', value: videosProcessed },
              { ico: '🧠', label: 'Concepts learned', value: conceptsLearned },
              { ico: '‹/›', label: 'Drills completed', value: drillsCompleted },
              { ico: '🏆', label: 'Concepts mastered', value: conceptsMastered },
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
          {goalRows.filter(g => g.done).length} of {goalRows.length} completed
        </div>
        <div className="v2-goal-progress">
          <span style={{ width: `${(goalRows.filter(g => g.done).length / goalRows.length) * 100}%` }} />
        </div>
        <div className="v2-goal-list">
          {goalRows.map(g => (
            <label key={g.key} className="v2-goal">
              <input type="checkbox" checked={g.done} readOnly tabIndex={-1} />
              <span>{g.label}</span>
              <span className="v2-count">{Math.min(g.have, g.need)}/{g.need}</span>
            </label>
          ))}
        </div>
      </section>

      <V2Panel title="Recall Queue" action={<V2Button variant="link" href="/v2/recall">View All →</V2Button>}>
        {dueItems.length === 0 ? (
          <p className="v2-muted v2-small" style={{ margin: 0 }}>
            Nothing due right now. Come back after a drill to see what resurfaces.
          </p>
        ) : (
          <div className="v2-recall-list">
            {dueItems.slice(0, 4).map(item => (
              <div key={item.challengeId} className="v2-recall-item">
                <div className="v2-recall-icon">{conceptGlyph(item.concept)}</div>
                <div>
                  <strong>{item.concept}</strong>
                  <span>Last seen {relativeTime(item.lastReviewedAt)}</span>
                </div>
                <a className="v2-secondary" href={`/v2/challenge/${encodeURIComponent(item.challengeId)}`}>
                  Review
                </a>
              </div>
            ))}
          </div>
        )}
      </V2Panel>

      <V2MasteryPanel limit={5} />

      <V2CommunityTile />

      <section className="v2-panel">
        <div className="v2-panel-head">
          <h2>Recent Achievements</h2>
          <button className="v2-link-btn" onClick={() => showToast('All achievements.')}>
            See All →
          </button>
        </div>
        <div className="v2-achievement-grid">
          {[
            { ico: '🔥', label: `${stats.currentStreak || 0}-Day Streak`, cls: stats.currentStreak > 0 ? '' : 'lock' },
            { ico: '🐞', label: drillsCompleted > 0 ? 'First Debug Challenge' : 'Complete your first', cls: drillsCompleted > 0 ? 'red' : 'lock' },
            { ico: '✓', label: conceptsMastered > 0 ? `${conceptsMastered} Concept${conceptsMastered === 1 ? '' : 's'} Mastered` : 'Master your first', cls: conceptsMastered > 0 ? 'cyan' : 'lock' },
            { ico: '🔒', label: 'JavaScript Mastered', cls: 'lock' },
          ].map(b => (
            <div key={b.label}>
              <div className={`v2-badge-ico ${b.cls}`}>{b.ico}</div>
              <span>{b.label}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  return (
    <V2Shell
      activeNav="Home"
      theme={theme}
      onToggleTheme={toggleTheme}
      rightRail={dashboardRail}
      showSearch
      searchValue={search}
      onSearchChange={setSearch}
      toast={toast}
      streak={stats.currentStreak || 0}
      xp={xp}
      level={level}
      xpProgress={xpProgress}
    >
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
              onChange={e => { setYoutubeUrl(e.target.value); if (importError) setImportError(null); }}
              disabled={importing}
            />
            <button className="v2-primary" type="submit" disabled={importing}>
              {importing ? `Generating… ${importElapsed}s` : (<>Create Drills&nbsp;→</>)}
            </button>
          </form>
          {importing && (
            <div className="v2-hero-status" role="status" aria-live="polite">
              <div className="v2-import-bar" />
              <span>Building drills — this can take up to 30 seconds with AI generation.</span>
            </div>
          )}
          {importError && !importing && (
            <div className="v2-hero-error" role="alert">
              <strong>Import failed.</strong> {importError}
            </div>
          )}
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

      {/* ---- Daily / Boss / Season ---- */}
      <div className="v2-feature-stack">
        <V2DailyDrillCard />
        <V2BossDrillCard isPro={isPro} challenges={allChallenges} />
        <V2SeasonCard isPro={isPro} />
      </div>

      {/* ---- Continue Learning ---- */}
      {continueCard && (
        <section className="v2-section">
          <div className="v2-section-head">
            <h2>Continue Learning</h2>
            <span className="v2-spacer" />
            <a className="v2-link-btn" href="/v2/recall">View All →</a>
          </div>
          <div className="v2-continue-card">
            <div className="v2-thumb">
              <img
                src={continueCard.video.thumbnailUrl}
                alt={`${continueCard.video.title} thumbnail`}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="v2-duration">{continueCard.video.duration}</span>
            </div>
            <div className="v2-continue-info">
              <h3>{continueCard.video.title}</h3>
              <div className="v2-muted v2-small">{continueCard.video.channel}</div>
              <div className="v2-progress-row">
                <V2Progress value={continueCard.progress} label="Video progress" />
                <span className="v2-small v2-muted">
                  {continueCard.drillsDone} / {continueCard.drillsTotal} drills completed
                </span>
              </div>
              <div className="v2-tags">
                {continueCard.tags.map(t => (
                  <V2Chip key={t}>{t}</V2Chip>
                ))}
              </div>
            </div>
            <div className="v2-continue-actions">
              <button
                className="v2-primary"
                disabled={continueCard.drillsDone >= continueCard.drillsTotal}
                onClick={launchContinue}
              >
                {continueCard.drillsDone >= continueCard.drillsTotal ? '✓ Completed' : 'Continue'}
              </button>
              <a
                className="v2-secondary"
                href="/v2/recall"
                style={{ textAlign: 'center', textDecoration: 'none' }}
              >
                Open recall
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ---- Learning Library ---- */}
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
          <a className="v2-link-btn" href="/v2/library">View All →</a>
        </div>
        {loading ? (
          <div className="v2-library-empty">Loading your library…</div>
        ) : filteredLibrary.length ? (
          <div className="v2-library-grid">
            {filteredLibrary.map(card => (
              <article key={card.video.id} className="v2-video-card" onClick={() => launchCard(card)}>
                <div className="v2-video-thumb">
                  <img
                    src={card.video.thumbnailUrl}
                    alt={`${card.video.title} thumbnail`}
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <button
                    className="v2-more"
                    aria-label="More options"
                    onClick={e => { e.stopPropagation(); showToast('Card menu coming soon.'); }}
                  >
                    ⋯
                  </button>
                </div>
                <h3>{card.video.title}</h3>
                <div className="v2-creator">{card.video.channel}</div>
                <div className="v2-progress-row">
                  <V2Progress value={card.progress} label="Video progress" />
                  <span className="v2-small v2-muted">
                    {card.drillsDone} / {card.drillsTotal} drills
                  </span>
                </div>
                <div className="v2-tags">
                  {card.tags.map(t => (
                    <V2Chip key={t}>{t}</V2Chip>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="v2-library-empty">
            No videos match this view. Try another tab or search term.
          </div>
        )}
      </section>

      {/* ---- Recommended ---- */}
      {recommended.length > 0 && (
        <section className="v2-section">
          <div className="v2-section-head">
            <h2>Recommended for You</h2>
            <span className="v2-spacer" />
            <button className="v2-link-btn" onClick={() => showToast('More recommendations will appear as you learn.')}>
              See More →
            </button>
          </div>
          <div className="v2-recommended-grid">
            {recommended.map(v => {
              const first = challengesByVideoId.get(v.id)?.[0];
              return (
                <a
                  key={v.id}
                  className="v2-recommend-card"
                  href={first ? `/v2/challenge/${encodeURIComponent(first.id)}` : '/v2/'}
                >
                  <img
                    src={v.thumbnailUrl}
                    alt={`${v.title} thumbnail`}
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div>
                    <strong>{v.title}</strong>
                    <span>{v.channel}</span>
                    <span>{v.duration}</span>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      <V2Modal
        open={modalOpen}
        title={modalTitle}
        onClose={() => setModalOpen(false)}
        actions={(
          <>
            <V2Button variant="secondary" onClick={() => setModalOpen(false)}>Not now</V2Button>
            <V2Button onClick={handleModalConfirm}>{modalAction}</V2Button>
          </>
        )}
      >
        <p className="v2-muted">{modalBody}</p>
      </V2Modal>
    </V2Shell>
  );
}
