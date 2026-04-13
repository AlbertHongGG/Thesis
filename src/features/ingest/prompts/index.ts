import { createChunkAnalysisPromptBundle } from './chunk-analysis';
import { createDocumentSummaryPromptBundle } from './document-summary';
import { createImageAnalysisPromptBundle } from './image-analysis';
import type { IngestPrompts } from './types';

const INGEST_PROMPTS_ID = 'ingest';

export function createIngestPrompts(): IngestPrompts {
  return {
    id: INGEST_PROMPTS_ID,
    chunkAnalysis: createChunkAnalysisPromptBundle(INGEST_PROMPTS_ID),
    documentSummary: createDocumentSummaryPromptBundle(INGEST_PROMPTS_ID),
    imageAnalysis: createImageAnalysisPromptBundle(INGEST_PROMPTS_ID),
  };
}

export type * from './types';