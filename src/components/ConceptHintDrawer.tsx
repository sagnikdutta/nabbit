import React, { useState } from 'react';
import { Lightbulb, Play, ChevronDown, ChevronUp, Eye, ExternalLink, HelpCircle } from 'lucide-react';
import { Challenge } from '../lib/types';

export interface ConceptHintDrawerProps {
  challenge: Challenge;
  youtubeId: string;
  onCueVideo: (seconds: number, formatted: string) => void;
}

export const ConceptHintDrawer: React.FC<ConceptHintDrawerProps> = ({
  challenge,
  youtubeId,
  onCueVideo,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCodeClue, setShowCodeClue] = useState(false);

  // Derive hints with intelligent fallback if not explicitly populated
  const hintTimestamp = challenge.hints?.videoTimestampSeconds ?? challenge.timestampSeconds;
  const minutes = Math.floor(hintTimestamp / 60);
  const seconds = hintTimestamp % 60;
  const formattedHintTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const conceptNudge =
    challenge.hints?.conceptNudge ||
    `Review the ${challenge.concept} mental model taught in chapter "${challenge.chapter}". Watch for the exact parameter semantics and safety boundaries.`;

  const inspectionClue =
    challenge.hints?.inspectionClue ||
    `Examine lines ${challenge.buggyLines.join(', ')}. Compare the declared syntax or parameter type against the tutorial specification.`;

  const youtubeDeepLink = `https://www.youtube.com/watch?v=${youtubeId}&t=${hintTimestamp}s`;

  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] overflow-hidden transition-all">
      {/* Header bar / Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer select-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-[var(--radius-sm)] bg-[var(--color-accent-weak)] text-[var(--color-accent)] flex items-center justify-center shrink-0">
            <Lightbulb className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--color-text)]">
              Need a Hint?
            </span>
            <span className="mx-2 text-[var(--color-muted)]">·</span>
            <span className="text-[11px] text-[var(--color-muted)] font-mono">
              2-Stage Guided Review
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <span className="hidden sm:inline text-[11px]">
            {isOpen ? 'Collapse' : 'Review Concept & Timestamp'}
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-[var(--color-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--color-muted)]" />
          )}
        </div>
      </button>

      {/* Expanded Hint Content */}
      {isOpen && (
        <div className="p-4 border-t border-[var(--color-border)] space-y-4 bg-[var(--color-surface-subtle)] text-xs">
          {/* Stage 1: Concept Nudge */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-wider uppercase text-[var(--color-accent)] font-bold">
                Stage 1 · Concept Principle
              </span>
              <span className="text-[11px] text-[var(--color-muted)] font-mono">
                Cue: {formattedHintTime}
              </span>
            </div>

            <p className="text-[var(--color-text)] leading-relaxed bg-[var(--color-surface)] p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
              {conceptNudge}
            </p>

            {/* Video Review Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onCueVideo(hintTimestamp, formattedHintTime)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90 font-medium transition-opacity cursor-pointer text-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Jump Video to {formattedHintTime}</span>
              </button>

              <a
                href={youtubeDeepLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors text-xs"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open in YouTube ({formattedHintTime})</span>
              </a>
            </div>
          </div>

          {/* Stage 2: Code Inspection Clue (Progressive Disclosure) */}
          <div className="pt-2 border-t border-[var(--color-border)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-wider uppercase text-[var(--color-muted)] font-bold">
                Stage 2 · Code Inspection Clue
              </span>
              {!showCodeClue && (
                <button
                  type="button"
                  onClick={() => setShowCodeClue(true)}
                  className="flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:underline cursor-pointer font-medium"
                >
                  <Eye className="w-3 h-3" />
                  <span>Reveal Clue</span>
                </button>
              )}
            </div>

            {showCodeClue ? (
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-accent-border)] text-[var(--color-text)] font-mono text-[11px] leading-relaxed">
                <div className="flex items-start gap-2">
                  <HelpCircle className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0 mt-0.5" />
                  <span>{inspectionClue}</span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--color-muted)] italic">
                Still stuck after reviewing the video moment? Reveal the inspection clue to isolate the syntax artifact.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
