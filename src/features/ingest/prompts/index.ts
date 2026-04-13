import { createChunkAnalysisPromptBundle } from './chunk-analysis';
import { createDocumentOverviewPromptBundle } from './document-overview';
import { createDocumentSummaryPromptBundle } from './document-summary';
import { createImageAnalysisPromptBundle } from './image-analysis';
import { createImageQueryPromptBundle } from './image-query';
import { createKnowledgeProfilePromptBundle } from './knowledge-profile';
import type { IngestPrompts } from './types';

const INGEST_PROMPTS_ID = 'ingest';

export function createIngestPrompts(): IngestPrompts {
  return {
    id: INGEST_PROMPTS_ID,
    documentOverview: createDocumentOverviewPromptBundle(INGEST_PROMPTS_ID),
    chunkAnalysis: createChunkAnalysisPromptBundle(INGEST_PROMPTS_ID),
    documentSummary: createDocumentSummaryPromptBundle(INGEST_PROMPTS_ID),
    imageQuery: createImageQueryPromptBundle(INGEST_PROMPTS_ID),
    imageAnalysis: createImageAnalysisPromptBundle(INGEST_PROMPTS_ID),
    knowledgeProfile: createKnowledgeProfilePromptBundle(INGEST_PROMPTS_ID),
  };
}

export type * from './types';