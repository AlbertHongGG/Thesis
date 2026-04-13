create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

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
  research_questions jsonb not null default '[]'::jsonb,
  methods jsonb not null default '[]'::jsonb,
  recent_updates jsonb not null default '[]'::jsonb,
  source_count integer not null default 0,
  chunk_count integer not null default 0,
  version integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rag_documents (
  id uuid primary key,
  knowledge_base_id uuid references public.knowledge_bases(id) on delete cascade,
  filename text not null,
  source_type text not null check (source_type in ('document', 'image')),
  ingest_status text not null default 'ready' check (ingest_status in ('ingesting', 'ready', 'error', 'archived')),
  preview_kind text not null,
  summary text,
  description text,
  parsed_text_preview text,
  source_preview text,
  context_applied boolean not null default false,
  chunk_count integer not null default 0,
  total_char_count integer not null default 0,
  processing_duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rag_document_chunks (
  id text primary key,
  knowledge_base_id uuid references public.knowledge_bases(id) on delete cascade,
  document_id uuid not null references public.rag_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  preview text not null,
  summary text,
  keywords jsonb not null default '[]'::jsonb,
  bridging_context text,
  related_chunks jsonb not null default '[]'::jsonb,
  embedding jsonb,
  embedding_dimensions integer,
  word_count integer not null default 0,
  char_count integer not null default 0,
  start_offset integer not null default 0,
  end_offset integer not null default 0,
  status text not null default 'ready' check (status in ('ready', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (document_id, chunk_index)
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

alter table if exists public.rag_documents add column if not exists knowledge_base_id uuid references public.knowledge_bases(id) on delete cascade;
alter table if exists public.rag_documents add column if not exists ingest_status text not null default 'ready' check (ingest_status in ('ingesting', 'ready', 'error', 'archived'));
update public.rag_documents
set knowledge_base_id = '00000000-0000-0000-0000-000000000001'
where knowledge_base_id is null;
alter table if exists public.rag_documents alter column knowledge_base_id set not null;

alter table if exists public.rag_document_chunks add column if not exists knowledge_base_id uuid references public.knowledge_bases(id) on delete cascade;
update public.rag_document_chunks chunks
set knowledge_base_id = docs.knowledge_base_id
from public.rag_documents docs
where docs.id = chunks.document_id
  and chunks.knowledge_base_id is null;
update public.rag_document_chunks
set knowledge_base_id = '00000000-0000-0000-0000-000000000001'
where knowledge_base_id is null;
alter table if exists public.rag_document_chunks alter column knowledge_base_id set not null;

alter table if exists public.rag_documents drop column if exists workflow_key;
alter table if exists public.rag_documents drop column if exists runtime_profile;

alter table if exists public.rag_document_chunks drop column if exists analysis_provider;
alter table if exists public.rag_document_chunks drop column if exists analysis_model;
alter table if exists public.rag_document_chunks drop column if exists embedding_provider;
alter table if exists public.rag_document_chunks drop column if exists embedding_model;
alter table if exists public.rag_document_chunks drop column if exists runtime_profile;

create index if not exists knowledge_bases_status_idx
  on public.knowledge_bases (status, updated_at desc);

create index if not exists rag_documents_knowledge_base_idx
  on public.rag_documents (knowledge_base_id, created_at desc);

create index if not exists rag_documents_source_type_idx
  on public.rag_documents (knowledge_base_id, source_type, created_at desc);

create index if not exists rag_documents_status_idx
  on public.rag_documents (knowledge_base_id, ingest_status, updated_at desc);

create index if not exists rag_document_chunks_knowledge_base_idx
  on public.rag_document_chunks (knowledge_base_id, chunk_index);

create index if not exists rag_document_chunks_document_idx
  on public.rag_document_chunks (document_id, chunk_index);

create index if not exists rag_document_chunks_status_idx
  on public.rag_document_chunks (knowledge_base_id, status);

drop trigger if exists knowledge_bases_set_updated_at on public.knowledge_bases;
create trigger knowledge_bases_set_updated_at
before update on public.knowledge_bases
for each row execute function public.set_updated_at();

drop trigger if exists knowledge_profiles_set_updated_at on public.knowledge_profiles;
create trigger knowledge_profiles_set_updated_at
before update on public.knowledge_profiles
for each row execute function public.set_updated_at();

drop trigger if exists rag_documents_set_updated_at on public.rag_documents;
create trigger rag_documents_set_updated_at
before update on public.rag_documents
for each row execute function public.set_updated_at();

drop trigger if exists rag_document_chunks_set_updated_at on public.rag_document_chunks;
create trigger rag_document_chunks_set_updated_at
before update on public.rag_document_chunks
for each row execute function public.set_updated_at();