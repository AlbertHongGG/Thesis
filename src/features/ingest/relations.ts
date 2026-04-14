import type { RelationKind, UnitMeta, UnitRelation } from './contracts';

const MIN_RELATION_SCORE = 0.34;
const MAX_RELATED_UNITS = 4;

export type RelatableUnit = {
  id: string;
  sequence: number;
  meta: UnitMeta;
  status: 'ready' | 'error';
  embedding?: number[];
};

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
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

function overlapScore(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightSet = new Set(right.map(value => value.toLocaleLowerCase('en-US')));
  const shared = left.filter(value => rightSet.has(value.toLocaleLowerCase('en-US'))).length;
  return shared / Math.max(left.length, right.length, 1);
}

function resolveRelationKind(source: RelatableUnit, target: RelatableUnit): RelationKind {
  const sourceKinds = new Set(source.meta.relationHints.map(hint => hint.kind));
  for (const hint of target.meta.relationHints) {
    if (sourceKinds.has(hint.kind)) {
      return hint.kind;
    }
  }

  return 'references';
}

function buildRelationLabel(source: RelatableUnit, target: RelatableUnit) {
  const sharedEntities = source.meta.entities.filter(entity => target.meta.entities.includes(entity)).slice(0, 2);
  if (sharedEntities.length > 0) {
    return `共享實體：${sharedEntities.join('、')}`;
  }

  const sharedTerms = source.meta.terms.filter(term => target.meta.terms.includes(term)).slice(0, 2);
  if (sharedTerms.length > 0) {
    return `共享術語：${sharedTerms.join('、')}`;
  }

  return `與單位 ${target.sequence + 1} 存在穩定語意關聯`;
}

export function buildUnitRelations(units: RelatableUnit[]) {
  const relationMap: Record<string, UnitRelation[]> = {};

  for (const source of units) {
    if (!source.embedding || source.status === 'error') {
      relationMap[source.id] = [];
      continue;
    }

    relationMap[source.id] = units
      .filter(target => target.id !== source.id && target.embedding && target.status !== 'error')
      .map(target => ({
        target,
        score: (() => {
          const semanticScore = cosineSimilarity(source.embedding ?? [], target.embedding ?? []);
          const termScore = overlapScore(source.meta.terms, target.meta.terms);
          const entityScore = overlapScore(source.meta.entities, target.meta.entities);
          const relationScore = overlapScore(
            source.meta.relationHints.map(hint => `${hint.kind}:${hint.label}`),
            target.meta.relationHints.map(hint => `${hint.kind}:${hint.label}`),
          );

          return Number((semanticScore * 0.55 + termScore * 0.2 + entityScore * 0.15 + relationScore * 0.1).toFixed(4));
        })(),
      }))
      .filter(candidate => candidate.score >= MIN_RELATION_SCORE)
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_RELATED_UNITS)
      .map(candidate => ({
        unitId: candidate.target.id,
        kind: resolveRelationKind(source, candidate.target),
        score: Number(candidate.score.toFixed(4)),
        label: buildRelationLabel(source, candidate.target),
      }));
  }

  return relationMap;
}