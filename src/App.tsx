import React, { useState, useEffect } from 'react';
import { api } from './lib/api';
import { Video, Challenge, RecallItem, RecallStats } from './lib/types';
import { Navbar } from './components/Navbar';
import { LibraryScreen } from './screens/LibraryScreen';
import { ChallengeScreen } from './screens/ChallengeScreen';
import { RevealScreen } from './screens/RevealScreen';
import { RecallDashboardScreen } from './screens/RecallDashboardScreen';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [route, setRoute] = useState<'library' | 'challenge' | 'reveal' | 'recall'>('library');

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
  const [activeChallengeId, setActiveChallengeId] = useState<string>('react-state-batching');
  const [lastAttemptResult, setLastAttemptResult] = useState<{
    chosen: number;
    isCorrect: boolean;
    explanation: string;
    recallItem: RecallItem;
  } | null>(null);

  // Apply data-theme attribute on root element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
    loadData();
  }, []);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleNavigate = (
    newRoute: 'library' | 'challenge' | 'recall',
    param?: string
  ) => {
    if (param) {
      setActiveChallengeId(param);
    }
    setRoute(newRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectVideo = (videoId: string) => {
    const videoChallenges = challenges.filter(c => c.videoId === videoId);
    if (videoChallenges.length > 0) {
      setActiveChallengeId(videoChallenges[0].id);
      setRoute('challenge');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectChallenge = (challengeId: string) => {
    setActiveChallengeId(challengeId);
    setRoute('challenge');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitAttempt = async (chosen: number) => {
    const result = await api.submitAttempt(activeChallengeId, chosen);
    setLastAttemptResult({
      chosen,
      isCorrect: result.correct,
      explanation: result.explanation,
      recallItem: result.recallItem,
    });

    // Refresh dashboard stats
    const dashboard = await api.getRecallDashboard();
    setDueItems(dashboard.dueItems || []);
    setRecallItems(dashboard.allItems || []);
    setStats(dashboard.stats);

    setRoute('reveal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextChallenge = () => {
    const current = challenges.find(c => c.id === activeChallengeId);
    if (!current) return;

    const inSameVideo = challenges.filter(c => c.videoId === current.videoId);
    const currentIndex = inSameVideo.findIndex(c => c.id === activeChallengeId);

    if (currentIndex < inSameVideo.length - 1) {
      setActiveChallengeId(inSameVideo[currentIndex + 1].id);
      setRoute('challenge');
    } else {
      setRoute('library');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)] transition-colors">
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
            onSelectVideo={handleSelectVideo}
            onSelectChallenge={handleSelectChallenge}
          />
        )}

        {route === 'challenge' && currentChallenge && currentVideo && (
          <ChallengeScreen
            challenge={currentChallenge}
            video={currentVideo}
            allChallengesInVideo={currentVideoChallenges || []}
            onBackToLibrary={() => handleNavigate('library')}
            onSubmitAttempt={handleSubmitAttempt}
            onSelectAnotherChallenge={handleSelectChallenge}
          />
        )}

        {route === 'reveal' && currentChallenge && currentVideo && lastAttemptResult && (
          <RevealScreen
            challenge={currentChallenge}
            video={currentVideo}
            chosenOption={lastAttemptResult.chosen}
            isCorrect={lastAttemptResult.isCorrect}
            explanation={lastAttemptResult.explanation}
            recallItem={lastAttemptResult.recallItem}
            allChallengesInVideo={currentVideoChallenges || []}
            onNextChallenge={handleNextChallenge}
            onRetryChallenge={() => setRoute('challenge')}
            onGoToRecall={() => handleNavigate('recall')}
            onBackToLibrary={() => handleNavigate('library')}
          />
        )}

        {route === 'recall' && (
          <RecallDashboardScreen
            stats={stats}
            dueItems={dueItems}
            allItems={recallItems}
            videos={videos}
            offsetDays={stats.simulatedOffsetDays}
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
