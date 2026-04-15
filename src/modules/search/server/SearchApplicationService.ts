import type { AIProvider } from '@/modules/shared/server/ports/external';
import type { KnowledgeUnitRepository } from '@/modules/shared/server/ports/repositories';

export class SearchApplicationService {
  constructor(
    private readonly aiProvider: AIProvider,
    private readonly unitRepository: KnowledgeUnitRepository,
  ) {}

  async search(knowledgeBaseId: string, query: string, matchCount = 5) {
    const queryEmbedding = await this.aiProvider.createEmbedding({ text: query });
    return this.unitRepository.search({
      knowledgeBaseId,
      queryText: query,
      queryEmbedding,
      matchCount,
      matchThreshold: 0.3,
      sourceTypes: ['document', 'image'],
    });
  }
}
