import type { ChunkRelation } from './contracts';

const MIN_RELATION_SCORE = 0.24;
const MAX_RELATED_CHUNKS = 3;

export type RelatableChunk = {
  id: string;
  index: number;
  keywords: string[];
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

function buildRelationLabel(source: RelatableChunk, target: RelatableChunk) {
  const sharedKeywords = source.keywords.filter(keyword => target.keywords.includes(keyword)).slice(0, 2);

  if (sharedKeywords.length > 0) {
    return `共同主題：${sharedKeywords.join('、')}`;
  }

  return `與 Chunk ${target.index + 1} 的語意內容高度相近`;
}

export function buildChunkRelations(chunks: RelatableChunk[]) {
  const relationMap: Record<string, ChunkRelation[]> = {};

  for (const source of chunks) {
    if (!source.embedding || source.status === 'error') {
      relationMap[source.id] = [];
      continue;
    }

    relationMap[source.id] = chunks
      .filter(target => target.id !== source.id && target.embedding && target.status !== 'error')
      .map(target => ({
        target,
        score: cosineSimilarity(source.embedding ?? [], target.embedding ?? []),
      }))
      .filter(candidate => candidate.score >= MIN_RELATION_SCORE)
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_RELATED_CHUNKS)
      .map(candidate => ({
        chunkId: candidate.target.id,
        score: Number(candidate.score.toFixed(4)),
        label: buildRelationLabel(source, candidate.target),
      }));
  }

  return relationMap;
}