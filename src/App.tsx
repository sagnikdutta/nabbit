import React, { useState, useEffect } from 'react';
import { api } from './lib/api';
import { Video, Challenge, RecallItem, RecallStats } from './lib/types';
import {
  getRemindersEnabled,
  setRemindersEnabled,
  getNotificationPermission,
  requestNotificationPermission,
  notifyDueReviews,
  type PermissionState,
} from './lib/reminders';
import { Navbar } from './components/Navbar';
import { NameOnboarding } from './components/NameOnboarding';
import { LibraryScreen } from './screens/LibraryScreen';
import { ChallengeScreen } from './screens/ChallengeScreen';
import { RecallDashboardScreen } from './screens/RecallDashboardScreen';

type Route = 'library' | 'challenge' | 'recall';

// --- Hash router (B5): each screen has a shareable, refresh-safe URL ---
// #/              → library
// #/challenge/:id → a specific drill
// #/recall        → spaced-recall dashboard
function parseHash(): { route: Route; challengeId: string | null } {
  const h = window.location.hash.replace(/^#/, '');
  if (h.startsWith('/challenge/')) {
    const id = decodeURIComponent(h.slice('/challenge/'.length));
    return { route: 'challenge', challengeId: id || null };
  }
  if (h === '/recall') return { route: 'recall', challengeId: null };
  return { route: 'library', challengeId: null };
}

function hashFor(route: Route, challengeId?: string): string {
  if (route === 'challenge' && challengeId) return `#/challenge/${encodeURIComponent(challengeId)}`;
  if (route === 'recall') return '#/recall';
  return '#/';
}

// Shared bug-dare links are `/?dare=<challengeId>` (a server-readable query param
// so crawlers get per-challenge OG tags — see server.ts). Resolve it, or the hash.
function resolveInitialLocation(): { route: Route; challengeId: string | null } {
  const dare = new URLSearchParams(window.location.search).get('dare');
  if (dare) return { route: 'challenge', challengeId: dare };
  return parseHash();
}

// N3 — the "what is this?" intro strip is dismissed per browser.
const INTRO_DISMISSED_KEY = 'nabbit_intro_dismissed_v1';
function readIntroDismissed(): boolean {
  try {
    return localStorage.getItem(INTRO_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}
function persistIntroDismissed() {
  try {
    localStorage.setItem(INTRO_DISMISSED_KEY, '1');
  } catch {
    // storage unavailable — the strip simply reappears next load
  }
}

export default function App() {
  const initialHash = resolveInitialLocation();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [route, setRoute] = useState<Route>(initialHash.route);

  // Loaded Data
  const [videos, setVideos] = useState<Video[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [recallItems, setRecallItems] = useState<RecallItem[]>([]);
  const [dueItems, setDueItems] = useState<(RecallItem & { challenge: Challenge })[]>([]);
  const [stats, setStats] = useState<RecallStats>({
    revisitRate: 0,
    currentStreak: 0,
    totalSolved: 0,
    dueCount: 0,
    atRiskCount: 0,
    masteredCount: 0,
    simulatedOffsetDays: 0,
  });

  // Active Challenge / Drill State
  const [activeChallengeId, setActiveChallengeId] = useState<string>(
    initialHash.challengeId || 'react-state-batching'
  );

  // Local-only profile (B3): a name stored per browser, no account/password.
  const [profileName, setProfileName] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean>(() => api.getProfile().onboarded);

  // N3 — first-timer "what is this?" context strip (cold dare arrivals especially).
  const [introDismissed, setIntroDismissed] = useState<boolean>(readIntroDismissed);

  // N6 — review reminders (browser notifications when due; opt-in, local only).
  const [remindersOn, setRemindersOn] = useState<boolean>(getRemindersEnabled);
  const [notifyPermission, setNotifyPermission] = useState<PermissionState>(getNotificationPermission);

  // Apply data-theme attribute on root element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Keep screen state in sync with the URL hash (back/forward, refresh, shared links).
  useEffect(() => {
    const sync = () => {
      const parsed = parseHash();
      setRoute(parsed.route);
      if (parsed.challengeId) setActiveChallengeId(parsed.challengeId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', sync);

    // A dare link arrives as `/?dare=<id>`; convert it to the clean hash URL
    // (state was already initialized from it) so the query doesn't linger.
    const dare = new URLSearchParams(window.location.search).get('dare');
    if (dare) {
      window.history.replaceState(null, '', `${window.location.pathname}#/challenge/${encodeURIComponent(dare)}`);
    } else if (!window.location.hash) {
      // Normalize a bare URL to #/ so the first entry is shareable.
      window.history.replaceState(null, '', '#/');
    }
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  // Navigate by writing the hash; the listener above updates screen state.
  const go = (nextRoute: Route, challengeId?: string) => {
    const id = challengeId ?? (nextRoute === 'challenge' ? activeChallengeId : undefined);
    const target = hashFor(nextRoute, id);
    if (window.location.hash === target) {
      // Re-selecting the current hash emits no hashchange — update in place.
      setRoute(nextRoute);
      if (id) setActiveChallengeId(id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.location.hash = target;
    }
  };

  // Initial Data Load
  const loadData = async () => {
    const loadedVideos = await api.getVideos();
    const dashboard = await api.getRecallDashboard();

    // Flatten all challenges across videos
    const allChalls: Challenge[] = [];
    for (const v of loadedVideos) {
      const vChalls = await api.getVideoChallenges(v.id);
      allChalls.push(...vChalls);
    }

    setVideos(loadedVideos);
    setChallenges(allChalls);
    setDueItems(dashboard.dueItems || []);
    setRecallItems(dashboard.allItems || []);
    setStats(dashboard.stats);

    if (allChalls.length > 0 && !activeChallengeId) {
      setActiveChallengeId(allChalls[0].id);
    }
  };

  useEffect(() => {
    (async () => {
      await loadData();
      // N6 — nudge once on open if reminders are on and concepts are due now.
      if (getRemindersEnabled() && getNotificationPermission() === 'granted') {
        const dash = await api.getRecallDashboard();
        if (dash.stats.dueCount > 0) {
          notifyDueReviews(dash.stats.dueCount, () => {
            window.location.hash = '#/recall';
          });
        }
      }
    })();

    // Load the local profile. The name prompt is deferred to AFTER the first
    // attempt (value before any gate) — see handleSubmitAttempt, not here.
    setProfileName(api.getProfile().name);
  }, []);

  const handleToggleReminders = async () => {
    if (remindersOn) {
      setRemindersEnabled(false);
      setRemindersOn(false);
      return;
    }
    const perm = await requestNotificationPermission();
    setNotifyPermission(perm);
    if (perm === 'granted') {
      setRemindersEnabled(true);
      setRemindersOn(true);
      // Immediate confirmation nudge if something is already due.
      if (stats.dueCount > 0) {
        notifyDueReviews(stats.dueCount, () => handleNavigate('recall'));
      }
    } else {
      setRemindersEnabled(false);
      setRemindersOn(false);
    }
  };

  const handleSaveName = (name: string) => {
    api.saveProfileName(name);
    setProfileName(api.getProfile().name);
    setOnboarded(true);
    setShowOnboarding(false);
  };

  const handleSkipOnboarding = () => {
    api.dismissOnboarding();
    setOnboarded(true);
    setShowOnboarding(false);
  };

  const handleDismissIntro = () => {
    setIntroDismissed(true);
    persistIntroDismissed();
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleNavigate = (newRoute: Route, param?: string) => {
    go(newRoute, param);
  };

  const handleSelectVideo = (videoId: string) => {
    const videoChallenges = challenges.filter(c => c.videoId === videoId);
    if (videoChallenges.length > 0) {
      go('challenge', videoChallenges[0].id);
    }
  };

  const handleSelectChallenge = (challengeId: string) => {
    go('challenge', challengeId);
  };

  const handleSubmitAttempt = async (chosen: number) => {
    const result = await api.submitAttempt(activeChallengeId, chosen);

    // Refresh dashboard stats; the challenge screen reveals the result in place.
    const dashboard = await api.getRecallDashboard();
    setDueItems(dashboard.dueItems || []);
    setRecallItems(dashboard.allItems || []);
    setStats(dashboard.stats);

    // Activation: offer the skippable name prompt AFTER the first attempt, and
    // only once. A short delay lets the reveal (the "aha") land first.
    if (!api.getProfile().onboarded) {
      window.setTimeout(() => setShowOnboarding(true), 1400);
    }

    return {
      correct: result.correct,
      explanation: result.explanation,
      recallItem: result.recallItem,
    };
  };

  const handleNextChallenge = () => {
    const current = challenges.find(c => c.id === activeChallengeId);
    if (!current) return;

    const inSameVideo = challenges.filter(c => c.videoId === current.videoId);
    const currentIndex = inSameVideo.findIndex(c => c.id === activeChallengeId);

    if (currentIndex < inSameVideo.length - 1) {
      go('challenge', inSameVideo[currentIndex + 1].id);
    } else {
      go('library');
    }
  };

  const handleTimeTravel = async (days: number) => {
    api.setSimulatedOffset(days);
    const dashboard = await api.getRecallDashboard();
    setDueItems(dashboard.dueItems || []);
    setRecallItems(dashboard.allItems || []);
    setStats(dashboard.stats);
  };

  const handleResetData = async () => {
    await api.resetData();
    await loadData();
  };

  // Find active challenge & video
  const currentChallenge =
    challenges.find(c => c.id === activeChallengeId) || challenges[0];
  const currentVideo =
    currentChallenge && videos.find(v => v.id === currentChallenge.videoId);
  const currentVideoChallenges =
    currentChallenge && challenges.filter(c => c.videoId === currentChallenge.videoId);

  // Dynamic tab title (client-side) — helps shared links and bookmarks read well.
  useEffect(() => {
    const base = 'Nabbit — Code Review Drills & Spaced Recall';
    if (route === 'challenge' && currentChallenge) {
      document.title = `Catch the bug: ${currentChallenge.concept} · Nabbit`;
    } else if (route === 'recall') {
      document.title = `Spaced Recall · Nabbit`;
    } else {
      document.title = base;
    }
  }, [route, currentChallenge]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)] transition-colors">
      {/* First-visit, local-only name onboarding (B3) */}
      <NameOnboarding
        open={showOnboarding}
        onSave={handleSaveName}
        onSkip={handleSkipOnboarding}
      />

      {/* 3-Zone Top Navigation Bar */}
      <Navbar
        currentRoute={route}
        onNavigate={handleNavigate}
        activeStreak={stats.currentStreak}
        dueCount={stats.dueCount}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 pb-12">
        {route === 'library' && (
          <LibraryScreen
            videos={videos}
            challenges={challenges}
            recallItems={recallItems}
            stats={stats}
            userName={profileName}
            onSelectVideo={handleSelectVideo}
            onSelectChallenge={handleSelectChallenge}
          />
        )}

        {route === 'challenge' && currentChallenge && currentVideo && (
          <ChallengeScreen
            challenge={currentChallenge}
            video={currentVideo}
            allChallengesInVideo={currentVideoChallenges || []}
            userName={profileName}
            showIntro={!onboarded && !introDismissed}
            onDismissIntro={handleDismissIntro}
            onBackToLibrary={() => handleNavigate('library')}
            onSubmitAttempt={handleSubmitAttempt}
            onSelectAnotherChallenge={handleSelectChallenge}
            onNextChallenge={handleNextChallenge}
            onGoToRecall={() => handleNavigate('recall')}
          />
        )}

        {route === 'challenge' && !currentChallenge && (
          <div className="py-24 text-center text-sm text-[var(--color-muted)] font-mono">
            Loading drill…
          </div>
        )}

        {route === 'recall' && (
          <RecallDashboardScreen
            stats={stats}
            dueItems={dueItems}
            allItems={recallItems}
            videos={videos}
            offsetDays={stats.simulatedOffsetDays}
            remindersOn={remindersOn}
            notifyPermission={notifyPermission}
            onToggleReminders={handleToggleReminders}
            onSetOffset={handleTimeTravel}
            onResetData={handleResetData}
            onLaunchDrill={handleSelectChallenge}
            onGoToLibrary={() => handleNavigate('library')}
          />
        )}
      </main>

      {/* Quiet Minimalist Footer */}
      <footer className="border-t border-[var(--color-border)] py-6 px-4 text-center text-xs text-[var(--color-muted)]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
          <div>
            <span>Nabbit</span>
            <span className="mx-2">·</span>
            <span>Catch the nit on the dev videos you watch</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Deterministic MCQ Grading</span>
            <span>·</span>
            <span>Direction B Tokens</span>
            <span>·</span>
            <span>HelloPM Cohort 52</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
