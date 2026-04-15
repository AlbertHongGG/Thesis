import type { AIProvider } from '@/modules/shared/server/ports/external';
import type { KnowledgeProfilePromptBundle } from '@/features/ingest/prompts';
import { buildPreview } from '@/features/ingest/text';
import { uniqueStrings } from '@/domain/knowledge/defaults';

type KnowledgeProfileSource = {
  summary: string;
  title: string;
  terms: string[];
};

export class ProfileSummarizationService {
  constructor(
    private readonly aiProvider: AIProvider,
    private readonly prompt: KnowledgeProfilePromptBundle,
  ) {}

  async summarize(input: {
    knowledgeBaseName: string;
    sources: KnowledgeProfileSource[];
  }) {
    const sourceSummaries = input.sources
      .filter(source => source.summary.trim().length > 0)
      .slice(0, 12)
      .map(source => `${source.title}：${buildPreview(source.summary, 260)}`);
    const keyTerms = uniqueStrings(input.sources.flatMap(source => source.terms)).slice(0, 16);

    if (sourceSummaries.length === 0) {
      return {
        summary: `${input.knowledgeBaseName} 目前已建立知識庫，但尚未累積足夠內容形成穩定的領域摘要。`,
        focusAreas: [],
        keyTerms,
      };
    }

    try {
      const raw = await this.aiProvider.generateText({
        systemPrompt: this.prompt.systemPrompt,
        prompt: this.prompt.buildPrompt({
          knowledgeBaseName: input.knowledgeBaseName,
          sourceSummaries,
          keyTerms,
        }),
      });

      return this.prompt.parse(raw);
    } catch {
      return {
        summary: sourceSummaries.slice(0, 4).join(' '),
        focusAreas: [],
        keyTerms,
      };
    }
  }
}
