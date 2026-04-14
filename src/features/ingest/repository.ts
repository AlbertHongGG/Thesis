import type { IngestResult, IngestUnit, PreviewKind, SourceMeta, UnitMeta, UnitRelation } from './contracts';
import type {
  KnowledgeBaseInput,
  KnowledgeBaseRecord,
  KnowledgeProfileRecord,
  KnowledgeSourceType,
  KnowledgeUnitMatch,
} from './knowledge';

export type PersistableUnit = IngestUnit & {
  embedding?: number[];
};

export type PersistSourceParams = {
  knowledgeBaseId: string;
  canonicalPath: string;
  previewKind: PreviewKind;
  result: IngestResult;
  units: PersistableUnit[];
  promptVariant: string;
};

export type RetrieveRelevantUnitsParams = {
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
  sourceCount: number;
  unitCount: number;
};

export type KnowledgeProfileSourceMaterial = {
  title: string;
  summary: string;
  terms: string[];
};

export type KnowledgeBaseStats = {
  sourceCount: number;
  unitCount: number;
};

export type ReindexableUnit = {
  id: string;
  sourceId: string;
  title: string;
  canonicalPath: string;
  sourceType: KnowledgeSourceType;
  sourceMeta: SourceMeta;
  unitType: string;
  sequence: number;
  content: string;
  meta: UnitMeta;
  status: 'ready' | 'error';
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
  retrieveRelevantUnits(params: RetrieveRelevantUnitsParams): Promise<KnowledgeUnitMatch[]>;
  listUnitsForReindex(knowledgeBaseId: string): Promise<ReindexableUnit[]>;
  saveReindexedUnits(params: {
    knowledgeBaseId: string;
    units: Array<{
      id: string;
      embedding: number[] | null;
      embeddingDimensions: number | null;
      relatedUnits: UnitRelation[];
    }>;
  }): Promise<void>;
  saveSource(params: PersistSourceParams): Promise<void>;
}