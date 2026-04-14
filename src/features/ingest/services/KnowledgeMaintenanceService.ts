import type { AIRuntime } from '@/ai';
import { buildUnitRelations } from '../relations';
import type { UnitRelation } from '../contracts';
import type { KnowledgeBaseRecord } from '../knowledge';
import type { IngestRepository, ReindexableUnit } from '../repository';
import { KnowledgeProfileService } from './KnowledgeProfileService';

export type KnowledgeMaintenanceResult = {
  action: 'rebuild-profile' | 'reindex';
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  sourceCount: number;
  unitCount: number;
  profileVersion?: number;
};

function buildUnitEmbeddingText(unit: ReindexableUnit) {
  const relationHints = unit.meta.relationHints.map(hint => `${hint.kind}:${hint.label}`).join('；');
  return [
    unit.sourceMeta.summary.trim() ? `來源摘要：${unit.sourceMeta.summary.trim()}` : '',
    unit.sourceMeta.structure?.label ? `來源結構：${unit.sourceMeta.structure.label}` : '',
    unit.meta.summary.trim() ? `單位摘要：${unit.meta.summary.trim()}` : '',
    unit.meta.terms.length > 0 ? `檢索詞：${unit.meta.terms.join('、')}` : '',
    unit.meta.entities.length > 0 ? `實體：${unit.meta.entities.join('、')}` : '',
    relationHints ? `關聯提示：${relationHints}` : '',
    `內容：${unit.content}`,
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
      sourceCount: stats.sourceCount,
      unitCount: stats.unitCount,
    });

    return {
      action: 'rebuild-profile',
      knowledgeBaseId: knowledgeBase.id,
      knowledgeBaseName: knowledgeBase.name,
      sourceCount: stats.sourceCount,
      unitCount: stats.unitCount,
      profileVersion: saved.version,
    };
  }

  async reindex(knowledgeBase: KnowledgeBaseRecord): Promise<KnowledgeMaintenanceResult> {
    const units = await this.repository.listUnitsForReindex(knowledgeBase.id);
    const sourceUnits = new Map<string, ReindexableUnit[]>();

    for (const unit of units) {
      const collection = sourceUnits.get(unit.sourceId) ?? [];
      collection.push(unit);
      sourceUnits.set(unit.sourceId, collection);
    }

    const reindexedUnits: Array<{
      id: string;
      embedding: number[] | null;
      embeddingDimensions: number | null;
      relatedUnits: UnitRelation[];
    }> = [];

    for (const unitsForSource of sourceUnits.values()) {
      const enriched = await Promise.all(unitsForSource.map(async unit => {
        if (unit.status === 'error') {
          return {
            ...unit,
            embedding: undefined,
          };
        }

        const embedding = await this.runtime.createEmbedding({
          text: buildUnitEmbeddingText(unit),
        });

        return {
          ...unit,
          embedding,
        };
      }));

      const relationMap = buildUnitRelations(enriched.map(unit => ({
        id: unit.id,
        sequence: unit.sequence,
        meta: unit.meta,
        status: unit.status,
        embedding: unit.embedding,
      })));

      reindexedUnits.push(...enriched.map(unit => ({
        id: unit.id,
        embedding: unit.embedding ?? null,
        embeddingDimensions: unit.embedding?.length ?? null,
        relatedUnits: relationMap[unit.id] ?? [],
      })));
    }

    await this.repository.saveReindexedUnits({
      knowledgeBaseId: knowledgeBase.id,
      units: reindexedUnits,
    });

    const profileResult = await this.rebuildProfile(knowledgeBase);

    return {
      action: 'reindex',
      knowledgeBaseId: knowledgeBase.id,
      knowledgeBaseName: knowledgeBase.name,
      sourceCount: profileResult.sourceCount,
      unitCount: reindexedUnits.length,
      profileVersion: profileResult.profileVersion,
    };
  }
}