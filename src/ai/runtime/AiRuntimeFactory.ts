import { resolveAIRuntimeConfig } from './config';
import { AIRuntimeConfigurationError } from './errors';
import { CopilotRuntime } from './providers/CopilotRuntime';
import { OllamaRuntime } from './providers/OllamaRuntime';
import type { AIRuntime, AIRuntimeFactoryOptions, AIRuntimeResolvedConfig } from './types';

export function createAiRuntimeFromConfig(config: AIRuntimeResolvedConfig): AIRuntime {
  if (config.provider === 'ollama') {
    return new OllamaRuntime(config);
  }

  if (config.provider === 'copilot') {
    return new CopilotRuntime(config);
  }

  throw new AIRuntimeConfigurationError(`Unsupported AI provider: ${config.provider}`);
}

export function createAiRuntime(options: AIRuntimeFactoryOptions = {}): AIRuntime {
  return createAiRuntimeFromConfig(resolveAIRuntimeConfig(options));
}