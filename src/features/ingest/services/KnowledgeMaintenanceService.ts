import type { AIRuntime } from '@/ai';
import { buildChunkRelations } from '../relations';
import type { KnowledgeBaseRecord } from '../knowledge';
import type { IngestRepository, ReindexableDocumentChunk } from '../repository';
import { KnowledgeProfileService } from './KnowledgeProfileService';

export type KnowledgeMaintenanceResult = {
  action: 'rebuild-profile' | 'reindex';
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  sourceCount: number;
  chunkCount: number;
  imageCount: number;
  profileVersion?: number;
};

function buildChunkEmbeddingText(chunk: ReindexableDocumentChunk) {
  return [
    chunk.documentSummary.trim() ? `文件摘要：${chunk.documentSummary.trim()}` : '',
    chunk.summary.trim() ? `當前 chunk 摘要：${chunk.summary.trim()}` : '',
    chunk.keywords.length > 0 ? `關鍵詞：${chunk.keywords.join('、')}` : '',
    `原始 chunk 內容：${chunk.content}`,
  ].filter(Boolean).join('\n');
}

export class KnowledgeMaintenanceService {
  constructor(
    private readonly runtime: AIRuntime,
    private readonly repository: IngestRepository,
    private readonly knowledgeProfileService: KnowledgeProfileService,
  ) {}

  async rebuildProfile(knowledgeBase: KnowledgeBaseRecord): Promise<KnowledgeMaintenanceResult> {
    const [sources, stats] = await Promise.all([
      this.repository.listKnowledgeProfileSources(knowledgeBase.id, 20),
      this.repository.getKnowledgeBaseStats(knowledgeBase.id),
    ]);

    const profile = await this.knowledgeProfileService.summarize({
      knowledgeBaseName: knowledgeBase.name,
      sources,
    });

    const saved = await this.repository.saveKnowledgeProfile({
      knowledgeBaseId: knowledgeBase.id,
      summary: profile.summary,
      focusAreas: profile.focusAreas,
      keyTerms: profile.keyTerms,
      researchQuestions: profile.researchQuestions,
      methods: profile.methods,
      recentUpdates: profile.recentUpdates,
      sourceCount: stats.sourceCount,
      chunkCount: stats.chunkCount,
    });

    return {
      action: 'rebuild-profile',
      knowledgeBaseId: knowledgeBase.id,
      knowledgeBaseName: knowledgeBase.name,
      sourceCount: stats.sourceCount,
      chunkCount: stats.chunkCount,
      imageCount: 0,
      profileVersion: saved.version,
    };
  }

  async reindex(knowledgeBase: KnowledgeBaseRecord): Promise<KnowledgeMaintenanceResult> {
    const [chunks, images] = await Promise.all([
      this.repository.listChunksForReindex(knowledgeBase.id),
      this.repository.listImagesForReindex(knowledgeBase.id),
    ]);

    const documents = new Map<string, ReindexableDocumentChunk[]>();
    for (const chunk of chunks) {
      const collection = documents.get(chunk.documentId) ?? [];
      collection.push(chunk);
      documents.set(chunk.documentId, collection);
    }

    const reindexedChunks: Array<{
      id: string;
      embedding: number[] | null;
      embeddingDimensions: number | null;
      relatedChunks: Array<{ chunkId: string; score: number; label: string }>;
    }> = [];

    for (const documentChunks of documents.values()) {
      const enriched = await Promise.all(documentChunks.map(async chunk => {
        if (chunk.status === 'error') {
          return {
            ...chunk,
            embedding: undefined,
          };
        }

        const embedding = await this.runtime.createEmbedding({
          text: buildChunkEmbeddingText(chunk),
        });

        return {
          ...chunk,
          embedding,
        };
      }));

      const relationMap = buildChunkRelations(enriched.map(chunk => ({
        id: chunk.id,
        index: chunk.chunkIndex,
        keywords: chunk.keywords,
        status: chunk.status,
        embedding: chunk.embedding,
      })));

      reindexedChunks.push(...enriched.map(chunk => ({
        id: chunk.id,
        embedding: chunk.embedding ?? null,
        embeddingDimensions: chunk.embedding?.length ?? null,
        relatedChunks: relationMap[chunk.id] ?? [],
      })));
    }

    await this.repository.saveReindexedChunks({
      knowledgeBaseId: knowledgeBase.id,
      chunks: reindexedChunks,
    });

    for (const image of images) {
      const embedding = await this.runtime.createEmbedding({ text: image.description });
      await this.repository.saveImageEmbedding({
        knowledgeBaseId: knowledgeBase.id,
        documentId: image.documentId,
        embedding,
      });
    }

    const profileResult = await this.rebuildProfile(knowledgeBase);

    return {
      action: 'reindex',
      knowledgeBaseId: knowledgeBase.id,
      knowledgeBaseName: knowledgeBase.name,
      sourceCount: profileResult.sourceCount,
      chunkCount: reindexedChunks.length,
      imageCount: images.length,
      profileVersion: profileResult.profileVersion,
    };
  }
}