import { useEffect, useState } from 'react';
import { Trophy, Lock, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { V2Shell } from '../V2Shell';
import { useV2Theme } from '../useTheme';
import './leaderboard.css';

/*
 * V2 Season Leaderboard — Pro-gated. Non-Pro users see a locked state;
 * Pro users see the top 25 placements for the latest season via the
 * `season_leaderboard` RPC on Supabase.
 *
 * There's no live season until an admin runs close_season(…) at rollover,
 * so the Pro view usually renders empty for most of a season — the gate
 * itself is what proves the Pro surface works end-to-end.
 */

interface Row {
  user_id: string;
  display_name: string;
  end_rating: number;
  bucket: string;
}

export default function V2LeaderboardPage() {
  const [theme, toggleTheme] = useV2Theme();
  const [isPro, setIsPro] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [loadingPro, setLoadingPro] = useState(true);

  // Fetch Pro flag.
  useEffect(() => {
    const user = api.getCurrentUser();
    if (!user || user.provider !== 'supabase' || !supabase) {
      setIsPro(false);
      setLoadingPro(false);
      return;
    }
    let alive = true;
    supabase.from('users').select('is_pro').eq('id', user.id).maybeSingle()
      .then(
        ({ data }) => {
          if (!alive) return;
          setIsPro(Boolean((data as any)?.is_pro));
          setLoadingPro(false);
        },
        () => { if (alive) { setIsPro(false); setLoadingPro(false); } },
      );
    return () => { alive = false; };
  }, []);

  // Fetch leaderboard when Pro.
  useEffect(() => {
    if (loadingPro) return;
    if (!isPro || !supabase) return;
    let alive = true;
    (async () => {
      try {
        const { data: seasons } = await supabase
          .from('seasons')
          .select('id')
          .order('starts_at', { ascending: false })
          .limit(1);
        const sid = (seasons as Array<{ id: string }> | null)?.[0]?.id ?? null;
        if (!alive) return;
        setSeasonId(sid);
        if (!sid) { setRows([]); return; }
        const { data, error } = await supabase.rpc('season_leaderboard', { season_id: sid, lim: 25 });
        if (!alive) return;
        if (error) {
          setErr(error.message || 'Failed to load leaderboard');
          return;
        }
        setRows((data as Row[] | null) ?? []);
      } catch (e: any) {
        if (alive) setErr(e?.message || String(e));
      }
    })();
    return () => { alive = false; };
  }, [isPro, loadingPro]);

  return (
    <V2Shell
      activeNav="Leaderboard"
      theme={theme}
      onToggleTheme={toggleTheme}
      showSearch={false}
    >
      <div className="v2-leaderboard">
        <header className="v2-lb-header">
          <h1>Season leaderboard</h1>
          {seasonId && <span className="season-chip">{seasonId}</span>}
        </header>
        <p className="v2-lb-sub">
          Season placements bucket you Diamond / Platinum / Gold / Silver by end-of-season Elo.
          Soft reset to 60% between seasons.
        </p>

        {loadingPro ? (
          <section className="v2-lb-empty">Loading…</section>
        ) : !isPro ? (
          <section className="v2-lb-locked">
            <div className="v2-lb-locked-head">
              <div className="v2-lb-locked-ico">
                <Trophy size={22} />
                <span className="lock"><Lock size={10} /></span>
              </div>
              <div className="v2-lb-locked-copy">
                <strong>Season leaderboard is a Pro feature</strong>
                <span>
                  Rank against every other Pro player on a public leaderboard.
                  Buckets lock on season close; Pro users keep their rating with a soft reset.
                </span>
              </div>
            </div>
            <a className="cta" href="/v2/">
              <Sparkles size={14} /> Unlock with Pro
            </a>
          </section>
        ) : err ? (
          <section className="v2-lb-error">{err}</section>
        ) : rows === null ? (
          <section className="v2-lb-empty">Loading leaderboard…</section>
        ) : rows.length === 0 ? (
          <section className="v2-lb-empty">
            {seasonId
              ? 'No placements yet for this season. Placements land when the admin closes the season.'
              : 'No active season. The next one appears once an admin seeds a row in public.seasons.'}
          </section>
        ) : (
          <section className="v2-lb-list">
            {rows.map((r, i) => (
              <div key={r.user_id} className={`v2-lb-row${i < 3 ? ' top-3' : ''}`}>
                <div className="v2-lb-rank">{i + 1}.</div>
                <div className="v2-lb-name">{r.display_name}</div>
                <span className={`v2-lb-bucket ${r.bucket}`}>{r.bucket}</span>
                <div className="v2-lb-rating">{r.end_rating}</div>
              </div>
            ))}
          </section>
        )}
      </div>
    </V2Shell>
  );
}
