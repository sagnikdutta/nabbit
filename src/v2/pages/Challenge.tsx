import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Lightbulb,
  MousePointerClick,
  Crosshair,
  ListOrdered,
  Pencil,
  GitPullRequest,
  Ghost,
  Lock,
  ChevronUp,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Challenge, Video, AttemptInput, Confidence, ChallengeFormat, PRO_FORMATS, RecallStats } from '../../lib/types';
import { visibleFormats, grade } from '../../lib/grading';
import { supabase } from '../../lib/supabase';
import { V2Shell } from '../V2Shell';
import { V2Button, V2Card } from '../components/primitives';
import { useV2Theme } from '../useTheme';
import './challenge.css';

/*
 * V2 Challenge page — Bug Hunt Drill.
 * Reads the drill id from /v2/challenge/<id>, loads challenge + video via
 * the shared api layer, and plays all seven Phase 8 formats:
 *   spot-fix, locate-then-fix, rank-fixes, blind-fix, diff-review,
 *   impostor (Pro), red-herring (Pro).
 *
 * Grading, SRS and Elo pipeline live in api.submitAttempt / grading.ts
 * — identical to V1. Trial (signed-out) users grade locally.
 */

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

const FORMAT_META: Record<
  ChallengeFormat,
  { label: string; icon: typeof MousePointerClick; hint: string }
> = {
  'spot-fix':        { label: 'Spot-fix',     icon: MousePointerClick, hint: 'Pick the correct fix.' },
  'locate-then-fix': { label: 'Locate + fix', icon: Crosshair,         hint: 'Pick the buggy line, then the fix.' },
  'rank-fixes':      { label: 'Rank fixes',   icon: ListOrdered,       hint: 'Order fixes worst → best.' },
  'blind-fix':       { label: 'Blind fix',    icon: Pencil,            hint: 'Write the patch yourself.' },
  'diff-review':     { label: 'Diff review',  icon: GitPullRequest,    hint: 'Approve, request changes, or comment.' },
  'impostor':        { label: 'Impostor',     icon: Ghost,             hint: 'Pro — one of the fixes is a decoy.' },
  'red-herring':     { label: 'Red herring',  icon: Crosshair,         hint: 'Pro — locate the real bug through a decoy.' },
};

// Session combo survives the full-page navigations between drills (V1 kept it
// in App state); sessionStorage scopes it to the tab.
const COMBO_KEY = 'nabbit.v2.combo';
function readSessionCombo(): number {
  try {
    const n = Number(window.sessionStorage.getItem(COMBO_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}
function writeSessionCombo(n: number): void {
  try {
    window.sessionStorage.setItem(COMBO_KEY, String(Math.max(0, n)));
  } catch {
    /* storage unavailable — combo just resets per drill */
  }
}

function readChallengeIdFromPath(): string | null {
  const m = window.location.pathname.match(/^\/v2\/challenge\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

type Phase = 'answering' | 'revealed';
type Verdict = 'approve' | 'request-changes' | 'comment';
type RevealState = {
  isCorrect: boolean;
  explanation: string;
  score: number;
  comboAfter: number;
  newRating?: number;
  eloDelta?: number;
};

export default function V2ChallengePage() {
  const [theme, toggleTheme] = useV2Theme();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [allInVideo, setAllInVideo] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [stats, setStats] = useState<RecallStats | null>(null);
  const [totalXp, setTotalXp] = useState(0);

  const [format, setFormat] = useState<ChallengeFormat>('spot-fix');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [rankOrder, setRankOrder] = useState<number[]>([]);
  const [patch, setPatch] = useState<string>('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  const [confidence, setConfidence] = useState<Confidence>('sure');
  const [phase, setPhase] = useState<Phase>('answering');
  const [reveal, setReveal] = useState<RevealState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const startedAt = useRef<number>(Date.now());

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };
  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  // Fetch public.users.is_pro once per session so Impostor/Red-herring
  // unlock for Pro users. Same lookup V1 App.tsx uses.
  useEffect(() => {
    const user = api.getCurrentUser();
    if (!user || user.provider !== 'supabase' || !supabase) {
      setIsPro(false);
      return;
    }
    let alive = true;
    supabase.from('users').select('is_pro').eq('id', user.id).maybeSingle()
      .then(
        ({ data }) => { if (alive) setIsPro(Boolean((data as any)?.is_pro)); },
        () => { if (alive) setIsPro(false); },
      );
    return () => { alive = false; };
  }, []);

  // Load challenge + video + sibling challenges + topbar stats.
  useEffect(() => {
    let alive = true;
    const id = readChallengeIdFromPath();
    if (!id) { setLoading(false); setNotFound(true); return; }
    (async () => {
      try {
        const [videos, dash] = await Promise.all([api.getVideos(), api.getRecallDashboard()]);
        if (alive) {
          setStats(dash.stats);
          setTotalXp((dash.allItems || []).reduce(
            (n, r) => n + r.history.filter(a => a.correct).length * 100, 0,
          ));
        }
        for (const v of videos) {
          const list = await api.getVideoChallenges(v.id);
          const match = list.find(c => c.id === id);
          if (match) {
            if (!alive) return;
            setChallenge(match);
            setVideo(v);
            setAllInVideo(list);
            setLoading(false);
            startedAt.current = Date.now();
            return;
          }
        }
        if (alive) { setNotFound(true); setLoading(false); }
      } catch {
        if (alive) { setNotFound(true); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, []);

  const supportedFormats = useMemo(
    () => (challenge ? visibleFormats(challenge) : ['spot-fix' as ChallengeFormat]),
    [challenge],
  );
  const identityOrder = useMemo(
    () => (challenge ? challenge.fixOptions.map((_, i) => i) : []),
    [challenge?.id],
  );

  // Reset drill-level state whenever the challenge changes (e.g. Next drill).
  useEffect(() => {
    if (!challenge) return;
    setFormat(supportedFormats[0]);
    setSelectedOption(null);
    setSelectedLine(null);
    setRankOrder(identityOrder);
    setPatch('');
    setVerdict(null);
    setConfidence('sure');
    setPhase('answering');
    setReveal(null);
    setIsSubmitting(false);
    setShowHint(false);
    startedAt.current = Date.now();
  }, [challenge?.id]);

  // Reset answer state when the user switches format mid-drill.
  useEffect(() => {
    setSelectedOption(null);
    setSelectedLine(null);
    setRankOrder(identityOrder);
    setPatch('');
    setVerdict(null);
    startedAt.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);

  const locateMode = format === 'locate-then-fix' || format === 'red-herring';
  const impostorOptionCount =
    challenge && format === 'impostor'
      ? challenge.fixOptions.length + (challenge.impostorOption ? 1 : 0)
      : challenge?.fixOptions.length ?? 0;

  const canSubmit = (() => {
    if (!challenge) return false;
    switch (format) {
      case 'locate-then-fix':
      case 'red-herring':
        return selectedLine !== null && selectedOption !== null;
      case 'rank-fixes':
        return rankOrder.length === challenge.fixOptions.length;
      case 'blind-fix':
        return patch.trim().length > 0;
      case 'diff-review':
        if (verdict === null) return false;
        if (verdict === 'request-changes') return selectedOption !== null;
        return true;
      default:
        return selectedOption !== null;
    }
  })();

  const handleSubmit = async () => {
    if (!challenge || !canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    const timeMs = Math.max(0, Date.now() - startedAt.current);
    let input: AttemptInput;
    switch (format) {
      case 'locate-then-fix':
        input = { format: 'locate-then-fix', line: selectedLine as number, chosen: selectedOption as number };
        break;
      case 'red-herring':
        input = { format: 'red-herring', chosenLine: selectedLine as number, chosen: selectedOption as number };
        break;
      case 'rank-fixes':
        input = { format: 'rank-fixes', order: rankOrder };
        break;
      case 'blind-fix':
        input = { format: 'blind-fix', patch };
        break;
      case 'diff-review':
        input = verdict === 'request-changes'
          ? { format: 'diff-review', verdict, chosen: selectedOption as number }
          : { format: 'diff-review', verdict: verdict as 'approve' | 'comment' };
        break;
      case 'impostor':
        input = { format: 'impostor', chosen: selectedOption as number };
        break;
      default:
        input = { format: 'spot-fix', chosen: selectedOption as number };
    }
    try {
      const currentUser = api.getCurrentUser();
      if (currentUser) {
        const isBoss = new URLSearchParams(window.location.search).get('boss') === '1';
        const res = await api.submitAttempt(challenge.id, input, {
          confidence,
          timeMs,
          combo: readSessionCombo(),
          isBoss,
        });
        writeSessionCombo(res.comboAfter);
        setReveal({
          isCorrect: res.correct,
          explanation: res.explanation,
          score: res.score,
          comboAfter: res.comboAfter,
          newRating: res.newRating,
          eloDelta: res.eloDelta,
        });
      } else {
        const g = grade(challenge, input);
        setReveal({
          isCorrect: g.correct,
          explanation: challenge.explanation,
          score: g.correct ? 100 : -40,
          comboAfter: 0,
        });
      }
      setPhase('revealed');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      showToast(err?.message || 'Could not submit — try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard: 1-N pick option, F cycle format, Enter submit.
  useEffect(() => {
    if (!challenge || phase !== 'answering') return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        if (format === 'rank-fixes' || format === 'blind-fix') return;
        if (format === 'diff-review' && verdict !== 'request-changes') return;
        if (locateMode && selectedLine === null) return;
        const idx = parseInt(e.key, 10) - 1;
        const upperBound = format === 'impostor' ? impostorOptionCount : challenge.fixOptions.length;
        if (idx >= upperBound) return;
        setSelectedOption(idx);
      } else if (e.key === 'Enter' && canSubmit) {
        handleSubmit();
      } else if ((e.key === 'f' || e.key === 'F') && supportedFormats.length > 1) {
        const i = supportedFormats.indexOf(format);
        const next = supportedFormats[(i + 1) % supportedFormats.length];
        const locked = PRO_FORMATS.includes(next) && !isPro;
        if (!locked) setFormat(next);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [challenge, phase, format, selectedOption, selectedLine, rankOrder, patch, verdict, canSubmit, supportedFormats, locateMode, impostorOptionCount, isPro]);

  const handleNext = () => {
    if (!challenge) return;
    const idx = allInVideo.findIndex(c => c.id === challenge.id);
    const next = idx >= 0 && idx + 1 < allInVideo.length ? allInVideo[idx + 1] : null;
    window.location.href = next ? `/v2/challenge/${next.id}` : '/v2/';
  };

  const handleRetry = () => {
    setSelectedOption(null);
    setSelectedLine(null);
    setRankOrder(identityOrder);
    setPatch('');
    setVerdict(null);
    setPhase('answering');
    setReveal(null);
    startedAt.current = Date.now();
  };

  const handlePickFormat = (fmt: ChallengeFormat) => {
    const locked = PRO_FORMATS.includes(fmt) && !isPro;
    if (locked) {
      showToast(`${FORMAT_META[fmt].label} is a Pro format — unlock Pro to play.`);
      return;
    }
    setFormat(fmt);
  };

  const moveRank = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rankOrder.length) return;
    const next = rankOrder.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setRankOrder(next);
  };

  if (loading) {
    return (
      <V2Shell activeNav="Practice" theme={theme} onToggleTheme={toggleTheme} showSearch={false} toast={toast}>
        <div className="v2-loading">Loading drill…</div>
      </V2Shell>
    );
  }
  if (notFound || !challenge || !video) {
    return (
      <V2Shell activeNav="Practice" theme={theme} onToggleTheme={toggleTheme} showSearch={false} toast={toast}>
        <div className="v2-empty">
          Couldn't find that drill.{' '}
          <V2Button variant="link" href="/v2/">Back to dashboard</V2Button>
        </div>
      </V2Shell>
    );
  }

  const buggySet = new Set(challenge.buggyLines ?? []);
  const codeLines = challenge.buggyCode.split('\n');

  const shellStreak = stats?.currentStreak ?? 0;
  const shellLevel = stats ? Math.max(1, Math.floor(stats.totalSolved / 10) + 1) : 1;
  const shellXpProgress = stats ? (stats.totalSolved % 10) / 10 : 0;

  // Options rendered by MCQ-like formats.
  const optionList = (() => {
    const base = challenge.fixOptions.slice();
    if (format === 'impostor' && challenge.impostorOption) base.push(challenge.impostorOption);
    return base;
  })();

  return (
    <V2Shell
      activeNav="Practice"
      theme={theme}
      onToggleTheme={toggleTheme}
      showSearch={false}
      toast={toast}
      streak={shellStreak}
      xp={totalXp}
      level={shellLevel}
      xpProgress={shellXpProgress}
    >
      <button
        type="button"
        className="v2-challenge-back"
        onClick={() => (window.location.href = '/v2/')}
      >
        <ArrowLeft size={14} /> Back to dashboard
      </button>

      <div className="v2-challenge">
        <section>
          <div className="v2-challenge-header">
            <span className="v2-challenge-concept-chip">◎ {challenge.concept}</span>
            <span className={`v2-challenge-chip diff-${challenge.difficulty.toLowerCase()}`}>
              {challenge.difficulty}
            </span>
            <span className="v2-challenge-chip">
              {challenge.timestampFormatted} · {video.title}
            </span>
          </div>

          <h1 className="v2-challenge-title">{challenge.chapter}</h1>

          {/* ---- Format chooser ---- */}
          {supportedFormats.length > 1 && phase === 'answering' && (
            <div className="v2-format-chooser" role="group" aria-label="Format">
              <span className="label">Format:</span>
              {supportedFormats.map(fmt => {
                const meta = FORMAT_META[fmt];
                const Ico = meta.icon;
                const selected = fmt === format;
                const locked = PRO_FORMATS.includes(fmt) && !isPro;
                return (
                  <button
                    key={fmt}
                    type="button"
                    className={[
                      selected ? 'active' : '',
                      locked ? 'locked' : '',
                    ].filter(Boolean).join(' ')}
                    title={locked ? `${meta.hint} (Pro — unlock to play)` : meta.hint}
                    onClick={() => handlePickFormat(fmt)}
                    aria-pressed={selected}
                  >
                    <Ico size={13} />
                    <span>{meta.label}</span>
                    {locked && <Lock size={11} className="lock-ico" />}
                  </button>
                );
              })}
              <span className="hint">Press F to cycle</span>
            </div>
          )}

          {/* ---- Reveal ---- */}
          {phase === 'revealed' && reveal && (
            <div className="v2-reveal">
              <div className={`v2-reveal-verdict ${reveal.isCorrect ? 'correct' : 'incorrect'}`}>
                {reveal.isCorrect ? <Check size={20} /> : <X size={20} />}
                {reveal.isCorrect ? 'Nice catch!' : 'Not quite — here’s the fix.'}
              </div>
              <p className="v2-reveal-explain">{reveal.explanation}</p>
              <div>
                <span className="v2-reveal-score">
                  Score: <strong>{reveal.score > 0 ? `+${reveal.score}` : reveal.score}</strong>
                </span>
                {typeof reveal.eloDelta === 'number' && reveal.eloDelta !== 0 && (
                  <span className="v2-reveal-score">
                    Elo: <strong>{reveal.eloDelta > 0 ? `+${reveal.eloDelta}` : reveal.eloDelta}</strong>
                    {typeof reveal.newRating === 'number' ? ` → ${reveal.newRating}` : ''}
                  </span>
                )}
                {reveal.comboAfter > 1 && (
                  <span className="v2-reveal-score">
                    Combo: <strong>×{reveal.comboAfter}</strong>
                  </span>
                )}
              </div>
              <div className="v2-reveal-actions">
                <V2Button onClick={handleNext}>
                  Next drill <ArrowRight size={14} />
                </V2Button>
                <V2Button variant="secondary" onClick={handleRetry}>Try again</V2Button>
                <V2Button variant="secondary" href="/v2/">Back to dashboard</V2Button>
              </div>
            </div>
          )}

          {/* ---- Format-specific preamble banners ---- */}
          {phase === 'answering' && locateMode && (
            <div className={`v2-step-banner${selectedLine !== null ? ' done' : ''}`}>
              {selectedLine !== null ? <Check size={14} className="ico" /> : <Crosshair size={14} className="ico" />}
              <span>
                {selectedLine !== null
                  ? (<>Line <strong style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{selectedLine}</strong> marked as the suspect — now pick the fix below.</>)
                  : (<><strong>Step 1:</strong> click the suspect line in the code.</>)}
              </span>
            </div>
          )}
          {phase === 'answering' && format === 'red-herring' && (
            <div className="v2-step-banner warn">
              <Crosshair size={14} className="ico" />
              <span><strong>Red herring:</strong> one suspicious line is a decoy. A wrong line is a full miss (no partial credit).</span>
            </div>
          )}
          {phase === 'answering' && format === 'rank-fixes' && (
            <div className="v2-step-banner">
              <ListOrdered size={14} className="ico" />
              <span>Rank the fixes <strong>worst → best</strong> with the arrows. Any order submits.</span>
            </div>
          )}
          {phase === 'answering' && format === 'blind-fix' && (
            <div className="v2-step-banner">
              <Pencil size={14} className="ico" />
              <span><strong>Blind fix:</strong> write the corrected code yourself. Whitespace and punctuation are normalised.</span>
            </div>
          )}
          {phase === 'answering' && format === 'diff-review' && (
            <div className="v2-step-banner">
              <GitPullRequest size={14} className="ico" />
              <span><strong>Diff review:</strong> treat the snippet as a pull-request. Approve, request changes, or leave a comment.</span>
            </div>
          )}
          {phase === 'answering' && format === 'impostor' && (
            <div className="v2-step-banner warn">
              <Ghost size={14} className="ico" />
              <span><strong>Impostor round:</strong> one fix <em>looks</em> correct but is subtly wrong. {impostorOptionCount} options this round.</span>
            </div>
          )}

          {phase === 'answering' && !locateMode && format !== 'rank-fixes' && format !== 'blind-fix' && format !== 'diff-review' && format !== 'impostor' && (
            <p className="v2-challenge-prompt">
              Review the snippet below. One of the highlighted lines contains a bug. Pick the fix
              that correctly resolves it.
            </p>
          )}

          {/* ---- Code viewer ---- */}
          <div className="v2-code" aria-label="Buggy code">
            <div className="v2-code-head">
              <span className="filename">{challenge.filename}</span>
              <span className="filetype">{challenge.fileType}</span>
            </div>
            <pre className="v2-code-body">
              {codeLines.map((line, i) => {
                const n = i + 1;
                const buggy = buggySet.has(n);
                const clickable = phase === 'answering' && locateMode;
                const picked = locateMode && selectedLine === n;
                return (
                  <div
                    key={i}
                    className={[
                      'v2-code-line',
                      buggy ? 'buggy' : '',
                      clickable ? 'clickable' : '',
                      picked ? 'picked' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => {
                      if (clickable) setSelectedLine(n);
                    }}
                  >
                    <span className="ln">{n}</span>
                    <span className="code-text">{line || ' '}</span>
                  </div>
                );
              })}
            </pre>
          </div>

          {/* ---- Per-format answer panel ---- */}
          {phase === 'answering' && (format === 'spot-fix' || format === 'impostor' || locateMode) && (
            <>
              <div className="v2-options-head">
                <h3>
                  {locateMode ? 'Step 2: pick the correct fix' : 'Pick the correct fix'}
                </h3>
                <span className="hint">Press 1–{Math.min(5, format === 'impostor' ? impostorOptionCount : challenge.fixOptions.length)}, Enter to submit</span>
              </div>
              <div
                className={`v2-options${locateMode && selectedLine === null ? ' locked' : ''}`}
                role="radiogroup"
                aria-label="Fix options"
              >
                {optionList.map((opt, i) => {
                  const revealed = false;
                  const isSelected = selectedOption === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={['v2-option', isSelected ? 'selected' : ''].filter(Boolean).join(' ')}
                      onClick={() => (locateMode && selectedLine === null ? null : setSelectedOption(i))}
                      role="radio"
                      aria-checked={isSelected}
                      disabled={revealed}
                    >
                      <span className="v2-option-badge">{OPTION_LETTERS[i]}</span>
                      <span>{opt}</span>
                      <span className="v2-option-kbd">[{i + 1}]</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {phase === 'answering' && format === 'rank-fixes' && (
            <>
              <div className="v2-options-head">
                <h3>Your ranking (position 1 = worst, position {rankOrder.length} = best)</h3>
              </div>
              <ol className="v2-rank">
                {rankOrder.map((optIdx, i) => (
                  <li key={optIdx} className="v2-rank-item">
                    <div className="v2-rank-pos">{i + 1}</div>
                    <div>
                      <span className="letter">[{OPTION_LETTERS[optIdx]}]</span>
                      {challenge.fixOptions[optIdx]}
                    </div>
                    <div className="v2-rank-arrows">
                      <button type="button" aria-label={`Move option ${OPTION_LETTERS[optIdx]} up`}
                        disabled={i === 0} onClick={() => moveRank(i, -1)}>
                        <ChevronUp size={14} />
                      </button>
                      <button type="button" aria-label={`Move option ${OPTION_LETTERS[optIdx]} down`}
                        disabled={i === rankOrder.length - 1} onClick={() => moveRank(i, 1)}>
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}

          {phase === 'answering' && format === 'blind-fix' && (
            <>
              <div className="v2-options-head">
                <h3>
                  Your fix (lines{' '}
                  {(challenge.buggyLines ?? []).join(', ')})
                </h3>
              </div>
              <textarea
                className="v2-blind-area"
                value={patch}
                onChange={e => setPatch(e.target.value)}
                spellCheck={false}
                placeholder={'// write the fixed code here'}
              />
              <p className="v2-blind-meta">
                {patch.trim().length} character{patch.trim().length === 1 ? '' : 's'}
              </p>
            </>
          )}

          {phase === 'answering' && format === 'diff-review' && (
            <>
              <div className="v2-options-head">
                <h3>Your verdict</h3>
              </div>
              <div className="v2-verdicts" role="radiogroup" aria-label="Verdict">
                <button type="button" className={`v2-verdict approve${verdict === 'approve' ? ' selected' : ''}`}
                  onClick={() => setVerdict('approve')} aria-pressed={verdict === 'approve'}>
                  <span className="top"><Check size={14} /> Approve</span>
                  <span className="hint">LGTM, ship it as proposed.</span>
                </button>
                <button type="button" className={`v2-verdict request-changes${verdict === 'request-changes' ? ' selected' : ''}`}
                  onClick={() => setVerdict('request-changes')} aria-pressed={verdict === 'request-changes'}>
                  <span className="top"><X size={14} /> Request changes</span>
                  <span className="hint">The patch is wrong — pick the correct fix below.</span>
                </button>
                <button type="button" className={`v2-verdict comment${verdict === 'comment' ? ' selected' : ''}`}
                  onClick={() => setVerdict('comment')} aria-pressed={verdict === 'comment'}>
                  <span className="top"><MessageSquare size={14} /> Comment</span>
                  <span className="hint">Neither clearly correct nor broken — leave a note.</span>
                </button>
              </div>

              {verdict === 'request-changes' && (
                <>
                  <div className="v2-options-head">
                    <h3>Which fix would unblock the review?</h3>
                    <span className="hint">Press 1–4, Enter to submit</span>
                  </div>
                  <div className="v2-options" role="radiogroup" aria-label="Fix options">
                    {challenge.fixOptions.map((opt, i) => (
                      <button key={i} type="button"
                        className={['v2-option', selectedOption === i ? 'selected' : ''].filter(Boolean).join(' ')}
                        onClick={() => setSelectedOption(i)}
                        role="radio" aria-checked={selectedOption === i}>
                        <span className="v2-option-badge">{OPTION_LETTERS[i]}</span>
                        <span>{opt}</span>
                        <span className="v2-option-kbd">[{i + 1}]</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {phase === 'answering' && (
            <div className="v2-submit-bar">
              <div className="v2-confidence" role="group" aria-label="Confidence">
                <span className="v2-confidence-label">Confidence:</span>
                {(['guess', 'sure', 'certain'] as Confidence[]).map(c => (
                  <button key={c} type="button" className={confidence === c ? 'active' : ''} onClick={() => setConfidence(c)}>
                    {c === 'guess' ? '🤔 Guess' : c === 'sure' ? '😎 Sure' : '🔥 Certain'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="v2-submit"
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? 'Submitting…' : (<>Submit <ArrowRight size={16} /></>)}
              </button>
            </div>
          )}
        </section>

        <aside className="v2-challenge-rail">
          <V2Card className="v2-rail-card">
            <h3>Drill info</h3>
            <div className="row"><span>Concept</span><strong>{challenge.concept}</strong></div>
            <div className="row"><span>Difficulty</span><strong>{challenge.difficulty}</strong></div>
            <div className="row"><span>Chapter</span><strong>{challenge.chapter}</strong></div>
            <div className="row"><span>From</span><strong>{video.channel}</strong></div>
            <div className="row"><span>Timestamp</span><strong>{challenge.timestampFormatted}</strong></div>
            <div className="row"><span>Format</span><strong>{FORMAT_META[format].label}</strong></div>
          </V2Card>

          <V2Card className="v2-rail-card">
            <h3>Need a hint?</h3>
            {!showHint ? (
              <button type="button" className="v2-hint-btn" onClick={() => setShowHint(true)}>
                💡 Give me a nudge
              </button>
            ) : (
              <div className="v2-hint-body">
                {challenge.hints?.conceptNudge || 'Look carefully at the highlighted lines above.'}
                {challenge.hints?.inspectionClue && (
                  <>
                    <br /><br />
                    <strong style={{ color: 'var(--purple)' }}>Where to look:</strong>{' '}
                    {challenge.hints.inspectionClue}
                  </>
                )}
              </div>
            )}
          </V2Card>

          <V2Card className="v2-rail-card">
            <h3>In this video</h3>
            {allInVideo.map(c => (
              <a
                key={c.id}
                href={`/v2/challenge/${encodeURIComponent(c.id)}`}
                className="row video-row"
                style={{
                  textDecoration: 'none',
                  color: c.id === challenge.id ? 'var(--purple)' : undefined,
                  fontWeight: c.id === challenge.id ? 700 : undefined,
                }}
              >
                <span>{c.timestampFormatted}</span>
                <strong style={{ color: 'inherit' }}>{c.concept}</strong>
              </a>
            ))}
          </V2Card>
        </aside>
      </div>
    </V2Shell>
  );
}
