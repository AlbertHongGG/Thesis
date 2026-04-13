import type { AIRuntime } from '@/ai';
import type { TextChunk } from '@/lib/rag/chunker';
import type { ChunkAnalysisPromptBundle } from '../prompts';

export type ChunkAnalysisServiceResult = {
  summary: string;
  keywords: string[];
  bridgingContext: string;
};

export class ChunkAnalysisService {
  constructor(
    private readonly runtime: AIRuntime,
    private readonly prompt: ChunkAnalysisPromptBundle,
  ) {}

  async analyze(input: {
    chunk: TextChunk;
    previousChunk?: TextChunk;
    nextChunk?: TextChunk;
    knowledgeContext: string;
    documentOverview: string;
  }): Promise<ChunkAnalysisServiceResult> {
    const raw = await this.runtime.generateText({
      systemPrompt: this.prompt.systemPrompt,
      prompt: this.prompt.buildPrompt(input),
    });

    return this.prompt.parse(raw);
  }
}