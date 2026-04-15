import type { KnowledgeBaseRecord } from '@/domain/knowledge/types';
import type { KnowledgeBaseMaintenanceAction } from '@/domain/operations/types';
import { requestJson } from './http';

type KnowledgeBaseListResponse = {
  knowledgeBases?: KnowledgeBaseRecord[];
};

type KnowledgeBaseCreateResponse = {
  knowledgeBase: KnowledgeBaseRecord;
};

type KnowledgeBaseMaintenanceResponse = {
  result: {
    action: KnowledgeBaseMaintenanceAction;
    knowledgeBaseId: string;
    knowledgeBaseName: string;
    sourceCount: number;
    unitCount: number;
    profileVersion?: number;
  };
};

export async function listKnowledgeBases() {
  const response = await requestJson<KnowledgeBaseListResponse>('/api/knowledge-bases');
  return response.knowledgeBases ?? [];
}

export async function createKnowledgeBase(input: {
  id?: string;
  slug?: string;
  name?: string;
  description?: string;
}) {
  const response = await requestJson<KnowledgeBaseCreateResponse>('/api/knowledge-bases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  return response.knowledgeBase;
}

export async function deleteKnowledgeBase(knowledgeBaseId: string) {
  await requestJson<{ ok: boolean }>(`/api/knowledge-bases?id=${encodeURIComponent(knowledgeBaseId)}`, {
    method: 'DELETE',
  });
}

export async function runKnowledgeBaseMaintenance(
  knowledgeBaseId: string,
  action: KnowledgeBaseMaintenanceAction,
) {
  const response = await requestJson<KnowledgeBaseMaintenanceResponse>(
    `/api/knowledge-bases/${encodeURIComponent(knowledgeBaseId)}/maintenance`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    },
  );

  return response.result;
}

export async function repathKnowledgeSources(
  knowledgeBaseId: string,
  items: Array<{
    sourceId: string;
    canonicalPath: string;
  }>,
) {
  const response = await requestJson<{ updatedSourceCount: number }>(
    `/api/knowledge-bases/${encodeURIComponent(knowledgeBaseId)}/sources/repath`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    },
  );

  return response.updatedSourceCount;
}