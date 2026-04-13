import { buildPreview, clampContext } from '../text';
import { extractJsonObject, normalizeKeywords } from './shared';
import type { ChunkAnalysisPromptBundle } from './types';

export function createChunkAnalysisPromptBundle(bundleId: string): ChunkAnalysisPromptBundle {
  return {
    id: `${bundleId}:chunk-analysis`,
    systemPrompt: 'You are a precise retrieval preprocessing system. Return strict JSON only with no markdown fences and no extra commentary.',
    buildPrompt(input) {
      const contextSection = input.globalContext.trim().length > 0
        ? `\nPrevious document context:\n${clampContext(input.globalContext)}\n`
        : '';

      return [
        'Analyze the following document chunk for downstream RAG retrieval.',
        'Return strict JSON with keys: summary (string), keywords (string array), bridgingContext (string).',
        'The summary must be concise but preserve specific facts and terminology.',
        'Keywords should be short Traditional Chinese or English phrases that help retrieval.',
        'bridgingContext should explain what adjacent chunk context may matter when this chunk is retrieved alone.',
        contextSection,
        input.previousChunk ? `Previous chunk preview:\n${buildPreview(input.previousChunk.text, 260)}\n` : 'Previous chunk preview:\n(none)\n',
        input.nextChunk ? `Next chunk preview:\n${buildPreview(input.nextChunk.text, 260)}\n` : 'Next chunk preview:\n(none)\n',
        `Chunk content:\n${input.chunk.text}`,
      ].join('\n');
    },
    parse(rawText) {
      const parsed = extractJsonObject(rawText);

      return {
        summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
        keywords: normalizeKeywords(parsed.keywords),
        bridgingContext: typeof parsed.bridgingContext === 'string' ? parsed.bridgingContext.trim() : '',
      };
    },
  };
}