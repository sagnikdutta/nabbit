-- Nabbit: attribute trial visits to the user who shared the link.
-- Share links carry `ref` = first 10 hex chars of sha256(user id) — anonymous in the URL,
-- but resolvable to a user here. Run after 0002_leads.sql.

alter table public.leads add column if not exists sharer_ref text;
create index if not exists leads_sharer_ref_idx on public.leads (sharer_ref);

-- Replace log_lead with a version that also stores the sharer ref.
drop function if exists public.log_lead(text, text, text, text, text, text);

create or replace function public.log_lead(
  p_visitor_id   text,
  p_challenge_id text,
  p_utm_source   text default null,
  p_utm_medium   text default null,
  p_utm_campaign text default null,
  p_referrer     text default null,
  p_ref          text default null
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

  insert into public.leads (visitor_id, challenge_id, utm_source, utm_medium, utm_campaign, referrer, sharer_ref)
  values (
    p_visitor_id, p_challenge_id,
    left(p_utm_source, 128), left(p_utm_medium, 128), left(p_utm_campaign, 128), left(p_referrer, 512),
    left(p_ref, 32)
  )
  on conflict (visitor_id, challenge_id) do update
    set last_seen_at = now(),
        utm_source   = coalesce(public.leads.utm_source, excluded.utm_source),
        utm_medium   = coalesce(public.leads.utm_medium, excluded.utm_medium),
        utm_campaign = coalesce(public.leads.utm_campaign, excluded.utm_campaign),
        referrer     = coalesce(public.leads.referrer, excluded.referrer),
        sharer_ref   = coalesce(public.leads.sharer_ref, excluded.sharer_ref);
end;
$$;

revoke all on function public.log_lead(text, text, text, text, text, text, text) from public;
grant execute on function public.log_lead(text, text, text, text, text, text, text) to anon, authenticated;

-- Who brings in the most trial visitors? (run in the SQL editor)
create or replace view public.lead_sharers as
select
  u.id          as user_id,
  u.email,
  count(l.*)                                   as trial_visits,
  count(*) filter (where l.completed)          as completed,
  count(*) filter (where l.converted_user_id is not null) as signed_up
from public.users u
join public.leads l
  on l.sharer_ref = left(encode(sha256(convert_to(u.id::text, 'UTF8')), 'hex'), 10)
group by u.id, u.email;

-- Views run with the owner's rights by default; keep this one off the public API.
revoke all on public.lead_sharers from anon, authenticated;
