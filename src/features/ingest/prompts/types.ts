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
    documentOverview: string;
  }): string;
  parse(rawText: string): ChunkAnalysisPromptResult;
}

export interface DocumentOverviewPromptBundle {
  id: string;
  systemPrompt: string;
  buildPrompt(input: {
    filename: string;
    globalContext: string;
    parsedTextPreview: string;
    chunks: TextChunk[];
  }): string;
}

export interface DocumentSummaryPromptBundle {
  id: string;
  systemPrompt: string;
  buildPrompt(input: {
    filename: string;
    globalContext: string;
    documentOverview: string;
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
  documentOverview: DocumentOverviewPromptBundle;
  chunkAnalysis: ChunkAnalysisPromptBundle;
  documentSummary: DocumentSummaryPromptBundle;
  imageAnalysis: ImageAnalysisPromptBundle;
}