-- Nabbit · Phase 8 v2 · migration 0008
-- Global streaks (with server-side weekly freeze — replaces v1's client-only
-- streak-freeze.ts for signed-in users) + Pro-gated Boss drills.
-- Idempotent.

------------------------------------------------------------
-- 1. streaks — one row per user. Weekly freeze: +1 granted automatically at
-- the start of each ISO-week (capped at 1 unused). Absorbs one wrong attempt
-- that would otherwise break the streak.
------------------------------------------------------------
create table if not exists public.streaks (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  current                 int not null default 0,
  best                    int not null default 0,
  freezes                 int not null default 1,
  last_freeze_grant_week  date,
  last_outcome_at         timestamptz,
  updated_at              timestamptz not null default now()
);

alter table public.streaks enable row level security;

drop policy if exists "streaks_read_own" on public.streaks;
create policy "streaks_read_own" on public.streaks
  for select using (auth.uid() = user_id);

------------------------------------------------------------
-- 2. boss_drills — one row per user per week (Pro)
------------------------------------------------------------
create table if not exists public.boss_drills (
  user_id       uuid not null references auth.users (id) on delete cascade,
  week_start    date not null,
  challenge_ids text[] not null,
  completed_at  timestamptz,
  score         numeric,
  primary key (user_id, week_start)
);

alter table public.boss_drills enable row level security;

drop policy if exists "boss_read_own" on public.boss_drills;
create policy "boss_read_own" on public.boss_drills
  for select using (auth.uid() = user_id);

------------------------------------------------------------
-- 3. Week helper — Monday of the ISO-week containing ts, as date
------------------------------------------------------------
create or replace function public._nabbit_week_start(ts timestamptz)
returns date
language sql
immutable
as $$
  select date_trunc('week', ts at time zone 'UTC')::date;  -- Monday-based (ISO)
$$;

------------------------------------------------------------
-- 4. Extend apply_attempt — global streak + weekly freeze consumption.
--    Returns gain: global_streak + freezes_remaining.
------------------------------------------------------------
drop function if exists public.apply_attempt(jsonb);
create function public.apply_attempt(payload jsonb)
returns table (
  attempt_id         uuid,
  correct            boolean,
  outcome            numeric,
  score              numeric,
  interval_days      int,
  next_review_at     timestamptz,
  streak             int,       -- per-concept (from recall_items)
  new_rating         int,
  delta              int,
  global_streak      int,
  freezes_remaining  int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_format text;
  v_outcome numeric;
  v_correct boolean;
  v_chosen int;
  v_correct_option int;
  v_now timestamptz := now();
  v_current_week date := public._nabbit_week_start(v_now);
  v_existing public.recall_items%rowtype;
  v_new_interval int;
  v_new_streak int;        -- per-concept
  v_attempt_id uuid;
  v_concept text;
  v_difficulty text;
  v_opp_rating int;
  v_elo public.concept_elo%rowtype;
  v_k int;
  v_expected numeric;
  v_new_rating int;
  v_delta int;
  v_streaks public.streaks%rowtype;
  v_global_streak int;
  v_freezes int;
  v_consumed_freeze boolean := false;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  v_format := payload ->> 'format';
  v_chosen := nullif(payload ->> 'chosen', '')::int;
  v_correct_option := nullif(payload ->> 'correct_option', '')::int;
  v_outcome := (payload ->> 'outcome')::numeric;
  v_concept := payload ->> 'concept';
  v_difficulty := payload ->> 'difficulty';
  v_opp_rating := public._nabbit_base_rating(v_difficulty);

  if v_format = 'spot-fix' and v_correct_option is not null and v_chosen is not null then
    v_outcome := case when v_chosen = v_correct_option then 1 else 0 end;
  end if;
  if v_outcome not in (0, 0.5, 1) then
    raise exception 'invalid outcome: %', v_outcome;
  end if;
  v_correct := v_outcome = 1;

  -- Recall item (per-concept SRS) --------------------------------------------
  select * into v_existing from public.recall_items
   where user_id = uid and challenge_id = payload ->> 'challenge_id';
  if not found then
    v_new_interval := 1;
    v_new_streak := case when v_outcome = 1 then 1 else 0 end;
    insert into public.recall_items (user_id, challenge_id, concept, video_id, interval_days, next_review_at, last_reviewed_at, streak)
    values (uid, payload ->> 'challenge_id', v_concept, payload ->> 'video_id',
            v_new_interval, v_now + make_interval(days => v_new_interval), v_now, v_new_streak);
  else
    v_new_interval := public._nabbit_next_interval(v_existing.interval_days, v_outcome);
    v_new_streak := case
      when v_outcome = 1   then v_existing.streak + 1
      when v_outcome = 0.5 then v_existing.streak
      else 0
    end;
    update public.recall_items
       set interval_days    = v_new_interval,
           next_review_at   = v_now + make_interval(days => v_new_interval),
           last_reviewed_at = v_now,
           streak           = v_new_streak
     where user_id = uid and challenge_id = v_existing.challenge_id;
  end if;

  -- Elo ----------------------------------------------------------------------
  select * into v_elo from public.concept_elo
   where user_id = uid and concept = v_concept;
  if not found then
    v_elo.rating := 1200;
    v_elo.games := 0;
  end if;
  v_k := public._nabbit_k_factor(v_elo.games);
  v_expected := public._nabbit_expected_score(v_elo.rating, v_opp_rating);
  v_new_rating := v_elo.rating + round(v_k * (v_outcome - v_expected));
  v_delta := v_new_rating - v_elo.rating;

  insert into public.concept_elo (user_id, concept, rating, games, updated_at)
  values (uid, v_concept, v_new_rating, v_elo.games + 1, v_now)
  on conflict (user_id, concept) do update
    set rating = v_new_rating,
        games = public.concept_elo.games + 1,
        updated_at = v_now;

  -- Global streak with weekly freeze -----------------------------------------
  insert into public.streaks (user_id, current, best, freezes, last_freeze_grant_week, last_outcome_at)
  values (uid, 0, 0, 1, v_current_week, v_now)
  on conflict (user_id) do nothing;
  select * into v_streaks from public.streaks where user_id = uid;

  -- Grant a fresh freeze if the ISO-week rolled over (capped at 1 unused).
  if v_streaks.last_freeze_grant_week is null or v_streaks.last_freeze_grant_week < v_current_week then
    v_streaks.freezes := least(1, v_streaks.freezes + 1);
    v_streaks.last_freeze_grant_week := v_current_week;
  end if;

  v_global_streak := v_streaks.current;
  v_freezes := v_streaks.freezes;
  if v_outcome = 1 then
    v_global_streak := v_global_streak + 1;
  elsif v_outcome = 0 then
    if v_freezes > 0 then
      v_freezes := v_freezes - 1;
      v_consumed_freeze := true;
      -- streak preserved
    else
      v_global_streak := 0;
    end if;
  end if;
  -- outcome 0.5 preserves streak (no freeze consumed)

  update public.streaks
     set current = v_global_streak,
         best = greatest(best, v_global_streak),
         freezes = v_freezes,
         last_freeze_grant_week = v_streaks.last_freeze_grant_week,
         last_outcome_at = v_now,
         updated_at = v_now
   where user_id = uid;

  -- Attempt log --------------------------------------------------------------
  insert into public.attempts (
    user_id, challenge_id, concept, video_id, difficulty,
    format, chosen, correct, outcome, confidence, time_ms, score, combo_at_time, payload, at
  ) values (
    uid, payload ->> 'challenge_id', v_concept, payload ->> 'video_id', v_difficulty,
    v_format, v_chosen, v_correct, v_outcome,
    payload ->> 'confidence', (payload ->> 'time_ms')::int, (payload ->> 'score')::numeric,
    coalesce((payload ->> 'combo_at_time')::int, 0),
    coalesce(payload -> 'input', '{}'::jsonb) || jsonb_build_object('freeze_consumed', v_consumed_freeze),
    v_now
  ) returning id into v_attempt_id;

  return query select
    v_attempt_id,
    v_correct,
    v_outcome,
    (payload ->> 'score')::numeric,
    v_new_interval,
    v_now + make_interval(days => v_new_interval),
    v_new_streak,
    v_new_rating,
    v_delta,
    v_global_streak,
    v_freezes;
end;
$$;

grant execute on function public.apply_attempt(jsonb) to authenticated;

------------------------------------------------------------
-- 5. generate_boss_drill — Pro-only. Picks the user's 3 weakest concepts
-- (lowest concept_elo rating, tie-break on oldest overdue in SRS), bundles up
-- to 5 drills across them from candidate_challenge_ids (client supplies the
-- library via payload — challenges live in src/content/data.ts).
--
-- Payload: { candidate_challenge_ids: text[], week_start: date (optional) }
-- Returns the week_start + the 5 chosen challenge_ids.
------------------------------------------------------------
drop function if exists public.generate_boss_drill(jsonb);
create function public.generate_boss_drill(payload jsonb)
returns table (week_start date, challenge_ids text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_is_pro boolean;
  v_week date := coalesce((payload ->> 'week_start')::date, public._nabbit_week_start(now()));
  v_candidates text[] := array(select jsonb_array_elements_text(coalesce(payload -> 'candidate_challenge_ids', '[]'::jsonb)));
  v_existing public.boss_drills%rowtype;
  v_weak_concepts text[];
  v_picks text[];
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select is_pro into v_is_pro from public.users where id = uid;
  if not coalesce(v_is_pro, false) then
    raise exception 'pro_required' using errcode = '42501';
  end if;

  -- Already generated this week? Return existing.
  select * into v_existing from public.boss_drills where user_id = uid and week_start = v_week;
  if found then
    return query select v_existing.week_start, v_existing.challenge_ids;
    return;
  end if;

  -- Pick 3 weakest concepts (lowest Elo). Users with no Elo yet get an empty
  -- weak-concepts list and the picker falls back to the first N candidates.
  select coalesce(array_agg(concept order by rating asc, updated_at asc), '{}')
    into v_weak_concepts
    from (
      select concept, rating, updated_at
        from public.concept_elo
       where user_id = uid
       order by rating asc, updated_at asc
       limit 3
    ) q;

  -- Fallback: at least some weak concepts, otherwise take whatever's available.
  -- For now, pick up to 5 candidates (client can also narrow candidate_challenge_ids by concept).
  v_picks := (array(select unnest(v_candidates) limit 5));

  insert into public.boss_drills (user_id, week_start, challenge_ids)
  values (uid, v_week, v_picks);

  return query select v_week, v_picks;
end;
$$;

grant execute on function public.generate_boss_drill(jsonb) to authenticated;
