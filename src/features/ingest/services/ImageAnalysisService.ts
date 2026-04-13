import type { AIRuntime } from '@/ai';
import type { ImageAnalysisPromptBundle, ImageQueryPromptBundle } from '../prompts';

export class ImageAnalysisService {
  constructor(
    private readonly runtime: AIRuntime,
    private readonly imageQueryPrompt: ImageQueryPromptBundle,
    private readonly prompt: ImageAnalysisPromptBundle,
  ) {}

  async buildRetrievalHints(imageDataUrl: string, filename: string) {
    const raw = await this.runtime.analyzeImage({
      imageDataUrl,
      systemPrompt: this.imageQueryPrompt.systemPrompt,
      prompt: this.imageQueryPrompt.buildPrompt({ filename }),
    });

    return this.imageQueryPrompt.parse(raw);
  }

  async analyze(input: {
    imageDataUrl: string;
    knowledgeContext: string;
    preliminarySummary: string;
    retrievalQuery: string;
  }) {
    return this.runtime.analyzeImage({
      imageDataUrl: input.imageDataUrl,
      systemPrompt: this.prompt.systemPrompt,
      prompt: this.prompt.buildPrompt({
        knowledgeContext: input.knowledgeContext,
        preliminarySummary: input.preliminarySummary,
        retrievalQuery: input.retrievalQuery,
      }),
    });
  }
}