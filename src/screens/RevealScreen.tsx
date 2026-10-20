import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Challenge, Video, RecallItem } from '../lib/types';
import { CodeBlock } from '../components/CodeBlock';
import { OptionCard } from '../components/OptionCard';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Calendar,
  Flame,
  Check,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';

export interface RevealScreenProps {
  challenge: Challenge;
  video: Video;
  chosenOption: number;
  isCorrect: boolean;
  explanation: string;
  recallItem: RecallItem;
  allChallengesInVideo: Challenge[];
  onNextChallenge?: () => void;
  onRetryChallenge: () => void;
  onGoToRecall: () => void;
  onBackToLibrary: () => void;
}

export const RevealScreen: React.FC<RevealScreenProps> = ({
  challenge,
  video,
  chosenOption,
  isCorrect,
  explanation,
  recallItem,
  allChallengesInVideo,
  onNextChallenge,
  onRetryChallenge,
  onGoToRecall,
  onBackToLibrary,
}) => {
  const [activeTab, setActiveTab] = useState<'diff' | 'explanation'>('diff');

  // Trigger celebration confetti on correct solve
  useEffect(() => {
    if (isCorrect) {
      confetti({
        particleCount: 75,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#10b981', '#f59e0b', '#3b82f6'],
      });
    }
  }, [isCorrect]);

  const currentIndex = allChallengesInVideo.findIndex(c => c.id === challenge.id);
  const hasNext = currentIndex < allChallengesInVideo.length - 1;

  const nextReviewDate = new Date(recallItem.nextReviewAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 text-xs">
        <button
          onClick={onBackToLibrary}
          className="flex items-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Library</span>
        </button>
        <span className="font-mono text-[var(--color-muted)]">
          {video.title} · Concept {currentIndex + 1} of {allChallengesInVideo.length}
        </span>
      </div>

      {/* Verdict Hero Banner */}
      <section
        className={`rounded-[var(--radius-lg)] border p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-[var(--shadow-sm)] transition-all ${
          isCorrect
            ? 'bg-[var(--color-good-weak)] border-[var(--color-good-border)]'
            : 'bg-[var(--color-danger-weak)] border-[var(--color-danger-border)]'
        }`}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isCorrect ? (
              <div className="w-7 h-7 rounded-full bg-[var(--color-good)] text-white flex items-center justify-center">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-[var(--color-danger)] text-white flex items-center justify-center">
                <XCircle className="w-4 h-4 stroke-[2.5]" />
              </div>
            )}
            <h1
              className={`text-xl sm:text-2xl font-bold tracking-tight ${
                isCorrect ? 'text-[var(--color-good-ink)]' : 'text-[var(--color-danger-ink)]'
              }`}
            >
              {isCorrect ? 'Bug Caught! Sharp Review Judgment.' : 'Planted Bug Missed.'}
            </h1>
          </div>

          <p
            className={`text-sm ${
              isCorrect ? 'text-[var(--color-good-ink)]/90' : 'text-[var(--color-danger-ink)]/90'
            }`}
          >
            {isCorrect
              ? `You spotted the flaw and picked the verified fix. Concept scheduled for spaced recall in ${recallItem.interval} ${
                  recallItem.interval === 1 ? 'day' : 'days'
                }.`
              : 'The code contained a subtle edge-case defect. Scheduled to resurface in 1 day for reinforcement.'}
          </p>
        </div>

        {/* Schedule & Streak Badges */}
        <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-mono">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span className="text-[var(--color-muted)]">Next Recall:</span>
            <strong className="text-[var(--color-text)]">{nextReviewDate}</strong>
            <span className="text-[var(--color-accent)] font-semibold">({recallItem.interval}d)</span>
          </div>

          {recallItem.streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-mono">
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span className="text-[var(--color-text)] font-semibold">{recallItem.streak}</span>
              <span className="text-[var(--color-muted)]">streak</span>
            </div>
          )}
        </div>
      </section>

      {/* Answer Options Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-[var(--color-muted)] font-mono">
          <span>Options Breakdown</span>
          <span>Green = Correct Fix · Red = Your Choice</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {challenge.fixOptions.map((opt, idx) => (
            <OptionCard
              key={idx}
              index={idx}
              text={opt}
              isSelected={chosenOption === idx}
              isCorrect={idx === challenge.correctOption}
              isRevealed={true}
              disabled={true}
              onClick={() => {}}
            />
          ))}
        </div>
      </div>

      {/* Side-by-Side Code Diff: Buggy vs Corrected */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
            <h2 className="text-sm font-bold text-[var(--color-text)]">
              Code Implementation Comparison
            </h2>
          </div>

          <div className="text-xs text-[var(--color-muted)] font-mono">
            Line {challenge.buggyLines.join(', ')} rectified
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[var(--color-danger)] font-semibold flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>Buggy Snippet (Before)</span>
              </span>
              <span className="text-[var(--color-muted)]">Flawed logic</span>
            </div>
            <CodeBlock
              code={challenge.buggyCode}
              highlightLines={challenge.buggyLines}
              variant="bug"
              filename="flawed_snippet.tsx"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[var(--color-good)] font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Corrected Solution (After)</span>
              </span>
              <span className="text-[var(--color-good)] font-medium">Verified fix</span>
            </div>
            <CodeBlock
              code={challenge.correctCode}
              highlightLines={challenge.buggyLines}
              variant="fix"
              filename="corrected_snippet.tsx"
            />
          </div>
        </div>
      </div>

      {/* Deep Concept Explanation & Architectural Takeaway */}
      <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4 shadow-[var(--shadow-sm)]">
        <div className="space-y-1">
          <span className="text-xs font-mono text-[var(--color-accent)] font-semibold">
            Concept Mechanics
          </span>
          <h3 className="text-lg font-bold text-[var(--color-text)]">
            Why this happens: {challenge.concept}
          </h3>
        </div>

        <div className="text-sm text-[var(--color-text-subtle)] leading-relaxed space-y-3 bg-[var(--color-surface-subtle)] p-4 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)]">
          <p>{explanation}</p>
        </div>

        <div className="border-t border-[var(--color-border)] pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-semibold text-[var(--color-text)]">Reviewer's Rule of Thumb:</span>
            <p className="text-[var(--color-muted)]">{challenge.takeaway}</p>
          </div>
        </div>
      </section>

      {/* Navigation & Next Actions */}
      <div className="pt-4 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-4">
        <Button variant="outline" size="md" onClick={onRetryChallenge} icon={<RotateCcw className="w-4 h-4" />}>
          Try This Drill Again
        </Button>

        <div className="flex items-center gap-3">
          <Button variant="secondary" size="md" onClick={onGoToRecall} icon={<Calendar className="w-4 h-4" />}>
            View Spaced Recall Queue
          </Button>

          {hasNext && onNextChallenge ? (
            <Button
              variant="primary"
              size="md"
              onClick={onNextChallenge}
              icon={<ArrowRight className="w-4 h-4 order-last" />}
            >
              Next Challenge in Pack
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={onBackToLibrary}>
              Explore More Videos
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
