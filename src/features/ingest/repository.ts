import type { DocumentChunkAnalysis, DocumentIngestResult, ImageIngestResult, PreviewKind } from './contracts';
import type {
  KnowledgeBaseInput,
  KnowledgeBaseRecord,
  KnowledgeChunkMatch,
  KnowledgeProfileRecord,
  KnowledgeSourceType,
} from './knowledge';

export type PersistableDocumentChunk = DocumentChunkAnalysis & {
  embedding?: number[];
};

export type PersistImageParams = {
  knowledgeBaseId: string;
  fileName: string;
  previewKind: PreviewKind;
  result: ImageIngestResult;
  description: string;
  descriptionSnippet: string;
  embeddingVector: number[];
  promptVariant: string;
};

export type PersistDocumentParams = {
  knowledgeBaseId: string;
  fileName: string;
  previewKind: PreviewKind;
  result: DocumentIngestResult;
  chunks: PersistableDocumentChunk[];
  promptVariant: string;
};

export type RetrieveRelevantChunksParams = {
  knowledgeBaseId: string;
  queryText: string;
  queryEmbedding: number[];
  matchCount?: number;
  matchThreshold?: number;
  sourceTypes?: KnowledgeSourceType[];
};

export type PersistKnowledgeProfileParams = {
  knowledgeBaseId: string;
  summary: string;
  focusAreas: string[];
  keyTerms: string[];
  researchQuestions: string[];
  methods: string[];
  recentUpdates: string[];
  sourceCount: number;
  chunkCount: number;
};

export type KnowledgeProfileSourceMaterial = {
  filename: string;
  summary: string;
  keywords: string[];
};

export type KnowledgeBaseStats = {
  sourceCount: number;
  chunkCount: number;
};

export type ReindexableDocumentChunk = {
  id: string;
  documentId: string;
  filename: string;
  documentSummary: string;
  chunkIndex: number;
  content: string;
  summary: string;
  keywords: string[];
  status: 'ready' | 'error';
};

export type ReindexableImageSource = {
  documentId: string;
  filename: string;
  description: string;
};

export interface IngestRepository {
  listKnowledgeBases(): Promise<KnowledgeBaseRecord[]>;
  getKnowledgeBase(id: string): Promise<KnowledgeBaseRecord | null>;
  ensureKnowledgeBase(input?: KnowledgeBaseInput): Promise<KnowledgeBaseRecord>;
  deleteKnowledgeBase(id: string): Promise<void>;
  getKnowledgeBaseStats(knowledgeBaseId: string): Promise<KnowledgeBaseStats>;
  getKnowledgeProfile(knowledgeBaseId: string): Promise<KnowledgeProfileRecord | null>;
  saveKnowledgeProfile(params: PersistKnowledgeProfileParams): Promise<KnowledgeProfileRecord>;
  listKnowledgeProfileSources(knowledgeBaseId: string, limit?: number): Promise<KnowledgeProfileSourceMaterial[]>;
  retrieveRelevantChunks(params: RetrieveRelevantChunksParams): Promise<KnowledgeChunkMatch[]>;
  listChunksForReindex(knowledgeBaseId: string): Promise<ReindexableDocumentChunk[]>;
  saveReindexedChunks(params: {
    knowledgeBaseId: string;
    chunks: Array<{
      id: string;
      embedding: number[] | null;
      embeddingDimensions: number | null;
      relatedChunks: DocumentChunkAnalysis['relatedChunks'];
    }>;
  }): Promise<void>;
  listImagesForReindex(knowledgeBaseId: string): Promise<ReindexableImageSource[]>;
  saveImageEmbedding(params: {
    knowledgeBaseId: string;
    documentId: string;
    embedding: number[];
  }): Promise<void>;
  saveImage(params: PersistImageParams): Promise<void>;
  saveDocument(params: PersistDocumentParams): Promise<void>;
}