import { createKnowledgeProfilePromptBundle } from './knowledge-profile';
import { createDocumentSourcePromptBundle } from './source-document';
import { createImageSourcePromptBundle } from './source-image';
import { createDocumentUnitPromptBundle } from './unit-document';
import { createImageUnitPromptBundle } from './unit-image';
import type { IngestPrompts } from './types';

const INGEST_PROMPTS_ID = 'ingest';

export function createIngestPrompts(): IngestPrompts {
  return {
    id: INGEST_PROMPTS_ID,
    documentSource: createDocumentSourcePromptBundle(INGEST_PROMPTS_ID),
    imageSource: createImageSourcePromptBundle(INGEST_PROMPTS_ID),
    documentUnit: createDocumentUnitPromptBundle(INGEST_PROMPTS_ID),
    imageUnit: createImageUnitPromptBundle(INGEST_PROMPTS_ID),
    knowledgeProfile: createKnowledgeProfilePromptBundle(INGEST_PROMPTS_ID),
  };
}

export type * from './types';