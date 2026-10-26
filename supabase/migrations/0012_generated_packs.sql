-- 0012_generated_packs.sql
-- Importer v2 Pass #1: cache the JSON pack a successful import returns so
-- re-importing the same YouTube video is instant and costs zero AI calls.
--
-- Reads: public (anyone with the anon key may read a cached pack).
-- Writes: ONLY through upsert_generated_pack (security definer) so clients
--         can't poison the cache with arbitrary content; the RPC validates
--         the pack has the minimum shape the import endpoint ever stores.
--
-- Vote columns (upvotes/downvotes) are reserved for the follow-up pass
-- that lets users flag a bad pack for re-generation.

create table if not exists public.generated_packs (
  youtube_id text primary key,
  pack       jsonb not null,
  source     text,
  upvotes    int not null default 0,
  downvotes  int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists generated_packs_created_at_idx
  on public.generated_packs (created_at desc);

alter table public.generated_packs enable row level security;

drop policy if exists "read generated_packs" on public.generated_packs;
create policy "read generated_packs" on public.generated_packs
  for select using (true);

-- No public insert/update/delete policy: writes go through upsert_generated_pack
-- (security definer) which bypasses RLS and validates shape first.

create or replace function public.upsert_generated_pack(
  p_youtube_id text,
  p_pack jsonb,
  p_source text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_youtube_id is null or length(trim(p_youtube_id)) = 0 then
    raise exception 'youtube_id required';
  end if;
  if p_pack is null
     or p_pack->'video' is null
     or p_pack->'challenges' is null
     or jsonb_typeof(p_pack->'challenges') <> 'array'
     or jsonb_array_length(p_pack->'challenges') = 0 then
    raise exception 'pack must contain video and a non-empty challenges array';
  end if;

  insert into public.generated_packs (youtube_id, pack, source)
  values (p_youtube_id, p_pack, p_source)
  on conflict (youtube_id) do update
    set pack       = excluded.pack,
        source     = excluded.source,
        upvotes    = 0,
        downvotes  = 0,
        created_at = now();
end;
$$;

grant execute on function public.upsert_generated_pack(text, jsonb, text)
  to anon, authenticated;
