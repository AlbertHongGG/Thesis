create extension if not exists vector schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop table if exists public.knowledge_unit_relations cascade;
drop table if exists public.knowledge_operations cascade;
drop table if exists public.knowledge_units cascade;
drop table if exists public.knowledge_sources cascade;
drop table if exists public.rag_units cascade;
drop table if exists public.rag_sources cascade;
drop table if exists public.rag_document_chunks cascade;
drop table if exists public.rag_documents cascade;
drop table if exists public.knowledge_profiles cascade;
drop table if exists public.knowledge_bases cascade;

create table if not exists public.knowledge_bases (
  id uuid primary key,
  slug text not null unique,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.knowledge_profiles (
  knowledge_base_id uuid primary key references public.knowledge_bases(id) on delete cascade,
  summary text not null default '',
  focus_areas text[] not null default '{}'::text[],
  key_terms text[] not null default '{}'::text[],
  source_count integer not null default 0,
  unit_count integer not null default 0,
  version integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.knowledge_sources (
  id uuid primary key,
  knowledge_base_id uuid not null references public.knowledge_bases(id) on delete cascade,
  canonical_path text not null,
  title text not null,
  source_type text not null check (source_type in ('document', 'image')),
  preview_kind text not null,
  raw_preview text,
  summary text not null default '',
  terms text[] not null default '{}'::text[],
  entities text[] not null default '{}'::text[],
  structure jsonb,
  total_unit_count integer not null default 0,
  total_char_count integer not null default 0,
  processing_duration_ms integer,
  ingest_status text not null default 'ready' check (ingest_status in ('ready', 'error', 'archived')),
  prompt_variant text not null default 'ingest',
  metadata_version integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (knowledge_base_id, canonical_path)
);

create table if not exists public.knowledge_units (
  id text primary key,
  knowledge_base_id uuid not null references public.knowledge_bases(id) on delete cascade,
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  unit_type text not null,
  sequence integer not null,
  content text not null,
  preview text not null,
  summary text not null default '',
  terms text[] not null default '{}'::text[],
  entities text[] not null default '{}'::text[],
  relation_hints jsonb not null default '[]'::jsonb,
  status text not null default 'ready' check (status in ('ready', 'error')),
  error_message text,
  embedding extensions.vector,
  embedding_dimensions integer,
  word_count integer not null default 0,
  char_count integer not null default 0,
  start_offset integer not null default 0,
  end_offset integer not null default 0,
  metadata_version integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (source_id, unit_type, sequence)
);

create table if not exists public.knowledge_unit_relations (
  source_unit_id text not null references public.knowledge_units(id) on delete cascade,
  target_unit_id text not null references public.knowledge_units(id) on delete cascade,
  knowledge_base_id uuid not null references public.knowledge_bases(id) on delete cascade,
  relation_kind text not null check (relation_kind in ('depends-on', 'continues', 'compares', 'explains', 'references', 'supports')),
  relation_label text not null,
  score double precision not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (source_unit_id, target_unit_id, relation_kind),
  check (source_unit_id <> target_unit_id)
);

create table if not exists public.knowledge_operations (
  id uuid primary key,
  knowledge_base_id uuid not null references public.knowledge_bases(id) on delete cascade,
  operation_kind text not null check (operation_kind in ('ingest', 'rebuild-profile', 'reindex')),
  status text not null check (status in ('running', 'completed', 'failed')),
  source_id uuid,
  source_path text,
  summary text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

insert into public.knowledge_bases (id, slug, name, description, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'thesis-research',
  'Thesis Research',
  'Default knowledge base for thesis-domain ingestion.',
  'active'
)
on conflict (id) do update
set slug = excluded.slug,
    name = excluded.name,
    description = excluded.description,
    status = excluded.status;

insert into public.knowledge_profiles (knowledge_base_id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (knowledge_base_id) do nothing;

create index if not exists knowledge_bases_status_idx
  on public.knowledge_bases (status, updated_at desc);

create index if not exists knowledge_sources_knowledge_base_idx
  on public.knowledge_sources (knowledge_base_id, updated_at desc);

create index if not exists knowledge_sources_source_type_idx
  on public.knowledge_sources (knowledge_base_id, source_type, updated_at desc);

create index if not exists knowledge_sources_status_idx
  on public.knowledge_sources (knowledge_base_id, ingest_status, updated_at desc);

create index if not exists knowledge_units_knowledge_base_idx
  on public.knowledge_units (knowledge_base_id, sequence);

create index if not exists knowledge_units_source_idx
  on public.knowledge_units (source_id, sequence);

create index if not exists knowledge_units_status_idx
  on public.knowledge_units (knowledge_base_id, status);

create index if not exists knowledge_unit_relations_knowledge_base_idx
  on public.knowledge_unit_relations (knowledge_base_id, source_unit_id);

create index if not exists knowledge_unit_relations_target_idx
  on public.knowledge_unit_relations (target_unit_id);

create index if not exists knowledge_operations_knowledge_base_idx
  on public.knowledge_operations (knowledge_base_id, created_at desc);

create index if not exists knowledge_operations_status_idx
  on public.knowledge_operations (status, created_at desc);

drop index if exists public.rag_units_embedding_idx;
drop index if exists public.knowledge_units_embedding_idx;

drop trigger if exists knowledge_bases_set_updated_at on public.knowledge_bases;
create trigger knowledge_bases_set_updated_at
before update on public.knowledge_bases
for each row execute function public.set_updated_at();

drop trigger if exists knowledge_profiles_set_updated_at on public.knowledge_profiles;
create trigger knowledge_profiles_set_updated_at
before update on public.knowledge_profiles
for each row execute function public.set_updated_at();

drop trigger if exists knowledge_sources_set_updated_at on public.knowledge_sources;
create trigger knowledge_sources_set_updated_at
before update on public.knowledge_sources
for each row execute function public.set_updated_at();

drop trigger if exists knowledge_units_set_updated_at on public.knowledge_units;
create trigger knowledge_units_set_updated_at
before update on public.knowledge_units
for each row execute function public.set_updated_at();

drop trigger if exists knowledge_operations_set_updated_at on public.knowledge_operations;
create trigger knowledge_operations_set_updated_at
before update on public.knowledge_operations
for each row execute function public.set_updated_at();