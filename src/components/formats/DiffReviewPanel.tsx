import React from 'react';
import { Challenge } from '../../lib/types';
import { OptionCard } from '../OptionCard';
import { CodeBlock } from '../CodeBlock';
import { Check, X, MessageSquare, GitPullRequest } from 'lucide-react';

type Verdict = 'approve' | 'request-changes' | 'comment';

export interface DiffReviewPanelProps {
  challenge: Challenge;
  verdict: Verdict | null;
  selectedOption: number | null;
  onChangeVerdict: (v: Verdict) => void;
  onChangeOption: (idx: number) => void;
  disabled?: boolean;
}

const VERDICT_META: Record<Verdict, { label: string; icon: React.ReactNode; hint: string; accent: string }> = {
  approve: {
    label: 'Approve',
    icon: <Check className="w-3.5 h-3.5" />,
    hint: 'LGTM, ship it as proposed.',
    accent: 'var(--color-good)',
  },
  'request-changes': {
    label: 'Request changes',
    icon: <X className="w-3.5 h-3.5" />,
    hint: 'The patch is wrong — pick the correct fix below.',
    accent: 'var(--color-danger)',
  },
  comment: {
    label: 'Comment',
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    hint: 'Neither clearly correct nor clearly broken; leave a note.',
    accent: 'var(--color-accent)',
  },
};

/**
 * Phase 8 v3 — Diff-review. Shows a proposed patch (the drill's buggyCode as
 * "what someone's trying to merge" — the planted-flaw framing) and asks the
 * reviewer to pick a verdict. If the verdict is "request changes", the reviewer
 * also picks the right fix from the options.
 *
 * Grading: verdict match → correct. For 'request-changes', wrong fix → partial.
 */
export const DiffReviewPanel: React.FC<DiffReviewPanelProps> = ({
  challenge,
  verdict,
  selectedOption,
  onChangeVerdict,
  onChangeOption,
  disabled,
}) => {
  const needsFix = verdict === 'request-changes';

  return (
    <div className="space-y-4 pt-2">
      <div className="rounded-[var(--radius-sm)] border border-[var(--color-accent-border)] bg-[var(--color-accent-weak)] px-3 py-2 flex items-start gap-2 text-xs">
        <GitPullRequest className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--color-accent)]" />
        <span className="text-[var(--color-text)]">
          <strong>Diff review:</strong> treat the snippet above as a pull-request diff.
          Approve, request changes, or leave a comment.
        </span>
      </div>

      {/* Proposed patch — buggyCode shown as "what's being proposed". */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[var(--color-text)] font-semibold">Proposed patch</span>
          <span className="text-[var(--color-muted)]">as submitted</span>
        </div>
        <CodeBlock
          code={challenge.buggyCode}
          highlightLines={[]}
          variant="neutral"
          filename={challenge.filename || 'proposed.tsx'}
          fileType={challenge.fileType}
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[var(--color-text)]">Your verdict:</label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {(Object.keys(VERDICT_META) as Verdict[]).map(v => {
          const m = VERDICT_META[v];
          const selected = verdict === v;
          return (
            <button
              key={v}
              type="button"
              disabled={disabled}
              onClick={() => onChangeVerdict(v)}
              aria-pressed={selected}
              className={`text-left px-3 py-2.5 rounded-[var(--radius)] border transition-all flex flex-col gap-1 cursor-pointer disabled:cursor-not-allowed ${
                selected
                  ? 'bg-[var(--color-surface)] shadow-[var(--shadow-sm)]'
                  : 'bg-[var(--color-surface-subtle)] hover:bg-[var(--color-surface)]'
              }`}
              style={{
                borderColor: selected ? m.accent : 'var(--color-border)',
              }}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: m.accent }}>
                {m.icon}
                {m.label}
              </span>
              <span className="text-[11px] text-[var(--color-muted)] leading-relaxed">{m.hint}</span>
            </button>
          );
        })}
      </div>

      {needsFix && (
        <div className="space-y-3 pt-2 border-t border-[var(--color-border-subtle)]">
          <label className="text-xs font-semibold text-[var(--color-text)] block">
            Which fix would unblock the review?
          </label>
          <div className="space-y-2.5">
            {challenge.fixOptions.map((option, idx) => (
              <OptionCard
                key={idx}
                index={idx}
                text={option}
                isSelected={selectedOption === idx}
                onClick={() => !disabled && onChangeOption(idx)}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
