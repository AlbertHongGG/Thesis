export type PreviewKind = 'image' | 'text' | 'parsed-text' | 'unsupported';

export type PreviewChunk = {
  index: number;
  preview: string;
  charCount: number;
};

export type IngestResult = {
  type: 'document' | 'image';
  previewKind?: PreviewKind;
  chunks?: number;
  summary?: string;
  description?: string;
  descriptionSnippet?: string;
  contextApplied?: boolean;
  parsedTextPreview?: string;
  chunkPreviews?: PreviewChunk[];
};

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