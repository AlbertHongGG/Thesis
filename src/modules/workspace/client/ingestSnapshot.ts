import type { IngestResult, IngestUnit } from '@/features/ingest/contracts';

export function cloneIngestUnit(unit: IngestUnit): IngestUnit {
  return {
    ...unit,
    meta: {
      ...unit.meta,
      terms: [...unit.meta.terms],
      entities: [...unit.meta.entities],
      relationHints: unit.meta.relationHints.map(relation => ({ ...relation })),
    },
    relatedUnits: unit.relatedUnits.map(relation => ({ ...relation })),
  };
}

export function cloneKnowledgeContext(trace?: IngestResult['knowledgeContext']) {
  if (!trace) {
    return undefined;
  }

  return {
    ...trace,
    usedSources: trace.usedSources.map(source => ({ ...source })),
  };
}

export function cloneIngestResult(result?: IngestResult) {
  if (!result) {
    return undefined;
  }

  return {
    ...result,
    meta: {
      ...result.meta,
      terms: [...result.meta.terms],
      entities: [...result.meta.entities],
      structure: result.meta.structure ? { ...result.meta.structure } : undefined,
    },
    knowledgeContext: cloneKnowledgeContext(result.knowledgeContext),
    units: result.units.map(cloneIngestUnit),
  } satisfies IngestResult;
}
