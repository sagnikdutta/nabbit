import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { Challenge, Video } from '../../lib/types';
import { V2Shell } from '../V2Shell';
import { V2Button, V2Panel } from '../components/primitives';
import { useV2Theme } from '../useTheme';
import { useV2ShellStats } from '../useShellData';
import './pages.css';

/*
 * V2 Import Video — dedicated importer. Same backend as the Dashboard hero
 * (api.generateFromYouTubeUrl: Gemini on the server when configured, template
 * fallback otherwise), but with in-flight status, error detail and a result
 * summary instead of a toast. The API has no progress events, so the in-flight
 * state is an indeterminate bar plus an elapsed-seconds counter.
 */

type Result = { video: Video; challenges: Challenge[]; source: string };

export default function V2ImportPage() {
  const [theme, toggleTheme] = useV2Theme();
  const shell = useV2ShellStats();
  const [url, setUrl] = useState('');
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || busy) {
      if (!trimmed) setError('Paste a YouTube link first.');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setElapsed(0);
    const started = Date.now();
    timer.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    try {
      const res = await api.generateFromYouTubeUrl(trimmed, topic.trim() || undefined);
      setResult(res);
      setUrl('');
      setTopic('');
    } catch (err: any) {
      setError(err?.message || 'Could not generate drills from that URL.');
    } finally {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
      setBusy(false);
    }
  };

  const first = result?.challenges[0];

  return (
    <V2Shell
      activeNav="Import Video"
      theme={theme}
      onToggleTheme={toggleTheme}
      showSearch={false}
      streak={shell.streak}
      xp={shell.xp}
      level={shell.level}
      xpProgress={shell.xpProgress}
    >
      <div className="v2-simple-page">
        <header className="v2-simple-head">
          <h1>Import a video</h1>
        </header>
        <p className="v2-simple-sub">
          Paste a YouTube tutorial and Nabbit builds hands-on drills from it. Generated drills are
          saved to your library in this browser.
        </p>

        <V2Panel>
          <form className="v2-import-form" onSubmit={submit}>
            <label>
              YouTube link or video ID
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                disabled={busy}
                autoFocus
              />
            </label>
            <label>
              Topic hint <span className="v2-muted">(optional)</span>
              <input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. React state, async/await"
                disabled={busy}
              />
            </label>
            <div className="v2-import-actions">
              <V2Button type="submit" size="lg" disabled={busy}>
                {busy ? 'Generating…' : 'Create drills →'}
              </V2Button>
              <V2Button
                variant="link"
                disabled={busy}
                onClick={() => setUrl('https://www.youtube.com/watch?v=Ke90Tje7VS0')}
              >
                Try an example video
              </V2Button>
            </div>
          </form>
        </V2Panel>

        {busy && (
          <V2Panel>
            <div className="v2-import-status" role="status" aria-live="polite">
              <strong>Generating drills… {elapsed}s</strong>
              <div className="v2-import-bar" />
              <span className="v2-small v2-muted">
                This can take 10–30 seconds when AI generation is on. Falls back to a template pack if
                the server can't reach the video.
              </span>
            </div>
          </V2Panel>
        )}

        {error && (
          <div className="v2-import-error" role="alert">
            <strong>Import failed</strong>
            <span>{error}</span>
          </div>
        )}

        {result && (
          <V2Panel title={`Added “${result.video.title}”`}>
            <div className="v2-import-result">
              <span className="v2-small v2-muted">
                {result.challenges.length} drill{result.challenges.length === 1 ? '' : 's'} ·{' '}
                {result.source === 'template' ? 'template fallback (no AI generation available)' : `source: ${result.source}`}
              </span>
              <ul>
                {result.challenges.map(c => <li key={c.id}>{c.concept}</li>)}
              </ul>
              <div className="v2-import-actions">
                {first && (
                  <V2Button size="lg" href={`/v2/challenge/${encodeURIComponent(first.id)}`}>
                    Start first drill →
                  </V2Button>
                )}
                <V2Button variant="secondary" size="lg" href="/v2/library">Open library</V2Button>
              </div>
            </div>
          </V2Panel>
        )}
      </div>
    </V2Shell>
  );
}
