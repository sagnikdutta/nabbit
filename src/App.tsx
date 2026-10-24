import React, { useState, useEffect, useRef } from 'react';
import { api } from './lib/api';
import { Video, Challenge, RecallItem, RecallStats, AttemptInput, Confidence } from './lib/types';
import { grade } from './lib/grading';
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

import { AuthScreen } from './screens/AuthScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { trackTrialView, trackTrialCompleted, claimLeads } from './lib/leads';
import { UserAccount } from './lib/types';
import { supabase } from './lib/supabase';

type Route = 'library' | 'challenge' | 'recall' | 'auth' | 'leaderboard';

// --- Hash router (B5): each screen has a shareable, refresh-safe URL ---
// #/              → library
// #/challenge/:id → a specific drill
// #/recall        → spaced-recall dashboard
// #/auth          → sign-in / sign-up screen
function parseHash(): { route: Route; challengeId: string | null } {
  const h = window.location.hash.replace(/^#/, '');
  if (h.startsWith('/challenge/')) {
    const id = decodeURIComponent(h.slice('/challenge/'.length));
    return { route: 'challenge', challengeId: id || null };
  }
  if (h === '/recall') return { route: 'recall', challengeId: null };
  if (h === '/auth' || h === '/signin' || h === '/signup') return { route: 'auth', challengeId: null };
  if (h === '/leaderboard') return { route: 'leaderboard', challengeId: null };
  return { route: 'library', challengeId: null };
}

function hashFor(route: Route, challengeId?: string): string {
  if (route === 'challenge' && challengeId) return `#/challenge/${encodeURIComponent(challengeId)}`;
  if (route === 'recall') return '#/recall';
  if (route === 'auth') return '#/auth';
  if (route === 'leaderboard') return '#/leaderboard';
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

  // User Authentication & Background Verification State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => api.getCurrentUser());
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  // Set when a signed-out visitor finishes a trial challenge: sends them to sign up.
  const [trialResult, setTrialResult] = useState<{ correct: boolean; concept: string } | null>(null);

  // Phase 8 v1 — session combo. Chain of consecutive full-corrects in the
  // current challenge-browsing session. Resets when the user leaves the
  // challenge screen or signs out.
  const [combo, setCombo] = useState(0);

  // Phase 8 v2 — public.users.is_pro flag. Fetched when the user changes.
  // Gates Boss drill + Seasons leaderboard surfaces (visible but locked otherwise).
  const [isPro, setIsPro] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!currentUser || currentUser.provider !== 'supabase' || !supabase) {
      setIsPro(false);
      return;
    }
    supabase.from('users').select('is_pro').eq('id', currentUser.id).maybeSingle()
      .then(
        ({ data }) => { if (alive) setIsPro(Boolean(data?.is_pro)); },
        () => { if (alive) setIsPro(false); },
      );
    return () => { alive = false; };
  }, [currentUser?.id, currentUser?.provider]);

  // Subscribe to auth changes
  useEffect(() => {
    return api.onAuthChange(user => {
      setCurrentUser(user);
    });
  }, []);

  // Progress belongs to the signed-in account: reload it (and the display name) whenever
  // the user changes, so one person's stats never linger for the next.
  const lastUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const id = currentUser?.id ?? null;
    if (lastUserId.current !== undefined && lastUserId.current !== id) {
      // Phase 8 v2 — restored Supabase sessions skip handleAuthSuccess entirely,
      // so attempt the merge here too. Idempotent per-user per-browser.
      (async () => {
        if (id) {
          try { await api.mergeLocalProgressIntoSupabase(); } catch { /* non-fatal */ }
        }
        loadData();
        setProfileName(api.getProfile().name);
      })();
    }
    lastUserId.current = id;
  }, [currentUser?.id]);

  // Apply data-theme attribute on root element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Keep screen state in sync with the URL hash (back/forward, refresh, shared links).
  useEffect(() => {
    const sync = () => {
      setTrialResult(null);
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
    setTrialResult(null);
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

  const handleOpenAuth = (mode: 'signin' | 'signup' = 'signup') => {
    setAuthMode(mode);
    go('auth');
  };

  const handleSignOut = () => {
    api.signOut();
  };

  const handleAuthSuccess = async (user: UserAccount) => {
    setCurrentUser(user);
    setTrialResult(null);
    claimLeads();
    // Phase 8 v2 — first sign-in on this browser pushes any local progress to
    // Supabase so the user keeps their streak + solved concepts cross-device.
    // Idempotent server-side; harmless if nothing's local or already merged.
    try {
      const res = await api.mergeLocalProgressIntoSupabase();
      if (res.merged) {
        console.log('[Nabbit] merged local progress →', res);
        await loadData(); // refresh dashboard with the now-authoritative server state
      }
    } catch (err) {
      console.warn('[Nabbit] merge_local_progress failed (will stay local):', err);
    }
    // Land on the library after sign-in, unless they came in via a deep link (e.g. a shared dare).
    if (route === 'auth') go('library');
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

  const handleSubmitAttempt = async (
    input: AttemptInput,
    meta: { confidence: Confidence; timeMs: number },
  ) => {
    // Trial mode (signed out): grade locally, save nothing, send them to sign up.
    if (!currentUser) {
      const trial = challenges.find(c => c.id === activeChallengeId);
      if (trial) {
        const g = grade(trial, input);
        trackTrialCompleted(trial.id, g.correct);
        setTrialResult({ correct: g.correct, concept: trial.concept });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      // The challenge screen is replaced by the sign-up screen, so this never needs to resolve.
      return new Promise<never>(() => {});
    }

    const result = await api.submitAttempt(activeChallengeId, input, { ...meta, combo });

    // Mirror the authoritative combo state after the server-side-ready grading.
    setCombo(result.comboAfter);

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
      outcome: result.outcome,
      explanation: result.explanation,
      recallItem: result.recallItem,
      score: result.score,
      scoreBreakdown: result.scoreBreakdown,
      comboAfter: result.comboAfter,
      // Phase 8 v2 — populated by SupabaseStore; undefined on the local path.
      newRating: result.newRating,
      eloDelta: result.eloDelta,
      globalStreak: result.globalStreak,
      freezesRemaining: result.freezesRemaining,
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

  const handleImportYouTube = async (url: string, topicHint?: string) => {
    const result = await api.generateFromYouTubeUrl(url, topicHint);
    await loadData();
    return result;
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

  // Routing by auth state:
  //  - signed out: landing page + public trial challenges (shared links); finishing a
  //    trial challenge sends them to sign-up. Recall is members-only.
  //  - signed in: dashboard / drills / recall; the auth screen redirects to the library.
  const activeRoute: Route = !currentUser
    ? trialResult
      ? 'auth'
      : route === 'auth' || route === 'challenge'
      ? route
      : 'library'
    : route === 'auth'
    ? 'library'
    : route;

  // Phase 8 v1 — reset the session combo when the user leaves the challenge screen
  // (switching to the Library/Recall/Auth breaks the chain). Also resets on sign-out.
  useEffect(() => {
    if (activeRoute !== 'challenge') setCombo(0);
  }, [activeRoute]);
  useEffect(() => {
    if (!currentUser) setCombo(0);
  }, [currentUser?.id]);

  // Trial-link lead capture: remember which shared challenge a signed-out visitor opened.
  useEffect(() => {
    if (!currentUser && route === 'challenge' && activeChallengeId) {
      trackTrialView(activeChallengeId);
    }
  }, [currentUser, route, activeChallengeId]);

  // A signed-in user opening #/auth gets the clean library URL.
  useEffect(() => {
    if (currentUser && route === 'auth') {
      window.history.replaceState(null, '', '#/');
      setRoute('library');
    }
  }, [currentUser, route]);

  // Dynamic tab title (client-side) — helps shared links and bookmarks read well.
  useEffect(() => {
    const route = activeRoute;
    const base = 'Nabbit — Code Review Drills & Spaced Recall';
    if (route === 'auth') {
      document.title = 'Sign In & Sign Up · Nabbit';
    } else if (route === 'challenge' && currentChallenge) {
      document.title = `Catch the bug: ${currentChallenge.concept} · Nabbit`;
    } else if (route === 'recall') {
      document.title = `Spaced Recall · Nabbit`;
    } else {
      document.title = base;
    }
  }, [activeRoute, currentChallenge]);

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
        currentRoute={activeRoute}
        onNavigate={handleNavigate}
        activeStreak={stats.currentStreak}
        dueCount={stats.dueCount}
        theme={theme}
        onToggleTheme={toggleTheme}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuth}
        onSignOut={handleSignOut}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 pb-12">
        {activeRoute === 'auth' && (
          <AuthScreen
            key={authMode}
            initialMode={authMode}
            trialResult={trialResult}
            onSuccess={handleAuthSuccess}
            onCancel={() => handleNavigate('library')}
            signUpFn={api.signUp}
            signInFn={api.signIn}
          />
        )}
        {activeRoute === 'library' && (
          <LibraryScreen
            videos={videos}
            challenges={challenges}
            recallItems={recallItems}
            stats={stats}
            userName={profileName}
            mode={currentUser ? 'dashboard' : 'landing'}
            onGoToRecall={() => handleNavigate('recall')}
            onGoToLeaderboard={() => handleNavigate('leaderboard')}
            onSignUp={() => handleOpenAuth('signup')}
            onSelectVideo={handleSelectVideo}
            onSelectChallenge={handleSelectChallenge}
            onImportYouTube={handleImportYouTube}
            onRefreshData={loadData}
            isPro={isPro}
          />
        )}

        {activeRoute === 'challenge' && currentChallenge && currentVideo && (
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

        {activeRoute === 'challenge' && !currentChallenge && (
          <div className="py-24 text-center text-sm text-[var(--color-muted)] font-mono">
            Loading drill…
          </div>
        )}

        {activeRoute === 'leaderboard' && (
          <LeaderboardScreen
            isPro={isPro}
            onBack={() => handleNavigate('library')}
          />
        )}

        {activeRoute === 'recall' && (
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
            masteryEnabled={Boolean(currentUser && currentUser.provider === 'supabase')}
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
        </div>
      </footer>
    </div>
  );
}
