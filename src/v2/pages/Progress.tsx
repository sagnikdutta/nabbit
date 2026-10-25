import { useMemo } from 'react';
import { V2Shell } from '../V2Shell';
import { V2Button, V2Panel, V2Progress } from '../components/primitives';
import { V2MasteryPanel } from '../components/DashboardCards';
import { useV2Theme } from '../useTheme';
import { useV2Library } from '../useLibrary';
import './pages.css';

/*
 * V2 Progress — the numbers behind the dashboard ring: totals, per-video
 * completion, the recall interval pipeline and per-concept Elo mastery.
 */

const INTERVALS = [1, 3, 7, 14, 30];

export default function V2ProgressPage() {
  const [theme, toggleTheme] = useV2Theme();
  const { loading, cards, recallItems, stats, shell } = useV2Library();

  const drills = useMemo(() => recallItems.reduce((n, r) => n + r.history.length, 0), [recallItems]);
  const concepts = useMemo(() => new Set(recallItems.map(r => r.concept)).size, [recallItems]);
  const accuracy = useMemo(() => {
    const all = recallItems.flatMap(r => r.history);
    return all.length ? Math.round((all.filter(a => a.correct).length / all.length) * 100) : 0;
  }, [recallItems]);
  const pipeline = useMemo(
    () => INTERVALS.map(d => ({ d, n: recallItems.filter(r => r.interval === d).length })),
    [recallItems],
  );
  const byVideo = useMemo(() => [...cards].sort((a, b) => b.progress - a.progress), [cards]);

  return (
    <V2Shell
      activeNav="Progress"
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
          <h1>Progress</h1>
          <div className="spacer" />
          <V2Button variant="secondary" size="lg" href="/v2/recall">Open recall</V2Button>
        </header>

        <V2Panel>
          <div className="v2-prog-stats">
            <div className="v2-prog-stat"><strong>{loading ? '–' : cards.length}</strong><span>Videos</span></div>
            <div className="v2-prog-stat"><strong>{loading ? '–' : drills}</strong><span>Drills completed</span></div>
            <div className="v2-prog-stat"><strong>{loading ? '–' : concepts}</strong><span>Concepts learned</span></div>
            <div className="v2-prog-stat"><strong>{loading ? '–' : stats.masteredCount}</strong><span>Concepts mastered</span></div>
            <div className="v2-prog-stat"><strong>{loading ? '–' : `${accuracy}%`}</strong><span>Accuracy</span></div>
            <div className="v2-prog-stat"><strong>{loading ? '–' : `${Math.round(stats.revisitRate)}%`}</strong><span>Revisit rate</span></div>
          </div>
        </V2Panel>

        <div className="v2-prog-cols">
          <V2Panel title="Videos">
            {loading ? (
              <p className="v2-muted v2-small" style={{ margin: 0 }}>Loading…</p>
            ) : byVideo.length === 0 ? (
              <p className="v2-muted v2-small" style={{ margin: 0 }}>
                No videos yet. <a href="/v2/import" style={{ color: 'var(--purple)' }}>Import one</a> to start tracking.
              </p>
            ) : (
              <div className="v2-prog-videos">
                {byVideo.map(c => (
                  <div key={c.video.id} className="v2-prog-video">
                    <div className="top">
                      <strong>{c.video.title}</strong>
                      <span>{c.drillsDone} / {c.drillsTotal} drills</span>
                    </div>
                    <V2Progress value={c.progress} label={`${c.video.title} progress`} />
                  </div>
                ))}
              </div>
            )}
          </V2Panel>

          <div style={{ display: 'grid', gap: 16 }}>
            <V2Panel title="Retention pipeline">
              <div className="v2-prog-pipeline">
                {pipeline.map(p => (
                  <div key={p.d} className="step"><span>{p.d}-day interval</span><strong>{p.n}</strong></div>
                ))}
                <div className="step"><span>Due now</span><strong>{stats.dueCount}</strong></div>
                <div className="step"><span>At risk</span><strong>{stats.atRiskCount}</strong></div>
              </div>
            </V2Panel>
            <V2MasteryPanel />
          </div>
        </div>
      </div>
    </V2Shell>
  );
}
