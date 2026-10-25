import { useCallback, useEffect, useState } from 'react';
import { Plus, ThumbsUp, Users, CheckCircle2, Clock, X } from 'lucide-react';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { V2Shell } from '../V2Shell';
import { useV2Theme } from '../useTheme';
import './community.css';

/*
 * V2 Community drafts — port of V1 CommunityScreen onto V2Shell.
 * Anyone can view queued + published drafts; signed-in users can upvote
 * (upvote_community_draft RPC) and submit new drafts (submit_community_draft
 * RPC). Auto-publishes once a draft hits its Elo-scaled threshold
 * (3 / 5 / 10 upvotes) — see supabase/migrations/0009_community_drafts.sql.
 */

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

type SubmitForm = {
  concept: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  buggyCode: string;
  explanation: string;
};

export default function V2CommunityPage() {
  const [theme, toggleTheme] = useV2Theme();
  const [signedIn, setSignedIn] = useState(() => Boolean(api.getCurrentUser()));
  const [rows, setRows] = useState<DraftRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [upvoting, setUpvoting] = useState<string | null>(null);

  useEffect(() => api.onAuthChange(u => setSignedIn(Boolean(u))), []);

  const refresh = useCallback(() => {
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
          setRows((data as DraftRow[] | null) ?? []);
        },
        (e: unknown) => setErr(String((e as any)?.message || e)),
      );
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleUpvote = async (id: string) => {
    if (!signedIn || !supabase) { window.location.href = '/v2/auth'; return; }
    setUpvoting(id);
    try {
      const { data } = await supabase.rpc('upvote_community_draft', { draft_id: id });
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        // Hotfix 0010 renamed the return columns with an _out suffix to
        // dodge a PL/pgSQL variable/column collision; tolerate both shapes.
        const upvotes = Number((row as any).upvotes_out ?? (row as any).upvotes ?? 0);
        const status = ((row as any).status_out ?? (row as any).status) as DraftRow['status'];
        setRows(prev => prev
          ? prev.map(r => r.id === id ? { ...r, upvotes, status } : r)
          : prev);
      }
    } finally {
      setUpvoting(null);
    }
  };

  return (
    <V2Shell
      activeNav="Community"
      theme={theme}
      onToggleTheme={toggleTheme}
      showSearch={false}
    >
      <div className="v2-community">
        <header className="v2-comm-header">
          <h1><Users size={20} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--purple)' }} /> Community drafts</h1>
          {rows && <span className="count">{rows.length}</span>}
          <div className="spacer" />
          {signedIn ? (
            <button
              type="button"
              className={`v2-comm-header-cta${showSubmit ? ' secondary' : ''}`}
              onClick={() => setShowSubmit(v => !v)}
            >
              {showSubmit ? <X size={13} /> : <Plus size={13} />}
              {showSubmit ? 'Cancel' : 'Submit a drill'}
            </button>
          ) : (
            <a className="v2-comm-header-cta" href="/v2/auth">Sign in to submit</a>
          )}
        </header>

        <p className="v2-comm-sub">
          Community-submitted drills enter a queue, collect upvotes, and auto-publish once they
          hit the submitter's Elo-scaled threshold (3 / 5 / 10 upvotes).
        </p>

        {showSubmit && signedIn && (
          <SubmitDraftForm onDone={() => { setShowSubmit(false); refresh(); }} />
        )}

        {err ? (
          <section className="v2-comm-error">{err}</section>
        ) : rows === null ? (
          <section className="v2-comm-empty">Loading drafts…</section>
        ) : rows.length === 0 ? (
          <section className="v2-comm-empty">
            Nothing in the queue yet. {signedIn ? 'Submit the first community drill.' : 'Sign in to submit the first one.'}
          </section>
        ) : (
          <div className="v2-comm-list">
            {rows.map(r => (
              <article key={r.id} className="v2-comm-draft">
                <div>
                  <h3>{r.draft.concept || '(untitled draft)'}</h3>
                  <div className="meta">
                    {r.draft.difficulty && <span>{r.draft.difficulty}</span>}
                    <span className={`status ${r.status}`}>
                      {r.status === 'published'
                        ? (<><CheckCircle2 size={11} /> Published</>)
                        : (<><Clock size={11} /> Queued</>)}
                    </span>
                  </div>
                  {r.draft.explanation && <p className="excerpt">{r.draft.explanation}</p>}
                </div>
                <button
                  type="button"
                  className="v2-comm-upvote"
                  onClick={() => handleUpvote(r.id)}
                  disabled={upvoting === r.id}
                  title={signedIn ? 'Upvote this draft' : 'Sign in to upvote'}
                >
                  <ThumbsUp size={13} /> {r.upvotes}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </V2Shell>
  );
}

function SubmitDraftForm({ onDone }: { onDone: () => void }) {
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
      setErr('Concept and buggy snippet are required.');
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
          // Full Challenge shape — fixOptions / correctOption are left to a
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
    <section className="v2-comm-submit">
      <h2>New community drill</h2>
      {err && <div className="v2-comm-error">{err}</div>}
      <div className="v2-comm-field">
        <label htmlFor="v2-comm-concept">Concept</label>
        <input
          id="v2-comm-concept"
          type="text"
          value={form.concept}
          onChange={e => setForm(f => ({ ...f, concept: e.target.value }))}
          placeholder="e.g. useEffect stale closure"
        />
      </div>
      <div className="v2-comm-field">
        <label htmlFor="v2-comm-difficulty">Difficulty</label>
        <select
          id="v2-comm-difficulty"
          value={form.difficulty}
          onChange={e => setForm(f => ({ ...f, difficulty: e.target.value as SubmitForm['difficulty'] }))}
        >
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </select>
      </div>
      <div className="v2-comm-field">
        <label htmlFor="v2-comm-code">Buggy snippet</label>
        <textarea
          id="v2-comm-code"
          className="code"
          rows={7}
          spellCheck={false}
          value={form.buggyCode}
          onChange={e => setForm(f => ({ ...f, buggyCode: e.target.value }))}
          placeholder={'// paste the buggy snippet here'}
        />
      </div>
      <div className="v2-comm-field">
        <label htmlFor="v2-comm-explain">What's the bug? <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional explanation)</span></label>
        <textarea
          id="v2-comm-explain"
          rows={2}
          value={form.explanation}
          onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))}
        />
      </div>
      <div className="v2-comm-submit-actions">
        <button type="button" className="primary" disabled={submitting} onClick={submit}>
          {submitting ? 'Submitting…' : 'Submit for review'}
        </button>
      </div>
    </section>
  );
}
