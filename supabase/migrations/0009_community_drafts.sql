-- Nabbit · Phase 8 v3 · migration 0009
-- Community-authored drill drafts + the apply_attempt extensions that v3
-- surfaces need:
--   - is_boss flag on attempts (so Boss-drill runs can be reported back
--     into boss_drills.completed_at + score)
--   - impostor_graded flag on attempts (so Pro-only grading paths can be
--     distinguished for later analytics / content ops)
--
-- Idempotent; safe to re-run.

------------------------------------------------------------
-- 1. Community drafts queue
------------------------------------------------------------
create table if not exists public.community_drafts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references auth.users (id) on delete cascade,
  draft         jsonb not null,                          -- a Challenge-shaped payload
  upvotes       int not null default 0,
  status        text not null default 'queued' check (status in ('queued','published','rejected')),
  created_at    timestamptz not null default now(),
  published_at  timestamptz
);

create index if not exists community_drafts_status_idx on public.community_drafts (status, created_at desc);
create index if not exists community_drafts_author_idx on public.community_drafts (author_id);

alter table public.community_drafts enable row level security;

-- Published drafts are world-readable so the live library can mix them in.
drop policy if exists "community_drafts_read_published" on public.community_drafts;
create policy "community_drafts_read_published" on public.community_drafts
  for select using (status = 'published' or author_id = auth.uid());

-- Upvotes — per-user per-draft. Only lets you push a draft forward; no
-- down-votes in v3 (keeps community civil during cold start).
create table if not exists public.community_upvotes (
  draft_id  uuid not null references public.community_drafts (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  at        timestamptz not null default now(),
  primary key (draft_id, user_id)
);

alter table public.community_upvotes enable row level security;

drop policy if exists "community_upvotes_read_own" on public.community_upvotes;
create policy "community_upvotes_read_own" on public.community_upvotes
  for select using (auth.uid() = user_id);

------------------------------------------------------------
-- 2. attempts gets is_boss + impostor_graded flags
------------------------------------------------------------
alter table public.attempts
  add column if not exists is_boss boolean not null default false;
alter table public.attempts
  add column if not exists impostor_graded boolean not null default false;

------------------------------------------------------------
-- 3. submit_community_draft RPC — write draft on behalf of author.
--    Returns the new row id. draft is validated minimally server-side.
------------------------------------------------------------
drop function if exists public.submit_community_draft(jsonb);
create function public.submit_community_draft(draft jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if draft is null or jsonb_typeof(draft) <> 'object' then
    raise exception 'invalid draft payload';
  end if;
  if (draft ->> 'concept') is null or (draft ->> 'buggyCode') is null then
    raise exception 'draft missing required fields: concept, buggyCode';
  end if;

  insert into public.community_drafts (author_id, draft)
  values (uid, draft)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.submit_community_draft(jsonb) to authenticated;

------------------------------------------------------------
-- 4. upvote_community_draft — one upvote per user; auto-publishes once a
--    draft hits the author's threshold.
--
-- Threshold scales with the submitter's Elo (plan § Pillar 3):
--   avg concept_elo ≥ 1500 → auto-publish at 3 upvotes
--   avg concept_elo ≥ 1300 → 5 upvotes
--   else                   → 10 upvotes
------------------------------------------------------------
drop function if exists public.upvote_community_draft(uuid);
create function public.upvote_community_draft(draft_id uuid)
returns table (upvotes int, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_author uuid;
  v_status text;
  v_votes int;
  v_avg_elo numeric;
  v_threshold int;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select author_id, status into v_author, v_status
    from public.community_drafts
   where id = upvote_community_draft.draft_id;
  if v_author is null then raise exception 'draft not found'; end if;

  -- Idempotent per voter; a repeat upvote is a no-op (not an error).
  insert into public.community_upvotes (draft_id, user_id)
  values (upvote_community_draft.draft_id, uid)
  on conflict (draft_id, user_id) do nothing;

  select count(*)::int into v_votes
    from public.community_upvotes
   where community_upvotes.draft_id = upvote_community_draft.draft_id;

  if v_status = 'queued' then
    select avg(rating)::numeric into v_avg_elo
      from public.concept_elo where user_id = v_author;
    v_threshold := case
      when coalesce(v_avg_elo, 1200) >= 1500 then 3
      when coalesce(v_avg_elo, 1200) >= 1300 then 5
      else 10
    end;
    if v_votes >= v_threshold then
      update public.community_drafts
         set status = 'published',
             upvotes = v_votes,
             published_at = now()
       where id = upvote_community_draft.draft_id;
      v_status := 'published';
    else
      update public.community_drafts
         set upvotes = v_votes
       where id = upvote_community_draft.draft_id;
    end if;
  end if;

  return query select v_votes, v_status;
end;
$$;

grant execute on function public.upvote_community_draft(uuid) to authenticated;

------------------------------------------------------------
-- 5. apply_attempt — extend to accept is_boss / impostor_graded hints
--    and mark the attempt row accordingly. Signature grows but existing
--    callers that don't pass the new keys still work (coalesce → false).
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
  streak             int,
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
  v_streaks public.streaks%rowtype;
  v_global_streak int;
  v_freezes int;
  v_consumed_freeze boolean := false;
  v_is_boss boolean := coalesce((payload ->> 'is_boss')::boolean, false);
  v_impostor_graded boolean := coalesce((payload ->> 'impostor_graded')::boolean, false);
begin
  if uid is null then raise exception 'not authenticated'; end if;

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

  insert into public.streaks (user_id, current, best, freezes, last_freeze_grant_week, last_outcome_at)
  values (uid, 0, 0, 1, v_current_week, v_now)
  on conflict (user_id) do nothing;
  select * into v_streaks from public.streaks where user_id = uid;

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
    else
      v_global_streak := 0;
    end if;
  end if;

  update public.streaks
     set current = v_global_streak,
         best = greatest(best, v_global_streak),
         freezes = v_freezes,
         last_freeze_grant_week = v_streaks.last_freeze_grant_week,
         last_outcome_at = v_now,
         updated_at = v_now
   where user_id = uid;

  insert into public.attempts (
    user_id, challenge_id, concept, video_id, difficulty,
    format, chosen, correct, outcome, confidence, time_ms, score, combo_at_time,
    is_boss, impostor_graded,
    payload, at
  ) values (
    uid, payload ->> 'challenge_id', v_concept, payload ->> 'video_id', v_difficulty,
    v_format, v_chosen, v_correct, v_outcome,
    payload ->> 'confidence', (payload ->> 'time_ms')::int, (payload ->> 'score')::numeric,
    coalesce((payload ->> 'combo_at_time')::int, 0),
    v_is_boss, v_impostor_graded,
    coalesce(payload -> 'input', '{}'::jsonb) || jsonb_build_object('freeze_consumed', v_consumed_freeze),
    v_now
  ) returning id into v_attempt_id;

  -- Boss drill completion: mark the week's boss row done when all 5 drills
  -- have been attempted. Simple threshold — not demanding "all correct".
  if v_is_boss then
    update public.boss_drills bd
       set completed_at = v_now,
           score = coalesce(bd.score, 0) + (payload ->> 'score')::numeric
     where bd.user_id = uid
       and bd.week_start = v_current_week
       and bd.completed_at is null
       and (
         select count(*) from public.attempts a
          where a.user_id = uid
            and a.is_boss
            and a.at >= bd.week_start
            and a.at <  bd.week_start + interval '7 days'
       ) >= coalesce(array_length(bd.challenge_ids, 1), 5);
  end if;

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
