-- Nabbit: public.users table mirroring Supabase Auth registrations.
-- Run in the Supabase SQL editor (or `supabase db push`).

create table if not exists public.users (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text unique not null,
  phone_number        text not null default '',
  phone_country_code  text not null default '+1',
  display_name        text,
  email_verified      boolean not null default false,
  phone_verified      boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

-- Users may edit only their profile fields; id/email/verification flags are managed by triggers.
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- On registration (auth.users insert) create the matching public.users row.
-- Runs server-side, so it works even when email confirmation means no session exists yet.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, phone_number, phone_country_code, display_name, email_verified, created_at)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'phone_number', ''),
    coalesce(new.raw_user_meta_data ->> 'phone_country_code', '+1'),
    split_part(lower(new.email), '@', 1),
    new.email_confirmed_at is not null,
    coalesce(new.created_at, now())
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keep verification flags / email in sync when auth.users changes (e.g. email confirmed).
create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
     set email          = lower(new.email),
         email_verified = new.email_confirmed_at is not null,
         phone_verified = new.phone_confirmed_at is not null,
         updated_at     = now()
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_auth_user_updated();

-- Backfill users registered before this migration.
insert into public.users (id, email, phone_number, phone_country_code, display_name, email_verified, phone_verified, created_at)
select
  u.id,
  lower(u.email),
  coalesce(u.raw_user_meta_data ->> 'phone_number', ''),
  coalesce(u.raw_user_meta_data ->> 'phone_country_code', '+1'),
  split_part(lower(u.email), '@', 1),
  u.email_confirmed_at is not null,
  u.phone_confirmed_at is not null,
  u.created_at
from auth.users u
where u.email is not null
on conflict (id) do nothing;
