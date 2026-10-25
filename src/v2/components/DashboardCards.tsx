import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { supabaseStore } from '../../lib/supabase-store';
import { api } from '../../lib/api';
import { Challenge } from '../../lib/types';
import '../dashboard.css';
import { V2Button, V2Panel } from './primitives';

/*
 * V2-styled Dashboard parity surfaces ported from the V1 Library screen:
 * Daily Drill, Boss drill (Pro), Season banner (Pro), Community drafts tile
 * and the per-concept MasteryPanel (also reusable on V2 Recall).
 * All Supabase-backed cards hide or degrade gracefully with no client/session.
 */

const challengeHref = (id: string, boss = false) =>
  `/v2/challenge/${encodeURIComponent(id)}${boss ? '?boss=1' : ''}`;

// ---------- Daily Drill ----------
export function V2DailyDrillCard() {
  const [state, setState] = useState<{ id: string | null; played: boolean; total: number } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase) { setState({ id: null, played: false, total: 0 }); return; }
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: d }, { data: dist }] = await Promise.all([
        supabase.rpc('get_daily_drill', { for_date: today }),
        supabase.rpc('get_daily_distribution', { for_date: today }),
      ]);
      if (!alive) return;
      const drill = Array.isArray(d) ? d[0] : d;
      const dd = Array.isArray(dist) ? dist[0] : dist;
      setState({
        id: drill?.challenge_id ?? null,
        played: Boolean(drill?.user_pick),
        total: Number(dd?.total_picks ?? 0),
      });
    })().catch(() => alive && setState({ id: null, played: false, total: 0 }));
    return () => { alive = false; };
  }, []);

  if (!state?.id) return null;
  return (
    <section className="v2-feature-card accent">
      <div className="v2-feature-ico">🔥</div>
      <div className="v2-feature-body">
        <strong>Today's bug — Daily Drill</strong>
        <span>
          {state.total > 0
            ? `${state.total} ${state.total === 1 ? 'other has' : 'others have'} played today.`
            : "Be the first to play today's drill."}
          {state.played && <b className="v2-good"> You've played ✓</b>}
        </span>
      </div>
      <V2Button href={challengeHref(state.id)}>
        {state.played ? 'See the result' : "Play today's drill"}
      </V2Button>
    </section>
  );
}

// ---------- Boss drill ----------
function mondayISO(d: Date): string {
  const u = new Date(d);
  u.setUTCDate(u.getUTCDate() - ((u.getUTCDay() + 6) % 7));
  u.setUTCHours(0, 0, 0, 0);
  return u.toISOString().slice(0, 10);
}

export function V2BossDrillCard({ isPro, challenges }: { isPro: boolean; challenges: Challenge[] }) {
  const [row, setRow] = useState<{ week: string; ids: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isPro || !supabase || challenges.length === 0) return;
    supabase
      .rpc('generate_boss_drill', {
        payload: { week_start: mondayISO(new Date()), candidate_challenge_ids: challenges.map(c => c.id) },
      })
      .then(
        ({ data, error }) => {
          if (error) {
            if (!error.message?.toLowerCase().includes('pro_required')) setErr(error.message || 'failed to load');
            return;
          }
          const r = Array.isArray(data) ? data[0] : data;
          if (r) setRow({ week: r.week_start, ids: r.challenge_ids });
        },
        (e: unknown) => setErr(String((e as any)?.message || e)),
      );
  }, [isPro, challenges.length]);

  if (!isPro) {
    return (
      <section className="v2-feature-card locked">
        <div className="v2-feature-ico">🏆</div>
        <div className="v2-feature-body">
          <strong>This week's Boss drill <span className="v2-pro-tag">Pro</span></strong>
          <span>5 drills from your weakest concepts. No hints, 10-minute clock. One attempt per week.</span>
        </div>
        <V2Button variant="secondary" disabled title="Pro — coming soon">Unlock with Pro</V2Button>
      </section>
    );
  }
  if (err) return <section className="v2-feature-card locked"><span>Boss drill: {err}</span></section>;
  if (!row) return <section className="v2-feature-card locked"><span className="v2-muted">Preparing this week's Boss drill…</span></section>;
  return (
    <section className="v2-feature-card accent">
      <div className="v2-feature-ico">🔥</div>
      <div className="v2-feature-body">
        <strong>This week's Boss drill <span className="v2-pro-tag">Pro</span></strong>
        <span>{row.ids.length} drill{row.ids.length === 1 ? '' : 's'} from your weakest concepts · week of {row.week}</span>
      </div>
      <V2Button href={challengeHref(row.ids[0], true)}>Start Boss drill</V2Button>
    </section>
  );
}

// ---------- Season banner ----------
const THRESHOLDS = { Silver: 0, Gold: 1300, Platinum: 1500, Diamond: 1700 } as const;
type Bucket = keyof typeof THRESHOLDS;
const bucketFor = (r: number): Bucket =>
  r >= THRESHOLDS.Diamond ? 'Diamond' : r >= THRESHOLDS.Platinum ? 'Platinum' : r >= THRESHOLDS.Gold ? 'Gold' : 'Silver';
const nextBucket = (b: Bucket): Bucket | null =>
  b === 'Silver' ? 'Gold' : b === 'Gold' ? 'Platinum' : b === 'Platinum' ? 'Diamond' : null;

export function V2SeasonCard({ isPro }: { isPro: boolean }) {
  const [s, setS] = useState<{ name: string; endsAt: string; avg: number } | null>(null);
  useEffect(() => {
    let alive = true;
    if (!isPro || !supabase) { setS(null); return; }
    (async () => {
      const now = new Date().toISOString();
      const [{ data: season }, { data: elo }] = await Promise.all([
        supabase.from('seasons').select('id, name, ends_at')
          .lte('starts_at', now).gte('ends_at', now)
          .order('starts_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('concept_elo').select('rating'),
      ]);
      if (!alive || !season) return;
      const ratings = (elo ?? []).map((r: any) => Number(r.rating)).filter(Number.isFinite);
      const avg = ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : 1200;
      setS({ name: season.name ?? season.id, endsAt: season.ends_at, avg });
    })().catch(() => alive && setS(null));
    return () => { alive = false; };
  }, [isPro]);

  if (!s) return null;
  const days = Math.max(0, Math.ceil((new Date(s.endsAt).getTime() - Date.now()) / 86_400_000));
  const b = bucketFor(s.avg);
  const nb = nextBucket(b);
  return (
    <a className="v2-feature-card season" href="/v2/leaderboard">
      <div className="v2-feature-ico">🏆</div>
      <div className="v2-feature-body">
        <strong>{s.name} <span className="v2-pro-tag">Pro</span></strong>
        <span>
          {days} day{days === 1 ? '' : 's'} left · {b} {s.avg}
          {nb && THRESHOLDS[nb] - s.avg > 0 && ` · ${THRESHOLDS[nb] - s.avg} pts → ${nb}`}
        </span>
      </div>
      <span className="v2-link-btn">Leaderboard →</span>
    </a>
  );
}

// ---------- Community tile (right rail) ----------
interface DraftPreview { id: string; concept: string; upvotes: number; status: string }

export function V2CommunityTile() {
  const [rows, setRows] = useState<DraftPreview[] | null>(null);
  useEffect(() => {
    let alive = true;
    if (!supabase) { setRows([]); return; }
    supabase
      .from('community_drafts')
      .select('id, draft, upvotes, status')
      .in('status', ['queued', 'published'])
      .order('upvotes', { ascending: false })
      .limit(3)
      .then(
        ({ data }) => {
          if (!alive) return;
          setRows(((data as any[]) ?? []).map(r => ({
            id: r.id, concept: r.draft?.concept || 'Untitled draft', upvotes: r.upvotes, status: r.status,
          })));
        },
        () => alive && setRows([]),
      );
    return () => { alive = false; };
  }, []);

  return (
    <V2Panel title="Community Drafts" action={<V2Button variant="link" href="/v2/community">View All →</V2Button>}>
      {rows === null ? (
        <p className="v2-muted v2-small" style={{ margin: 0 }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="v2-muted v2-small" style={{ margin: 0 }}>No drafts yet — be the first to submit a bug.</p>
      ) : (
        <div className="v2-recall-list">
          {rows.map(r => (
            <a key={r.id} className="v2-draft-row" href="/v2/community">
              <strong>{r.concept}</strong>
              <span>▲ {r.upvotes} · {r.status}</span>
            </a>
          ))}
        </div>
      )}
    </V2Panel>
  );
}

// ---------- Mastery panel (per-concept Elo) ----------
const masteryBucket = (r: number) =>
  r >= 1700 ? { label: 'Diamond', color: 'var(--purple)' }
  : r >= 1500 ? { label: 'Platinum', color: '#16a34a' }
  : r >= 1300 ? { label: 'Gold', color: '#d97706' }
  : { label: 'Silver', color: 'var(--muted)' };

export function V2MasteryPanel({ limit }: { limit?: number }) {
  const [rows, setRows] = useState<{ concept: string; rating: number; games: number }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const enabled = api.getCurrentUser()?.provider === 'supabase';

  useEffect(() => {
    let alive = true;
    if (!enabled) { setRows([]); return; }
    supabaseStore.getConceptElo()
      .then(d => alive && setRows(d))
      .catch(e => alive && setErr(e?.message || 'failed to load mastery'));
    return () => { alive = false; };
  }, [enabled]);

  const shown = limit ? rows?.slice(0, limit) : rows;
  return (
    <V2Panel
      title="Concept Mastery"
      action={rows && rows.length > 0 ? (
        <span className="v2-small v2-muted">{rows.length} concept{rows.length === 1 ? '' : 's'}</span>
      ) : undefined}
    >
      {!enabled ? (
        <p className="v2-muted v2-small" style={{ margin: 0 }}>Per-concept Elo is tracked once you sign in.</p>
      ) : err ? (
        <p className="v2-small" style={{ margin: 0, color: '#dc2626' }}>Couldn't load mastery: {err}</p>
      ) : rows === null ? (
        <p className="v2-muted v2-small" style={{ margin: 0 }}>Loading mastery…</p>
      ) : rows.length === 0 ? (
        <p className="v2-muted v2-small" style={{ margin: 0 }}>
          Attempt a drill and your per-concept rating starts tracking (starts at 1200).
        </p>
      ) : (
        <div className="v2-mastery-rows">
          {shown!.map(r => {
            const b = masteryBucket(r.rating);
            return (
              <div key={r.concept} className="v2-mastery-row">
                <div>
                  <strong>{r.concept}</strong>
                  <span>{r.games} game{r.games === 1 ? '' : 's'}</span>
                </div>
                <span className="v2-bucket" style={{ color: b.color, borderColor: b.color }}>{b.label}</span>
                <b>{r.rating}</b>
              </div>
            );
          })}
        </div>
      )}
    </V2Panel>
  );
}
