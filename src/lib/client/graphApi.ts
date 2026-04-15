import type { KnowledgeGraphProjection } from '@/domain/knowledge/types';
import { requestJson } from './http';

export async function fetchKnowledgeGraph(knowledgeBaseId: string) {
  return requestJson<KnowledgeGraphProjection>(`/api/graph?kbId=${encodeURIComponent(knowledgeBaseId)}`);
}

export async function deleteKnowledgeGraphTarget(input: {
  knowledgeBaseId: string;
  documentId?: string;
  folderPath?: string;
  deleteAll?: boolean;
}) {
  const params = new URLSearchParams({ kbId: input.knowledgeBaseId });

  if (input.documentId) {
    params.set('documentId', input.documentId);
  }

  if (input.folderPath) {
    params.set('folderPath', input.folderPath);
  }

  if (input.deleteAll) {
    params.set('deleteAll', 'true');
  }

  return requestJson<{ success: boolean; message: string }>(`/api/graph?${params.toString()}`, {
    method: 'DELETE',
  });
}