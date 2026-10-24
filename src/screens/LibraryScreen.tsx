import React, { useState } from 'react';
import { Video, Challenge, RecallItem, RecallStats } from '../lib/types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { YouTubeImportCard } from '../components/YouTubeImportCard';
import { DailyDrillCard } from '../components/DailyDrillCard';
import { BossDrillCard } from '../components/BossDrillCard';
import { SeasonBanner } from '../components/SeasonBanner';
import { Play, CheckCircle2, ArrowRight, ShieldCheck, BookOpen, Flame, Clock, Youtube, Trophy, Users } from 'lucide-react';

export interface LibraryScreenProps {
  videos: Video[];
  challenges: Challenge[];
  recallItems: RecallItem[];
  stats: RecallStats;
  userName?: string;
  /** 'landing' = pitch page for visitors (trial); 'dashboard' = signed-in home. */
  mode?: 'landing' | 'dashboard';
  onGoToRecall?: () => void;
  onGoToLeaderboard?: () => void;
  onGoToCommunity?: () => void;
  onSignUp?: () => void;
  onSelectVideo: (videoId: string) => void;
  onSelectChallenge: (challengeId: string, opts?: { fromBoss?: boolean }) => void;
  onImportYouTube: (url: string, topicHint?: string) => Promise<{ video: Video; challenges: Challenge[]; source: string }>;
  onRefreshData?: () => Promise<void>;
  // Phase 8 v2 — gates Boss-drill + leaderboard surfaces (visible but locked when false).
  isPro?: boolean;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  videos,
  challenges,
  recallItems,
  stats,
  userName,
  mode = 'landing',
  onGoToRecall,
  onGoToLeaderboard,
  onGoToCommunity,
  onSignUp,
  onSelectVideo,
  onSelectChallenge,
  onImportYouTube,
  onRefreshData,
  isPro = false,
}) => {
  const isDashboard = mode === 'dashboard';
  const [selectedStack, setSelectedStack] = useState<'all' | 'react' | 'javascript' | 'custom'>('all');
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<'all' | 'Beginner' | 'Intermediate' | 'Advanced'>('all');
  const [showImport, setShowImport] = useState(false);

  // Visitors on the landing page are in trial mode: no saved progress to show.
  const solvedIds = new Set(isDashboard ? recallItems.map(i => i.challengeId) : []);

  // N4 — the quick-start lands on a *winnable* first drill: an unsolved Beginner
  // one if available, else any unsolved, else the first drill.
  const nextChallenge =
    challenges.find(c => !solvedIds.has(c.id) && c.difficulty === 'Beginner') ||
    challenges.find(c => !solvedIds.has(c.id)) ||
    challenges[0];

  const challengesFor = (videoId: string) =>
    challenges.filter(
      c =>
        c.videoId === videoId &&
        (selectedDifficulty === 'all' || c.difficulty === selectedDifficulty)
    );

  const customVideosCount = videos.filter(v => v.isUserCustom).length;

  const progressOf = (videoId: string) => challenges.filter(c => c.videoId === videoId && solvedIds.has(c.id)).length;

  const filteredVideos = (
    selectedStack === 'all'
      ? videos
      : selectedStack === 'custom'
      ? videos.filter(v => v.isUserCustom)
      : videos.filter(v => v.stack === selectedStack)
  )
    .filter(v => challengesFor(v.id).length > 0)
    // Dashboard: packs in progress float to the top.
    .sort((a, b) => {
      if (!isDashboard) return 0;
      const inProgress = (v: Video) => {
        const total = challenges.filter(c => c.videoId === v.id).length;
        const done = progressOf(v.id);
        return done > 0 && done < total ? 1 : 0;
      };
      return inProgress(b) - inProgress(a);
    });

  const DIFFICULTIES: ('all' | 'Beginner' | 'Intermediate' | 'Advanced')[] = [
    'all',
    'Beginner',
    'Intermediate',
    'Advanced',
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Signed-in dashboard: what to do today, quiet stats, collapsed importer */}
      {isDashboard && (
        <>
          {/* Phase 8 v2 — Daily Drill (hides when no row seeded for today). */}
          <DailyDrillCard onOpenChallenge={onSelectChallenge} />

          {/* Phase 8 v2 — Boss drill (Pro-gated; shows lock + CTA for non-Pro). */}
          <BossDrillCard
            isPro={isPro}
            allChallenges={challenges}
            onLaunchDrill={onSelectChallenge}
          />

          {/* Phase 8 v3 — season progress banner (Pro only; hidden when no
              active season exists). Clicking jumps to the leaderboard. */}
          <SeasonBanner isPro={isPro} onOpenLeaderboard={onGoToLeaderboard} />

          {/* Phase 8 v2 — jump to the Pro leaderboard page. */}
          {onGoToLeaderboard && (
            <button
              type="button"
              onClick={onGoToLeaderboard}
              className="w-full flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-left cursor-pointer hover:bg-[var(--color-surface-subtle)] transition-colors"
            >
              <span className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                <Trophy className="w-4 h-4 text-[var(--color-accent)]" />
                Season leaderboard
                {!isPro && (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-warning-weak)] text-[var(--color-warning-ink)] uppercase">Pro</span>
                )}
              </span>
              <ArrowRight className="w-4 h-4 text-[var(--color-muted)]" />
            </button>
          )}

          {/* Phase 8 v3 — community drafts queue (free, visible to all signed-in users). */}
          {onGoToCommunity && (
            <button
              type="button"
              onClick={onGoToCommunity}
              className="w-full flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-left cursor-pointer hover:bg-[var(--color-surface-subtle)] transition-colors"
            >
              <span className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                <Users className="w-4 h-4 text-[var(--color-accent)]" />
                Community drafts
              </span>
              <ArrowRight className="w-4 h-4 text-[var(--color-muted)]" />
            </button>
          )}

          <section className="space-y-4">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text)]">
              {userName ? `Welcome back, ${userName}` : 'Welcome back'}
            </h1>

            <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent-border)] bg-[var(--color-accent-weak)] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--color-text)]">
                    {stats.dueCount > 0
                      ? `${stats.dueCount} concept${stats.dueCount === 1 ? '' : 's'} due for review`
                      : stats.totalSolved === 0
                      ? 'Ready for your first bug hunt?'
                      : 'Nothing due — keep the streak going'}
                  </div>
                  <div className="text-xs text-[var(--color-muted)]">
                    {stats.dueCount > 0
                      ? 'A quick review now locks them in before you forget.'
                      : nextChallenge
                      ? `Up next: ${nextChallenge.concept}`
                      : 'Pick a video below to start a bug hunt.'}
                  </div>
                </div>
              </div>

              {stats.dueCount > 0 && onGoToRecall ? (
                <Button
                  size="md"
                  variant="primary"
                  icon={<ArrowRight className="w-4 h-4 order-last" />}
                  onClick={onGoToRecall}
                >
                  Start review
                </Button>
              ) : (
                nextChallenge && (
                  <Button
                    size="md"
                    variant="primary"
                    icon={<Play className="w-4 h-4 fill-current" />}
                    onClick={() => onSelectChallenge(nextChallenge.id)}
                  >
                    {stats.totalSolved === 0 ? 'Start' : 'Continue'}
                  </Button>
                )
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />, value: stats.currentStreak, label: 'day streak' },
                { icon: <CheckCircle2 className="w-4 h-4 text-[var(--color-good)]" />, value: stats.totalSolved, label: 'concepts solved' },
                { icon: <ShieldCheck className="w-4 h-4 text-[var(--color-accent)]" />, value: stats.masteredCount, label: 'mastered' },
              ].map(s => (
                <div
                  key={s.label}
                  className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 flex items-center gap-3"
                >
                  {s.icon}
                  <div className="leading-tight">
                    <div className="text-sm font-bold text-[var(--color-text)] tabular-nums">{s.value}</div>
                    <div className="text-[11px] text-[var(--color-muted)] font-mono">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <Button
              size="sm"
              variant="secondary"
              icon={<Youtube className="w-4 h-4 text-red-500" />}
              onClick={() => setShowImport(v => !v)}
            >
              {showImport ? 'Hide YouTube import' : 'Import from YouTube'}
            </Button>
            {showImport && (
              <YouTubeImportCard
                onImport={onImportYouTube}
                onLaunchChallenge={onSelectChallenge}
                onSuccess={async () => {
                  if (onRefreshData) await onRefreshData();
                }}
              />
            )}
          </section>
        </>
      )}

      {/* Hero Header (visitors / trial links only) */}
      {!isDashboard && (
      <section className="relative rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="max-w-2xl space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
            Train your code-review judgment on the dev videos you watch.
          </h1>

          <p className="text-sm sm:text-base text-[var(--color-muted)] leading-relaxed">
            AI now writes the first draft of code. The scarce engineering muscle is shifting from syntax recall to <strong className="text-[var(--color-text)] font-semibold">reviewing, catching subtle bugs, and verifying logic</strong>. Pick a curated tutorial to drill on its exact concepts.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {onSignUp && (
              <Button
                size="md"
                variant="primary"
                icon={<ArrowRight className="w-4 h-4 order-last" />}
                onClick={onSignUp}
              >
                Create free account
              </Button>
            )}
            {nextChallenge && (
              <Button
                size="md"
                variant={onSignUp ? 'secondary' : 'primary'}
                icon={<Play className="w-4 h-4 fill-current" />}
                onClick={() => onSelectChallenge(nextChallenge.id)}
              >
                Try a free bug hunt
              </Button>
            )}

            <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] font-mono pl-2">
              <ShieldCheck className="w-4 h-4 text-[var(--color-good)]" />
              <span>Deterministic MCQ grading · No flaky LLM</span>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Filter Tabs & Counter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">
            {selectedStack === 'custom' ? 'Your Generated Tutorials' : isDashboard ? 'Your Library' : 'Curated Video Packs'}
          </h2>
          <p className="text-xs text-[var(--color-muted)]">
            {selectedStack === 'custom'
              ? 'Drills synthesized from your pasted YouTube developer tutorials'
              : 'Hand-verified drills extracted from top community tutorials'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Stack filter */}
          <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-subtle)] rounded-[var(--radius)] border border-[var(--color-border)]">
            <button
              onClick={() => setSelectedStack('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                selectedStack === 'all'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              All Stacks ({videos.length})
            </button>
            <button
              onClick={() => setSelectedStack('react')}
              className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                selectedStack === 'react'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              React ({videos.filter(v => v.stack === 'react' && !v.isUserCustom).length})
            </button>
            <button
              onClick={() => setSelectedStack('javascript')}
              className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                selectedStack === 'javascript'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              JavaScript ({videos.filter(v => v.stack === 'javascript' && !v.isUserCustom).length})
            </button>
            {customVideosCount > 0 && (
              <button
                onClick={() => setSelectedStack('custom')}
                className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer flex items-center gap-1.5 ${
                  selectedStack === 'custom'
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <Youtube className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                <span>Pasted ({customVideosCount})</span>
              </button>
            )}
          </div>

          {/* Difficulty filter (N4) — find a winnable level */}
          <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-subtle)] rounded-[var(--radius)] border border-[var(--color-border)]">
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                onClick={() => setSelectedDifficulty(d)}
                aria-pressed={selectedDifficulty === d}
                className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                  selectedDifficulty === d
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {d === 'all' ? 'All Levels' : d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Video Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVideos.map(video => {
          const videoChallenges = challengesFor(video.id);
          const solvedInVideo = videoChallenges.filter(c => solvedIds.has(c.id)).length;
          const progressPercent =
            videoChallenges.length > 0
              ? Math.round((solvedInVideo / videoChallenges.length) * 100)
              : 0;

          return (
            <Card
              key={video.id}
              className="flex flex-col justify-between hover:border-[var(--color-accent-border)] transition-all group"
            >
              <div className="space-y-4">
                {/* Real YouTube thumbnail (full-bleed, offsets the card padding) */}
                <div className="-mt-6 -mx-6 mb-1 aspect-video overflow-hidden rounded-t-[var(--radius)] bg-[var(--color-surface-subtle)] border-b border-[var(--color-border)] flex items-center justify-center">
                  <img
                    src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
                    alt={`Thumbnail for ${video.title} by ${video.channel}`}
                    loading="lazy"
                    onError={e => {
                      // Graceful fallback: hide a failed image so the subtle
                      // surface + channel label below still read cleanly.
                      e.currentTarget.style.display = 'none';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Video Header & Meta */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[var(--color-muted)] font-mono">
                    <div className="flex items-center gap-1.5 truncate">
                      <span>{video.channel}</span>
                      {video.isUserCustom && (
                        <span className="text-[10px] font-mono font-semibold text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.2 rounded-[var(--radius-sm)] border border-red-500/20">
                          Pasted
                        </span>
                      )}
                    </div>
                    <span className="tabular-nums shrink-0">{video.duration}</span>
                  </div>

                  <h3 className="text-base font-bold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                    {video.title}
                  </h3>
                </div>

                <p className="text-xs text-[var(--color-muted)] leading-relaxed line-clamp-2">
                  {video.description}
                </p>

                {/* Progress bar (signed-in only — visitors don't have saved progress) */}
                {isDashboard && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[var(--color-muted)]">Progress</span>
                    <span className="tabular-nums font-semibold text-[var(--color-text)]">
                      {solvedInVideo} / {videoChallenges.length} concepts solved
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[var(--color-surface-subtle)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-accent)] transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
                )}

                {/* Chapter Concept Tags (Zero-Pill List) */}
                <div className="pt-2 border-t border-[var(--color-border-subtle)] space-y-2">
                  <div className="text-[11px] font-mono text-[var(--color-muted)] flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    <span>Bug Hunt Drills in Pack:</span>
                  </div>
                  <div className="space-y-1.5">
                    {videoChallenges.map(c => {
                      const isSolved = solvedIds.has(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => onSelectChallenge(c.id)}
                          className="w-full text-left flex items-center justify-between p-2 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-subtle)] text-xs transition-colors cursor-pointer group/item"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            {isSolved ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-good)] shrink-0" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] shrink-0" />
                            )}
                            <span className="text-[var(--color-text)] truncate font-medium">
                              {c.concept}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[9px] font-mono font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-[var(--radius-sm)] ${
                                c.difficulty === 'Beginner'
                                  ? 'bg-[var(--color-good-weak)] text-[var(--color-good)]'
                                  : c.difficulty === 'Intermediate'
                                  ? 'bg-[var(--color-accent-weak)] text-[var(--color-accent)]'
                                  : 'bg-[var(--color-warning-weak)] text-[var(--color-warning-ink)]'
                              }`}
                            >
                              {c.difficulty.slice(0, 3)}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--color-muted)] tabular-nums">
                              {c.timestampFormatted}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-5 border-t border-[var(--color-border)] mt-4">
                <Button
                  variant={solvedInVideo === videoChallenges.length ? 'secondary' : 'primary'}
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => onSelectVideo(video.id)}
                  icon={<ArrowRight className="w-4 h-4 order-last" />}
                >
                  <span>
                    {solvedInVideo === 0
                      ? 'Start Video Bug Hunt'
                      : solvedInVideo === videoChallenges.length
                      ? 'Re-practice Video Set'
                      : 'Continue Bug Hunt'}
                  </span>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
