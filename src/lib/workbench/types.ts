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

export interface ProcessStepEntry {
  id: number;
  message: string;
  status: StepStatus;
  startedAt: number;
  completedAt?: number;
}

export interface FileProcessEntry {
  path: string;
  displayPath: string;
  status: FileProcessStatus;
  steps: ProcessStepEntry[];
  startedAt?: number;
  completedAt?: number;
  result?: IngestResult;
  errorMessage?: string;
}