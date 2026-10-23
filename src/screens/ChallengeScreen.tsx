import React, { useState, useEffect, useRef } from 'react';
import { Challenge, Video, RecallItem, AttemptInput, ChallengeFormat, Confidence } from '../lib/types';
import { availableFormats } from '../lib/grading';
import { CodeBlock } from '../components/CodeBlock';
import { VideoPlayer } from '../components/VideoPlayer';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { RevealScreen } from './RevealScreen';
import { ConceptTimeline } from '../components/ConceptTimeline';
import { ConceptHintDrawer } from '../components/ConceptHintDrawer';
import { FormatChooser } from '../components/FormatChooser';
import { ConfidencePicker } from '../components/ConfidencePicker';
import { SpotFixPanel } from '../components/formats/SpotFixPanel';
import { LocateThenFixPanel } from '../components/formats/LocateThenFixPanel';
import { ArrowLeft, CheckCircle, AlertTriangle, ShieldCheck, Target, X } from 'lucide-react';

export interface AttemptResult {
  correct: boolean;
  outcome: 0 | 0.5 | 1;
  explanation: string;
  recallItem: RecallItem;
  score: number;
  scoreBreakdown: {
    basePoints: number;
    confidenceMultiplier: number;
    speedFactor: number;
    comboMultiplier: number;
    score: number;
  };
  comboAfter: number;
}

export interface ChallengeScreenProps {
  challenge: Challenge;
  video: Video;
  allChallengesInVideo: Challenge[];
  userName?: string;
  showIntro?: boolean;
  onDismissIntro?: () => void;
  onBackToLibrary: () => void;
  onSubmitAttempt: (
    input: AttemptInput,
    meta: { confidence: Confidence; timeMs: number },
  ) => Promise<AttemptResult>;
  onSelectAnotherChallenge: (challengeId: string) => void;
  onNextChallenge: () => void;
  onGoToRecall: () => void;
}

export const ChallengeScreen: React.FC<ChallengeScreenProps> = ({
  challenge,
  video,
  allChallengesInVideo,
  userName,
  showIntro = false,
  onDismissIntro,
  onBackToLibrary,
  onSubmitAttempt,
  onSelectAnotherChallenge,
  onNextChallenge,
  onGoToRecall,
}) => {
  const formats = availableFormats(challenge);
  const [format, setFormat] = useState<ChallengeFormat>(formats[0]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<Confidence>('sure');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phase, setPhase] = useState<'answering' | 'revealed'>('answering');
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [cueTimestamp, setCueTimestamp] = useState<{ seconds: number; label: string } | null>(null);

  // Timer: measures per-attempt time for the speed factor in grading.ts.
  const startedAt = useRef<number>(Date.now());

  // Reset answering state when the challenge or format changes.
  useEffect(() => {
    setSelectedOption(null);
    setSelectedLine(null);
    setPhase('answering');
    setResult(null);
    setIsSubmitting(false);
    setCueTimestamp(null);
    startedAt.current = Date.now();
  }, [challenge.id]);

  // Reset the format when the drill changes (always default to the first available).
  useEffect(() => {
    setFormat(formats[0]);
    // formats derives from challenge.id → safe to depend on id only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.id]);

  // Format-aware readiness check — gates the submit button.
  const canSubmit = (() => {
    if (format === 'locate-then-fix') return selectedLine !== null && selectedOption !== null;
    return selectedOption !== null;
  })();

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    const input: AttemptInput =
      format === 'locate-then-fix'
        ? { format: 'locate-then-fix', line: selectedLine as number, chosen: selectedOption as number }
        : { format: 'spot-fix', chosen: selectedOption as number };
    const timeMs = Math.max(0, Date.now() - startedAt.current);
    const res = await onSubmitAttempt(input, { confidence, timeMs });
    setResult(res);
    setPhase('revealed');
    setIsSubmitting(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Keyboard shortcuts (only while answering)
  //   1-4 → pick option  (locate-then-fix: ignored until line is picked)
  //   Enter → submit
  //   F → cycle format (when more than one is available)
  useEffect(() => {
    if (phase !== 'answering') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= challenge.fixOptions.length) return;
        if (format === 'locate-then-fix' && selectedLine === null) return;
        setSelectedOption(idx);
      } else if (e.key === 'Enter' && canSubmit) {
        handleSubmit();
      } else if ((e.key === 'f' || e.key === 'F') && formats.length > 1) {
        const i = formats.indexOf(format);
        setFormat(formats[(i + 1) % formats.length]);
        setSelectedOption(null);
        setSelectedLine(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOption, selectedLine, challenge, phase, format, formats, canSubmit]);

  const handleRetry = () => {
    setSelectedOption(null);
    setSelectedLine(null);
    setResult(null);
    setPhase('answering');
    startedAt.current = Date.now();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFormatChange = (next: ChallengeFormat) => {
    setFormat(next);
    setSelectedOption(null);
    setSelectedLine(null);
    startedAt.current = Date.now();
  };

  const currentIndex = allChallengesInVideo.findIndex(c => c.id === challenge.id);

  // Once an answer is submitted, swap the drill in place for the inline reveal.
  if (phase === 'revealed' && result && selectedOption !== null) {
    return (
      <RevealScreen
        embedded
        userName={userName}
        challenge={challenge}
        video={video}
        chosenOption={selectedOption}
        chosenLine={selectedLine}
        format={format}
        isCorrect={result.correct}
        outcome={result.outcome}
        explanation={result.explanation}
        recallItem={result.recallItem}
        allChallengesInVideo={allChallengesInVideo}
        scoreBreakdown={result.scoreBreakdown}
        comboAfter={result.comboAfter}
        onNextChallenge={onNextChallenge}
        onRetryChallenge={handleRetry}
        onGoToRecall={onGoToRecall}
        onBackToLibrary={onBackToLibrary}
      />
    );
  }

  const locateMode = format === 'locate-then-fix';

  return (
    <div className="space-y-6 pb-16">
      {/* "What is this?" context strip for first-time / cold-dare arrivals */}
      {showIntro && (
        <div className="rounded-[var(--radius)] border border-[var(--color-accent-border)] bg-[var(--color-accent-weak)] px-4 py-3 flex items-start gap-3">
          <div className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] flex items-center justify-center shrink-0">
            <Target className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
          </div>
          <p className="flex-1 text-xs sm:text-[13px] text-[var(--color-text)] leading-relaxed pt-0.5">
            <strong className="font-semibold">New to Nabbit?</strong>{' '}
            It turns dev tutorials into bug-hunt drills — spot the one planted bug below and
            pick the correct fix. No signup needed.
          </p>
          {onDismissIntro && (
            <button
              type="button"
              onClick={onDismissIntro}
              aria-label="Dismiss intro"
              className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer -mt-0.5"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

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

        <div className="flex items-center gap-1.5" role="group" aria-label="Drills in this video">
          {allChallengesInVideo.map((c, i) => (
            <button
              key={c.id}
              onClick={() => onSelectAnotherChallenge(c.id)}
              aria-label={`Drill ${i + 1}: ${c.concept}`}
              aria-current={c.id === challenge.id ? 'step' : undefined}
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

      {/* Main 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Video & Concept */}
        <div className="lg:col-span-5 min-w-0 space-y-4">
          <VideoPlayer
            youtubeId={video.youtubeId}
            timestampSeconds={challenge.timestampSeconds}
            timestampFormatted={challenge.timestampFormatted}
            chapterTitle={challenge.chapter}
            videoTitle={video.title}
            channel={video.channel}
            activeCueSeconds={cueTimestamp?.seconds}
            activeCueLabel={cueTimestamp?.label}
          />

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
              <span>
                {locateMode
                  ? 'Flaw hidden somewhere in the snippet — you choose the line.'
                  : `Planted flaw located around line ${challenge.buggyLines.join(', ')}`}
              </span>
            </div>
          </div>

          {allChallengesInVideo.length > 1 && (
            <ConceptTimeline
              challenges={allChallengesInVideo}
              activeId={challenge.id}
              onSelect={onSelectAnotherChallenge}
              summary={video.description}
            />
          )}
        </div>

        {/* Right: Code & Fix Options */}
        <div className="lg:col-span-7 min-w-0 space-y-5">
          {formats.length > 1 && (
            <FormatChooser available={formats} active={format} onChange={handleFormatChange} />
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--color-text)]">Code Under Review</span>
              <span className="text-[11px] font-mono text-[var(--color-danger)] font-medium">
                1 Planted Flaw
              </span>
            </div>

            {/*
              In locate-then-fix we don't give away the buggy line via highlights —
              the user picks the suspect themselves. In spot-fix the gutter marker
              on buggyLines stays, matching today's drill.
            */}
            <CodeBlock
              code={challenge.buggyCode}
              highlightLines={locateMode ? [] : challenge.buggyLines}
              variant="bug"
              filename={challenge.filename || 'ComponentUnderTest.tsx'}
              fileType={challenge.fileType}
              onLineClick={locateMode ? setSelectedLine : undefined}
              selectedLine={locateMode ? selectedLine : null}
            />
          </div>

          <ConceptHintDrawer
            challenge={challenge}
            youtubeId={video.youtubeId}
            onCueVideo={(seconds, formatted) => {
              setCueTimestamp({ seconds, label: `Hint (${formatted})` });
            }}
          />

          {/* Format-specific input panel */}
          {locateMode ? (
            <LocateThenFixPanel
              challenge={challenge}
              selectedLine={selectedLine}
              selectedOption={selectedOption}
              onChangeOption={setSelectedOption}
              disabled={isSubmitting}
            />
          ) : (
            <SpotFixPanel
              challenge={challenge}
              selectedOption={selectedOption}
              onChangeOption={setSelectedOption}
              disabled={isSubmitting}
            />
          )}

          {/* Submission Action Bar */}
          <div className="pt-4 border-t border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex flex-col gap-2 min-w-0">
              <ConfidencePicker
                value={confidence}
                onChange={setConfidence}
                disabled={isSubmitting}
              />
              <div className="flex items-center gap-2 text-[11px] text-[var(--color-muted)] font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-good)] shrink-0" />
                <span>Deterministic grading · Confidence scales score only</span>
              </div>
            </div>

            <Button
              size="lg"
              variant="primary"
              className="w-full sm:w-auto justify-center"
              disabled={!canSubmit}
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
