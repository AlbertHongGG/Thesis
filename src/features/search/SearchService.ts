import { createAiRuntimeFromConfig } from '@/ai';
import { loadIngestFeatureConfig } from '@/features/ingest/config';
import { SupabaseIngestRepository } from '@/features/ingest/SupabaseIngestRepository';
import { supabaseAdmin } from '@/lib/supabase';

export interface SearchResult {
  id: string;
  knowledgeBaseId: string;
  sourceId: string;
  title: string;
  canonicalPath: string;
  sourceType: 'document' | 'image';
  unitType: string;
  content: string;
  preview: string;
  summary: string;
  terms: string[];
  entities: string[];
  relationHints: string[];
  similarity: number;
}

export class SearchService {
  async search(knowledgeBaseId: string, query: string, matchCount = 5): Promise<SearchResult[]> {
    const featureConfig = loadIngestFeatureConfig();
    const runtime = createAiRuntimeFromConfig(featureConfig.runtime);
    const queryEmbedding = await runtime.createEmbedding({ text: query });
    const repository = new SupabaseIngestRepository(supabaseAdmin);
    const rows = await repository.retrieveRelevantUnits({
      knowledgeBaseId,
      queryText: query,
      queryEmbedding,
      matchThreshold: 0.3,
      matchCount,
      sourceTypes: ['document', 'image'],
    });

    return rows.map(row => ({
      id: row.id,
      knowledgeBaseId: row.knowledgeBaseId,
      sourceId: row.sourceId,
      title: row.title,
      canonicalPath: row.canonicalPath,
      sourceType: row.sourceType,
      unitType: row.unitType,
      content: row.content,
      preview: row.preview,
      summary: row.summary,
      terms: row.terms,
      entities: row.entities,
      relationHints: row.relationHints,
      similarity: row.similarity,
    }));
  }
}
