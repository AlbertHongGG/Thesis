import type { KnowledgeUnitMatch } from '@/domain/knowledge/types';
import { requestJson } from './http';

type SearchResponse = {
  results?: KnowledgeUnitMatch[];
};

export async function searchKnowledgeBase(input: {
  knowledgeBaseId: string;
  query: string;
  limit?: number;
}) {
  const response = await requestJson<SearchResponse>('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: input.query,
      knowledgeBaseId: input.knowledgeBaseId,
      limit: input.limit ?? 5,
    }),
  });

  return response.results ?? [];
}