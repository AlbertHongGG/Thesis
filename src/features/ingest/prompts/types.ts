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
    knowledgeContext: string;
    documentOverview: string;
  }): string;
  parse(rawText: string): ChunkAnalysisPromptResult;
}

export interface DocumentOverviewPromptBundle {
  id: string;
  systemPrompt: string;
  buildPrompt(input: {
    filename: string;
    knowledgeContext: string;
    parsedTextPreview: string;
    chunks: TextChunk[];
  }): string;
}

export interface DocumentSummaryPromptBundle {
  id: string;
  systemPrompt: string;
  buildPrompt(input: {
    filename: string;
    knowledgeContext: string;
    documentOverview: string;
    chunks: DocumentChunkAnalysis[];
  }): string;
}

export type ImageQueryPromptResult = {
  summary: string;
  chartType: string;
  keywords: string[];
  candidateQueries: string[];
  visibleText: string[];
};

export interface ImageQueryPromptBundle {
  id: string;
  systemPrompt: string;
  buildPrompt(input: { filename: string }): string;
  parse(rawText: string): ImageQueryPromptResult;
}

export interface ImageAnalysisPromptBundle {
  id: string;
  systemPrompt: string;
  buildPrompt(input: {
    knowledgeContext: string;
    preliminarySummary: string;
    retrievalQuery: string;
  }): string;
}

export interface KnowledgeProfilePromptBundle {
  id: string;
  systemPrompt: string;
  buildPrompt(input: {
    knowledgeBaseName: string;
    sourceSummaries: string[];
    keyTerms: string[];
  }): string;
  parse(rawText: string): {
    summary: string;
    focusAreas: string[];
    keyTerms: string[];
    researchQuestions: string[];
    methods: string[];
    recentUpdates: string[];
  };
}

export interface IngestPrompts {
  id: string;
  documentOverview: DocumentOverviewPromptBundle;
  chunkAnalysis: ChunkAnalysisPromptBundle;
  documentSummary: DocumentSummaryPromptBundle;
  imageQuery: ImageQueryPromptBundle;
  imageAnalysis: ImageAnalysisPromptBundle;
  knowledgeProfile: KnowledgeProfilePromptBundle;
}