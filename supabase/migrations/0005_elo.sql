-- Nabbit · Phase 8 v2 · migration 0005
-- Per-concept Elo rating + Elo update inside apply_attempt.
-- Confidence NEVER affects Elo (score-only); SRS and Elo stay independent.
-- Idempotent; safe to re-run.

------------------------------------------------------------
-- 1. concept_elo table
------------------------------------------------------------
create table if not exists public.concept_elo (
  user_id    uuid not null references auth.users (id) on delete cascade,
  concept    text not null,
  rating     int not null default 1200,
  games      int not null default 0,
  updated_at timestamptz not null default now(),
  season_id  text,
  primary key (user_id, concept)
);

create index if not exists concept_elo_user_rating_idx on public.concept_elo (user_id, rating desc);

alter table public.concept_elo enable row level security;

drop policy if exists "concept_elo_select_own" on public.concept_elo;
create policy "concept_elo_select_own" on public.concept_elo
  for select using (auth.uid() = user_id);

------------------------------------------------------------
-- 2. Elo helpers — expected score + rating update
--    K = 32 for the first 10 games on this concept, then 16.
--    Opponent rating is the drill's declared difficulty:
--      Beginner → 1100, Intermediate → 1400, Advanced → 1700.
------------------------------------------------------------
create or replace function public._nabbit_expected_score(ra int, rb int)
returns numeric
language sql
immutable
as $$
  select 1.0 / (1.0 + power(10.0, (rb - ra) / 400.0));
$$;

create or replace function public._nabbit_k_factor(games int)
returns int
language sql
immutable
as $$
  select case when games < 10 then 32 else 16 end;
$$;

create or replace function public._nabbit_base_rating(difficulty text)
returns int
language sql
immutable
as $$
  select case difficulty
    when 'Beginner'    then 1100
    when 'Intermediate' then 1400
    when 'Advanced'    then 1700
    else 1200
  end;
$$;

------------------------------------------------------------
-- 3. Extend apply_attempt — add Elo update + return new_rating / delta.
--    Signature changes: return columns gain new_rating + delta.
--    0004 callers that don't read those columns stay compatible.
------------------------------------------------------------
-- Replace 0004's apply_attempt with the Elo-aware version. Return columns gain
-- new_rating + delta so the client can show "1420 → 1428 ↑8" on reveal.
drop function if exists public.apply_attempt(jsonb);
create function public.apply_attempt(payload jsonb)
returns table (
  attempt_id      uuid,
  correct         boolean,
  outcome         numeric,
  score           numeric,
  interval_days   int,
  next_review_at  timestamptz,
  streak          int,
  new_rating      int,
  delta           int
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
  v_existing public.recall_items%rowtype;
  v_new_interval int;
  v_new_streak int;
  v_attempt_id uuid;
  v_concept text;
  v_difficulty text;
  v_opp_rating int;
  v_elo public.concept_elo%rowtype;
  v_k int;
  v_expected numeric;
  v_new_rating int;
  v_delta int;
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

  -- Recall item ---------------------------------------------------------------
  select * into v_existing from public.recall_items
   where user_id = uid and challenge_id = payload ->> 'challenge_id';
  if not found then
    v_new_interval := 1;
    v_new_streak := case when v_outcome = 1 then 1 else 0 end;
    insert into public.recall_items (user_id, challenge_id, concept, video_id, interval_days, next_review_at, last_reviewed_at, streak)
    values (
      uid, payload ->> 'challenge_id', v_concept, payload ->> 'video_id',
      v_new_interval, v_now + make_interval(days => v_new_interval), v_now, v_new_streak
    );
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

  -- Concept Elo ---------------------------------------------------------------
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
        games  = public.concept_elo.games + 1,
        updated_at = v_now;

  -- Attempt log ---------------------------------------------------------------
  insert into public.attempts (
    user_id, challenge_id, concept, video_id, difficulty,
    format, chosen, correct, outcome, confidence, time_ms, score, combo_at_time, payload, at
  ) values (
    uid, payload ->> 'challenge_id', v_concept, payload ->> 'video_id', v_difficulty,
    v_format, v_chosen, v_correct, v_outcome,
    payload ->> 'confidence', (payload ->> 'time_ms')::int, (payload ->> 'score')::numeric,
    coalesce((payload ->> 'combo_at_time')::int, 0), payload -> 'input', v_now
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
    v_delta;
end;
$$;

grant execute on function public.apply_attempt(jsonb) to authenticated;
