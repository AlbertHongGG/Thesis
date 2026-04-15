import { AIRuntimeConfigurationError, createAiRuntimeFromConfig, resolveAIRuntimeConfig } from '@/ai';
import type { AIProvider } from '@/application/ports/external';

function assertConfiguredModel(model: string | undefined, envName: string) {
  if (!model) {
    throw new AIRuntimeConfigurationError(`${envName} is required for the ingest module.`);
  }
}

export function createIngestAiProvider(env: NodeJS.ProcessEnv = process.env): AIProvider {
  const runtimeConfig = resolveAIRuntimeConfig({
    featureKey: 'ingest',
    env,
  });

  assertConfiguredModel(runtimeConfig.textModel, 'AI_TEXT_MODEL or INGEST_TEXT_MODEL');
  assertConfiguredModel(runtimeConfig.visionModel, 'AI_VISION_MODEL or INGEST_VISION_MODEL');
  assertConfiguredModel(runtimeConfig.embeddingModel, 'AI_EMBEDDING_MODEL or INGEST_EMBEDDING_MODEL');

  return createAiRuntimeFromConfig(runtimeConfig);
}
