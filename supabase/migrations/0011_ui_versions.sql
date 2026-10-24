-- 0011_ui_versions.sql
-- Picks which dashboard the base URL (/) serves.
-- Columns: version (primary key) + default (bool). Row with default=true wins
-- the base-URL redirect; the server falls back to v1 if lookup fails or no
-- row is marked default (v1 = stable product; v2 is still being filled in).

create table if not exists public.ui_versions (
  version text primary key,
  "default" boolean not null default false
);

-- RLS off: public read + public write with the anon key. The choice is a
-- product toggle, not sensitive data.
alter table public.ui_versions disable row level security;

-- Seed the two versions. v1 is default; flip later with:
--   update public.ui_versions set "default" = (version = 'v2');
insert into public.ui_versions (version, "default") values
  ('v1', true),
  ('v2', false)
on conflict (version) do nothing;
