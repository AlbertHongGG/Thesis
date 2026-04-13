import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IngestRepository, PersistDocumentParams, PersistImageParams } from './repository';

function normalizeEmbedding(embedding: number[]) {
  return embedding.map(value => Number(value.toFixed(8)));
}

export class SupabaseIngestRepository implements IngestRepository {
  constructor(private readonly client: SupabaseClient) {}

  async saveImage(params: PersistImageParams): Promise<void> {
    const documentId = randomUUID();
    const { error } = await this.client.from('rag_documents').upsert({
      id: documentId,
      filename: params.fileName,
      source_type: 'image',
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
      },
    });

    if (error) {
      throw error;
    }
  }

  async saveDocument(params: PersistDocumentParams): Promise<void> {
    const documentResponse = await this.client.from('rag_documents').upsert({
      id: params.result.documentId,
      filename: params.fileName,
      source_type: 'document',
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
}