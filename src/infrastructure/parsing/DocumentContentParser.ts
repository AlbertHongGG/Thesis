import type { DocumentParser } from '@/modules/shared/server/ports/external';
import { parseDocument } from '@/lib/rag/parser';

export class DocumentContentParser implements DocumentParser {
  async parse(fileBuffer: Buffer, filename: string) {
    return parseDocument(fileBuffer, filename);
  }
}
