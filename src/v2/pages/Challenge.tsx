import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X, Lightbulb } from 'lucide-react';
import { api } from '../../lib/api';
import { Challenge, Video, AttemptInput, Confidence } from '../../lib/types';
import { availableFormats, grade } from '../../lib/grading';
import { V2Shell } from '../V2Shell';
import { useV2Theme } from '../useTheme';
import './challenge.css';

/*
 * V2 Challenge page — "Bug Hunt Drill". Reads the challenge id from the
 * URL path (/v2/challenge/<id>), loads the challenge + video via the
 * shared api layer, and plays the Spot-fix (pick 1 of 4 fixes) format
 * end-to-end with an in-place reveal.
 *
 * Other formats on the same drill are intentionally scoped out of this
 * first pass — a notice in the right rail links to the classic view when
 * they're declared on the challenge. Full format router port is tracked
 * as follow-up work under B10 V2-B/2.
 *
 * The grading, SRS and Elo logic all live in api.submitAttempt / grading.ts,
 * so correctness, score, combo and Elo delta behave identically to V1.
 */

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

function readChallengeIdFromPath(): string | null {
  const m = window.location.pathname.match(/^\/v2\/challenge\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

type Phase = 'answering' | 'revealed';

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

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
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

  // Load challenge + its video + the other challenges in the same video.
  useEffect(() => {
    let alive = true;
    const id = readChallengeIdFromPath();
    if (!id) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    (async () => {
      try {
        const videos = await api.getVideos();
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
        if (alive) {
          setNotFound(true);
          setLoading(false);
        }
      } catch {
        if (alive) {
          setNotFound(true);
          setLoading(false);
        }
      }
    })();
    return () => { alive = false; };
  }, []);

  // Reset drill state whenever the challenge changes (e.g. "Next drill").
  useEffect(() => {
    if (!challenge) return;
    setSelectedOption(null);
    setConfidence('sure');
    setPhase('answering');
    setReveal(null);
    setIsSubmitting(false);
    setShowHint(false);
    startedAt.current = Date.now();
  }, [challenge?.id]);

  const supportedFormats = useMemo(
    () => (challenge ? availableFormats(challenge) : []),
    [challenge],
  );
  const hasAdvancedFormats = supportedFormats.some(f => f !== 'spot-fix');

  const handleSubmit = async () => {
    if (!challenge || selectedOption === null || isSubmitting) return;
    setIsSubmitting(true);
    const timeMs = Math.max(0, Date.now() - startedAt.current);
    const input: AttemptInput = { format: 'spot-fix', chosen: selectedOption };
    try {
      const currentUser = api.getCurrentUser();
      if (currentUser) {
        const res = await api.submitAttempt(challenge.id, input, { confidence, timeMs, combo: 0 });
        setReveal({
          isCorrect: res.correct,
          explanation: res.explanation,
          score: res.score,
          comboAfter: res.comboAfter,
          newRating: res.newRating,
          eloDelta: res.eloDelta,
        });
      } else {
        // Signed-out trial: grade locally without touching SRS/Elo.
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

  // Keyboard shortcuts: 1-4 pick option, Enter submits.
  useEffect(() => {
    if (!challenge || phase !== 'answering') return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < challenge.fixOptions.length) setSelectedOption(idx);
      } else if (e.key === 'Enter' && selectedOption !== null) {
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [challenge, phase, selectedOption]);

  const handleNext = () => {
    if (!challenge) return;
    const idx = allInVideo.findIndex(c => c.id === challenge.id);
    const next = idx >= 0 && idx + 1 < allInVideo.length ? allInVideo[idx + 1] : null;
    if (next) {
      window.location.href = `/v2/challenge/${next.id}`;
    } else {
      window.location.href = '/v2/';
    }
  };

  const handleRetry = () => {
    setSelectedOption(null);
    setPhase('answering');
    setReveal(null);
    startedAt.current = Date.now();
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
          <a href="/v2/" style={{ color: 'var(--purple)', fontWeight: 650 }}>Back to dashboard</a>
        </div>
      </V2Shell>
    );
  }

  const buggySet = new Set(challenge.buggyLines ?? []);
  const codeLines = challenge.buggyCode.split('\n');

  return (
    <V2Shell activeNav="Practice" theme={theme} onToggleTheme={toggleTheme} showSearch={false} toast={toast}>
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
                <button className="v2-primary" onClick={handleNext}>
                  Next drill <ArrowRight size={14} style={{ marginLeft: 4 }} />
                </button>
                <button className="v2-secondary" onClick={handleRetry}>
                  Try again
                </button>
                <a className="v2-secondary" href="/v2/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  Back to dashboard
                </a>
              </div>
            </div>
          )}

          {phase === 'answering' && (
            <p className="v2-challenge-prompt">
              Review the snippet below. One of the highlighted lines contains a bug. Pick the
              fix that correctly resolves it.
            </p>
          )}

          <div className="v2-code" aria-label="Buggy code">
            <div className="v2-code-head">
              <span className="filename">{challenge.filename}</span>
              <span className="filetype">{challenge.fileType}</span>
            </div>
            <pre className="v2-code-body">
              {codeLines.map((line, i) => {
                const n = i + 1;
                const buggy = buggySet.has(n);
                return (
                  <div key={i} className={`v2-code-line${buggy ? ' buggy' : ''}`}>
                    <span className="ln">{n}</span>
                    <span className="code-text">{line || ' '}</span>
                  </div>
                );
              })}
            </pre>
          </div>

          <div className="v2-options-head">
            <h3>Pick the correct fix</h3>
            <span className="hint">Press 1–4, Enter to submit</span>
          </div>
          <div className="v2-options" role="radiogroup" aria-label="Fix options">
            {challenge.fixOptions.map((opt, i) => {
              const revealed = phase === 'revealed';
              const isSelected = selectedOption === i;
              const isCorrectAnswer = revealed && i === challenge.correctOption;
              const isWrongPick = revealed && isSelected && i !== challenge.correctOption;
              return (
                <button
                  key={i}
                  type="button"
                  className={[
                    'v2-option',
                    !revealed && isSelected ? 'selected' : '',
                    isCorrectAnswer ? 'correct' : '',
                    isWrongPick ? 'incorrect' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => phase === 'answering' && setSelectedOption(i)}
                  disabled={phase === 'revealed'}
                  role="radio"
                  aria-checked={isSelected}
                >
                  <span className="v2-option-badge">
                    {revealed && isCorrectAnswer ? <Check size={16} /> :
                     revealed && isWrongPick ? <X size={16} /> :
                     OPTION_LETTERS[i]}
                  </span>
                  <span>{opt}</span>
                  <span className="v2-option-kbd">[{i + 1}]</span>
                </button>
              );
            })}
          </div>

          {phase === 'answering' && (
            <div className="v2-submit-bar">
              <div className="v2-confidence" role="group" aria-label="Confidence">
                <span className="v2-confidence-label">Confidence:</span>
                {(['guess', 'sure', 'certain'] as Confidence[]).map(c => (
                  <button
                    key={c}
                    type="button"
                    className={confidence === c ? 'active' : ''}
                    onClick={() => setConfidence(c)}
                  >
                    {c === 'guess' ? '🤔 Guess' : c === 'sure' ? '😎 Sure' : '🔥 Certain'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="v2-submit"
                onClick={handleSubmit}
                disabled={selectedOption === null || isSubmitting}
              >
                {isSubmitting ? 'Submitting…' : (<>Submit <ArrowRight size={16} /></>)}
              </button>
            </div>
          )}
        </section>

        <aside className="v2-challenge-rail">
          <div className="v2-rail-card">
            <h3>Drill info</h3>
            <div className="row"><span>Concept</span><strong>{challenge.concept}</strong></div>
            <div className="row"><span>Difficulty</span><strong>{challenge.difficulty}</strong></div>
            <div className="row"><span>Chapter</span><strong>{challenge.chapter}</strong></div>
            <div className="row"><span>From</span><strong>{video.channel}</strong></div>
            <div className="row"><span>Timestamp</span><strong>{challenge.timestampFormatted}</strong></div>
          </div>

          <div className="v2-rail-card">
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
          </div>

          {hasAdvancedFormats && (
            <div className="v2-rail-banner">
              This drill also supports{' '}
              <strong>{supportedFormats.filter(f => f !== 'spot-fix').length}</strong>{' '}
              other formats (locate-then-fix, rank-fixes, blind-fix…).{' '}
              <a href={`/v1/#/challenge/${encodeURIComponent(challenge.id)}`}>
                Open in classic view →
              </a>
            </div>
          )}

          <div className="v2-rail-card">
            <h3>In this video</h3>
            {allInVideo.map(c => (
              <a
                key={c.id}
                href={`/v2/challenge/${encodeURIComponent(c.id)}`}
                className="row"
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
          </div>
        </aside>
      </div>
    </V2Shell>
  );
}
