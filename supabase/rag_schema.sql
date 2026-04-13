create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.rag_documents (
  id uuid primary key,
  filename text not null,
  source_type text not null check (source_type in ('document', 'image')),
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

alter table if exists public.rag_documents drop column if exists workflow_key;
alter table if exists public.rag_documents drop column if exists runtime_profile;

alter table if exists public.rag_document_chunks drop column if exists analysis_provider;
alter table if exists public.rag_document_chunks drop column if exists analysis_model;
alter table if exists public.rag_document_chunks drop column if exists embedding_provider;
alter table if exists public.rag_document_chunks drop column if exists embedding_model;
alter table if exists public.rag_document_chunks drop column if exists runtime_profile;

create index if not exists rag_documents_source_type_idx
  on public.rag_documents (source_type, created_at desc);

create index if not exists rag_document_chunks_document_idx
  on public.rag_document_chunks (document_id, chunk_index);

create index if not exists rag_document_chunks_status_idx
  on public.rag_document_chunks (status);

drop trigger if exists rag_documents_set_updated_at on public.rag_documents;
create trigger rag_documents_set_updated_at
before update on public.rag_documents
for each row execute function public.set_updated_at();

drop trigger if exists rag_document_chunks_set_updated_at on public.rag_document_chunks;
create trigger rag_document_chunks_set_updated_at
before update on public.rag_document_chunks
for each row execute function public.set_updated_at();