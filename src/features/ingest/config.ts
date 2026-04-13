import { AIRuntimeConfigurationError, resolveAIRuntimeConfig, type AIRuntimeResolvedConfig } from '@/ai';
import { createIngestPrompts, type IngestPrompts } from './prompts';

export interface IngestFeatureConfig {
  runtime: AIRuntimeResolvedConfig;
  prompts: IngestPrompts;
}

function assertConfiguredModel(model: string | undefined, envName: string) {
  if (!model) {
    throw new AIRuntimeConfigurationError(`${envName} is required for the ingest feature.`);
  }
}

export function loadIngestFeatureConfig(env: NodeJS.ProcessEnv = process.env): IngestFeatureConfig {
  const runtime = resolveAIRuntimeConfig({
    featureKey: 'ingest',
    env,
  });

  assertConfiguredModel(runtime.textModel, 'AI_TEXT_MODEL or INGEST_TEXT_MODEL');
  assertConfiguredModel(runtime.visionModel, 'AI_VISION_MODEL or INGEST_VISION_MODEL');
  assertConfiguredModel(runtime.embeddingModel, 'AI_EMBEDDING_MODEL or INGEST_EMBEDDING_MODEL');

  return {
    runtime,
    prompts: createIngestPrompts(),
  };
}