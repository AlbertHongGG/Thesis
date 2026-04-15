import type { IngestResult } from '@/features/ingest/contracts';

export type {
  PreviewKind,
  IngestUnit,
  RelationHint,
  SourceMeta,
  IngestResult,
  UnitMeta,
  UnitRelation,
} from '@/features/ingest/contracts';

export type FileProcessStatus = 'idle' | 'processing' | 'completed' | 'error';
export type StepStatus = 'running' | 'completed' | 'error';
export type WorkbenchSourceSyncStatus = 'unsynced' | 'synced' | 'pending-path-sync' | 'syncing-path' | 'sync-error';
export type WorkbenchNodeKind = 'folder' | 'file';
export type WorkbenchDropPosition = 'before' | 'after' | 'inside';

export type WorkbenchFileBlob = File & {
  path?: string;
};

export interface WorkbenchFileRecord {
  id: string;
  file: WorkbenchFileBlob;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  originalPath: string;
  workbenchPath: string;
  sourceSyncStatus: WorkbenchSourceSyncStatus;
  sourceSyncError?: string;
  syncedCanonicalPath?: string;
  sourceId?: string;
  knowledgeBaseId?: string;
}

export interface WorkbenchFolderNode {
  id: string;
  kind: 'folder';
  name: string;
  parentId: string | null;
  childIds: string[];
}

export interface WorkbenchFileNode {
  id: string;
  kind: 'file';
  name: string;
  parentId: string | null;
  fileId: string;
}

export type WorkbenchTreeNode = WorkbenchFolderNode | WorkbenchFileNode;

export interface WorkbenchTreeState {
  rootNodeIds: string[];
  nodes: Record<string, WorkbenchTreeNode>;
}

export interface WorkbenchRenderNode {
  id: string;
  name: string;
  path: string;
  kind: WorkbenchNodeKind;
  fileId?: string;
  children?: WorkbenchRenderNode[];
}

export interface WorkbenchSourcePathSyncItem {
  fileId: string;
  sourceId: string;
  knowledgeBaseId: string;
  canonicalPath: string;
}

export interface ProcessStepEntry {
  id: number;
  message: string;
  status: StepStatus;
  startedAt: number;
  completedAt?: number;
}

export interface FileProcessEntry {
  fileId: string;
  path: string;
  displayPath: string;
  status: FileProcessStatus;
  steps: ProcessStepEntry[];
  startedAt?: number;
  completedAt?: number;
  result?: IngestResult;
  errorMessage?: string;
}