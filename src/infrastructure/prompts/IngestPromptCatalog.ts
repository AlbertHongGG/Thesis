import type { IngestModuleConfig } from '@/application/ports/external';
import { createIngestPrompts } from '@/features/ingest/prompts';

export function createIngestModuleConfig(): IngestModuleConfig {
  return {
    prompts: createIngestPrompts(),
    defaultChunkSize: 500,
    defaultOverlap: 100,
  };
}
