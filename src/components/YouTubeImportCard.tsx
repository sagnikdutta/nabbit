import React, { useState } from 'react';
import { Youtube, Sparkles, ArrowRight, Loader2, CheckCircle2, AlertCircle, Wand2 } from 'lucide-react';
import { extractYouTubeVideoId, SAMPLE_YOUTUBE_PRESETS } from '../lib/youtube';
import { Button } from './Button';
import { Video, Challenge } from '../lib/types';

export interface YouTubeImportCardProps {
  onSuccess: (video: Video, challenges: Challenge[]) => void;
  onLaunchChallenge?: (challengeId: string) => void;
  onImport: (url: string, topicHint?: string) => Promise<{ video: Video; challenges: Challenge[]; source: string }>;
}

export const YouTubeImportCard: React.FC<YouTubeImportCardProps> = ({
  onSuccess,
  onLaunchChallenge,
  onImport,
}) => {
  const [url, setUrl] = useState('');
  const [topicHint, setTopicHint] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<{ video: Video; challenges: Challenge[] } | null>(null);

  const detected = extractYouTubeVideoId(url);

  const handleApplyPreset = (preset: typeof SAMPLE_YOUTUBE_PRESETS[0]) => {
    setUrl(preset.url);
    setTopicHint(preset.topic);
    setError(null);
    setCreatedResult(null);
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) {
      setError('Please enter a YouTube video URL');
      return;
    }

    const parsed = extractYouTubeVideoId(url);
    if (!parsed) {
      setError('Please provide a valid YouTube URL (e.g. https://www.youtube.com/watch?v=...)');
      return;
    }

    setError(null);
    setIsLoading(true);
    setCreatedResult(null);
    setLoadingStep(1);

    // Progressive step indicator for rich user feedback
    const stepTimer1 = setTimeout(() => setLoadingStep(2), 1500);
    const stepTimer2 = setTimeout(() => setLoadingStep(3), 3200);

    try {
      const result = await onImport(url.trim(), topicHint.trim() || undefined);
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setLoadingStep(4);
      setCreatedResult({ video: result.video, challenges: result.challenges });
      onSuccess(result.video, result.challenges);
    } catch (err: any) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setError(err?.message || 'Failed to generate drill from YouTube tutorial.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-7 shadow-[var(--shadow-sm)] space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[var(--radius-sm)] bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <Youtube className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
              <span>Paste YouTube Tutorial URL</span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-accent-weak)] text-[var(--color-accent)] font-semibold">
                AI Drill Generator
              </span>
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              Convert any dev screencast into realistic bug-hunt drills with planted defects and spaced recall.
            </p>
          </div>
        </div>

        {/* 1-Click Demo Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-mono text-[var(--color-muted)] mr-1">Presets:</span>
          {SAMPLE_YOUTUBE_PRESETS.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleApplyPreset(p)}
              className="text-[11px] font-mono px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] text-[var(--color-text)] border border-[var(--color-border)] hover:border-[var(--color-accent-border)] hover:bg-[var(--color-accent-weak)] transition-colors cursor-pointer select-none"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleGenerate} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-7 space-y-1">
            <label className="text-xs font-semibold text-[var(--color-text)] flex items-center justify-between">
              <span>YouTube Video URL or ID</span>
              {detected && (
                <span className="text-[11px] font-mono text-[var(--color-good)] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>ID: {detected.videoId}</span>
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={e => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3.5 py-2.5 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-xs text-[var(--color-text)] font-mono placeholder:text-[var(--color-muted)]/60 focus:bg-[var(--color-surface)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="md:col-span-5 space-y-1">
            <label className="text-xs font-semibold text-[var(--color-text)]">
              <span>Concept / Topic Focus (Optional)</span>
            </label>
            <input
              type="text"
              value={topicHint}
              onChange={e => setTopicHint(e.target.value)}
              placeholder="e.g. Next.js Server Actions, Zustand..."
              className="w-full px-3.5 py-2.5 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)]/60 focus:bg-[var(--color-surface)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--color-danger-border)] bg-[var(--color-danger-weak)] text-xs text-[var(--color-danger-ink)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--color-danger)]" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Progress Stages */}
        {isLoading && (
          <div className="p-4 rounded-[var(--radius)] border border-[var(--color-accent-border)] bg-[var(--color-accent-weak)] text-xs space-y-2">
            <div className="flex items-center justify-between font-mono text-[var(--color-accent)]">
              <span className="flex items-center gap-2 font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>
                  {loadingStep === 1 && 'Extracting YouTube metadata and tutorial chapters...'}
                  {loadingStep === 2 && 'Synthesizing AI-written code snippet and planting subtle defect...'}
                  {loadingStep >= 3 && 'Formulating 4-option code review trap and deep explanation...'}
                </span>
              </span>
              <span className="text-[11px] tabular-nums">Step {loadingStep} / 3</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/40 overflow-hidden">
              <div
                className="h-full bg-[var(--color-accent)] transition-all duration-500"
                style={{ width: `${(loadingStep / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Success Banner */}
        {createdResult && !isLoading && (
          <div className="p-4 rounded-[var(--radius)] border border-[var(--color-good-border)] bg-[var(--color-good-weak)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[var(--color-good)] shrink-0" />
              <div>
                <p className="font-bold text-[var(--color-good-ink)]">
                  Created {createdResult.challenges.length} Bug-Hunt Drills for "{createdResult.video.title}"!
                </p>
                <p className="text-[11px] text-[var(--color-good-ink)]/80">
                  Video and concepts are saved in your library and enrolled in the spaced recall engine.
                </p>
              </div>
            </div>

            {onLaunchChallenge && createdResult.challenges[0] && (
              <Button
                type="button"
                size="sm"
                variant="success"
                onClick={() => onLaunchChallenge(createdResult.challenges[0].id)}
                icon={<ArrowRight className="w-3.5 h-3.5 order-last" />}
              >
                Start Drill Now
              </Button>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--color-muted)]">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Powered by Gemini 3.8 Flash · Instant deterministic grading</span>
          </div>

          <Button
            type="submit"
            size="md"
            variant="primary"
            disabled={!url.trim() || isLoading}
            isLoading={isLoading}
            icon={<Wand2 className="w-4 h-4" />}
          >
            Generate Bug Hunt Drills
          </Button>
        </div>
      </form>
    </div>
  );
};
