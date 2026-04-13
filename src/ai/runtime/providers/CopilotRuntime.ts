import {
  AIRuntimeConfigurationError,
  AIRuntimeRequestError,
} from '../errors';
import type {
  AIRuntime,
  AIRuntimeEmbeddingRequest,
  AIRuntimeResolvedConfig,
  AIRuntimeTextRequest,
  AIRuntimeVisionRequest,
} from '../types';

type CopilotChatMessage = {
  role: 'system' | 'user';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
};

type CopilotChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
};

type CopilotEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
};

function resolveModel(explicitModel: string | undefined, configuredModel: string | undefined, label: string) {
  const model = explicitModel ?? configuredModel;

  if (!model) {
    throw new AIRuntimeConfigurationError(`${label} model is not configured.`);
  }

  return model;
}

function extractText(data: CopilotChatCompletionResponse, failureLabel: string) {
  const content = data.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const combined = content.map(part => part.text ?? '').join('').trim();
    if (combined) {
      return combined;
    }
  }

  throw new AIRuntimeRequestError(`${failureLabel} returned an empty response.`);
}

export class CopilotRuntime implements AIRuntime {
  constructor(private readonly config: AIRuntimeResolvedConfig) {
    if (!config.githubToken) {
      throw new AIRuntimeConfigurationError('GITHUB_TOKEN is required when AI_PROVIDER=copilot.');
    }
  }

  private async requestJson<T>(path: string, body: Record<string, unknown>, timeoutMs: number, failureLabel: string): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.config.copilotBaseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.githubToken}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AIRuntimeRequestError(`${failureLabel} failed: ${response.status} ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIRuntimeRequestError(`${failureLabel} timed out after ${timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateText(request: AIRuntimeTextRequest): Promise<string> {
    const model = resolveModel(request.model, this.config.textModel, 'AI text');
    const messages: CopilotChatMessage[] = [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.prompt },
    ];
    const data = await this.requestJson<CopilotChatCompletionResponse>(
      '/chat/completions',
      {
        model,
        messages,
        stream: false,
      },
      request.timeoutMs ?? this.config.timeoutMs,
      'GitHub text generation',
    );

    return extractText(data, 'GitHub text generation');
  }

  async analyzeImage(request: AIRuntimeVisionRequest): Promise<string> {
    const model = resolveModel(request.model, this.config.visionModel, 'AI vision');
    const data = await this.requestJson<CopilotChatCompletionResponse>(
      '/chat/completions',
      {
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: request.prompt },
              { type: 'image_url', image_url: { url: request.imageDataUrl } },
            ],
          },
        ],
        stream: false,
      },
      request.timeoutMs ?? this.config.timeoutMs,
      'GitHub vision analysis',
    );

    return extractText(data, 'GitHub vision analysis');
  }

  async createEmbedding(request: AIRuntimeEmbeddingRequest): Promise<number[]> {
    const model = resolveModel(request.model, this.config.embeddingModel, 'AI embedding');
    const data = await this.requestJson<CopilotEmbeddingResponse>(
      '/embeddings',
      {
        model,
        input: request.text,
      },
      request.timeoutMs ?? this.config.timeoutMs,
      'GitHub embedding generation',
    );

    const embedding = data.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      throw new AIRuntimeRequestError('GitHub embedding generation returned an empty vector.');
    }

    return embedding;
  }
}