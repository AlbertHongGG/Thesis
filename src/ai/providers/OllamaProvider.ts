import { AIProvider } from '../types';

export class OllamaProvider implements AIProvider {
  name = 'Ollama';
  private baseUrl: string;
  private textModel: string;
  private visionModel: string;
  private embeddingModel: string;
  private timeoutMs: number;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    if (!process.env.OLLAMA_TEXT_MODEL) {
      throw new Error('OLLAMA_TEXT_MODEL is required');
    }
    if (!process.env.OLLAMA_VISION_MODEL) {
      throw new Error('OLLAMA_VISION_MODEL is required');
    }
    if (!process.env.OLLAMA_EMBEDDING_MODEL) {
      throw new Error('OLLAMA_EMBEDDING_MODEL is required');
    }
    this.textModel = process.env.OLLAMA_TEXT_MODEL
    this.visionModel = process.env.OLLAMA_VISION_MODEL;
    this.embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL;
    this.timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);
  }

  private async requestJson<T>(path: string, body: Record<string, unknown>, failureLabel: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`${failureLabel} failed: ${response.status} ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${failureLabel} timed out after ${this.timeoutMs}ms`);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    const data = await this.requestJson<{ response: string }>(
      '/api/generate',
      {
        model: this.textModel,
        prompt,
        system: systemPrompt,
        stream: false,
      },
      'Ollama text generation',
    );

    return data.response;
  }

  async analyzeImage(base64Image: string, prompt: string = 'Describe this image in detail'): Promise<string> {
    // Remove data:image/...;base64, prefix if present
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

    const data = await this.requestJson<{ response: string }>(
      '/api/generate',
      {
        model: this.visionModel,
        prompt,
        images: [cleanBase64],
        stream: false,
      },
      'Ollama vision analysis',
    );

    return data.response;
  }

  async createEmbedding(text: string): Promise<number[]> {
    const data = await this.requestJson<{ embedding: number[] }>(
      '/api/embeddings',
      {
        model: this.embeddingModel,
        prompt: text,
      },
      'Ollama embedding generation',
    );

    return data.embedding;
  }
}
