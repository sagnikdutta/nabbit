import React, { useState, useEffect } from 'react';
import { ExternalLink, Play, RotateCcw, Bookmark } from 'lucide-react';

export interface VideoPlayerProps {
  youtubeId: string;
  timestampSeconds: number;
  timestampFormatted: string;
  chapterTitle: string;
  videoTitle: string;
  channel: string;
  activeCueSeconds?: number | null;
  activeCueLabel?: string | null;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  youtubeId,
  timestampSeconds,
  timestampFormatted,
  chapterTitle,
  videoTitle,
  channel,
  activeCueSeconds,
  activeCueLabel,
}) => {
  const [currentStart, setCurrentStart] = useState(timestampSeconds);
  const [key, setKey] = useState(0);

  // Update starting time if activeCueSeconds is provided
  useEffect(() => {
    if (typeof activeCueSeconds === 'number') {
      setCurrentStart(activeCueSeconds);
      setKey(prev => prev + 1);
    } else {
      setCurrentStart(timestampSeconds);
    }
  }, [activeCueSeconds, timestampSeconds]);

  const resetToTimestamp = () => {
    setCurrentStart(timestampSeconds);
    setKey(prev => prev + 1);
  };

  const isCuedToHint = typeof activeCueSeconds === 'number' && activeCueSeconds !== timestampSeconds;
  const minutes = Math.floor(currentStart / 60);
  const seconds = currentStart % 60;
  const currentFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const embedUrl = `https://www.youtube-nocookie.com/embed/${youtubeId}?start=${currentStart}&autoplay=1&rel=0&modestbranding=1`;
  const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}&t=${currentStart}s`;

  return (
    <div className="rounded-[var(--radius)] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] flex flex-col">
      {/* Video Context Header */}
      <div className="px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 truncate">
          <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0" />
          <span className="font-semibold text-[var(--color-text)] truncate">{chapterTitle}</span>
          <span className="text-[var(--color-muted)]">·</span>
          <span className="font-mono text-[var(--color-muted)] tabular-nums">{currentFormatted}</span>
          {isCuedToHint && (
            <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-accent-weak)] text-[var(--color-accent)] font-semibold shrink-0">
              <Bookmark className="w-2.5 h-2.5" />
              <span>{activeCueLabel || 'Hint Moment'}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={resetToTimestamp}
            className="flex items-center gap-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] px-2 py-0.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-border)] transition-colors cursor-pointer"
            title="Reset video to original chapter timestamp"
            aria-label={`Reset video to original timestamp at ${timestampFormatted}`}
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span className="hidden sm:inline">Reset Timestamp</span>
          </button>
          <a
            href={watchUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] px-2 py-0.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-border)] transition-colors"
            title="Open in new YouTube tab"
            aria-label="Watch on YouTube in a new tab"
          >
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
            <span className="hidden sm:inline">YouTube</span>
          </a>
        </div>
      </div>

      {/* YouTube Embed Player */}
      <div className="relative aspect-video w-full bg-black">
        <iframe
          key={key}
          src={embedUrl}
          title={`${videoTitle} - ${chapterTitle}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>

      {/* Video Footer Metadata */}
      <div className="px-4 py-2.5 text-xs text-[var(--color-muted)] flex items-center justify-between bg-[var(--color-surface)]">
        <div className="truncate">
          <span className="text-[var(--color-text)] font-medium">{channel}</span>
          <span className="mx-1.5 text-[var(--color-border)]">|</span>
          <span className="truncate">{videoTitle}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-[var(--color-accent)] font-medium shrink-0 ml-2">
          <Play className="w-3 h-3 fill-current" />
          <span>Synced to {currentFormatted}</span>
        </div>
      </div>
    </div>
  );
};
