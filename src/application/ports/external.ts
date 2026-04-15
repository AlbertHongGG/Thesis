import type { IngestPrompts } from '@/features/ingest/prompts';
import type { TextChunk } from '@/lib/rag/chunker';

export interface AIProvider {
  generateText(input: { systemPrompt: string; prompt: string }): Promise<string>;
  analyzeImage(input: { imageDataUrl: string; systemPrompt?: string; prompt: string }): Promise<string>;
  createEmbedding(input: { text: string }): Promise<number[]>;
}

export interface DocumentParser {
  parse(fileBuffer: Buffer, filename: string): Promise<string>;
}

export interface TextChunker {
  chunk(text: string, chunkSize?: number, overlap?: number): TextChunk[];
}

export interface IngestModuleConfig {
  prompts: IngestPrompts;
  defaultChunkSize: number;
  defaultOverlap: number;
}
