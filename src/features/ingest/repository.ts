import type { DocumentChunkAnalysis, DocumentIngestResult, ImageIngestResult, PreviewKind } from './contracts';

export type PersistableDocumentChunk = DocumentChunkAnalysis & {
  embedding?: number[];
};

export type PersistImageParams = {
  fileName: string;
  previewKind: PreviewKind;
  result: ImageIngestResult;
  description: string;
  descriptionSnippet: string;
  embeddingVector: number[];
  promptVariant: string;
};

export type PersistDocumentParams = {
  fileName: string;
  previewKind: PreviewKind;
  result: DocumentIngestResult;
  chunks: PersistableDocumentChunk[];
  promptVariant: string;
};

export interface IngestRepository {
  saveImage(params: PersistImageParams): Promise<void>;
  saveDocument(params: PersistDocumentParams): Promise<void>;
}