import type { AIRuntime } from '@/ai';
import type { DocumentChunkAnalysis } from '../contracts';
import type { DocumentSummaryPromptBundle } from '../prompts';

export class DocumentSummaryService {
  constructor(
    private readonly runtime: AIRuntime,
    private readonly prompt: DocumentSummaryPromptBundle,
  ) {}

  async summarize(filename: string, chunks: DocumentChunkAnalysis[], globalContext: string) {
    const usableChunks = chunks.filter(chunk => chunk.summary.trim().length > 0).slice(0, 12);

    if (usableChunks.length === 0) {
      return `文件 ${filename} 已完成解析，但沒有足夠的 chunk 摘要可供整合。`;
    }

    try {
      const raw = await this.runtime.generateText({
        systemPrompt: this.prompt.systemPrompt,
        prompt: this.prompt.buildPrompt({
          filename,
          globalContext,
          chunks: usableChunks,
        }),
      });

      return raw.trim();
    } catch {
      return usableChunks.map(chunk => chunk.summary).join(' ');
    }
  }
}