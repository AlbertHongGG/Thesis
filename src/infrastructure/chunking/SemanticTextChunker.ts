import type { TextChunker } from '@/modules/shared/server/ports/external';
import { chunkText } from '@/lib/rag/chunker';

export class SemanticTextChunker implements TextChunker {
  chunk(text: string, chunkSize = 500, overlap = 100) {
    return chunkText(text, chunkSize, overlap);
  }
}
