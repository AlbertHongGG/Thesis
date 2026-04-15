import type { IngestResult, IngestUnit, PreviewKind } from '@/features/ingest/contracts';
import type { KnowledgeBaseRecord, KnowledgeSourceRecord, KnowledgeUnitRecord } from '@/domain/knowledge/types';
import type { IngestExecutionResult } from '@/application/services/IngestApplicationService';

function toIngestUnitDto(unit: KnowledgeUnitRecord): IngestUnit {
  return {
    id: unit.id,
    sourceId: unit.sourceId,
    unitType: unit.unitType,
    sequence: unit.sequence,
    content: unit.content,
    preview: unit.preview,
    charCount: unit.charCount,
    wordCount: unit.wordCount,
    startOffset: unit.startOffset,
    endOffset: unit.endOffset,
    meta: {
      schemaVersion: unit.metadata.version,
      unitType: unit.metadata.unitType,
      summary: unit.metadata.summary,
      terms: unit.metadata.terms,
      entities: unit.metadata.entities,
      relationHints: unit.metadata.relationHints,
    },
    relatedUnits: unit.relations.map(relation => ({
      unitId: relation.unitId,
      kind: relation.kind,
      score: relation.score,
      label: relation.label,
    })),
    status: unit.status,
    errorMessage: unit.errorMessage,
  };
}

export function toIngestResultDto(result: IngestExecutionResult): IngestResult {
  const source = result.source;
  return {
    type: 'source',
    knowledgeBaseId: result.knowledgeBase.id,
    knowledgeBaseName: result.knowledgeBase.name,
    previewKind: source.previewKind as PreviewKind,
    sourceId: source.id,
    sourceType: source.sourceType,
    title: source.title,
    totalUnitCount: source.totalUnitCount,
    totalCharCount: source.totalCharCount,
    processingDurationMs: source.processingDurationMs,
    rawPreview: source.rawPreview,
    meta: {
      schemaVersion: source.metadata.version,
      sourceType: source.metadata.sourceType,
      title: source.metadata.title,
      summary: source.metadata.summary,
      terms: source.metadata.terms,
      entities: source.metadata.entities,
      structure: source.metadata.structure,
    },
    units: result.units.map(toIngestUnitDto),
    contextApplied: result.contextApplied,
    knowledgeContext: result.knowledgeContext,
    dbWritten: result.dbWritten,
  };
}

export function toIngestUnitProgressDto(input: {
  knowledgeBase: KnowledgeBaseRecord;
  sourceId: string;
  sourceType: KnowledgeSourceRecord['sourceType'];
  title: string;
  unit: KnowledgeUnitRecord;
  totalUnitCount: number;
  totalCharCount: number;
  rawPreview: string;
  previewKind: KnowledgeSourceRecord['previewKind'];
  progress: { current: number; total: number };
}) {
  return {
    type: 'unit' as const,
    knowledgeBaseId: input.knowledgeBase.id,
    knowledgeBaseName: input.knowledgeBase.name,
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    title: input.title,
    unit: toIngestUnitDto(input.unit),
    totalUnitCount: input.totalUnitCount,
    totalCharCount: input.totalCharCount,
    rawPreview: input.rawPreview,
    previewKind: input.previewKind as PreviewKind,
    progress: input.progress,
  };
}
