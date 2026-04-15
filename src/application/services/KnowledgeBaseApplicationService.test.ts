import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  KnowledgeBaseRepository,
  KnowledgeOperationRepository,
  KnowledgeRelationRepository,
  KnowledgeSourceRepository,
  KnowledgeUnitRepository,
} from '@/application/ports/repositories';
import type { AIProvider } from '@/application/ports/external';
import { KnowledgeBaseApplicationService } from './KnowledgeBaseApplicationService';
import { KnowledgeProfileRefreshService } from './KnowledgeProfileRefreshService';

function createKnowledgeBaseRepository(): KnowledgeBaseRepository {
  return {
    list: vi.fn(),
    get: vi.fn(),
    ensure: vi.fn(),
    delete: vi.fn(),
  };
}

function createKnowledgeSourceRepository(): KnowledgeSourceRepository {
  return {
    saveGraph: vi.fn(),
    listByKnowledgeBase: vi.fn(),
    getStats: vi.fn(),
    repathMany: vi.fn(),
    deleteById: vi.fn(),
    deleteByPathPrefix: vi.fn(),
    deleteByKnowledgeBase: vi.fn(),
  };
}

describe('KnowledgeBaseApplicationService', () => {
  const knowledgeBaseRepository = createKnowledgeBaseRepository();
  const sourceRepository = createKnowledgeSourceRepository();
  const unitRepository = {
    listByKnowledgeBase: vi.fn(),
    listForReindex: vi.fn(),
    search: vi.fn(),
  } satisfies KnowledgeUnitRepository;
  const relationRepository = {
    replaceForSource: vi.fn(),
    listByKnowledgeBase: vi.fn(),
  } satisfies KnowledgeRelationRepository;
  const operationRepository = {
    start: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
  } satisfies KnowledgeOperationRepository;
  const aiProvider = {
    createEmbedding: vi.fn(),
    summarizeKnowledgeBase: vi.fn(),
    ingestSource: vi.fn(),
    answerQuery: vi.fn(),
  } satisfies AIProvider;
  const profileRefreshService = {
    refresh: vi.fn(),
  } as unknown as KnowledgeProfileRefreshService;

  const service = new KnowledgeBaseApplicationService(
    knowledgeBaseRepository,
    sourceRepository,
    unitRepository,
    relationRepository,
    operationRepository,
    aiProvider,
    profileRefreshService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(knowledgeBaseRepository.get).mockResolvedValue({
      id: 'kb-1',
      slug: 'kb-1',
      name: 'KB 1',
      status: 'active',
      sourceCount: 0,
      unitCount: 0,
      profileVersion: 0,
    });
  });

  it('repaths sources with updated canonical paths and derived titles', async () => {
    const result = await service.repathSources({
      knowledgeBaseId: 'kb-1',
      items: [
        { sourceId: 'source-1', canonicalPath: '文件資料/專案計畫/紀錄.md' },
        { sourceId: 'source-2', canonicalPath: '文件資料/AgentSkills/spec-a/step-a.md' },
      ],
    });

    expect(sourceRepository.repathMany).toHaveBeenCalledWith({
      knowledgeBaseId: 'kb-1',
      items: [
        { sourceId: 'source-1', canonicalPath: '文件資料/專案計畫/紀錄.md', title: '紀錄.md' },
        { sourceId: 'source-2', canonicalPath: '文件資料/AgentSkills/spec-a/step-a.md', title: 'step-a.md' },
      ],
    });
    expect(result).toEqual({ updatedSourceCount: 2 });
  });

  it('does nothing when there are no repath items', async () => {
    const result = await service.repathSources({
      knowledgeBaseId: 'kb-1',
      items: [],
    });

    expect(sourceRepository.repathMany).not.toHaveBeenCalled();
    expect(result).toEqual({ updatedSourceCount: 0 });
  });
});
