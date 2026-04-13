export type AIProviderId = 'ollama' | 'copilot';

export interface AIRuntimeTextRequest {
  systemPrompt: string;
  prompt: string;
  model?: string;
  timeoutMs?: number;
}

export interface AIRuntimeVisionRequest {
  imageDataUrl: string;
  prompt: string;
  model?: string;
  timeoutMs?: number;
}

export interface AIRuntimeEmbeddingRequest {
  text: string;
  model?: string;
  timeoutMs?: number;
}

export interface AIRuntime {
  generateText(request: AIRuntimeTextRequest): Promise<string>;
  analyzeImage(request: AIRuntimeVisionRequest): Promise<string>;
  createEmbedding(request: AIRuntimeEmbeddingRequest): Promise<number[]>;
}

export interface AIRuntimeFeatureConfig {
  provider: AIProviderId;
  textModel?: string;
  visionModel?: string;
  embeddingModel?: string;
  timeoutMs: number;
}

export interface AIRuntimeResolvedConfig extends AIRuntimeFeatureConfig {
  ollamaBaseUrl: string;
  copilotBaseUrl: string;
  githubToken?: string;
}

export interface AIRuntimeFactoryOptions {
  featureKey?: string;
  env?: NodeJS.ProcessEnv;
  provider?: AIProviderId;
  textModel?: string;
  visionModel?: string;
  embeddingModel?: string;
  timeoutMs?: number;
  ollamaBaseUrl?: string;
  copilotBaseUrl?: string;
  githubToken?: string;
}