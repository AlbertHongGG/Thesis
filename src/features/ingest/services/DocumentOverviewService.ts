import type { AIRuntime } from '@/ai';
import type { TextChunk } from '@/lib/rag/chunker';
import type { DocumentOverviewPromptBundle } from '../prompts';

export class DocumentOverviewService {
  constructor(
    private readonly runtime: AIRuntime,
    private readonly prompt: DocumentOverviewPromptBundle,
  ) {}

  async summarize(filename: string, chunks: TextChunk[], parsedTextPreview: string, globalContext: string) {
    if (chunks.length === 0) {
      return `文件 ${filename} 已完成解析，但目前沒有可用的 chunk 可建立整體總覽。`;
    }

    try {
      const raw = await this.runtime.generateText({
        systemPrompt: this.prompt.systemPrompt,
        prompt: this.prompt.buildPrompt({
          filename,
          globalContext,
          parsedTextPreview,
          chunks,
        }),
      });

      return raw.trim();
    } catch {
      return `文件 ${filename} 主要在說明整體主題與多個相關子段落；後續 chunk 會分別補充其中的細節、步驟、限制與範例。`;
    }
  }
}