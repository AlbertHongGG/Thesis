create extension if not exists vector schema extensions;

alter table public.rag_document_chunks
  alter column embedding type vector
  using (
    case
      when embedding is not null then (embedding::text)::vector
      else null
    end
  );

drop function if exists public.match_rag_chunks(vector, double precision, integer);

create or replace function public.match_rag_chunks (
  query_embedding vector,
  kb_id uuid,
  match_threshold float,
  match_count int,
  source_types text[] default array['document']::text[]
)
returns table (
  id text,
  knowledge_base_id uuid,
  document_id uuid,
  filename text,
  source_type text,
  content text,
  preview text,
  summary text,
  keywords jsonb,
  bridging_context text,
  similarity float
)
language sql stable
as $$
  select
    chunks.id,
    chunks.knowledge_base_id,
    chunks.document_id,
    docs.filename,
    docs.source_type,
    chunks.content,
    chunks.preview,
    chunks.summary,
    chunks.keywords,
    chunks.bridging_context,
    1 - (chunks.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.rag_document_chunks chunks
  join public.rag_documents docs on docs.id = chunks.document_id
  where chunks.knowledge_base_id = kb_id
    and docs.knowledge_base_id = kb_id
    and chunks.embedding is not null
    and chunks.status = 'ready'
    and docs.ingest_status = 'ready'
    and (source_types is null or docs.source_type = any(source_types))
    and 1 - (chunks.embedding operator(extensions.<=>) query_embedding) > match_threshold
  order by chunks.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;