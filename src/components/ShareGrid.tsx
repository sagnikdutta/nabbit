import React, { useState } from 'react';
import { Challenge } from '../lib/types';
import { Button } from './Button';
import { Share2 } from 'lucide-react';

type Glyph = '🟩' | '🟢' | '🟨' | '🟥';

export interface ShareGridProps {
  challenge: Challenge;
  /** For spot-fix / locate-then-fix: the picked option index. null for rank-fixes. */
  chosenOption: number | null;
  /** For locate-then-fix: the picked line (used to colour as 🟨 when line was right but fix wrong). */
  chosenLine: number | null;
  isCorrect: boolean;
  outcome: 0 | 0.5 | 1 | undefined;
  streak: number;
  dareUrl: string;
  // Phase 8 v2 — real Elo delta on the Reveal upgrades Row 3 of the grid.
  newRating?: number;
  eloDelta?: number;
}

/**
 * Phase 8 v1b — "Wordle-grid" share card. A tiny visual preview on reveal
 * plus a share action that reuses the B4 bug-dare link + the native share
 * sheet (with a copy-link fallback). Tiles order follows seedDistribution
 * (most-picked left). Row 2 is the user's current streak as flames.
 *
 * Elo-delta row is deferred to v2 — Elo arrives with the Supabase sync.
 */
export const ShareGrid: React.FC<ShareGridProps> = ({
  challenge,
  chosenOption,
  chosenLine,
  isCorrect,
  outcome,
  streak,
  dareUrl,
  newRating,
  eloDelta,
}) => {
  const [state, setState] = useState<'idle' | 'copied' | 'shared'>('idle');

  // Fallback to even distribution when a drill hasn't been seeded yet.
  const dist =
    challenge.seedDistribution && challenge.seedDistribution.length === challenge.fixOptions.length
      ? challenge.seedDistribution
      : challenge.fixOptions.map(() => 1 / challenge.fixOptions.length);

  // Order option indices by popularity (desc).
  const indicesByPopularity = challenge.fixOptions
    .map((_, i) => i)
    .sort((a, b) => dist[b] - dist[a]);

  const lineWasRight =
    typeof challenge.buggyLineAnswer === 'number' && chosenLine === challenge.buggyLineAnswer;

  const glyphFor = (idx: number): Glyph => {
    if (chosenOption === null) {
      // Rank-fixes: no single chosen; green if we got the drill right overall, red otherwise.
      return isCorrect ? '🟩' : '🟥';
    }
    if (idx === challenge.correctOption && idx === chosenOption) return '🟩';
    if (idx === challenge.correctOption) return '🟢';
    if (idx === chosenOption) return outcome === 0.5 && lineWasRight ? '🟨' : '🟥';
    return '🟥';
  };

  const tiles: Glyph[] = indicesByPopularity.map(glyphFor);
  const streakRow = streak > 0 ? '🔥'.repeat(Math.min(streak, 10)) : '';
  const hasElo = typeof newRating === 'number' && typeof eloDelta === 'number';
  const eloRow = hasElo
    ? `${eloDelta! >= 0 ? '↑' : '↓'}${eloDelta! >= 0 ? '+' : ''}${eloDelta} ${challenge.concept} ${newRating! - eloDelta!}→${newRating}`
    : '';

  const shareText =
    `Nabbit · ${challenge.concept}\n` +
    `${tiles.join('')}\n` +
    (streakRow ? `${streakRow}\n` : '') +
    (eloRow ? `${eloRow}\n` : '') +
    `Can you catch it? ${dareUrl}`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Nabbit bug-dare', text: shareText });
        setState('shared');
      } else {
        await navigator.clipboard.writeText(shareText);
        setState('copied');
      }
      window.setTimeout(() => setState('idle'), 2200);
    } catch {
      // user cancelled or clipboard blocked — no-op
    }
  };

  return (
    <section className="rounded-[var(--radius)] border border-[var(--color-accent-border)] bg-[var(--color-accent-weak)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-accent-ink)] flex items-center justify-center shrink-0">
          <Share2 className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-semibold text-[var(--color-text)]">Share this bug-dare</p>
          <div
            className="font-mono text-base leading-tight tracking-tight select-all"
            aria-label={`Share grid: ${tiles.join(' ')}${streakRow ? ', ' + streak + ' streak' : ''}${eloRow ? ', ' + eloRow : ''}`}
          >
            <div>{tiles.join('')}</div>
            {streakRow && <div className="mt-0.5">{streakRow}</div>}
            {eloRow && (
              <div className={`mt-0.5 text-xs ${eloDelta! >= 0 ? 'text-[var(--color-good)]' : 'text-[var(--color-danger)]'}`}>
                {eloRow}
              </div>
            )}
          </div>
          <p className="text-[11px] text-[var(--color-muted)]">
            Tiles ordered by what others picked · 🟩 your correct · 🟢 correct · 🟨 right line · 🟥 wrong
          </p>
        </div>
      </div>

      <Button
        variant="primary"
        size="md"
        className="w-full sm:w-auto justify-center shrink-0"
        onClick={handleShare}
        icon={<Share2 className="w-4 h-4" />}
      >
        {state === 'copied' ? 'Copied!' : state === 'shared' ? 'Shared!' : 'Share grid'}
      </Button>
    </section>
  );
};
