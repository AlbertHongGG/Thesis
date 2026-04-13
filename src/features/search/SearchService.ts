import { createAiRuntimeFromConfig } from '@/ai';
import { loadIngestFeatureConfig } from '@/features/ingest/config';
import { supabaseAdmin } from '@/lib/supabase';

export interface SearchResult {
  id: string;
  documentId: string;
  content: string;
  summary: string;
  similarity: number;
}

export class SearchService {
  async search(query: string, matchCount = 5): Promise<SearchResult[]> {
    // We reuse the ingest feature config to ensure we use identical embedding models
    const featureConfig = loadIngestFeatureConfig();
    const runtime = createAiRuntimeFromConfig(featureConfig.runtime);
    
    // 1. Generate Embedding for the query
    const queryEmbedding = await runtime.createEmbedding({ text: query });
    const normalizedEmbedding = queryEmbedding.map(value => Number(value.toFixed(8)));

    // 2. Query Supabase via match_rag_chunks RPC
    const { data, error } = await supabaseAdmin.rpc('match_rag_chunks', {
      query_embedding: normalizedEmbedding,
      match_threshold: 0.3, // You can adjust this threshold based on the model
      match_count: matchCount,
    });

    if (error) {
      console.error('Supabase Search Error:', error);
      throw new Error(`Failed to query vectors: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      summary: row.summary,
      similarity: row.similarity,
    }));
  }
}
