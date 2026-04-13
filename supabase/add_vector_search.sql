-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector schema extensions;

-- Change the existing "embedding" column from JSONB to VECTOR.
-- The generic "vector" type is used because dimensions might vary depending on the model, 
-- though it's recommended to standardize.
alter table public.rag_document_chunks 
  alter column embedding type vector 
  using (
    case 
      when embedding is not null then (embedding::text)::vector 
      else null 
    end
  );

-- Create the search function for similarity matching
create or replace function public.match_rag_chunks (
  query_embedding vector,
  match_threshold float,
  match_count int
)
returns table (
  id text,
  document_id uuid,
  content text,
  summary text,
  similarity float
)
language sql stable
as $$
  select
    rag_document_chunks.id,
    rag_document_chunks.document_id,
    rag_document_chunks.content,
    rag_document_chunks.summary,
    1 - (rag_document_chunks.embedding <=> query_embedding) as similarity
  from rag_document_chunks
  where 1 - (rag_document_chunks.embedding <=> query_embedding) > match_threshold
  order by rag_document_chunks.embedding <=> query_embedding
  limit match_count;
$$;
