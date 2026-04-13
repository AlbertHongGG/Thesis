import { createChunkAnalysisPromptBundle } from '../chunk-analysis';
import { createDocumentSummaryPromptBundle } from '../document-summary';
import { createImageAnalysisPromptBundle } from '../image-analysis';
import type { IngestPromptVariant } from '../types';

const variantId = 'default';

export const defaultIngestPromptVariant: IngestPromptVariant = {
  id: variantId,
  chunkAnalysis: createChunkAnalysisPromptBundle(variantId),
  documentSummary: createDocumentSummaryPromptBundle(variantId),
  imageAnalysis: createImageAnalysisPromptBundle(variantId),
};