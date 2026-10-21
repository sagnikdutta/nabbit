import React, { useState } from 'react';
import { Video, Challenge, RecallItem, RecallStats } from '../lib/types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Play, CheckCircle2, ArrowRight, ShieldCheck, Sparkles, BookOpen, Flame, Clock } from 'lucide-react';

export interface LibraryScreenProps {
  videos: Video[];
  challenges: Challenge[];
  recallItems: RecallItem[];
  stats: RecallStats;
  userName?: string;
  onSelectVideo: (videoId: string) => void;
  onSelectChallenge: (challengeId: string) => void;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  videos,
  challenges,
  recallItems,
  stats,
  userName,
  onSelectVideo,
  onSelectChallenge,
}) => {
  const [selectedStack, setSelectedStack] = useState<'all' | 'react' | 'javascript'>('all');
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<'all' | 'Beginner' | 'Intermediate' | 'Advanced'>('all');

  const solvedIds = new Set(recallItems.map(i => i.challengeId));

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

  const filteredVideos = (selectedStack === 'all'
    ? videos
    : videos.filter(v => v.stack === selectedStack)
  ).filter(v => challengesFor(v.id).length > 0);

  const DIFFICULTIES: ('all' | 'Beginner' | 'Intermediate' | 'Advanced')[] = [
    'all',
    'Beginner',
    'Intermediate',
    'Advanced',
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Header */}
      <section className="relative rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 shadow-[var(--shadow-sm)] overflow-hidden">
        <div className="max-w-2xl space-y-4">
          <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] font-mono">
            <span>HelloPM Buildathon Entry</span>
            <span>·</span>
            <span>Cohort 52</span>
            <span>·</span>
            <span className="text-[var(--color-accent)] font-semibold">Nabbit MVP</span>
          </div>

          {userName && (
            <p className="text-sm font-semibold text-[var(--color-accent)]">
              Welcome back, {userName} 👋
            </p>
          )}

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)]">
            Train your code-review judgment on the dev videos you watch.
          </h1>

          <p className="text-sm sm:text-base text-[var(--color-muted)] leading-relaxed">
            AI now writes the first draft of code. The scarce engineering muscle is shifting from syntax recall to <strong className="text-[var(--color-text)] font-semibold">reviewing, catching subtle bugs, and verifying logic</strong>. Pick a curated tutorial to drill on its exact concepts.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {nextChallenge && (
              <Button
                size="md"
                variant="primary"
                icon={<Play className="w-4 h-4 fill-current" />}
                onClick={() => onSelectChallenge(nextChallenge.id)}
              >
                Launch Quick Bug Hunt
              </Button>
            )}

            <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] font-mono pl-2">
              <ShieldCheck className="w-4 h-4 text-[var(--color-good)]" />
              <span>Deterministic MCQ grading · No flaky LLM</span>
            </div>
          </div>
        </div>
      </section>

      {/* Returning-user progress strip (adaptive home) */}
      {recallItems.length > 0 && nextChallenge && (
        <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-5 py-4">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
              <div className="leading-tight">
                <div className="text-sm font-bold text-[var(--color-text)] tabular-nums">
                  {stats.currentStreak}
                </div>
                <div className="text-[11px] text-[var(--color-muted)] font-mono">day streak</div>
              </div>
            </div>

            <div className="w-px h-8 bg-[var(--color-border)]" />

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
              <div className="leading-tight">
                <div className="text-sm font-bold text-[var(--color-text)] tabular-nums">
                  {stats.dueCount}
                </div>
                <div className="text-[11px] text-[var(--color-muted)] font-mono">due for review</div>
              </div>
            </div>
          </div>

          <Button
            size="sm"
            variant="secondary"
            icon={<ArrowRight className="w-4 h-4 order-last" />}
            onClick={() => onSelectChallenge(nextChallenge.id)}
          >
            Continue where you left off
          </Button>
        </section>
      )}

      {/* Filter Tabs & Counter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">Curated Video Packs</h2>
          <p className="text-xs text-[var(--color-muted)]">
            Hand-verified drills extracted from top community tutorials
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
              React (2)
            </button>
            <button
              onClick={() => setSelectedStack('javascript')}
              className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                selectedStack === 'javascript'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              JavaScript (1)
            </button>
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
                    <span>{video.channel}</span>
                    <span className="tabular-nums">{video.duration}</span>
                  </div>

                  <h3 className="text-base font-bold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                    {video.title}
                  </h3>
                </div>

                <p className="text-xs text-[var(--color-muted)] leading-relaxed line-clamp-2">
                  {video.description}
                </p>

                {/* Progress bar */}
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

      {/* Nabbit Pro preview (N7) — premium entry + roadmap, no transactions */}
      <section className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text)]">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Nabbit Pro</span>
          <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-accent-weak)] text-[var(--color-accent)] text-[10px] font-mono uppercase tracking-wide">
            Coming soon
          </span>
        </div>

        {/* Paste-any-video auto-generation (premium entry, disabled for MVP) */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            disabled
            placeholder="Paste any YouTube tutorial URL to auto-generate drills…"
            aria-label="Paste a YouTube URL to auto-generate drills (Pro, coming soon)"
            className="flex-1 min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-muted)] disabled:cursor-not-allowed"
          />
          <Button size="sm" variant="secondary" disabled className="shrink-0 justify-center">
            Generate drills
          </Button>
        </div>

        <p className="text-xs text-[var(--color-muted)] leading-relaxed">
          Pro unlocks auto-generation from any video, more judgment formats (predict-output,
          spot-the-flaw, trade-off), extra stacks and a mastery dashboard.{' '}
          <span className="text-[var(--color-text)] font-medium">For teams:</span> drills on your
          own codebase and a shared dashboard to verify your devs' code-review judgment.
        </p>
      </section>
    </div>
  );
};
