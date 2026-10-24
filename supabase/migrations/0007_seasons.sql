-- Nabbit · Phase 8 v2 · migration 0007
-- Ranked ladders. Pro-gated: season_leaderboard enforces is_pro at call time.
-- Season rollover applies a soft reset: newRating = 1200 + (oldRating - 1200) * 0.6.
-- Idempotent.

------------------------------------------------------------
-- 1. seasons — descriptor rows (read-only to all)
------------------------------------------------------------
create table if not exists public.seasons (
  id         text primary key,
  name       text not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null
);

alter table public.seasons enable row level security;

drop policy if exists "seasons_read_all" on public.seasons;
create policy "seasons_read_all" on public.seasons for select using (true);

------------------------------------------------------------
-- 2. season_placement — end-of-season bucket per user
------------------------------------------------------------
create table if not exists public.season_placement (
  user_id      uuid not null references auth.users (id) on delete cascade,
  season_id    text not null references public.seasons (id),
  start_rating int not null,
  end_rating   int not null,
  bucket       text not null check (bucket in ('Diamond','Platinum','Gold','Silver')),
  primary key (user_id, season_id)
);

create index if not exists season_placement_season_rating_idx
  on public.season_placement (season_id, end_rating desc);

alter table public.season_placement enable row level security;

-- Reads are world-readable so leaderboards work for non-signed-in viewers of a Pro user's
-- public link. The leaderboard RPC still enforces Pro gating on the caller.
drop policy if exists "season_placement_read_all" on public.season_placement;
create policy "season_placement_read_all" on public.season_placement for select using (true);

------------------------------------------------------------
-- 3. season_leaderboard RPC — top N users for a season. Pro-only.
--    Returns display_name + end_rating. No sensitive fields.
------------------------------------------------------------
drop function if exists public.season_leaderboard(text, int);
create function public.season_leaderboard(season_id text, lim int default 25)
returns table (user_id uuid, display_name text, end_rating int, bucket text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_is_pro boolean;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select is_pro into v_is_pro from public.users where id = uid;
  if not coalesce(v_is_pro, false) then
    raise exception 'pro_required' using errcode = '42501';
  end if;

  return query
  select
    p.user_id,
    coalesce(u.display_name, split_part(u.email, '@', 1)) as display_name,
    p.end_rating,
    p.bucket
  from public.season_placement p
  join public.users u on u.id = p.user_id
  where p.season_id = season_leaderboard.season_id
  order by p.end_rating desc
  limit greatest(1, least(lim, 100));
end;
$$;

grant execute on function public.season_leaderboard(text, int) to authenticated;

------------------------------------------------------------
-- 4. close_season — admin helper (not exposed to clients). Buckets players by
-- percentile of end_rating and applies the soft reset for next season.
--
-- Call it from the Supabase SQL editor at season rollover:
--   select public.close_season('s1', 's2');
------------------------------------------------------------
drop function if exists public.close_season(text, text);
create function public.close_season(ending_season_id text, next_season_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_placed int := 0;
begin
  with ranked as (
    select
      e.user_id,
      e.rating,
      percent_rank() over (order by e.rating desc) as pr
    from public.concept_elo e
  ),
  agg as (
    select user_id, round(avg(rating))::int as mean_rating, min(pr) as top_pr
      from ranked
     group by user_id
  )
  insert into public.season_placement (user_id, season_id, start_rating, end_rating, bucket)
  select
    agg.user_id,
    ending_season_id,
    agg.mean_rating,
    agg.mean_rating,
    case
      when agg.top_pr < 0.25 then 'Diamond'
      when agg.top_pr < 0.50 then 'Platinum'
      when agg.top_pr < 0.75 then 'Gold'
      else 'Silver'
    end
  from agg
  on conflict (user_id, season_id) do nothing;

  get diagnostics v_placed = row_count;

  -- Soft reset for the next season: new = 1200 + (old - 1200) * 0.6
  update public.concept_elo
     set rating = 1200 + round((rating - 1200) * 0.6)::int,
         season_id = next_season_id,
         updated_at = now();

  return v_placed;
end;
$$;

revoke all on function public.close_season(text, text) from public, anon, authenticated;
