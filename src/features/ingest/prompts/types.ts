import type { TextChunk } from '@/lib/rag/chunker';
import type { DocumentChunkAnalysis } from '../contracts';

export type ChunkAnalysisPromptResult = {
  summary: string;
  keywords: string[];
  bridgingContext: string;
};

export interface ChunkAnalysisPromptBundle {
  id: string;
  systemPrompt: string;
  buildPrompt(input: {
    chunk: TextChunk;
    previousChunk?: TextChunk;
    nextChunk?: TextChunk;
    globalContext: string;
  }): string;
  parse(rawText: string): ChunkAnalysisPromptResult;
}

export interface DocumentSummaryPromptBundle {
  id: string;
  systemPrompt: string;
  buildPrompt(input: {
    filename: string;
    globalContext: string;
    chunks: DocumentChunkAnalysis[];
  }): string;
}

export interface ImageAnalysisPromptBundle {
  id: string;
  systemPrompt: string;
  buildPrompt(input: { globalContext: string }): string;
}

export interface IngestPrompts {
  id: string;
  chunkAnalysis: ChunkAnalysisPromptBundle;
  documentSummary: DocumentSummaryPromptBundle;
  imageAnalysis: ImageAnalysisPromptBundle;
}