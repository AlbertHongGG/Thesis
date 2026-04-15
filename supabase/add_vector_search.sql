create extension if not exists vector schema extensions;

drop function if exists public.match_rag_units(vector, uuid, float, int, text[]);
drop function if exists public.match_knowledge_units(vector, uuid, float, int, text[]);

create or replace function public.match_knowledge_units (
  query_embedding vector,
  kb_id uuid,
  match_threshold float,
  match_count int,
  source_types text[] default array['document']::text[]
)
returns table (
  id text,
  knowledge_base_id uuid,
  source_id uuid,
  title text,
  canonical_path text,
  source_type text,
  unit_type text,
  content text,
  preview text,
  summary text,
  terms text[],
  entities text[],
  relation_hints text[],
  similarity float
)
language sql stable
as $$
  select
    units.id,
    units.knowledge_base_id,
    units.source_id,
    sources.title,
    sources.canonical_path,
    sources.source_type,
    units.unit_type,
    units.content,
    units.preview,
    units.summary,
    units.terms,
    units.entities,
    coalesce(
      array(
        select item->>'label'
        from jsonb_array_elements(coalesce(units.relation_hints, '[]'::jsonb)) item
        where coalesce(item->>'label', '') <> ''
      ),
      array[]::text[]
    ),
    1 - (units.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.knowledge_units units
  join public.knowledge_sources sources on sources.id = units.source_id
  where units.knowledge_base_id = kb_id
    and sources.knowledge_base_id = kb_id
    and units.embedding is not null
    and units.status = 'ready'
    and sources.ingest_status = 'ready'
    and (
      source_types is null
      or array_length(source_types, 1) is null
      or sources.source_type = any(source_types)
    )
    and 1 - (units.embedding operator(extensions.<=>) query_embedding) > match_threshold
  order by units.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;