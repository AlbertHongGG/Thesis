import type { TextChunk } from '@/lib/rag/chunker';
import type { RelationHint, SourceStructure } from '../contracts';

export type SourceMetadataPromptResult = {
  summary: string;
  terms: string[];
  entities: string[];
  structure?: SourceStructure;
};

export type UnitMetadataPromptResult = {
  summary: string;
  terms: string[];
  entities: string[];
  relationHints: RelationHint[];
};

export interface DocumentSourcePromptBundle {
  id: string;
  systemPrompt: string;
  buildPrompt(input: {
    filename: string;
    knowledgeContext: string;
    parsedTextPreview: string;
    units: TextChunk[];
  }): string;
  parse(rawText: string): SourceMetadataPromptResult;
}

export interface ImageSourcePromptBundle {
  id: string;
  systemPrompt: string;
  buildPrompt(input: {
    filename: string;
    knowledgeContext: string;
  }): string;
  parse(rawText: string): SourceMetadataPromptResult;
}

export interface DocumentUnitPromptBundle {
  id: string;
  systemPrompt: string;
  buildPrompt(input: {
    unit: TextChunk;
    previousUnit?: TextChunk;
    nextUnit?: TextChunk;
    knowledgeContext: string;
    sourceSummary: string;
  }): string;
  parse(rawText: string): UnitMetadataPromptResult;
}

export interface ImageUnitPromptBundle {
  id: string;
  systemPrompt: string;
  buildPrompt(input: {
    filename: string;
    knowledgeContext: string;
    sourceSummary: string;
  }): string;
  parse(rawText: string): UnitMetadataPromptResult;
}

export interface DocumentSummaryPromptBundle {
  never?: never;
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
  };
}

export interface IngestPrompts {
  id: string;
  documentSource: DocumentSourcePromptBundle;
  imageSource: ImageSourcePromptBundle;
  documentUnit: DocumentUnitPromptBundle;
  imageUnit: ImageUnitPromptBundle;
  knowledgeProfile: KnowledgeProfilePromptBundle;
}