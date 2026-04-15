import { describe, expect, it, vi } from 'vitest';
import type { KnowledgeRelationRepository, KnowledgeSourceRepository, KnowledgeUnitRepository } from '@/application/ports/repositories';
import type { KnowledgeSourceRecord, KnowledgeUnitRecord, KnowledgeUnitRelationRecord } from '@/domain/knowledge/types';
import { GraphApplicationService } from './GraphApplicationService';

function createSourceRecord(overrides: Partial<KnowledgeSourceRecord> = {}): KnowledgeSourceRecord {
  return {
    id: 'source-1',
    knowledgeBaseId: 'kb-1',
    canonicalPath: 'docs/source-1.md',
    title: 'source-1.md',
    sourceType: 'document',
    previewKind: 'text',
    totalUnitCount: 1,
    totalCharCount: 120,
    metadata: {
      version: 1,
      sourceType: 'document',
      title: 'source-1.md',
      summary: 'Source summary',
      terms: ['alpha'],
      entities: ['entity-a'],
    },
    ingestStatus: 'ready',
    promptVariant: 'ingest',
    ...overrides,
  };
}

function createUnitRecord(overrides: Partial<KnowledgeUnitRecord> = {}): KnowledgeUnitRecord {
  return {
    id: 'unit-1',
    knowledgeBaseId: 'kb-1',
    sourceId: 'source-1',
    unitType: 'text-segment',
    sequence: 0,
    content: 'Test content',
    preview: 'Test preview',
    charCount: 12,
    wordCount: 2,
    startOffset: 0,
    endOffset: 12,
    metadata: {
      version: 1,
      unitType: 'text-segment',
      summary: 'Unit summary',
      terms: ['alpha'],
      entities: ['entity-a'],
      relationHints: [],
    },
    relations: [],
    status: 'ready',
    embedding: [1, 0],
    ...overrides,
  };
}

describe('GraphApplicationService', () => {
  it('builds a graph projection with hierarchy, source, unit, and related links', async () => {
    const sourceRepository = {
      saveGraph: vi.fn(),
      listByKnowledgeBase: vi.fn<KnowledgeSourceRepository['listByKnowledgeBase']>(),
      getStats: vi.fn(),
      deleteById: vi.fn(),
      deleteByPathPrefix: vi.fn(),
      deleteByKnowledgeBase: vi.fn(),
    } satisfies KnowledgeSourceRepository;
    const unitRepository = {
      listByKnowledgeBase: vi.fn<KnowledgeUnitRepository['listByKnowledgeBase']>(),
      listForReindex: vi.fn(),
      search: vi.fn(),
    } satisfies KnowledgeUnitRepository;
    const relationRepository = {
      replaceForSource: vi.fn(),
      listByKnowledgeBase: vi.fn<KnowledgeRelationRepository['listByKnowledgeBase']>(),
    } satisfies KnowledgeRelationRepository;

    sourceRepository.listByKnowledgeBase.mockResolvedValue([
      createSourceRecord({ id: 'source-1', canonicalPath: 'docs/chapter-1/source-1.md', title: 'source-1.md' }),
      createSourceRecord({
        id: 'source-2',
        canonicalPath: 'docs/appendix/source-2.md',
        title: 'source-2.md',
        metadata: {
          version: 1,
          sourceType: 'document',
          title: 'source-2.md',
          summary: 'Second source summary',
          terms: ['beta'],
          entities: ['entity-b'],
        },
      }),
    ]);
    unitRepository.listByKnowledgeBase.mockResolvedValue([
      createUnitRecord({ id: 'unit-1', sourceId: 'source-1', embedding: [1, 0] }),
      createUnitRecord({
        id: 'unit-2',
        sourceId: 'source-2',
        metadata: {
          version: 1,
          unitType: 'text-segment',
          summary: 'Second unit summary',
          terms: ['beta'],
          entities: ['entity-b'],
          relationHints: [],
        },
        embedding: [0.9, 0.1],
      }),
    ]);
    relationRepository.listByKnowledgeBase.mockResolvedValue([
      {
        sourceUnitId: 'unit-1',
        targetUnitId: 'unit-2',
        knowledgeBaseId: 'kb-1',
        kind: 'references',
        label: 'explicit relation',
        score: 0.82,
      } satisfies KnowledgeUnitRelationRecord,
    ]);

    const service = new GraphApplicationService(sourceRepository, unitRepository, relationRepository);
    const graph = await service.getGraph('kb-1');

    expect(graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'folder:docs', type: 'folder' }),
      expect.objectContaining({ id: 'folder:docs/chapter-1', type: 'folder' }),
      expect.objectContaining({ id: 'source-1', type: 'source' }),
      expect.objectContaining({ id: 'unit-1', type: 'unit' }),
    ]));
    expect(graph.links).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'folder:docs', target: 'folder:docs/chapter-1', type: 'hierarchy' }),
      expect.objectContaining({ source: 'folder:docs/chapter-1', target: 'source-1', type: 'hierarchy' }),
      expect.objectContaining({ source: 'source-1', target: 'unit-1', type: 'child', label: 'contains' }),
      expect.objectContaining({ source: 'unit-1', target: 'unit-2', type: 'related', label: 'explicit relation', score: 0.82 }),
    ]));
    expect(graph.links.some(link => link.type === 'related' && link.source === 'unit-2' && link.target === 'unit-1')).toBe(true);
  });

  it('routes deletion commands to the appropriate repository action', async () => {
    const sourceRepository = {
      saveGraph: vi.fn(),
      listByKnowledgeBase: vi.fn(),
      getStats: vi.fn(),
      deleteById: vi.fn().mockResolvedValue(undefined),
      deleteByPathPrefix: vi.fn().mockResolvedValue(undefined),
      deleteByKnowledgeBase: vi.fn().mockResolvedValue(undefined),
    } satisfies KnowledgeSourceRepository;
    const unitRepository = {
      listByKnowledgeBase: vi.fn(),
      listForReindex: vi.fn(),
      search: vi.fn(),
    } satisfies KnowledgeUnitRepository;
    const relationRepository = {
      replaceForSource: vi.fn(),
      listByKnowledgeBase: vi.fn(),
    } satisfies KnowledgeRelationRepository;

    const service = new GraphApplicationService(sourceRepository, unitRepository, relationRepository);

    await service.deleteGraphTarget({ knowledgeBaseId: 'kb-1', deleteAll: true });
    await service.deleteGraphTarget({ knowledgeBaseId: 'kb-1', folderPath: 'docs/chapter-1' });
    await service.deleteGraphTarget({ knowledgeBaseId: 'kb-1', documentId: 'source-1' });

    expect(sourceRepository.deleteByKnowledgeBase).toHaveBeenCalledWith('kb-1');
    expect(sourceRepository.deleteByPathPrefix).toHaveBeenCalledWith('kb-1', 'docs/chapter-1');
    expect(sourceRepository.deleteById).toHaveBeenCalledWith('source-1');
    await expect(service.deleteGraphTarget({ knowledgeBaseId: 'kb-1' })).rejects.toThrow('No valid deletion target provided.');
  });
});