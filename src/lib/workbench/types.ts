export type PreviewKind = 'image' | 'text' | 'parsed-text' | 'unsupported';

export type ChunkRelation = {
  chunkId: string;
  score: number;
  label: string;
};

export type DocumentChunkAnalysis = {
  id: string;
  index: number;
  text: string;
  preview: string;
  charCount: number;
  wordCount: number;
  startOffset: number;
  endOffset: number;
  summary: string;
  keywords: string[];
  bridgingContext?: string;
  relatedChunks: ChunkRelation[];
  embeddingDimensions?: number;
  embeddingModel?: string;
  analysisModel?: string;
  status: 'ready' | 'error';
  errorMessage?: string;
};

export type DocumentIngestResult = {
  type: 'document';
  previewKind?: PreviewKind;
  documentId: string;
  chunkCount: number;
  totalCharCount: number;
  processingDurationMs?: number;
  summary?: string;
  parsedTextPreview?: string;
  chunkAnalyses: DocumentChunkAnalysis[];
  contextApplied?: boolean;
  dbWritten?: boolean;
};

export type ImageIngestResult = {
  type: 'image';
  previewKind?: PreviewKind;
  processingDurationMs?: number;
  description?: string;
  descriptionSnippet?: string;
  contextApplied?: boolean;
  dbWritten?: boolean;
};

export type IngestResult = DocumentIngestResult | ImageIngestResult;

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