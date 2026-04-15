export type KnowledgeOperationKind = 'ingest' | 'rebuild-profile' | 'reindex';
export type KnowledgeOperationStatus = 'running' | 'completed' | 'failed';
export type KnowledgeBaseMaintenanceAction = Exclude<KnowledgeOperationKind, 'ingest'>;

export interface KnowledgeOperationRecord {
  id: string;
  knowledgeBaseId: string;
  kind: KnowledgeOperationKind;
  status: KnowledgeOperationStatus;
  sourceId?: string;
  sourcePath?: string;
  summary?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}
