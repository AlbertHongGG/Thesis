import { AIProvider } from './types';
import { OllamaProvider } from './providers/OllamaProvider';
import { CopilotProvider } from './providers/CopilotProvider';

export * from './types';

export function getAIProvider(providerName: 'ollama' | 'copilot' = 'ollama'): AIProvider {
  if (providerName === 'copilot') {
    return new CopilotProvider();
  }
  return new OllamaProvider();
}
