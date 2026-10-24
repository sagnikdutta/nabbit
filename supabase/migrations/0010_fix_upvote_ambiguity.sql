-- Nabbit · Phase 8 v3 · migration 0010
-- Hotfix for 0009's upvote_community_draft:
--   "column reference 'status' is ambiguous" — the RETURNS TABLE column
--   `status` collided with the table column `community_drafts.status` inside
--   the function body.
--
-- Fix: rename the returned columns with an _out suffix so PL/pgSQL's
-- implicit OUT parameters don't clash with the table column. Also qualify
-- the status SELECT with the `cd.` table alias to be explicit.
--
-- Clients read `upvotes_out` + `status_out`.
--
-- Idempotent (drop-then-create).

drop function if exists public.upvote_community_draft(uuid);
create function public.upvote_community_draft(draft_id uuid)
returns table (upvotes_out int, status_out text)
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

  select author_id, cd.status into v_author, v_status
    from public.community_drafts cd
   where cd.id = upvote_community_draft.draft_id;
  if v_author is null then raise exception 'draft not found'; end if;

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
