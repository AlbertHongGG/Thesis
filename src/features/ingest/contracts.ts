import type {
  KnowledgeContextTrace,
  KnowledgeRelationKind,
  KnowledgeSourceType,
  PreviewKind as KnowledgePreviewKind,
  RelationHint as KnowledgeRelationHint,
  SourceStructure as KnowledgeSourceStructure,
} from '@/domain/knowledge/types';

export const INGEST_CONTRACT_VERSION = 5;

export type PreviewKind = KnowledgePreviewKind;

export type RelationKind = KnowledgeRelationKind;

export type RelationHint = KnowledgeRelationHint;

export type UnitRelation = {
  unitId: string;
  kind: RelationKind;
  score: number;
  label: string;
};

export type SourceStructure = KnowledgeSourceStructure;

export type SourceMeta = {
  schemaVersion: number;
  sourceType: KnowledgeSourceType;
  title: string;
  summary: string;
  terms: string[];
  entities: string[];
  structure?: SourceStructure;
};

export type UnitMeta = {
  schemaVersion: number;
  unitType: string;
  summary: string;
  terms: string[];
  entities: string[];
  relationHints: RelationHint[];
};

export type IngestUnit = {
  id: string;
  sourceId: string;
  unitType: string;
  sequence: number;
  content: string;
  preview: string;
  charCount: number;
  wordCount: number;
  startOffset: number;
  endOffset: number;
  meta: UnitMeta;
  relatedUnits: UnitRelation[];
  status: 'ready' | 'error';
  errorMessage?: string;
};

export type IngestResult = {
  type: 'source';
  knowledgeBaseId: string;
  knowledgeBaseName?: string;
  previewKind?: PreviewKind;
  sourceId: string;
  sourceType: KnowledgeSourceType;
  title: string;
  totalUnitCount: number;
  totalCharCount: number;
  processingDurationMs?: number;
  rawPreview?: string;
  meta: SourceMeta;
  units: IngestUnit[];
  contextApplied?: boolean;
  knowledgeContext?: KnowledgeContextTrace;
  dbWritten?: boolean;
};

export type IngestStepEvent = {
  type: 'step';
  message: string;
};

export type IngestUnitEvent = {
  type: 'unit';
  knowledgeBaseId: string;
  knowledgeBaseName?: string;
  sourceId: string;
  sourceType: KnowledgeSourceType;
  title: string;
  unit: IngestUnit;
  totalUnitCount: number;
  totalCharCount: number;
  rawPreview: string;
  previewKind: PreviewKind;
  progress: { current: number; total: number };
};

export type IngestResultEvent = {
  type: 'result';
  result: IngestResult;
};

export type IngestErrorEvent = {
  type: 'error';
  error: string;
};

export type IngestStreamEvent = IngestStepEvent | IngestUnitEvent | IngestResultEvent | IngestErrorEvent;

export function encodeStreamEvent(event: IngestStreamEvent) {
  return `${JSON.stringify(event)}\n`;
}