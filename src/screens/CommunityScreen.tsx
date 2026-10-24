import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { ArrowLeft, Plus, ThumbsUp, Users, CheckCircle2, Clock } from 'lucide-react';

export interface CommunityScreenProps {
  signedIn: boolean;
  onBack: () => void;
  onOpenAuth: () => void;
}

interface DraftRow {
  id: string;
  draft: {
    concept?: string;
    difficulty?: string;
    buggyCode?: string;
    explanation?: string;
  };
  upvotes: number;
  status: 'queued' | 'published' | 'rejected';
  created_at: string;
  author_id: string;
}

interface SubmitForm {
  concept: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  buggyCode: string;
  explanation: string;
}

/**
 * Phase 8 v3 — community drafts queue + inline submit form.
 *
 * Anyone can view queued drafts; signed-in users can upvote once each.
 * A draft auto-publishes once it hits the submitter's Elo-scaled threshold
 * (3/5/10 upvotes — see migration 0009 upvote_community_draft).
 *
 * Submission is minimal here — concept + buggy snippet + a plain-English
 * explanation. v3 polish will connect the YouTubeImportCard's Gemini
 * author-time path to this submit as a fuller flow.
 */
export const CommunityScreen: React.FC<CommunityScreenProps> = ({ signedIn, onBack, onOpenAuth }) => {
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [upvoting, setUpvoting] = useState<string | null>(null);

  const refresh = React.useCallback(() => {
    if (!supabase) { setRows([]); return; }
    supabase
      .from('community_drafts')
      .select('*')
      .in('status', ['queued', 'published'])
      .order('upvotes', { ascending: false })
      .limit(50)
      .then(
        ({ data, error }) => {
          if (error) { setErr(error.message); return; }
          setRows((data ?? []) as DraftRow[]);
        },
        (e: unknown) => setErr(String((e as any)?.message || e)),
      );
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleUpvote = async (id: string) => {
    if (!signedIn || !supabase) { onOpenAuth(); return; }
    setUpvoting(id);
    try {
      const { data } = await supabase.rpc('upvote_community_draft', { draft_id: id });
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setRows(prev => prev
          ? prev.map(r => r.id === id ? { ...r, upvotes: Number(row.upvotes), status: row.status as DraftRow['status'] } : r)
          : prev);
      }
    } finally {
      setUpvoting(null);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
        <h1 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-1.5">
          <Users className="w-4 h-4 text-[var(--color-accent)]" />
          Community drafts
        </h1>
        {signedIn ? (
          <Button
            variant={showSubmit ? 'outline' : 'primary'}
            size="sm"
            onClick={() => setShowSubmit(v => !v)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            {showSubmit ? 'Cancel' : 'Submit a drill'}
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onOpenAuth}>
            Sign in to submit
          </Button>
        )}
      </div>

      {showSubmit && signedIn && (
        <SubmitDraftForm onDone={() => { setShowSubmit(false); refresh(); }} />
      )}

      {err ? (
        <section className="rounded-[var(--radius)] border border-[var(--color-danger-border)] bg-[var(--color-danger-weak)] p-4 text-xs text-[var(--color-danger-ink)]">
          {err}
        </section>
      ) : rows === null ? (
        <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-xs text-[var(--color-muted)] font-mono">
          Loading drafts…
        </section>
      ) : rows.length === 0 ? (
        <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-xs text-[var(--color-muted)]">
          Nothing in the queue yet. Submit the first community drill.
        </section>
      ) : (
        <ul className="space-y-2">
          {rows.map(r => (
            <li
              key={r.id}
              className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-semibold text-[var(--color-text)] truncate">
                  {r.draft.concept || '(untitled draft)'}
                </p>
                <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--color-muted)]">
                  {r.draft.difficulty && <span>{r.draft.difficulty}</span>}
                  <span className="flex items-center gap-1">
                    {r.status === 'published'
                      ? <><CheckCircle2 className="w-3 h-3 text-[var(--color-good)]" /> Published</>
                      : <><Clock className="w-3 h-3" /> Queued</>}
                  </span>
                </div>
                {r.draft.explanation && (
                  <p className="text-xs text-[var(--color-muted)] line-clamp-2 pt-1">
                    {r.draft.explanation}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => handleUpvote(r.id)}
                disabled={upvoting === r.id}
                icon={<ThumbsUp className="w-3.5 h-3.5" />}
              >
                {r.upvotes}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const SubmitDraftForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [form, setForm] = useState<SubmitForm>({
    concept: '',
    difficulty: 'Beginner',
    buggyCode: '',
    explanation: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!supabase) return;
    if (!form.concept.trim() || !form.buggyCode.trim()) {
      setErr('concept and buggyCode are required');
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('submit_community_draft', {
        draft: {
          concept: form.concept.trim(),
          difficulty: form.difficulty,
          buggyCode: form.buggyCode,
          explanation: form.explanation.trim(),
          // The full Challenge shape — fixOptions / correctOption are left to a
          // reviewer or Gemini pass to flesh out before publish.
          fixOptions: [],
          correctOption: 0,
        },
      });
      if (error) { setErr(error.message); return; }
      onDone();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text)]">New community drill</p>
      {err && (
        <p className="text-xs text-[var(--color-danger-ink)] bg-[var(--color-danger-weak)] border border-[var(--color-danger-border)] rounded-[var(--radius-sm)] px-2 py-1">
          {err}
        </p>
      )}
      <label className="block text-xs font-medium text-[var(--color-text)] space-y-1">
        <span>Concept</span>
        <input
          type="text"
          value={form.concept}
          onChange={e => setForm(f => ({ ...f, concept: e.target.value }))}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm px-3 py-2 mt-1"
          placeholder="e.g. useEffect stale closure"
        />
      </label>
      <label className="block text-xs font-medium text-[var(--color-text)] space-y-1">
        <span>Difficulty</span>
        <select
          value={form.difficulty}
          onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as SubmitForm['difficulty'] }))}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm px-3 py-2 mt-1"
        >
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-[var(--color-text)] space-y-1">
        <span>Buggy snippet</span>
        <textarea
          value={form.buggyCode}
          onChange={e => setForm(f => ({ ...f, buggyCode: e.target.value }))}
          rows={6}
          spellCheck={false}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--code-bg)] text-[var(--code-text)] font-mono text-[13px] px-3 py-2 mt-1"
          placeholder="// paste the buggy snippet here"
        />
      </label>
      <label className="block text-xs font-medium text-[var(--color-text)] space-y-1">
        <span>What's the bug? (optional explanation)</span>
        <textarea
          value={form.explanation}
          onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))}
          rows={2}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] text-sm px-3 py-2 mt-1"
        />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="primary" size="md" onClick={submit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit for review'}
        </Button>
      </div>
    </section>
  );
};
