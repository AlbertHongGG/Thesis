import type {
  EnsureKnowledgeBaseInput,
  KnowledgeBaseRecord,
  KnowledgeBaseStats,
  KnowledgeProfileRecord,
  KnowledgeSourceMaterial,
  KnowledgeSourceRecord,
  KnowledgeUnitMatch,
  KnowledgeUnitRecord,
  KnowledgeUnitRelationRecord,
  PersistKnowledgeProfileInput,
  ReplaceKnowledgeSourceGraphInput,
  SearchKnowledgeUnitsInput,
} from '@/domain/knowledge/types';
import type { KnowledgeOperationKind, KnowledgeOperationRecord } from '@/domain/operations/types';

export interface KnowledgeBaseRepository {
  list(): Promise<KnowledgeBaseRecord[]>;
  get(id: string): Promise<KnowledgeBaseRecord | null>;
  ensure(input?: EnsureKnowledgeBaseInput): Promise<KnowledgeBaseRecord>;
  delete(id: string): Promise<void>;
}

export interface KnowledgeProfileRepository {
  get(knowledgeBaseId: string): Promise<KnowledgeProfileRecord | null>;
  save(input: PersistKnowledgeProfileInput): Promise<KnowledgeProfileRecord>;
  listSourceMaterials(knowledgeBaseId: string, limit?: number): Promise<KnowledgeSourceMaterial[]>;
}

export interface KnowledgeSourceRepository {
  saveGraph(input: ReplaceKnowledgeSourceGraphInput): Promise<void>;
  listByKnowledgeBase(knowledgeBaseId: string): Promise<KnowledgeSourceRecord[]>;
  getStats(knowledgeBaseId: string): Promise<KnowledgeBaseStats>;
  deleteById(sourceId: string): Promise<void>;
  deleteByPathPrefix(knowledgeBaseId: string, pathPrefix: string): Promise<void>;
  deleteByKnowledgeBase(knowledgeBaseId: string): Promise<void>;
}

export interface KnowledgeUnitRepository {
  listByKnowledgeBase(knowledgeBaseId: string): Promise<KnowledgeUnitRecord[]>;
  listForReindex(knowledgeBaseId: string): Promise<KnowledgeUnitRecord[]>;
  search(input: SearchKnowledgeUnitsInput): Promise<KnowledgeUnitMatch[]>;
}

export interface KnowledgeRelationRepository {
  replaceForSource(input: {
    knowledgeBaseId: string;
    sourceId: string;
    relations: KnowledgeUnitRelationRecord[];
  }): Promise<void>;
  listByKnowledgeBase(knowledgeBaseId: string): Promise<KnowledgeUnitRelationRecord[]>;
}

export interface KnowledgeOperationRepository {
  start(input: {
    knowledgeBaseId: string;
    kind: KnowledgeOperationKind;
    sourceId?: string;
    sourcePath?: string;
    metadata?: Record<string, unknown>;
  }): Promise<KnowledgeOperationRecord>;
  complete(input: {
    operationId: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  fail(input: {
    operationId: string;
    errorMessage: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}
