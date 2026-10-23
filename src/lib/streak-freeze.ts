/**
 * Phase 8 v1 — passive weekly streak freeze.
 *
 * One streak break per ISO-week is auto-protected so a single wrong answer
 * doesn't nuke a long run. Fully silent (no banner, no "you used a freeze"
 * message) per the plan — the chrome just doesn't drop the streak chip.
 *
 * Client-only for v1; v2's `streaks` Supabase table will carry it server-side.
 */

const KEY = 'nabbit_streak_freeze_v1';

/** Monday of the ISO-week containing `ts`, as `YYYY-MM-DD` (UTC). Stable key for the week. */
export function weekStartISO(ts: number): string {
  const d = new Date(ts);
  const dow = d.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (dow + 6) % 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - daysSinceMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export interface FreezeState {
  weekStart: string;
  used: boolean;
}

export function getFreezeState(now: number): FreezeState {
  const currentWeek = weekStartISO(now);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { weekStart: currentWeek, used: false };
    const parsed = JSON.parse(raw);
    // Rolled into a new week — freeze resets automatically.
    if (parsed.weekStart !== currentWeek) return { weekStart: currentWeek, used: false };
    return { weekStart: currentWeek, used: Boolean(parsed.used) };
  } catch {
    return { weekStart: currentWeek, used: false };
  }
}

export function markFreezeUsed(now: number): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ weekStart: weekStartISO(now), used: true }),
    );
  } catch {
    // storage unavailable — the freeze is best-effort anyway
  }
}
