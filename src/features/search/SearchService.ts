import { createAiRuntimeFromConfig } from '@/ai';
import { loadIngestFeatureConfig } from '@/features/ingest/config';
import { SupabaseIngestRepository } from '@/features/ingest/SupabaseIngestRepository';
import { supabaseAdmin } from '@/lib/supabase';

export interface SearchResult {
  id: string;
  knowledgeBaseId: string;
  documentId: string;
  filename: string;
  sourceType: 'document' | 'image';
  content: string;
  summary: string;
  keywords: string[];
  similarity: number;
}

export class SearchService {
  async search(knowledgeBaseId: string, query: string, matchCount = 5): Promise<SearchResult[]> {
    const featureConfig = loadIngestFeatureConfig();
    const runtime = createAiRuntimeFromConfig(featureConfig.runtime);
    const queryEmbedding = await runtime.createEmbedding({ text: query });
    const repository = new SupabaseIngestRepository(supabaseAdmin);
    const rows = await repository.retrieveRelevantChunks({
      knowledgeBaseId,
      queryText: query,
      queryEmbedding,
      matchThreshold: 0.3,
      matchCount,
      sourceTypes: ['document'],
    });

    return rows.map(row => ({
      id: row.id,
      knowledgeBaseId: row.knowledgeBaseId,
      documentId: row.documentId,
      filename: row.filename,
      sourceType: row.sourceType,
      content: row.content,
      summary: row.summary,
      keywords: row.keywords,
      similarity: row.similarity,
    }));
  }
}
