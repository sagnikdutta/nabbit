import React from 'react';
import { RecallItem, Challenge, RecallStats, Video } from '../lib/types';
import type { PermissionState } from '../lib/reminders';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { TimeTravelBar } from '../components/TimeTravelBar';
import { MasteryList } from '../components/MasteryList';
import {
  Calendar,
  Flame,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Bell,
  BellOff,
} from 'lucide-react';

export interface RecallDashboardScreenProps {
  stats: RecallStats;
  dueItems: (RecallItem & { challenge: Challenge })[];
  allItems: (RecallItem & { challenge?: Challenge })[];
  videos: Video[];
  offsetDays: number;
  remindersOn: boolean;
  notifyPermission: PermissionState;
  onToggleReminders: () => void;
  onSetOffset: (days: number) => void;
  onResetData: () => void;
  onLaunchDrill: (challengeId: string) => void;
  onGoToLibrary: () => void;
  /** Phase 8 v2 — true for signed-in Supabase users; gates the MasteryList fetch. */
  masteryEnabled?: boolean;
}

export const RecallDashboardScreen: React.FC<RecallDashboardScreenProps> = ({
  stats,
  dueItems,
  allItems,
  videos,
  offsetDays,
  remindersOn,
  notifyPermission,
  onToggleReminders,
  onSetOffset,
  onResetData,
  onLaunchDrill,
  onGoToLibrary,
  masteryEnabled = false,
}) => {
  const simulatedNow = Date.now() + offsetDays * 86400000;

  // Buckets for spaced repetition intervals
  const intervalBuckets = {
    1: allItems.filter(i => i.interval === 1),
    3: allItems.filter(i => i.interval === 3),
    7: allItems.filter(i => i.interval === 7),
    14: allItems.filter(i => i.interval === 14),
    30: allItems.filter(i => i.interval === 30),
  };

  // Identify at-risk items
  const atRiskList = allItems.filter(item => {
    const isOverdue = simulatedNow - item.nextReviewAt > 24 * 60 * 60 * 1000;
    const lastAttempt = item.history[item.history.length - 1];
    const failedRecently = lastAttempt && !lastAttempt.correct;
    return isOverdue || failedRecently;
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Time Travel Simulation Strip */}
      <TimeTravelBar
        offsetDays={offsetDays}
        onSetOffset={onSetOffset}
        onResetData={onResetData}
        dueCount={dueItems.length}
      />

      {/* Phase 8 v2 — per-concept Elo. Reads from concept_elo (Supabase); for
          anonymous/trial users shows a soft placeholder. */}
      <MasteryList enabled={masteryEnabled} />

      {/* Header & Overview */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Spaced Recall Engine
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-muted)]">
            Prevent tutorial decay through automated Ebbinghaus resurfacing (1 / 3 / 7 / 14 / 30 day cycles).
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={onGoToLibrary} icon={<ArrowRight className="w-4 h-4 order-last" />}>
          Browse Video Library
        </Button>
      </div>

      {/* North-Star Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revisit Rate (North-Star) */}
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--color-muted)] font-mono">
            <span>Revisit Rate</span>
            <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--color-text)] tabular-nums">
            {stats.revisitRate}%
          </div>
          <p className="text-[11px] text-[var(--color-muted)] leading-tight">
            Target &ge;33% · Solved concepts re-tested in recall
          </p>
        </Card>

        {/* Current Review Streak */}
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--color-muted)] font-mono">
            <span>Review Streak</span>
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--color-text)] tabular-nums">
            {stats.currentStreak}
          </div>
          <p className="text-[11px] text-[var(--color-muted)] leading-tight">
            Consecutive successful reviews
          </p>
        </Card>

        {/* Due Now */}
        <Card className={`p-5 space-y-2 ${stats.dueCount > 0 ? 'border-[var(--color-accent-border)] bg-[var(--color-accent-weak)]' : ''}`}>
          <div className="flex items-center justify-between text-xs text-[var(--color-muted)] font-mono">
            <span>Due for Recall</span>
            <Calendar className="w-4 h-4 text-[var(--color-accent)]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--color-text)] tabular-nums">
            {stats.dueCount}
          </div>
          <p className="text-[11px] text-[var(--color-muted)] leading-tight">
            Ready for review today
          </p>
        </Card>

        {/* Total Solved & In System */}
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--color-muted)] font-mono">
            <span>Active Pipeline</span>
            <CheckCircle2 className="w-4 h-4 text-[var(--color-good)]" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--color-text)] tabular-nums">
            {stats.totalSolved}
          </div>
          <p className="text-[11px] text-[var(--color-muted)] leading-tight">
            Concepts tracking retention intervals
          </p>
        </Card>
      </div>

      {/* Review reminders (N6) */}
      <section className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[var(--shadow-sm)]">
        <div className="flex items-start gap-3">
          <div
            className={`w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 ${
              remindersOn
                ? 'bg-[var(--color-good)] text-white'
                : 'bg-[var(--color-surface-subtle)] text-[var(--color-muted)] border border-[var(--color-border)]'
            }`}
          >
            {remindersOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text)]">Review reminders</p>
            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
              {notifyPermission === 'unsupported'
                ? 'This browser does not support notifications.'
                : notifyPermission === 'denied'
                ? 'Notifications are blocked — enable them in your browser settings, then try again.'
                : remindersOn
                ? 'A browser notification nudges you when concepts are due. Scheduled email/push is on the roadmap.'
                : 'Get a browser nudge when concepts are due. Shows when you open Nabbit — scheduled email/push is on the roadmap.'}
            </p>
          </div>
        </div>

        {notifyPermission !== 'unsupported' && notifyPermission !== 'denied' && (
          <Button
            size="sm"
            variant={remindersOn ? 'secondary' : 'primary'}
            className="w-full sm:w-auto justify-center shrink-0"
            onClick={onToggleReminders}
            icon={remindersOn ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
          >
            {remindersOn ? 'Turn off reminders' : 'Enable review reminders'}
          </Button>
        )}
      </section>

      {/* Due Today Queue */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[var(--color-text)]">
              Due Today Queue
            </h2>
            <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-white text-xs font-mono font-bold">
              {dueItems.length}
            </span>
          </div>

          {dueItems.length > 0 && (
            <Button
              size="sm"
              variant="primary"
              icon={<Play className="w-3.5 h-3.5 fill-current" />}
              onClick={() => onLaunchDrill(dueItems[0].challengeId)}
            >
              Start Recall Session
            </Button>
          )}
        </div>

        {dueItems.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-8 text-center bg-[var(--color-surface)] space-y-2">
            <CheckCircle2 className="w-8 h-8 text-[var(--color-good)] mx-auto" />
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              All Caught Up for Today!
            </h3>
            <p className="text-xs text-[var(--color-muted)] max-w-md mx-auto">
              No concepts are due at this simulated date. Use the Time-Travel bar above to jump +1d, +3d, or +7d to see how concepts resurface as memory decays.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dueItems.map(item => {
              const video = videos.find(v => v.id === item.videoId);
              return (
                <Card
                  key={item.challengeId}
                  className="flex flex-col justify-between hover:border-[var(--color-accent-border)] transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-[var(--color-muted)] font-mono">
                      <span>{video?.title || 'Tutorial Drill'}</span>
                      <span className="text-[var(--color-accent)] font-semibold">
                        Interval: {item.interval}d
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[var(--color-text)]">
                      {item.concept}
                    </h4>

                    <p className="text-xs text-[var(--color-muted)] line-clamp-2">
                      {item.challenge?.chapter} · Timestamp: {item.challenge?.timestampFormatted}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[var(--color-border)] mt-3 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-[var(--color-muted)]">
                      {item.history.length} prior {item.history.length === 1 ? 'solve' : 'solves'}
                    </span>
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Play className="w-3.5 h-3.5 fill-current" />}
                      onClick={() => onLaunchDrill(item.challengeId)}
                    >
                      Review Drill
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Interval Pipeline Stages */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-[var(--color-text)]">
          Retention Pipeline (Interval Stages)
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { interval: 1, label: '1 Day', desc: 'Initial recall', count: intervalBuckets[1].length },
            { interval: 3, label: '3 Days', desc: 'Consolidation', count: intervalBuckets[3].length },
            { interval: 7, label: '7 Days', desc: 'Deepening', count: intervalBuckets[7].length },
            { interval: 14, label: '14 Days', desc: 'Retention', count: intervalBuckets[14].length },
            { interval: 30, label: '30 Days', desc: 'Permanent intuition', count: intervalBuckets[30].length },
          ].map(stage => (
            <div
              key={stage.interval}
              className="p-3.5 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2"
            >
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-semibold text-[var(--color-text)]">{stage.label}</span>
                <span className="w-5 h-5 rounded-full bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center font-bold text-[11px] text-[var(--color-accent)]">
                  {stage.count}
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-muted)]">{stage.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* At-Risk Concepts Table / Warning */}
      {atRiskList.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <h2 className="text-sm font-bold">Concepts At Risk (Overdue &gt; 24h or Failed)</h2>
          </div>

          <div className="rounded-[var(--radius)] border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
            {atRiskList.map(item => (
              <div
                key={item.challengeId}
                className="flex items-center justify-between text-xs py-1 border-b border-amber-200/50 dark:border-amber-900/30 last:border-0"
              >
                <div>
                  <span className="font-semibold text-[var(--color-text)]">{item.concept}</span>
                  <span className="text-[var(--color-muted)] ml-2">
                    (Current interval: {item.interval}d)
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onLaunchDrill(item.challengeId)}
                >
                  Reinforce
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
