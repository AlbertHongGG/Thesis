import { AIProvider } from '../types';

export class CopilotProvider implements AIProvider {
  name = 'Copilot';
  private model: string;
  private token: string;

  constructor() {
    this.model = process.env.COPILOT_MODEL || 'gpt-4';
    this.token = process.env.GITHUB_TOKEN || '';
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    // Placeholder for actual Github Copilot SDK implementation
    // This will be fully implemented in the "Thesis Writing Workspace" phase
    console.log(`[Copilot] Generating text with model ${this.model}`);
    
    // TODO: implement actual Copilot SDK call
    return Promise.resolve(`(Copilot SDK response pending implementation for writing phase)`);
  }

  async analyzeImage(base64Image: string, prompt?: string): Promise<string> {
    throw new Error('CopilotProvider does not currently support image analysis natively in this abstraction.');
  }

  async createEmbedding(text: string): Promise<number[]> {
     throw new Error('CopilotProvider does not currently support embedding generation in this abstraction.');
  }
}
