import React, { useState } from 'react';
import { Video, Challenge, RecallItem } from '../lib/types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Play, CheckCircle2, ArrowRight, ShieldCheck, Sparkles, BookOpen } from 'lucide-react';

export interface LibraryScreenProps {
  videos: Video[];
  challenges: Challenge[];
  recallItems: RecallItem[];
  onSelectVideo: (videoId: string) => void;
  onSelectChallenge: (challengeId: string) => void;
}

export const LibraryScreen: React.FC<LibraryScreenProps> = ({
  videos,
  challenges,
  recallItems,
  onSelectVideo,
  onSelectChallenge,
}) => {
  const [selectedStack, setSelectedStack] = useState<'all' | 'react' | 'javascript'>('all');

  const filteredVideos =
    selectedStack === 'all'
      ? videos
      : videos.filter(v => v.stack === selectedStack);

  // Find next unattempted challenge for the quick drill button
  const solvedIds = new Set(recallItems.map(i => i.challengeId));
  const nextChallenge = challenges.find(c => !solvedIds.has(c.id)) || challenges[0];

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

      {/* Filter Tabs & Counter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">Curated Video Packs</h2>
          <p className="text-xs text-[var(--color-muted)]">
            Hand-verified drills extracted from top community tutorials
          </p>
        </div>

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
      </div>

      {/* Video Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVideos.map(video => {
          const videoChallenges = challenges.filter(c => c.videoId === video.id);
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
                          <span className="text-[10px] font-mono text-[var(--color-muted)] shrink-0 tabular-nums">
                            {c.timestampFormatted}
                          </span>
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

      {/* Roadmap Teaser Banner */}
      <section className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5 text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-muted)]">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Roadmap (Post-Buildathon)</span>
        </div>
        <p className="text-xs text-[var(--color-muted)] max-w-lg mx-auto">
          "Paste Any YouTube URL" auto-generation, PR Review format (approving or requesting changes on multi-file implementations), and Python/Go backend packs are planned for next release.
        </p>
      </section>
    </div>
  );
};
