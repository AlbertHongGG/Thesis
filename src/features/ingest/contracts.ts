export const INGEST_CONTRACT_VERSION = 3;

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

export type IngestStepEvent = {
  type: 'step';
  message: string;
};

export type IngestChunkEvent = {
  type: 'chunk';
  chunk: DocumentChunkAnalysis;
  documentId: string;
  chunkCount: number;
  totalCharCount: number;
  parsedTextPreview: string;
  previewKind: PreviewKind;
  progress: { current: number; total: number };
};

export type IngestResultEvent = {
  type: 'result';
  result: IngestResult;
};

export type IngestErrorEvent = {
  type: 'error';
  error: string;
};

export type IngestStreamEvent = IngestStepEvent | IngestChunkEvent | IngestResultEvent | IngestErrorEvent;

export function encodeStreamEvent(event: IngestStreamEvent) {
  return `${JSON.stringify(event)}\n`;
}