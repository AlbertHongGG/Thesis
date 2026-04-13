import type { AIRuntime } from '@/ai';
import type { ImageAnalysisPromptBundle } from '../prompts';

export class ImageAnalysisService {
  constructor(
    private readonly runtime: AIRuntime,
    private readonly prompt: ImageAnalysisPromptBundle,
  ) {}

  async analyze(imageDataUrl: string, globalContext: string) {
    return this.runtime.analyzeImage({
      imageDataUrl,
      prompt: this.prompt.buildPrompt({ globalContext }),
    });
  }
}