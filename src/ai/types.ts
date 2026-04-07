export interface LLMProvider {
  generateText(prompt: string, systemPrompt?: string): Promise<string>;
}

export interface VisionProvider {
  analyzeImage(base64Image: string, prompt?: string): Promise<string>;
}

export interface EmbeddingProvider {
  createEmbedding(text: string): Promise<number[]>;
}

export interface AIProvider extends LLMProvider, VisionProvider, EmbeddingProvider {
  name: string;
}
