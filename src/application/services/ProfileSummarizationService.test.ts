import { describe, expect, it, vi } from 'vitest';
import type { AIProvider } from '@/application/ports/external';
import type { KnowledgeProfilePromptBundle } from '@/features/ingest/prompts';
import { ProfileSummarizationService } from './ProfileSummarizationService';

describe('ProfileSummarizationService', () => {
  it('returns deterministic fallback when there is not enough source material', async () => {
    const aiProvider = {
      generateText: vi.fn(),
      analyzeImage: vi.fn(),
      createEmbedding: vi.fn(),
    } satisfies AIProvider;
    const prompt = {
      id: 'ingest',
      systemPrompt: 'system',
      buildPrompt: vi.fn(),
      parse: vi.fn(),
    } satisfies KnowledgeProfilePromptBundle;

    const service = new ProfileSummarizationService(aiProvider, prompt);
    const result = await service.summarize({
      knowledgeBaseName: 'Research KB',
      sources: [
        { title: 'Empty source', summary: '   ', terms: ['alpha', 'beta', 'alpha'] },
      ],
    });

    expect(result.summary).toContain('Research KB 目前已建立知識庫');
    expect(result.focusAreas).toEqual([]);
    expect(result.keyTerms).toEqual(['alpha', 'beta']);
    expect(aiProvider.generateText).not.toHaveBeenCalled();
    expect(prompt.buildPrompt).not.toHaveBeenCalled();
  });

  it('falls back to merged source summaries when AI generation fails', async () => {
    const aiProvider = {
      generateText: vi.fn().mockRejectedValue(new Error('provider down')),
      analyzeImage: vi.fn(),
      createEmbedding: vi.fn(),
    } satisfies AIProvider;
    const prompt = {
      id: 'ingest',
      systemPrompt: 'system',
      buildPrompt: vi.fn().mockReturnValue('prompt body'),
      parse: vi.fn(),
    } satisfies KnowledgeProfilePromptBundle;

    const service = new ProfileSummarizationService(aiProvider, prompt);
    const result = await service.summarize({
      knowledgeBaseName: 'Research KB',
      sources: [
        { title: 'Source A', summary: 'Summary A', terms: ['alpha', 'beta'] },
        { title: 'Source B', summary: 'Summary B', terms: ['beta', 'gamma'] },
      ],
    });

    expect(aiProvider.generateText).toHaveBeenCalledWith({
      systemPrompt: 'system',
      prompt: 'prompt body',
    });
    expect(prompt.buildPrompt).toHaveBeenCalledWith({
      knowledgeBaseName: 'Research KB',
      sourceSummaries: ['Source A：Summary A', 'Source B：Summary B'],
      keyTerms: ['alpha', 'beta', 'gamma'],
    });
    expect(result.summary).toContain('Source A：Summary A');
    expect(result.summary).toContain('Source B：Summary B');
    expect(result.focusAreas).toEqual([]);
    expect(result.keyTerms).toEqual(['alpha', 'beta', 'gamma']);
  });
});