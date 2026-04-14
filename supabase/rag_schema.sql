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
  focus_areas jsonb not null default '[]'::jsonb,
  key_terms jsonb not null default '[]'::jsonb,
  source_count integer not null default 0,
  unit_count integer not null default 0,
  version integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rag_sources (
  id uuid primary key,
  knowledge_base_id uuid not null references public.knowledge_bases(id) on delete cascade,
  title text not null,
  canonical_path text not null,
  source_type text not null check (source_type in ('document', 'image')),
  ingest_status text not null default 'ready' check (ingest_status in ('ingesting', 'ready', 'error', 'archived')),
  preview_kind text not null,
  raw_preview text,
  total_unit_count integer not null default 0,
  total_char_count integer not null default 0,
  processing_duration_ms integer,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rag_units (
  id text primary key,
  knowledge_base_id uuid not null references public.knowledge_bases(id) on delete cascade,
  source_id uuid not null references public.rag_sources(id) on delete cascade,
  unit_type text not null,
  sequence integer not null,
  content text not null,
  preview text not null,
  related_units jsonb not null default '[]'::jsonb,
  embedding extensions.vector,
  embedding_dimensions integer,
  word_count integer not null default 0,
  char_count integer not null default 0,
  start_offset integer not null default 0,
  end_offset integer not null default 0,
  status text not null default 'ready' check (status in ('ready', 'error')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (source_id, unit_type, sequence)
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

create index if not exists rag_sources_knowledge_base_idx
  on public.rag_sources (knowledge_base_id, created_at desc);

create index if not exists rag_sources_source_type_idx
  on public.rag_sources (knowledge_base_id, source_type, created_at desc);

create index if not exists rag_sources_status_idx
  on public.rag_sources (knowledge_base_id, ingest_status, updated_at desc);

create index if not exists rag_units_knowledge_base_idx
  on public.rag_units (knowledge_base_id, sequence);

create index if not exists rag_units_source_idx
  on public.rag_units (source_id, sequence);

create index if not exists rag_units_status_idx
  on public.rag_units (knowledge_base_id, status);

drop index if exists public.rag_units_embedding_idx;

drop trigger if exists knowledge_bases_set_updated_at on public.knowledge_bases;
create trigger knowledge_bases_set_updated_at
before update on public.knowledge_bases
for each row execute function public.set_updated_at();

drop trigger if exists knowledge_profiles_set_updated_at on public.knowledge_profiles;
create trigger knowledge_profiles_set_updated_at
before update on public.knowledge_profiles
for each row execute function public.set_updated_at();

drop trigger if exists rag_sources_set_updated_at on public.rag_sources;
create trigger rag_sources_set_updated_at
before update on public.rag_sources
for each row execute function public.set_updated_at();

drop trigger if exists rag_units_set_updated_at on public.rag_units;
create trigger rag_units_set_updated_at
before update on public.rag_units
for each row execute function public.set_updated_at();