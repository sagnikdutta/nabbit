-- Nabbit: public.leads — one row per (anonymous visitor, trial challenge) so shared
-- challenge links (LinkedIn etc.) can be measured and retargeted later.
-- Run in the Supabase SQL editor after 0001_users.sql.

create table if not exists public.leads (
  id                 uuid primary key default gen_random_uuid(),
  visitor_id         text not null,              -- random id kept in the visitor's browser
  challenge_id       text not null,              -- challenge id taken from the shared URL
  utm_source         text,
  utm_medium         text,
  utm_campaign       text,
  referrer           text,
  completed          boolean not null default false,   -- submitted an answer in the trial
  answered_correctly boolean,
  converted_user_id  uuid references auth.users (id) on delete set null,  -- set once they sign up
  first_seen_at      timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  completed_at       timestamptz,
  unique (visitor_id, challenge_id)
);

create index if not exists leads_challenge_idx on public.leads (challenge_id);
create index if not exists leads_converted_idx on public.leads (converted_user_id);

-- No direct table access for the public API; everything goes through the functions below.
-- (Read the table from the dashboard / service role for advertising exports.)
alter table public.leads enable row level security;

-- Visitor opened a trial challenge. Safe to call repeatedly.
create or replace function public.log_lead(
  p_visitor_id   text,
  p_challenge_id text,
  p_utm_source   text default null,
  p_utm_medium   text default null,
  p_utm_campaign text default null,
  p_referrer     text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(length(p_visitor_id), 0) = 0 or length(p_visitor_id) > 64
     or coalesce(length(p_challenge_id), 0) = 0 or length(p_challenge_id) > 128 then
    return;
  end if;

  insert into public.leads (visitor_id, challenge_id, utm_source, utm_medium, utm_campaign, referrer)
  values (
    p_visitor_id, p_challenge_id,
    left(p_utm_source, 128), left(p_utm_medium, 128), left(p_utm_campaign, 128), left(p_referrer, 512)
  )
  on conflict (visitor_id, challenge_id) do update
    set last_seen_at = now(),
        utm_source   = coalesce(public.leads.utm_source, excluded.utm_source),
        utm_medium   = coalesce(public.leads.utm_medium, excluded.utm_medium),
        utm_campaign = coalesce(public.leads.utm_campaign, excluded.utm_campaign),
        referrer     = coalesce(public.leads.referrer, excluded.referrer);
end;
$$;

-- Visitor finished the trial challenge (right before the sign-up redirect).
create or replace function public.complete_lead(
  p_visitor_id   text,
  p_challenge_id text,
  p_correct      boolean
) returns void
language sql
security definer
set search_path = public
as $$
  update public.leads
     set completed = true,
         answered_correctly = p_correct,
         completed_at = now(),
         last_seen_at = now()
   where visitor_id = p_visitor_id
     and challenge_id = p_challenge_id;
$$;

-- Signed-in user links their earlier trial visits to their account.
create or replace function public.claim_leads(p_visitor_id text) returns void
language sql
security definer
set search_path = public
as $$
  update public.leads
     set converted_user_id = auth.uid()
   where visitor_id = p_visitor_id
     and auth.uid() is not null
     and converted_user_id is null;
$$;

revoke all on function public.log_lead(text, text, text, text, text, text) from public;
revoke all on function public.complete_lead(text, text, boolean) from public;
revoke all on function public.claim_leads(text) from public;
grant execute on function public.log_lead(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.complete_lead(text, text, boolean) to anon, authenticated;
grant execute on function public.claim_leads(text) to authenticated;
