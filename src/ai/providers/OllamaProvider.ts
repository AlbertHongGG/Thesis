import { AIProvider } from '../types';

export class OllamaProvider implements AIProvider {
  name = 'Ollama';
  private baseUrl: string;
  private textModel: string;
  private visionModel: string;
  private embeddingModel: string;

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
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.textModel,
        prompt,
        system: systemPrompt,
        stream: false,
      }),
    });
    
    if (!response.ok) {
        throw new Error(`Ollama text generation failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.response;
  }

  async analyzeImage(base64Image: string, prompt: string = 'Describe this image in detail'): Promise<string> {
    // Remove data:image/...;base64, prefix if present
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.visionModel,
        prompt: prompt,
        images: [cleanBase64],
        stream: false,
      }),
    });
    
    if (!response.ok) {
        throw new Error(`Ollama vision analysis failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  }

  async createEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.embeddingModel,
        prompt: text,
      }),
    });
    
    if (!response.ok) {
        throw new Error(`Ollama embedding generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  }
}
