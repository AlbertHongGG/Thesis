import { AIRuntimeConfigurationError } from '@/ai';
import { INGEST_PROMPT_VARIANT_ALIASES } from './aliases';
import type { IngestPromptVariant } from './types';
import { defaultIngestPromptVariant } from './variants/default';

const variants = new Map<string, IngestPromptVariant>([
  [defaultIngestPromptVariant.id, defaultIngestPromptVariant],
]);

export type IngestPromptVariantId = 'default';

export function resolveIngestPromptVariant(rawVariant: string | undefined): IngestPromptVariant {
  const normalized = rawVariant?.trim().toLowerCase() || 'default';
  const resolvedId = INGEST_PROMPT_VARIANT_ALIASES[normalized] ?? normalized;
  const variant = variants.get(resolvedId);

  if (!variant) {
    throw new AIRuntimeConfigurationError(`Unsupported INGEST_PROMPT_VARIANT: ${rawVariant}`);
  }

  return variant;
}

export type * from './types';