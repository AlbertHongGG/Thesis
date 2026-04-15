import type { KnowledgeBaseRecord } from '@/domain/knowledge/types';
import type { KnowledgeProfileRepository, KnowledgeSourceRepository } from '@/modules/shared/server/ports/repositories';
import { ProfileSummarizationService } from './ProfileSummarizationService';

export class KnowledgeProfileRefreshService {
  constructor(
    private readonly profileRepository: KnowledgeProfileRepository,
    private readonly sourceRepository: KnowledgeSourceRepository,
    private readonly summarizationService: ProfileSummarizationService,
  ) {}

  async refresh(knowledgeBase: KnowledgeBaseRecord) {
    const [sources, stats] = await Promise.all([
      this.profileRepository.listSourceMaterials(knowledgeBase.id, 20),
      this.sourceRepository.getStats(knowledgeBase.id),
    ]);

    const profile = await this.summarizationService.summarize({
      knowledgeBaseName: knowledgeBase.name,
      sources,
    });

    return this.profileRepository.save({
      knowledgeBaseId: knowledgeBase.id,
      summary: profile.summary,
      focusAreas: profile.focusAreas,
      keyTerms: profile.keyTerms,
      sourceCount: stats.sourceCount,
      unitCount: stats.unitCount,
    });
  }
}
