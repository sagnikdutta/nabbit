import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  Calendar,
  CheckCircle2,
  Flame,
  Play,
  TrendingUp,
  Clock,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Challenge, RecallItem, RecallStats, Video } from '../../lib/types';
import {
  getRemindersEnabled,
  setRemindersEnabled,
  getNotificationPermission,
  requestNotificationPermission,
  type PermissionState,
} from '../../lib/reminders';
import { V2Shell } from '../V2Shell';
import { useV2Theme } from '../useTheme';
import './recall.css';

/*
 * V2 Spaced Recall page — port of V1 RecallDashboardScreen onto the V2 Shell.
 *
 * Preserves every V1 behavior:
 *   - Four stat cards (revisit rate · streak · due today · active pipeline)
 *   - Due queue, each item linking to /v2/challenge/<id>
 *   - 1 / 3 / 7 / 14 / 30 day interval pipeline
 *   - At-risk list (overdue > 24h or last-attempt wrong)
 *   - Reminders toggle (browser notifications when due)
 *   - Time-travel dev strip (±days to simulate SRS resurfacing)
 *   - Demo reset
 *
 * Deferred to a follow-up PR:
 *   - MasteryList (per-concept Elo from Supabase concept_elo). V1 renders
 *     it above the fold for signed-in users; V2 will get a right-rail
 *     Mastery panel once we settle on its final V2 shape.
 */

type Dashboard = {
  dueItems: (RecallItem & { challenge: Challenge })[];
  allItems: (RecallItem & { challenge?: Challenge })[];
  stats: RecallStats;
};

const EMPTY_STATS: RecallStats = {
  revisitRate: 0,
  currentStreak: 0,
  totalSolved: 0,
  dueCount: 0,
  atRiskCount: 0,
  masteredCount: 0,
  simulatedOffsetDays: 0,
};

const INTERVAL_STAGES: Array<{ interval: 1 | 3 | 7 | 14 | 30; label: string; desc: string }> = [
  { interval: 1,  label: '1 Day',   desc: 'Initial recall' },
  { interval: 3,  label: '3 Days',  desc: 'Consolidation' },
  { interval: 7,  label: '7 Days',  desc: 'Deepening' },
  { interval: 14, label: '14 Days', desc: 'Retention' },
  { interval: 30, label: '30 Days', desc: 'Permanent intuition' },
];

export default function V2RecallPage() {
  const [theme, toggleTheme] = useV2Theme();
  const [dashboard, setDashboard] = useState<Dashboard>({ dueItems: [], allItems: [], stats: EMPTY_STATS });
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [offsetDays, setOffsetDays] = useState<number>(() => api.getSimulatedOffset());
  const [remindersOn, setRemindersOn] = useState<boolean>(getRemindersEnabled);
  const [notifyPermission, setNotifyPermission] = useState<PermissionState>(getNotificationPermission);
  const [toast, setToast] = useState<string | null>(null);

  const loadAll = async () => {
    const [vids, dash] = await Promise.all([api.getVideos(), api.getRecallDashboard()]);
    setVideos(vids);
    setDashboard(dash as Dashboard);
    setLoading(false);
  };

  useEffect(() => {
    loadAll().catch(() => setLoading(false));
  }, []);

  const flashToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  const handleOffset = async (days: number) => {
    api.setSimulatedOffset(days);
    setOffsetDays(days);
    await loadAll();
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all local progress? This clears attempts, recall items, and session state.')) return;
    await api.resetData();
    await loadAll();
    flashToast('Local progress reset.');
  };

  const handleToggleReminders = async () => {
    if (remindersOn) {
      setRemindersEnabled(false);
      setRemindersOn(false);
      flashToast('Reminders off.');
      return;
    }
    const perm = await requestNotificationPermission();
    setNotifyPermission(perm);
    if (perm === 'granted') {
      setRemindersEnabled(true);
      setRemindersOn(true);
      flashToast('Reminders enabled.');
    } else {
      setRemindersEnabled(false);
      setRemindersOn(false);
    }
  };

  const { dueItems, allItems, stats } = dashboard;
  const simulatedNow = Date.now() + offsetDays * 86_400_000;

  const buckets: Record<1 | 3 | 7 | 14 | 30, RecallItem[]> = {
    1:  allItems.filter(i => i.interval === 1),
    3:  allItems.filter(i => i.interval === 3),
    7:  allItems.filter(i => i.interval === 7),
    14: allItems.filter(i => i.interval === 14),
    30: allItems.filter(i => i.interval === 30),
  };

  const atRisk = allItems.filter(item => {
    const isOverdue = simulatedNow - item.nextReviewAt > 24 * 60 * 60 * 1000;
    const last = item.history[item.history.length - 1];
    const failedRecently = last && !last.correct;
    return isOverdue || failedRecently;
  });

  const canToggle = notifyPermission !== 'unsupported' && notifyPermission !== 'denied';
  const reminderCopy = (() => {
    if (notifyPermission === 'unsupported') return 'This browser does not support notifications.';
    if (notifyPermission === 'denied') return 'Notifications are blocked — enable them in your browser settings, then try again.';
    if (remindersOn) return 'A browser notification nudges you when concepts are due. Scheduled email/push is on the roadmap.';
    return 'Get a browser nudge when concepts are due. Shows when you open Nabbit.';
  })();

  return (
    <V2Shell
      activeNav="Recall"
      theme={theme}
      onToggleTheme={toggleTheme}
      showSearch={false}
      toast={toast}
      streak={stats.currentStreak || 0}
      xp={allItems.reduce((n, i) => n + i.history.filter(a => a.correct).length * 100, 0)}
      level={Math.max(1, Math.floor(stats.totalSolved / 10) + 1)}
      xpProgress={(stats.totalSolved % 10) / 10}
    >
      <div className="v2-recall">
        {offsetDays !== 0 && (
          <div className="v2-timetravel" role="status">
            <Clock size={14} />
            Simulating <strong>{offsetDays > 0 ? `+${offsetDays}` : offsetDays} days</strong> from today —{' '}
            {dueItems.length} drill{dueItems.length === 1 ? '' : 's'} due at that time.
            <div className="steps">
              {[-7, -1, 0, 1, 3, 7, 14].map(d => (
                <button key={d} className={d === 0 ? 'reset' : ''} onClick={() => handleOffset(d)}>
                  {d === 0 ? 'Now' : d > 0 ? `+${d}d` : `${d}d`}
                </button>
              ))}
              <button className="reset" onClick={handleReset} title="Reset local progress">
                <RotateCcw size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Reset
              </button>
            </div>
          </div>
        )}

        <header className="v2-recall-header">
          <div>
            <h1>Spaced Recall</h1>
            <p>Prevent tutorial decay through automated Ebbinghaus resurfacing (1 / 3 / 7 / 14 / 30 day cycles).</p>
          </div>
          <div className="v2-recall-header-spacer" />
          <a className="v2-recall-header-cta" href="/v2/">
            Browse library <ArrowRight size={14} />
          </a>
        </header>

        {offsetDays === 0 && (
          <div className="v2-timetravel" role="status" aria-label="Time-travel developer strip">
            <Clock size={14} />
            Dev tool: jump time to see concepts resurface.
            <div className="steps">
              {[1, 3, 7, 14].map(d => (
                <button key={d} onClick={() => handleOffset(d)}>+{d}d</button>
              ))}
              <button className="reset" onClick={handleReset} title="Reset local progress">
                <RotateCcw size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Reset
              </button>
            </div>
          </div>
        )}

        {/* ---- Stats row ---- */}
        <div className="v2-recall-stats">
          <StatCard
            label="Revisit Rate"
            value={`${stats.revisitRate}%`}
            sub={`Target ≥33% · ${loading ? '…' : 'solved concepts re-tested in recall'}`}
            icon={<TrendingUp size={15} />}
          />
          <StatCard
            label="Review Streak"
            value={stats.currentStreak}
            sub="Consecutive successful reviews"
            icon={<Flame size={15} style={{ color: 'var(--amber)' }} />}
          />
          <StatCard
            label="Due for Recall"
            value={stats.dueCount}
            sub="Ready for review today"
            icon={<Calendar size={15} />}
            highlight={stats.dueCount > 0}
          />
          <StatCard
            label="Active Pipeline"
            value={stats.totalSolved}
            sub="Concepts tracking retention intervals"
            icon={<CheckCircle2 size={15} style={{ color: 'var(--green)' }} />}
          />
        </div>

        {/* ---- Reminders ---- */}
        <div className="v2-reminders">
          <div className={`v2-reminders-ico ${remindersOn ? 'on' : ''}`}>
            {remindersOn ? <Bell size={16} /> : <BellOff size={16} />}
          </div>
          <div className="v2-reminders-copy">
            <strong>Review reminders</strong>
            <span>{reminderCopy}</span>
          </div>
          {canToggle && (
            <button
              type="button"
              className={`v2-reminders-btn ${remindersOn ? 'off' : 'on'}`}
              onClick={handleToggleReminders}
            >
              {remindersOn ? 'Turn off' : 'Enable reminders'}
            </button>
          )}
        </div>

        {/* ---- Due queue ---- */}
        <section>
          <div className="v2-recall-section-head">
            <h2>Due Today</h2>
            <span className="count">{dueItems.length}</span>
            <div className="spacer" />
            {dueItems.length > 0 && (
              <a className="start" href={`/v2/challenge/${encodeURIComponent(dueItems[0].challengeId)}`}>
                <Play size={13} /> Start recall session
              </a>
            )}
          </div>

          {loading ? (
            <div className="v2-due-empty">Loading recall items…</div>
          ) : dueItems.length === 0 ? (
            <div className="v2-due-empty">
              <div className="ico"><CheckCircle2 size={32} /></div>
              <h3>All caught up for today!</h3>
              <p>
                No concepts are due at this {offsetDays !== 0 ? 'simulated date' : 'point'}.
                Use the Time-Travel strip above to jump +1d, +3d, or +7d to see concepts resurface
                as memory decays.
              </p>
            </div>
          ) : (
            <div className="v2-due-grid">
              {dueItems.map(item => {
                const video = videos.find(v => v.id === item.videoId);
                return (
                  <article key={item.challengeId} className="v2-due-card">
                    <div className="top">
                      <span>{video?.title || 'Tutorial drill'}</span>
                      <span className="interval">Interval {item.interval}d</span>
                    </div>
                    <h4>{item.concept}</h4>
                    <p>
                      {item.challenge?.chapter}
                      {item.challenge?.timestampFormatted && ` · ${item.challenge.timestampFormatted}`}
                    </p>
                    <div className="foot">
                      <span>
                        {item.history.length} prior {item.history.length === 1 ? 'solve' : 'solves'}
                      </span>
                      <a href={`/v2/challenge/${encodeURIComponent(item.challengeId)}`}>
                        <Play size={12} /> Review
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ---- Interval pipeline ---- */}
        <section>
          <div className="v2-recall-section-head">
            <h2>Retention pipeline</h2>
          </div>
          <div className="v2-intervals">
            {INTERVAL_STAGES.map(stage => (
              <div key={stage.interval} className="v2-interval">
                <div className="label">
                  <span>{stage.label}</span>
                  <span className="count">{buckets[stage.interval].length}</span>
                </div>
                <div className="desc">{stage.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ---- At risk ---- */}
        {atRisk.length > 0 && (
          <section className="v2-atrisk">
            <div className="v2-atrisk-head">
              <AlertTriangle size={16} /> Concepts at risk (overdue &gt; 24h or last attempt wrong)
            </div>
            {atRisk.map(item => (
              <div key={item.challengeId} className="v2-atrisk-row">
                <div>
                  <strong>{item.concept}</strong>
                  <span className="meta">· current interval {item.interval}d</span>
                </div>
                <a href={`/v2/challenge/${encodeURIComponent(item.challengeId)}`}>Reinforce</a>
              </div>
            ))}
          </section>
        )}
      </div>
    </V2Shell>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  highlight = false,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`v2-stat-card${highlight ? ' highlight' : ''}`}>
      <div className="label">
        <span>{label}</span>
        <span className="ico">{icon}</span>
      </div>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}
