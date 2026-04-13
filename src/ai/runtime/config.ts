import { AIRuntimeConfigurationError } from './errors';
import type { AIProviderId, AIRuntimeFactoryOptions, AIRuntimeFeatureConfig, AIRuntimeResolvedConfig } from './types';

function normalizeString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseProvider(rawValue: string | undefined, envName: string, fallback: AIProviderId): AIProviderId {
  const normalized = normalizeString(rawValue);

  if (!normalized) {
    return fallback;
  }

  if (normalized === 'ollama' || normalized === 'copilot') {
    return normalized;
  }

  throw new AIRuntimeConfigurationError(`${envName} must be either "ollama" or "copilot".`);
}

function parsePositiveNumber(rawValue: string | undefined, envName: string, fallback: number) {
  const normalized = normalizeString(rawValue);

  if (!normalized) {
    return fallback;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AIRuntimeConfigurationError(`${envName} must be a positive number.`);
  }

  return parsed;
}

function normalizeFeatureKey(featureKey: string | undefined) {
  return normalizeString(featureKey)?.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
}

function readFeatureValue(env: NodeJS.ProcessEnv, featureKey: string | undefined, suffix: string) {
  const normalizedFeatureKey = normalizeFeatureKey(featureKey);

  if (!normalizedFeatureKey) {
    return undefined;
  }

  return normalizeString(env[`${normalizedFeatureKey}_${suffix}`]);
}

function readRuntimeModels(env: NodeJS.ProcessEnv, featureKey: string | undefined) {
  const globalSharedModel = normalizeString(env.AI_RUNTIME_MODEL);
  const featureSharedModel = readFeatureValue(env, featureKey, 'AI_MODEL');

  const globalTextModel = normalizeString(env.AI_TEXT_MODEL) ?? globalSharedModel;
  const globalVisionModel = normalizeString(env.AI_VISION_MODEL) ?? globalSharedModel;
  const globalEmbeddingModel = normalizeString(env.AI_EMBEDDING_MODEL);

  return {
    textModel: readFeatureValue(env, featureKey, 'TEXT_MODEL') ?? featureSharedModel ?? globalTextModel,
    visionModel: readFeatureValue(env, featureKey, 'VISION_MODEL') ?? featureSharedModel ?? globalVisionModel,
    embeddingModel: readFeatureValue(env, featureKey, 'EMBEDDING_MODEL') ?? globalEmbeddingModel,
  } satisfies Omit<AIRuntimeFeatureConfig, 'provider' | 'timeoutMs'>;
}

export function resolveAIRuntimeConfig(options: AIRuntimeFactoryOptions = {}): AIRuntimeResolvedConfig {
  const env = options.env ?? process.env;
  const defaultProvider = parseProvider(normalizeString(env.AI_PROVIDER), 'AI_PROVIDER', 'ollama');
  const featureProvider = parseProvider(readFeatureValue(env, options.featureKey, 'AI_PROVIDER'), `${normalizeFeatureKey(options.featureKey) ?? 'FEATURE'}_AI_PROVIDER`, defaultProvider);
  const resolvedProvider = options.provider ?? featureProvider;
  const modelConfig = readRuntimeModels(env, options.featureKey);
  const timeoutMs = options.timeoutMs
    ?? parsePositiveNumber(
      readFeatureValue(env, options.featureKey, 'TIMEOUT_MS') ?? normalizeString(env.AI_RUNTIME_TIMEOUT_MS),
      normalizeFeatureKey(options.featureKey) ? `${normalizeFeatureKey(options.featureKey)}_TIMEOUT_MS` : 'AI_RUNTIME_TIMEOUT_MS',
      120000,
    );

  return {
    provider: resolvedProvider,
    textModel: options.textModel ?? modelConfig.textModel,
    visionModel: options.visionModel ?? modelConfig.visionModel,
    embeddingModel: options.embeddingModel ?? modelConfig.embeddingModel,
    timeoutMs,
    ollamaBaseUrl: options.ollamaBaseUrl ?? normalizeString(env.OLLAMA_BASE_URL) ?? 'http://localhost:11434',
    copilotBaseUrl: options.copilotBaseUrl ?? normalizeString(env.COPILOT_BASE_URL) ?? 'https://models.github.ai/inference',
    githubToken: options.githubToken ?? normalizeString(env.GITHUB_TOKEN),
  };
}