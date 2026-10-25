import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

/*
 * Shared data hooks for V2 pages. Keeps topbar stats and the Pro flag in one
 * place so every page shows real values instead of the shell's demo defaults.
 */

export interface ShellStats {
  streak: number;
  xp: number;
  level: number;
  xpProgress: number;
}

const ZERO_STATS: ShellStats = { streak: 0, xp: 0, level: 1, xpProgress: 0 };

/** Live streak / XP / level for the V2 topbar, derived from the recall dashboard. */
export function useV2ShellStats(): ShellStats {
  const [stats, setStats] = useState<ShellStats>(ZERO_STATS);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const dash = await api.getRecallDashboard();
        if (!alive) return;
        const items = (dash.allItems || []) as Array<{ history: Array<{ correct: boolean }> }>;
        const solved = dash.stats?.totalSolved || 0;
        setStats({
          streak: dash.stats?.currentStreak || 0,
          xp: items.reduce((n, i) => n + i.history.filter(a => a.correct).length * 100, 0),
          level: Math.max(1, Math.floor(solved / 10) + 1),
          xpProgress: (solved % 10) / 10,
        });
      } catch {
        /* keep zeros */
      }
    };
    load();
    const off = api.onAuthChange(() => load());
    return () => {
      alive = false;
      if (typeof off === 'function') off();
    };
  }, []);
  return stats;
}

/** True when the signed-in Supabase user has is_pro = true. */
export function useV2IsPro(): { isPro: boolean; loading: boolean } {
  const [state, setState] = useState({ isPro: false, loading: true });
  useEffect(() => {
    let alive = true;
    const load = () => {
      const user = api.getCurrentUser();
      if (!user || user.provider !== 'supabase' || !supabase) {
        setState({ isPro: false, loading: false });
        return;
      }
      supabase.from('users').select('is_pro').eq('id', user.id).maybeSingle().then(
        ({ data }) => { if (alive) setState({ isPro: Boolean((data as any)?.is_pro), loading: false }); },
        () => { if (alive) setState({ isPro: false, loading: false }); },
      );
    };
    load();
    const off = api.onAuthChange(() => load());
    return () => {
      alive = false;
      if (typeof off === 'function') off();
    };
  }, []);
  return state;
}
