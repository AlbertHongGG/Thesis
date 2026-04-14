import type { AIRuntime } from '@/ai';
import type { TextChunk } from '@/lib/rag/chunker';
import type { SourceMeta } from '../contracts';
import { buildPreview } from '../text';
import type { DocumentSourcePromptBundle, ImageSourcePromptBundle } from '../prompts';

type SourceMetadataResult = Omit<SourceMeta, 'schemaVersion' | 'sourceType' | 'title'>;

export class SourceMetadataService {
  constructor(
    private readonly runtime: AIRuntime,
    private readonly documentPrompt: DocumentSourcePromptBundle,
    private readonly imagePrompt: ImageSourcePromptBundle,
  ) {}

  async analyzeDocument(input: {
    filename: string;
    parsedTextPreview: string;
    units: TextChunk[];
    knowledgeContext: string;
  }): Promise<SourceMetadataResult> {
    if (input.units.length === 0) {
      return {
        summary: `文件 ${input.filename} 已完成解析，但目前沒有足夠內容可建立來源摘要。`,
        terms: [],
        entities: [],
      };
    }

    try {
      const raw = await this.runtime.generateText({
        systemPrompt: this.documentPrompt.systemPrompt,
        prompt: this.documentPrompt.buildPrompt(input),
      });

      return this.documentPrompt.parse(raw);
    } catch {
      return {
        summary: buildPreview(input.parsedTextPreview, 220),
        terms: [],
        entities: [],
      };
    }
  }

  async analyzeImage(input: {
    filename: string;
    imageDataUrl: string;
    knowledgeContext: string;
  }): Promise<SourceMetadataResult> {
    try {
      const raw = await this.runtime.analyzeImage({
        imageDataUrl: input.imageDataUrl,
        systemPrompt: this.imagePrompt.systemPrompt,
        prompt: this.imagePrompt.buildPrompt(input),
      });

      return this.imagePrompt.parse(raw);
    } catch {
      return {
        summary: `圖片 ${input.filename} 已完成讀取，但目前只能保留基礎來源資訊。`,
        terms: [],
        entities: [],
      };
    }
  }
}