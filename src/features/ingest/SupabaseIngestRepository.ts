import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_KNOWLEDGE_BASE_NAME,
  DEFAULT_KNOWLEDGE_BASE_SLUG,
  slugifyKnowledgeBaseName,
  uniqueStrings,
  type KnowledgeBaseInput,
  type KnowledgeBaseRecord,
  type KnowledgeChunkMatch,
  type KnowledgeProfileRecord,
} from './knowledge';
import type {
  IngestRepository,
  KnowledgeProfileSourceMaterial,
  PersistDocumentParams,
  PersistImageParams,
  PersistKnowledgeProfileParams,
  ReindexableDocumentChunk,
  ReindexableImageSource,
  RetrieveRelevantChunksParams,
} from './repository';

function normalizeEmbedding(embedding: number[]) {
  return embedding.map(value => Number(value.toFixed(8)));
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function mapKnowledgeProfileRow(row: any): KnowledgeProfileRecord {
  return {
    knowledgeBaseId: row.knowledge_base_id,
    summary: row.summary ?? '',
    focusAreas: toStringArray(row.focus_areas),
    keyTerms: toStringArray(row.key_terms),
    researchQuestions: toStringArray(row.research_questions),
    methods: toStringArray(row.methods),
    recentUpdates: toStringArray(row.recent_updates),
    sourceCount: row.source_count ?? 0,
    chunkCount: row.chunk_count ?? 0,
    version: row.version ?? 1,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapKnowledgeBaseRow(row: any, profile?: any): KnowledgeBaseRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    sourceCount: profile?.source_count ?? 0,
    chunkCount: profile?.chunk_count ?? 0,
    profileVersion: profile?.version ?? 0,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export class SupabaseIngestRepository implements IngestRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listKnowledgeBases(): Promise<KnowledgeBaseRecord[]> {
    const [baseResponse, profileResponse] = await Promise.all([
      this.client.from('knowledge_bases').select('*').order('updated_at', { ascending: false }),
      this.client.from('knowledge_profiles').select('knowledge_base_id, source_count, chunk_count, version'),
    ]);

    if (baseResponse.error) {
      throw baseResponse.error;
    }

    if (profileResponse.error) {
      throw profileResponse.error;
    }

    const profileMap = new Map((profileResponse.data ?? []).map(row => [row.knowledge_base_id, row]));
    return (baseResponse.data ?? []).map(row => mapKnowledgeBaseRow(row, profileMap.get(row.id)));
  }

  async ensureKnowledgeBase(input: KnowledgeBaseInput = {}): Promise<KnowledgeBaseRecord> {
    if (input.id) {
      const existingById = await this.fetchKnowledgeBaseById(input.id);
      if (existingById) {
        return existingById;
      }
    }

    const name = input.name?.trim() || DEFAULT_KNOWLEDGE_BASE_NAME;
    const slug = input.slug?.trim() || slugifyKnowledgeBaseName(name || DEFAULT_KNOWLEDGE_BASE_SLUG);

    const existingBySlug = await this.fetchKnowledgeBaseBySlug(slug);
    if (existingBySlug) {
      return existingBySlug;
    }

    const id = input.id ?? randomUUID();
    const { error } = await this.client.from('knowledge_bases').upsert({
      id,
      slug,
      name,
      description: input.description ?? null,
      status: 'active',
    });

    if (error) {
      throw error;
    }

    const { error: profileError } = await this.client.from('knowledge_profiles').upsert({
      knowledge_base_id: id,
      summary: '',
      focus_areas: [],
      key_terms: [],
      research_questions: [],
      methods: [],
      recent_updates: [],
      source_count: 0,
      chunk_count: 0,
      version: 0,
    });

    if (profileError) {
      throw profileError;
    }

    return {
      id,
      slug,
      name,
      description: input.description,
      status: 'active',
      sourceCount: 0,
      chunkCount: 0,
      profileVersion: 0,
    };
  }

  async getKnowledgeBase(id: string): Promise<KnowledgeBaseRecord | null> {
    return this.fetchKnowledgeBaseById(id);
  }

  async deleteKnowledgeBase(id: string): Promise<void> {
    const { error } = await this.client.from('knowledge_bases').delete().eq('id', id);

    if (error) {
      throw error;
    }
  }

  async getKnowledgeBaseStats(knowledgeBaseId: string) {
    const [sourceResponse, chunkResponse] = await Promise.all([
      this.client
        .from('rag_documents')
        .select('id', { count: 'exact', head: true })
        .eq('knowledge_base_id', knowledgeBaseId)
        .neq('ingest_status', 'archived'),
      this.client
        .from('rag_document_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('knowledge_base_id', knowledgeBaseId)
        .eq('status', 'ready'),
    ]);

    if (sourceResponse.error) {
      throw sourceResponse.error;
    }

    if (chunkResponse.error) {
      throw chunkResponse.error;
    }

    return {
      sourceCount: sourceResponse.count ?? 0,
      chunkCount: chunkResponse.count ?? 0,
    };
  }

  async getKnowledgeProfile(knowledgeBaseId: string): Promise<KnowledgeProfileRecord | null> {
    const { data, error } = await this.client
      .from('knowledge_profiles')
      .select('*')
      .eq('knowledge_base_id', knowledgeBaseId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapKnowledgeProfileRow(data) : null;
  }

  async saveKnowledgeProfile(params: PersistKnowledgeProfileParams): Promise<KnowledgeProfileRecord> {
    const current = await this.getKnowledgeProfile(params.knowledgeBaseId);
    const nextVersion = (current?.version ?? 0) + 1;

    const payload = {
      knowledge_base_id: params.knowledgeBaseId,
      summary: params.summary,
      focus_areas: uniqueStrings(params.focusAreas),
      key_terms: uniqueStrings(params.keyTerms),
      research_questions: uniqueStrings(params.researchQuestions),
      methods: uniqueStrings(params.methods),
      recent_updates: uniqueStrings(params.recentUpdates),
      source_count: params.sourceCount,
      chunk_count: params.chunkCount,
      version: nextVersion,
    };

    const { data, error } = await this.client
      .from('knowledge_profiles')
      .upsert(payload)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapKnowledgeProfileRow(data);
  }

  async listKnowledgeProfileSources(knowledgeBaseId: string, limit = 12): Promise<KnowledgeProfileSourceMaterial[]> {
    const { data: documents, error: documentError } = await this.client
      .from('rag_documents')
      .select('id, filename, summary, description, source_preview')
      .eq('knowledge_base_id', knowledgeBaseId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (documentError) {
      throw documentError;
    }

    const rows = documents ?? [];
    const documentIds = rows.map(row => row.id);

    const keywordMap = new Map<string, string[]>();

    if (documentIds.length > 0) {
      const { data: chunks, error: chunkError } = await this.client
        .from('rag_document_chunks')
        .select('document_id, keywords')
        .eq('knowledge_base_id', knowledgeBaseId)
        .in('document_id', documentIds)
        .eq('status', 'ready')
        .order('updated_at', { ascending: false })
        .limit(limit * 6);

      if (chunkError) {
        throw chunkError;
      }

      for (const chunk of chunks ?? []) {
        const existing = keywordMap.get(chunk.document_id) ?? [];
        keywordMap.set(chunk.document_id, uniqueStrings([...existing, ...toStringArray(chunk.keywords)]).slice(0, 12));
      }
    }

    return rows.map(row => ({
      filename: row.filename,
      summary: row.summary || row.description || row.source_preview || '',
      keywords: keywordMap.get(row.id) ?? [],
    })).filter(row => row.summary.trim().length > 0);
  }

  async listChunksForReindex(knowledgeBaseId: string): Promise<ReindexableDocumentChunk[]> {
    const { data, error } = await this.client
      .from('rag_document_chunks')
      .select('id, document_id, chunk_index, content, summary, keywords, status, rag_documents!inner(filename, summary, source_type)')
      .eq('knowledge_base_id', knowledgeBaseId)
      .eq('rag_documents.knowledge_base_id', knowledgeBaseId)
      .eq('rag_documents.source_type', 'document')
      .order('document_id', { ascending: true })
      .order('chunk_index', { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      documentId: row.document_id,
      filename: row.rag_documents?.filename ?? 'Unknown document',
      documentSummary: row.rag_documents?.summary ?? '',
      chunkIndex: row.chunk_index,
      content: row.content ?? '',
      summary: row.summary ?? '',
      keywords: toStringArray(row.keywords),
      status: row.status,
    }));
  }

  async saveReindexedChunks(params: {
    knowledgeBaseId: string;
    chunks: Array<{
      id: string;
      embedding: number[] | null;
      embeddingDimensions: number | null;
      relatedChunks: Array<{ chunkId: string; score: number; label: string }>;
    }>;
  }): Promise<void> {
    if (params.chunks.length === 0) {
      return;
    }

    const { error } = await this.client.from('rag_document_chunks').upsert(
      params.chunks.map(chunk => ({
        id: chunk.id,
        knowledge_base_id: params.knowledgeBaseId,
        embedding: chunk.embedding ? normalizeEmbedding(chunk.embedding) : null,
        embedding_dimensions: chunk.embeddingDimensions,
        related_chunks: chunk.relatedChunks,
      })),
    );

    if (error) {
      throw error;
    }
  }

  async listImagesForReindex(knowledgeBaseId: string): Promise<ReindexableImageSource[]> {
    const { data, error } = await this.client
      .from('rag_documents')
      .select('id, filename, description')
      .eq('knowledge_base_id', knowledgeBaseId)
      .eq('source_type', 'image')
      .not('description', 'is', null)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: any) => ({
      documentId: row.id,
      filename: row.filename,
      description: row.description ?? '',
    })).filter(row => row.description.trim().length > 0);
  }

  async saveImageEmbedding(params: {
    knowledgeBaseId: string;
    documentId: string;
    embedding: number[];
  }): Promise<void> {
    const { data, error: selectError } = await this.client
      .from('rag_documents')
      .select('metadata')
      .eq('id', params.documentId)
      .eq('knowledge_base_id', params.knowledgeBaseId)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    const nextMetadata = {
      ...(data?.metadata ?? {}),
      embedding_dimensions: params.embedding.length,
      embedding_vector: normalizeEmbedding(params.embedding),
    };

    const { error } = await this.client
      .from('rag_documents')
      .update({ metadata: nextMetadata })
      .eq('id', params.documentId)
      .eq('knowledge_base_id', params.knowledgeBaseId);

    if (error) {
      throw error;
    }
  }

  async retrieveRelevantChunks(params: RetrieveRelevantChunksParams): Promise<KnowledgeChunkMatch[]> {
    const { data, error } = await this.client.rpc('match_rag_chunks', {
      query_embedding: normalizeEmbedding(params.queryEmbedding),
      kb_id: params.knowledgeBaseId,
      match_threshold: params.matchThreshold ?? 0.35,
      match_count: params.matchCount ?? 4,
      source_types: params.sourceTypes ?? ['document'],
    });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      knowledgeBaseId: row.knowledge_base_id,
      documentId: row.document_id,
      filename: row.filename,
      sourceType: row.source_type,
      content: row.content,
      summary: row.summary || '',
      similarity: row.similarity,
      keywords: toStringArray(row.keywords),
      bridgingContext: row.bridging_context ?? undefined,
      preview: row.preview ?? undefined,
    }));
  }

  async saveImage(params: PersistImageParams): Promise<void> {
    const documentId = randomUUID();
    const { error } = await this.client.from('rag_documents').upsert({
      id: documentId,
      knowledge_base_id: params.knowledgeBaseId,
      filename: params.fileName,
      source_type: 'image',
      ingest_status: 'ready',
      preview_kind: params.previewKind,
      description: params.description,
      source_preview: params.descriptionSnippet,
      context_applied: params.result.contextApplied,
      chunk_count: 0,
      total_char_count: params.description.length,
      processing_duration_ms: params.result.processingDurationMs,
      metadata: {
        prompt_variant: params.promptVariant,
        embedding_dimensions: params.embeddingVector.length,
        embedding_vector: normalizeEmbedding(params.embeddingVector),
        knowledge_context: params.result.knowledgeContext ?? null,
      },
    });

    if (error) {
      throw error;
    }
  }

  async saveDocument(params: PersistDocumentParams): Promise<void> {
    const documentResponse = await this.client.from('rag_documents').upsert({
      id: params.result.documentId,
      knowledge_base_id: params.knowledgeBaseId,
      filename: params.fileName,
      source_type: 'document',
      ingest_status: 'ready',
      preview_kind: params.previewKind,
      summary: params.result.summary,
      parsed_text_preview: params.result.parsedTextPreview,
      source_preview: params.result.summary || params.result.parsedTextPreview || '',
      context_applied: params.result.contextApplied,
      chunk_count: params.result.chunkCount,
      total_char_count: params.result.totalCharCount,
      processing_duration_ms: params.result.processingDurationMs,
      metadata: {
        context_applied: params.result.contextApplied ?? false,
        prompt_variant: params.promptVariant,
        knowledge_context: params.result.knowledgeContext ?? null,
      },
    });

    if (documentResponse.error) {
      throw documentResponse.error;
    }

    if (params.chunks.length === 0) {
      return;
    }

    const chunkResponse = await this.client.from('rag_document_chunks').upsert(
      params.chunks.map(chunk => ({
        id: chunk.id,
        knowledge_base_id: params.knowledgeBaseId,
        document_id: params.result.documentId,
        chunk_index: chunk.index,
        content: chunk.text,
        preview: chunk.preview,
        summary: chunk.summary,
        keywords: chunk.keywords,
        bridging_context: chunk.bridgingContext,
        related_chunks: chunk.relatedChunks,
        embedding: chunk.embedding ? normalizeEmbedding(chunk.embedding) : null,
        embedding_dimensions: chunk.embedding?.length ?? null,
        word_count: chunk.wordCount,
        char_count: chunk.charCount,
        start_offset: chunk.startOffset,
        end_offset: chunk.endOffset,
        status: chunk.status,
        metadata: {
          error_message: chunk.errorMessage ?? null,
          prompt_variant: params.promptVariant,
        },
      })),
    );

    if (chunkResponse.error) {
      throw chunkResponse.error;
    }
  }

  private async fetchKnowledgeBaseById(id: string) {
    const { data, error } = await this.client.from('knowledge_bases').select('*').eq('id', id).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const profile = await this.getKnowledgeProfile(id);
    return mapKnowledgeBaseRow(data, profile ? {
      source_count: profile.sourceCount,
      chunk_count: profile.chunkCount,
      version: profile.version,
    } : undefined);
  }

  private async fetchKnowledgeBaseBySlug(slug: string) {
    const { data, error } = await this.client.from('knowledge_bases').select('*').eq('slug', slug).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const profile = await this.getKnowledgeProfile(data.id);
    return mapKnowledgeBaseRow(data, profile ? {
      source_count: profile.sourceCount,
      chunk_count: profile.chunkCount,
      version: profile.version,
    } : undefined);
  }
}