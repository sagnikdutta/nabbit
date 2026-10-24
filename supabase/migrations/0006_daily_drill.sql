-- Nabbit · Phase 8 v2 · migration 0006
-- Daily Drill — one global drill per calendar date, same for everyone.
-- One submit per user per date; distribution of picks served via RPC.
-- Idempotent.

------------------------------------------------------------
-- 1. daily_drill — one row per date, picked at least a week ahead
------------------------------------------------------------
create table if not exists public.daily_drill (
  for_date     date primary key,
  challenge_id text not null,
  created_at   timestamptz not null default now()
);

alter table public.daily_drill enable row level security;

-- Everyone (including anon) can see today's drill id to render the Library card.
drop policy if exists "daily_drill_read_all" on public.daily_drill;
create policy "daily_drill_read_all" on public.daily_drill for select using (true);

------------------------------------------------------------
-- 2. daily_pick — one row per (user, date). Writes via RPC.
------------------------------------------------------------
create table if not exists public.daily_pick (
  user_id    uuid not null references auth.users (id) on delete cascade,
  for_date   date not null references public.daily_drill (for_date),
  chosen     int not null,
  confidence text not null check (confidence in ('guess','sure','certain')),
  time_ms    int not null check (time_ms >= 0),
  correct    boolean not null,
  at         timestamptz not null default now(),
  primary key (user_id, for_date)
);

create index if not exists daily_pick_date_idx on public.daily_pick (for_date);

alter table public.daily_pick enable row level security;

drop policy if exists "daily_pick_read_own" on public.daily_pick;
create policy "daily_pick_read_own" on public.daily_pick
  for select using (auth.uid() = user_id);

------------------------------------------------------------
-- 3. get_daily_drill — returns today's drill + the caller's own pick if any.
------------------------------------------------------------
drop function if exists public.get_daily_drill(date);
create function public.get_daily_drill(for_date date)
returns table (challenge_id text, user_pick jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  return query
  select
    d.challenge_id,
    case when uid is null then null::jsonb else to_jsonb(p) end as user_pick
  from public.daily_drill d
  left join public.daily_pick p
    on p.for_date = d.for_date and p.user_id = uid
  where d.for_date = get_daily_drill.for_date;
end;
$$;

grant execute on function public.get_daily_drill(date) to authenticated, anon;

------------------------------------------------------------
-- 4. submit_daily_pick — one attempt per user per date. Returns the running
-- distribution of picks + solve-rate so the client renders the Autopsy bar
-- with REAL numbers (not seedDistribution).
------------------------------------------------------------
drop function if exists public.submit_daily_pick(date, int, text, int, int);
create function public.submit_daily_pick(
  for_date date,
  chosen int,
  confidence text,
  time_ms int,
  correct_option int
)
returns table (counts jsonb, solved_rate numeric, total_picks int)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_correct boolean;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if confidence not in ('guess','sure','certain') then
    raise exception 'invalid confidence';
  end if;
  v_correct := chosen = correct_option;

  insert into public.daily_pick (user_id, for_date, chosen, confidence, time_ms, correct, at)
  values (uid, submit_daily_pick.for_date, chosen, confidence, time_ms, v_correct, now());
  -- primary key dedupes; a retry raises unique_violation, which is the desired signal.

  return query select * from public._nabbit_daily_distribution(submit_daily_pick.for_date);
end;
$$;

grant execute on function public.submit_daily_pick(date, int, text, int, int) to authenticated;

------------------------------------------------------------
-- 5. get_daily_distribution — read-only distribution for users who already submitted
------------------------------------------------------------

-- Shared aggregator — one place to get the submit/distribution math right.
drop function if exists public._nabbit_daily_distribution(date);
create function public._nabbit_daily_distribution(for_date date)
returns table (counts jsonb, solved_rate numeric, total_picks int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  with picks as (
    select chosen, correct
      from public.daily_pick
     where daily_pick.for_date = _nabbit_daily_distribution.for_date
  ),
  by_chosen as (
    select chosen, count(*)::int as cnt
      from picks group by chosen
  )
  select
    coalesce((select jsonb_object_agg(chosen::text, cnt) from by_chosen), '{}'::jsonb) as counts,
    coalesce(round((select count(*) from picks where correct) * 1.0 / nullif((select count(*) from picks), 0), 3), 0) as solved_rate,
    (select count(*)::int from picks) as total_picks;
end;
$$;

drop function if exists public.get_daily_distribution(date);
create function public.get_daily_distribution(for_date date)
returns table (counts jsonb, solved_rate numeric, total_picks int)
language sql
stable
security definer
set search_path = public
as $$
  select * from public._nabbit_daily_distribution(for_date);
$$;

grant execute on function public.get_daily_distribution(date) to authenticated, anon;
