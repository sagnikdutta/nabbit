-- Nabbit · Phase 8 v2 · migration 0004
-- Progress sync (attempts + recall_items) + Pro flag.
-- Apply in the Supabase SQL editor; idempotent and safe to re-run.

------------------------------------------------------------
-- 1. Pro flag on existing public.users
------------------------------------------------------------
alter table public.users
  add column if not exists is_pro boolean not null default false;

------------------------------------------------------------
-- 2. Per-attempt log — one row per submit
------------------------------------------------------------
create table if not exists public.attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  challenge_id  text not null,
  concept       text not null,
  video_id      text not null,
  difficulty    text not null check (difficulty in ('Beginner','Intermediate','Advanced')),
  format        text not null check (format in ('spot-fix','locate-then-fix','rank-fixes','blind-fix','diff-review','impostor','red-herring')),
  chosen        int,                  -- for spot-fix / locate-then-fix / impostor; -1 for rank-fixes/blind-fix
  correct       boolean not null,     -- true iff outcome = 1
  outcome       numeric not null check (outcome in (0, 0.5, 1)),
  confidence    text not null check (confidence in ('guess','sure','certain')),
  time_ms       int not null check (time_ms >= 0),
  score         numeric not null,
  combo_at_time int not null default 0,
  payload       jsonb,                -- full AttemptInput + format-specifics (line, order, patch, ...)
  at            timestamptz not null default now()
);

create index if not exists attempts_user_at_idx on public.attempts (user_id, at desc);
create index if not exists attempts_user_concept_idx on public.attempts (user_id, concept);

alter table public.attempts enable row level security;

-- RLS: own rows only. Writes go via apply_attempt() / merge_local_progress() (security definer).
drop policy if exists "attempts_select_own" on public.attempts;
create policy "attempts_select_own" on public.attempts
  for select using (auth.uid() = user_id);

------------------------------------------------------------
-- 3. Spaced-recall item per (user, challenge)
------------------------------------------------------------
create table if not exists public.recall_items (
  user_id          uuid not null references auth.users (id) on delete cascade,
  challenge_id     text not null,
  concept          text not null,
  video_id         text not null,
  interval_days    int not null check (interval_days in (1, 3, 7, 14, 30)),
  next_review_at   timestamptz not null,
  last_reviewed_at timestamptz not null,
  streak           int not null default 0,
  primary key (user_id, challenge_id)
);

create index if not exists recall_items_user_due_idx
  on public.recall_items (user_id, next_review_at);

alter table public.recall_items enable row level security;

drop policy if exists "recall_select_own" on public.recall_items;
create policy "recall_select_own" on public.recall_items
  for select using (auth.uid() = user_id);

------------------------------------------------------------
-- 4. Helpers: SRS interval advancement (matches src/lib/recall.ts)
------------------------------------------------------------
create or replace function public._nabbit_next_interval(current_interval int, outcome numeric)
returns int
language sql
immutable
as $$
  select case
    when outcome = 0 then 1                              -- miss → reset to 1 day
    when outcome = 0.5 then current_interval             -- partial → hold interval
    when current_interval = 1  then 3
    when current_interval = 3  then 7
    when current_interval = 7  then 14
    when current_interval = 14 then 30
    when current_interval = 30 then 30
    else 1
  end;
$$;

------------------------------------------------------------
-- 5. apply_attempt — the single write path from the client
--
-- Payload shape (JSON, keys snake_case):
--   challenge_id, concept, video_id, difficulty  (string)
--   format, chosen, confidence                   (string / int)
--   correct_option                               (int, 0-indexed, for server-side spot-fix re-grade)
--   time_ms, score, combo_at_time, outcome       (number)
--   input                                        (jsonb — full AttemptInput)
--
-- Returns one row: { attempt_id, correct, outcome, score, interval_days, next_review_at, streak }
--
-- Later migrations extend this function to also update concept_elo (0005) and
-- streaks (0008). Signature stays stable.
------------------------------------------------------------
-- Drop-then-create so later migrations (0005, 0008) can extend the return type.
drop function if exists public.apply_attempt(jsonb);
create function public.apply_attempt(payload jsonb)
returns table (
  attempt_id      uuid,
  correct         boolean,
  outcome         numeric,
  score           numeric,
  interval_days   int,
  next_review_at  timestamptz,
  streak          int
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
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  v_format := payload ->> 'format';
  v_chosen := nullif(payload ->> 'chosen', '')::int;
  v_correct_option := nullif(payload ->> 'correct_option', '')::int;
  v_outcome := (payload ->> 'outcome')::numeric;

  -- Server-side re-grade for spot-fix (deterministic; client authority still applies for
  -- other formats until later migrations re-grade them in SQL).
  if v_format = 'spot-fix' and v_correct_option is not null and v_chosen is not null then
    v_outcome := case when v_chosen = v_correct_option then 1 else 0 end;
  end if;

  if v_outcome not in (0, 0.5, 1) then
    raise exception 'invalid outcome: %', v_outcome;
  end if;
  v_correct := v_outcome = 1;

  -- Load or create the recall_items row for this (user, challenge).
  select * into v_existing
    from public.recall_items
   where user_id = uid and challenge_id = payload ->> 'challenge_id';

  if not found then
    v_new_interval := 1;
    v_new_streak := case when v_outcome = 1 then 1 else 0 end;
    insert into public.recall_items (user_id, challenge_id, concept, video_id, interval_days, next_review_at, last_reviewed_at, streak)
    values (
      uid,
      payload ->> 'challenge_id',
      payload ->> 'concept',
      payload ->> 'video_id',
      v_new_interval,
      v_now + make_interval(days => v_new_interval),
      v_now,
      v_new_streak
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

  insert into public.attempts (
    user_id, challenge_id, concept, video_id, difficulty,
    format, chosen, correct, outcome, confidence, time_ms, score, combo_at_time, payload, at
  ) values (
    uid,
    payload ->> 'challenge_id',
    payload ->> 'concept',
    payload ->> 'video_id',
    payload ->> 'difficulty',
    v_format,
    v_chosen,
    v_correct,
    v_outcome,
    payload ->> 'confidence',
    (payload ->> 'time_ms')::int,
    (payload ->> 'score')::numeric,
    coalesce((payload ->> 'combo_at_time')::int, 0),
    payload -> 'input',
    v_now
  )
  returning id into v_attempt_id;

  return query select
    v_attempt_id,
    v_correct,
    v_outcome,
    (payload ->> 'score')::numeric,
    v_new_interval,
    v_now + make_interval(days => v_new_interval),
    v_new_streak;
end;
$$;

grant execute on function public.apply_attempt(jsonb) to authenticated;

------------------------------------------------------------
-- 6. merge_local_progress — one-shot first-sign-in push of local attempts +
-- recall items. Idempotent on (user_id, challenge_id, at).
--
-- Payload: { attempts: [...], recall_items: [...] }  (each item uses the same
-- shape as apply_attempt's payload, minus server-computed fields).
------------------------------------------------------------
create or replace function public.merge_local_progress(payload jsonb)
returns table (attempts_imported int, recall_imported int)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_attempts jsonb := coalesce(payload -> 'attempts', '[]'::jsonb);
  v_recall   jsonb := coalesce(payload -> 'recall_items', '[]'::jsonb);
  v_att_count int := 0;
  v_rec_count int := 0;
  v_last_rows int := 0;
  r jsonb;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Attempts: dedupe on (user_id, challenge_id, at).
  for r in select * from jsonb_array_elements(v_attempts) loop
    insert into public.attempts (
      user_id, challenge_id, concept, video_id, difficulty,
      format, chosen, correct, outcome, confidence, time_ms, score, combo_at_time, payload, at
    )
    select
      uid,
      r ->> 'challenge_id',
      coalesce(r ->> 'concept', ''),
      coalesce(r ->> 'video_id', ''),
      coalesce(r ->> 'difficulty', 'Beginner'),
      coalesce(r ->> 'format', 'spot-fix'),
      nullif(r ->> 'chosen', '')::int,
      (r ->> 'correct')::boolean,
      coalesce((r ->> 'outcome')::numeric, case when (r ->> 'correct')::boolean then 1 else 0 end),
      coalesce(r ->> 'confidence', 'sure'),
      coalesce((r ->> 'time_ms')::int, 0),
      coalesce((r ->> 'score')::numeric, 0),
      coalesce((r ->> 'combo_at_time')::int, 0),
      r -> 'input',
      to_timestamp((r ->> 'at')::bigint / 1000.0)
    where not exists (
      select 1 from public.attempts a
       where a.user_id = uid
         and a.challenge_id = r ->> 'challenge_id'
         and a.at = to_timestamp((r ->> 'at')::bigint / 1000.0)
    );
    get diagnostics v_last_rows = row_count;
    v_att_count := v_att_count + v_last_rows;
  end loop;

  -- Recall items: upsert, keep whichever interval is larger (server wins ties).
  for r in select * from jsonb_array_elements(v_recall) loop
    insert into public.recall_items (user_id, challenge_id, concept, video_id, interval_days, next_review_at, last_reviewed_at, streak)
    values (
      uid,
      r ->> 'challenge_id',
      coalesce(r ->> 'concept', ''),
      coalesce(r ->> 'video_id', ''),
      coalesce((r ->> 'interval_days')::int, 1),
      to_timestamp((r ->> 'next_review_at')::bigint / 1000.0),
      to_timestamp((r ->> 'last_reviewed_at')::bigint / 1000.0),
      coalesce((r ->> 'streak')::int, 0)
    )
    on conflict (user_id, challenge_id) do update
      set interval_days    = greatest(public.recall_items.interval_days, excluded.interval_days),
          next_review_at   = greatest(public.recall_items.next_review_at, excluded.next_review_at),
          last_reviewed_at = greatest(public.recall_items.last_reviewed_at, excluded.last_reviewed_at),
          streak           = greatest(public.recall_items.streak, excluded.streak);
    v_rec_count := v_rec_count + 1;
  end loop;

  return query select v_att_count, v_rec_count;
end;
$$;

grant execute on function public.merge_local_progress(jsonb) to authenticated;
