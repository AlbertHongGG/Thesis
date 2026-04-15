import { buildUnitRelations } from '@/features/ingest/relations';
import type {
  KnowledgeBaseRepository,
  KnowledgeOperationRepository,
  KnowledgeRelationRepository,
  KnowledgeSourceRepository,
  KnowledgeUnitRepository,
} from '@/application/ports/repositories';
import type { AIProvider } from '@/application/ports/external';
import type { KnowledgeBaseRecord, KnowledgeUnitRelationRecord } from '@/domain/knowledge/types';
import { NotFoundError } from '@/domain/knowledge/errors';
import { KnowledgeProfileRefreshService } from './KnowledgeProfileRefreshService';

function buildUnitEmbeddingText(source: { summary: string; structure?: { label: string } }, unit: {
  content: string;
  metadata: { summary: string; terms: string[]; entities: string[]; relationHints: Array<{ kind: string; label: string }> };
}) {
  const relationHints = unit.metadata.relationHints.map(hint => `${hint.kind}:${hint.label}`).join('；');
  return [
    source.summary.trim() ? `來源摘要：${source.summary.trim()}` : '',
    source.structure?.label ? `來源結構：${source.structure.label}` : '',
    unit.metadata.summary.trim() ? `單位摘要：${unit.metadata.summary.trim()}` : '',
    unit.metadata.terms.length > 0 ? `檢索詞：${unit.metadata.terms.join('、')}` : '',
    unit.metadata.entities.length > 0 ? `實體：${unit.metadata.entities.join('、')}` : '',
    relationHints ? `關聯提示：${relationHints}` : '',
    `內容：${unit.content}`,
  ].filter(Boolean).join('\n');
}

export class KnowledgeBaseApplicationService {
  constructor(
    private readonly knowledgeBaseRepository: KnowledgeBaseRepository,
    private readonly sourceRepository: KnowledgeSourceRepository,
    private readonly unitRepository: KnowledgeUnitRepository,
    private readonly relationRepository: KnowledgeRelationRepository,
    private readonly operationRepository: KnowledgeOperationRepository,
    private readonly aiProvider: AIProvider,
    private readonly profileRefreshService: KnowledgeProfileRefreshService,
  ) {}

  async listKnowledgeBases() {
    return this.knowledgeBaseRepository.list();
  }

  async ensureKnowledgeBase(input?: { id?: string; slug?: string; name?: string; description?: string }) {
    return this.knowledgeBaseRepository.ensure(input);
  }

  async deleteKnowledgeBase(knowledgeBaseId: string) {
    await this.knowledgeBaseRepository.delete(knowledgeBaseId);
  }

  async repathSources(input: {
    knowledgeBaseId: string;
    items: Array<{
      sourceId: string;
      canonicalPath: string;
    }>;
  }) {
    if (input.items.length === 0) {
      return { updatedSourceCount: 0 };
    }

    await this.getKnowledgeBaseOrThrow(input.knowledgeBaseId);
    await this.sourceRepository.repathMany({
      knowledgeBaseId: input.knowledgeBaseId,
      items: input.items.map(item => ({
        ...item,
        title: item.canonicalPath.split('/').pop() || item.canonicalPath,
      })),
    });

    return {
      updatedSourceCount: input.items.length,
    };
  }

  async rebuildProfile(knowledgeBaseId: string) {
    const knowledgeBase = await this.getKnowledgeBaseOrThrow(knowledgeBaseId);
    const operation = await this.operationRepository.start({
      knowledgeBaseId,
      kind: 'rebuild-profile',
    });

    try {
      const profile = await this.profileRefreshService.refresh(knowledgeBase);
      const stats = await this.sourceRepository.getStats(knowledgeBaseId);
      await this.operationRepository.complete({
        operationId: operation.id,
        summary: `Rebuilt profile for ${knowledgeBase.name}`,
        metadata: { profileVersion: profile.version },
      });

      return {
        action: 'rebuild-profile' as const,
        knowledgeBaseId,
        knowledgeBaseName: knowledgeBase.name,
        sourceCount: stats.sourceCount,
        unitCount: stats.unitCount,
        profileVersion: profile.version,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.operationRepository.fail({
        operationId: operation.id,
        errorMessage: message,
      });
      throw error;
    }
  }

  async reindex(knowledgeBaseId: string) {
    const knowledgeBase = await this.getKnowledgeBaseOrThrow(knowledgeBaseId);
    const operation = await this.operationRepository.start({
      knowledgeBaseId,
      kind: 'reindex',
    });

    try {
      const [sources, units] = await Promise.all([
        this.sourceRepository.listByKnowledgeBase(knowledgeBaseId),
        this.unitRepository.listForReindex(knowledgeBaseId),
      ]);

      const sourceMap = new Map(sources.map(source => [source.id, source]));
      const groupedUnits = new Map<string, typeof units>();

      for (const unit of units) {
        const collection = groupedUnits.get(unit.sourceId) ?? [];
        collection.push(unit);
        groupedUnits.set(unit.sourceId, collection);
      }

      for (const [sourceId, unitsForSource] of groupedUnits.entries()) {
        const source = sourceMap.get(sourceId);
        if (!source) {
          continue;
        }

        const reindexedUnits = await Promise.all(unitsForSource.map(async unit => {
          if (unit.status === 'error') {
            return { ...unit, embedding: undefined };
          }

          const embedding = await this.aiProvider.createEmbedding({
            text: buildUnitEmbeddingText(source.metadata, unit),
          });

          return {
            ...unit,
            embedding,
          };
        }));

        const relationMap = buildUnitRelations(reindexedUnits.map(unit => ({
          id: unit.id,
          sequence: unit.sequence,
          meta: {
            schemaVersion: unit.metadata.version,
            unitType: unit.metadata.unitType,
            summary: unit.metadata.summary,
            terms: unit.metadata.terms,
            entities: unit.metadata.entities,
            relationHints: unit.metadata.relationHints,
          },
          status: unit.status,
          embedding: unit.embedding,
        })));

        const unitsWithRelations = reindexedUnits.map(unit => ({
          ...unit,
          relations: relationMap[unit.id] ?? [],
        }));
        const relations: KnowledgeUnitRelationRecord[] = unitsWithRelations.flatMap(unit =>
          unit.relations.map(relation => ({
            sourceUnitId: unit.id,
            targetUnitId: relation.unitId,
            knowledgeBaseId,
            kind: relation.kind,
            score: relation.score,
            label: relation.label,
          })),
        );

        await this.sourceRepository.saveGraph({
          source,
          units: unitsWithRelations,
        });
        await this.relationRepository.replaceForSource({
          knowledgeBaseId,
          sourceId,
          relations,
        });
      }

      const profile = await this.profileRefreshService.refresh(knowledgeBase);
      const stats = await this.sourceRepository.getStats(knowledgeBaseId);
      await this.operationRepository.complete({
        operationId: operation.id,
        summary: `Reindexed ${knowledgeBase.name}`,
        metadata: {
          profileVersion: profile.version,
          sourceCount: stats.sourceCount,
          unitCount: stats.unitCount,
        },
      });

      return {
        action: 'reindex' as const,
        knowledgeBaseId,
        knowledgeBaseName: knowledgeBase.name,
        sourceCount: stats.sourceCount,
        unitCount: stats.unitCount,
        profileVersion: profile.version,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.operationRepository.fail({
        operationId: operation.id,
        errorMessage: message,
      });
      throw error;
    }
  }

  private async getKnowledgeBaseOrThrow(knowledgeBaseId: string): Promise<KnowledgeBaseRecord> {
    const knowledgeBase = await this.knowledgeBaseRepository.get(knowledgeBaseId);

    if (!knowledgeBase) {
      throw new NotFoundError('Knowledge base not found');
    }

    return knowledgeBase;
  }
}
