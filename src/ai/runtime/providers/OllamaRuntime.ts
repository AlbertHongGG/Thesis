import { AIRuntimeConfigurationError } from '../errors';
import type {
  AIRuntime,
  AIRuntimeEmbeddingRequest,
  AIRuntimeResolvedConfig,
  AIRuntimeTextRequest,
  AIRuntimeVisionRequest,
} from '../types';

type OllamaGenerateResponse = {
  response: string;
};

type OllamaEmbeddingResponse = {
  embedding: number[];
};

function resolveModel(explicitModel: string | undefined, configuredModel: string | undefined, label: string) {
  const model = explicitModel ?? configuredModel;

  if (!model) {
    throw new AIRuntimeConfigurationError(`${label} model is not configured.`);
  }

  return model;
}

export class OllamaRuntime implements AIRuntime {
  constructor(private readonly config: AIRuntimeResolvedConfig) {}

  private async requestJson<T>(path: string, body: Record<string, unknown>, timeoutMs: number, failureLabel: string): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.config.ollamaBaseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`${failureLabel} failed: ${response.status} ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${failureLabel} timed out after ${timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateText(request: AIRuntimeTextRequest): Promise<string> {
    const model = resolveModel(request.model, this.config.textModel, 'AI text');
    const data = await this.requestJson<OllamaGenerateResponse>(
      '/api/generate',
      {
        model,
        prompt: request.prompt,
        system: request.systemPrompt,
        stream: false,
      },
      request.timeoutMs ?? this.config.timeoutMs,
      'Ollama text generation',
    );

    return data.response;
  }

  async analyzeImage(request: AIRuntimeVisionRequest): Promise<string> {
    const model = resolveModel(request.model, this.config.visionModel, 'AI vision');
    const cleanBase64 = request.imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const data = await this.requestJson<OllamaGenerateResponse>(
      '/api/generate',
      {
        model,
        prompt: request.prompt,
        images: [cleanBase64],
        stream: false,
      },
      request.timeoutMs ?? this.config.timeoutMs,
      'Ollama vision analysis',
    );

    return data.response;
  }

  async createEmbedding(request: AIRuntimeEmbeddingRequest): Promise<number[]> {
    const model = resolveModel(request.model, this.config.embeddingModel, 'AI embedding');
    const data = await this.requestJson<OllamaEmbeddingResponse>(
      '/api/embeddings',
      {
        model,
        prompt: request.text,
      },
      request.timeoutMs ?? this.config.timeoutMs,
      'Ollama embedding generation',
    );

    return data.embedding;
  }
}