import type { AIRuntime } from '@/ai';
import type { TextChunk } from '@/lib/rag/chunker';
import type { UnitMeta } from '../contracts';
import { buildPreview } from '../text';
import type { DocumentUnitPromptBundle, ImageUnitPromptBundle } from '../prompts';

type UnitMetadataResult = Omit<UnitMeta, 'schemaVersion' | 'unitType'>;

export class UnitMetadataService {
  constructor(
    private readonly runtime: AIRuntime,
    private readonly documentPrompt: DocumentUnitPromptBundle,
    private readonly imagePrompt: ImageUnitPromptBundle,
  ) {}

  async analyzeDocumentUnit(input: {
    unit: TextChunk;
    previousUnit?: TextChunk;
    nextUnit?: TextChunk;
    knowledgeContext: string;
    sourceSummary: string;
  }): Promise<UnitMetadataResult> {
    try {
      const raw = await this.runtime.generateText({
        systemPrompt: this.documentPrompt.systemPrompt,
        prompt: this.documentPrompt.buildPrompt(input),
      });

      return this.documentPrompt.parse(raw);
    } catch {
      return {
        summary: buildPreview(input.unit.text, 180),
        terms: [],
        entities: [],
        relationHints: [],
      };
    }
  }

  async analyzeImageUnit(input: {
    filename: string;
    imageDataUrl: string;
    knowledgeContext: string;
    sourceSummary: string;
  }): Promise<UnitMetadataResult> {
    try {
      const raw = await this.runtime.analyzeImage({
        imageDataUrl: input.imageDataUrl,
        systemPrompt: this.imagePrompt.systemPrompt,
        prompt: this.imagePrompt.buildPrompt(input),
      });

      return this.imagePrompt.parse(raw);
    } catch {
      return {
        summary: input.sourceSummary,
        terms: [],
        entities: [],
        relationHints: [],
      };
    }
  }
}