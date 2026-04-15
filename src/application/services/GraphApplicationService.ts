import type { KnowledgeRelationRepository, KnowledgeSourceRepository, KnowledgeUnitRepository } from '@/application/ports/repositories';
import type { KnowledgeGraphProjection, KnowledgeUnitRecord } from '@/domain/knowledge/types';

function cosineSimilarity(left: number[], right: number[]) {
  if (!left || !right || left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export class GraphApplicationService {
  constructor(
    private readonly sourceRepository: KnowledgeSourceRepository,
    private readonly unitRepository: KnowledgeUnitRepository,
    private readonly relationRepository: KnowledgeRelationRepository,
  ) {}

  async getGraph(knowledgeBaseId: string): Promise<KnowledgeGraphProjection> {
    const [sources, units, relations] = await Promise.all([
      this.sourceRepository.listByKnowledgeBase(knowledgeBaseId),
      this.unitRepository.listByKnowledgeBase(knowledgeBaseId),
      this.relationRepository.listByKnowledgeBase(knowledgeBaseId),
    ]);

    const nodes: KnowledgeGraphProjection['nodes'] = [];
    const links: KnowledgeGraphProjection['links'] = [];
    const folders = new Set<string>();

    for (const source of sources) {
      const parts = (source.canonicalPath || source.title).split('/');
      let currentPath = '';

      if (parts.length > 1) {
        for (let index = 0; index < parts.length - 1; index += 1) {
          const previousPath = currentPath;
          currentPath = currentPath ? `${currentPath}/${parts[index]}` : parts[index];

          if (!folders.has(currentPath)) {
            folders.add(currentPath);
            nodes.push({
              id: `folder:${currentPath}`,
              name: parts[index],
              group: 'folder',
              val: 12,
              type: 'folder',
            });

            if (previousPath) {
              links.push({
                source: `folder:${previousPath}`,
                target: `folder:${currentPath}`,
                type: 'hierarchy',
              });
            }
          }
        }

        links.push({
          source: `folder:${currentPath}`,
          target: source.id,
          type: 'hierarchy',
        });
      }

      nodes.push({
        id: source.id,
        name: source.title,
        fullName: source.canonicalPath,
        summary: source.metadata.summary,
        terms: source.metadata.terms,
        entities: source.metadata.entities,
        group: source.id,
        val: 8,
        type: 'source',
        sourceType: source.sourceType,
      });
    }

    for (const unit of units) {
      nodes.push({
        id: unit.id,
        name: unit.metadata.summary || `${unit.content.substring(0, 30)}...`,
        summary: unit.metadata.summary,
        content: unit.content,
        terms: unit.metadata.terms,
        entities: unit.metadata.entities,
        unitType: unit.unitType,
        group: unit.sourceId,
        val: 3,
        type: 'unit',
      });

      links.push({
        source: unit.sourceId,
        target: unit.id,
        type: 'child',
        label: 'contains',
      });
    }

    for (const relation of relations) {
      links.push({
        source: relation.sourceUnitId,
        target: relation.targetUnitId,
        type: 'related',
        score: relation.score,
        label: relation.label,
      });
    }

    this.appendCrossSourceLinks(units, links);

    return { nodes, links };
  }

  async deleteGraphTarget(input: {
    knowledgeBaseId: string;
    deleteAll?: boolean;
    folderPath?: string;
    documentId?: string;
  }) {
    if (input.deleteAll) {
      await this.sourceRepository.deleteByKnowledgeBase(input.knowledgeBaseId);
      return { success: true, message: 'All documents deleted.' };
    }

    if (input.folderPath) {
      await this.sourceRepository.deleteByPathPrefix(input.knowledgeBaseId, input.folderPath);
      return { success: true, message: `Folder ${input.folderPath} deleted.` };
    }

    if (input.documentId) {
      await this.sourceRepository.deleteById(input.documentId);
      return { success: true, message: 'Document deleted.' };
    }

    throw new Error('No valid deletion target provided.');
  }

  private appendCrossSourceLinks(units: KnowledgeUnitRecord[], links: KnowledgeGraphProjection['links']) {
    const unitsWithEmbeddings = units.filter(unit => Array.isArray(unit.embedding) && unit.embedding.length > 0);
    const MIN_CROSS_RELATION_SCORE = 0.35;
    const MAX_CROSS_LINKS = 2;

    for (const source of unitsWithEmbeddings) {
      const candidates: Array<{ targetId: string; score: number }> = [];

      for (const target of unitsWithEmbeddings) {
        if (source.sourceId === target.sourceId || !source.embedding || !target.embedding) {
          continue;
        }

        const score = cosineSimilarity(source.embedding, target.embedding);
        if (score >= MIN_CROSS_RELATION_SCORE) {
          candidates.push({ targetId: target.id, score });
        }
      }

      candidates
        .sort((left, right) => right.score - left.score)
        .slice(0, MAX_CROSS_LINKS)
        .forEach(match => {
          links.push({
            source: source.id,
            target: match.targetId,
            type: 'related',
            score: match.score,
          });
        });
    }
  }
}
