import React, { useState, useEffect } from 'react';
import { Challenge, Video } from '../lib/types';
import { CodeBlock } from '../components/CodeBlock';
import { OptionCard } from '../components/OptionCard';
import { VideoPlayer } from '../components/VideoPlayer';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { ArrowLeft, CheckCircle, HelpCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

export interface ChallengeScreenProps {
  challenge: Challenge;
  video: Video;
  allChallengesInVideo: Challenge[];
  onBackToLibrary: () => void;
  onSubmitAttempt: (chosenOption: number) => void;
  onSelectAnotherChallenge: (challengeId: string) => void;
}

export const ChallengeScreen: React.FC<ChallengeScreenProps> = ({
  challenge,
  video,
  allChallengesInVideo,
  onBackToLibrary,
  onSubmitAttempt,
  onSelectAnotherChallenge,
}) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keyboard shortcut support (1-4 and Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < challenge.fixOptions.length) {
          setSelectedOption(idx);
        }
      } else if (e.key === 'Enter' && selectedOption !== null) {
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOption, challenge]);

  // Reset selected option when challenge changes
  useEffect(() => {
    setSelectedOption(null);
  }, [challenge.id]);

  const handleSubmit = () => {
    if (selectedOption === null || isSubmitting) return;
    setIsSubmitting(true);
    onSubmitAttempt(selectedOption);
  };

  const currentIndex = allChallengesInVideo.findIndex(c => c.id === challenge.id);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb & Step Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToLibrary}
            className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Library</span>
          </button>
          <span className="text-[var(--color-border)]">/</span>
          <span className="text-xs font-medium text-[var(--color-text)] truncate max-w-[200px] sm:max-w-md">
            {video.title}
          </span>
          <span className="text-[var(--color-border)]">/</span>
          <span className="text-xs font-mono text-[var(--color-accent)] font-semibold">
            Drill {currentIndex + 1} of {allChallengesInVideo.length}
          </span>
        </div>

        {/* Step indicator pills */}
        <div className="flex items-center gap-1.5">
          {allChallengesInVideo.map((c, i) => (
            <button
              key={c.id}
              onClick={() => onSelectAnotherChallenge(c.id)}
              className={`w-6 h-6 rounded-[var(--radius-sm)] text-[11px] font-mono flex items-center justify-center cursor-pointer transition-colors ${
                c.id === challenge.id
                  ? 'bg-[var(--color-accent)] text-white font-bold'
                  : 'bg-[var(--color-surface-subtle)] text-[var(--color-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]'
              }`}
              title={`${c.concept} (${c.timestampFormatted})`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Main 2-Column Split: Left (Video & Concept) / Right (Code Review & Fix Options) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Synchronized Video & Concept Briefing */}
        <div className="lg:col-span-5 space-y-4">
          <VideoPlayer
            youtubeId={video.youtubeId}
            timestampSeconds={challenge.timestampSeconds}
            timestampFormatted={challenge.timestampFormatted}
            chapterTitle={challenge.chapter}
            videoTitle={video.title}
            channel={video.channel}
          />

          {/* Concept Briefing Card */}
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[var(--color-muted)]">Concept Spotlight</span>
              <Badge variant={challenge.difficulty === 'Beginner' ? 'neutral' : challenge.difficulty === 'Intermediate' ? 'accent' : 'warning'}>
                {challenge.difficulty}
              </Badge>
            </div>

            <h3 className="text-base font-bold text-[var(--color-text)]">
              {challenge.concept}
            </h3>

            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              In this chapter, the video discusses how this pattern is implemented. The snippet on the right contains <strong className="text-[var(--color-text)]">one subtle planted bug</strong> commonly generated by AI assistants or overlooked in code review.
            </p>

            <div className="pt-2 border-t border-[var(--color-border-subtle)] flex items-center gap-2 text-[11px] text-[var(--color-muted)] font-mono">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Planted flaw located around line {challenge.buggyLines.join(', ')}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Code Snippet & Multiple Choice Fixes */}
        <div className="lg:col-span-7 space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--color-text)]">Code Under Review</span>
              <span className="text-[11px] font-mono text-[var(--color-danger)] font-medium">
                1 Planted Flaw
              </span>
            </div>

            {/* CodeBlock highlighting buggy line candidates */}
            <CodeBlock
              code={challenge.buggyCode}
              highlightLines={challenge.buggyLines}
              variant="bug"
              filename="ComponentUnderTest.tsx"
            />
          </div>

          {/* Fix Options (MCQ) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--color-text)]">
                Identify the bug and pick the correct fix:
              </label>
              <span className="text-[11px] text-[var(--color-muted)] font-mono">
                Press [1-4] to select
              </span>
            </div>

            <div className="space-y-2.5">
              {challenge.fixOptions.map((option, idx) => (
                <OptionCard
                  key={idx}
                  index={idx}
                  text={option}
                  isSelected={selectedOption === idx}
                  onClick={() => setSelectedOption(idx)}
                />
              ))}
            </div>
          </div>

          {/* Submission Action Bar */}
          <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] font-mono">
              <ShieldCheck className="w-4 h-4 text-[var(--color-good)]" />
              <span>Instant deterministic grading</span>
            </div>

            <Button
              size="lg"
              variant="primary"
              disabled={selectedOption === null}
              isLoading={isSubmitting}
              onClick={handleSubmit}
              icon={<CheckCircle className="w-4 h-4" />}
            >
              Check Fix (Submit Review)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
