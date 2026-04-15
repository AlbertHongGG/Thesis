import { randomUUID } from 'node:crypto';
import type { IngestPrompts } from '@/features/ingest/prompts';
import { normalizeEntities, normalizeRelationHints, normalizeStructure, normalizeTerms } from '@/features/ingest/metadata';
import { buildUnitRelations } from '@/features/ingest/relations';
import { buildParsedPreview, buildPreview } from '@/features/ingest/text';
import type { TextChunk } from '@/lib/rag/chunker';
import type { AIProvider, DocumentParser, TextChunker } from '@/application/ports/external';
import type {
  KnowledgeOperationRepository,
  KnowledgeProfileRepository,
  KnowledgeRelationRepository,
  KnowledgeSourceRepository,
  KnowledgeUnitRepository,
} from '@/application/ports/repositories';
import type {
  KnowledgeBaseRecord,
  KnowledgeContextTrace,
  KnowledgeSourceMetadata,
  KnowledgeSourceRecord,
  KnowledgeSourceType,
  KnowledgeUnitMetadata,
  KnowledgeUnitRecord,
  KnowledgeUnitRelationRecord,
  PreviewKind,
} from '@/domain/knowledge/types';
import { uniqueStrings } from '@/domain/knowledge/defaults';
import { buildKnowledgeSourceReferences, renderKnowledgeContext } from '@/application/support/knowledgeContext';
import { KnowledgeProfileRefreshService } from './KnowledgeProfileRefreshService';

const METADATA_VERSION = 1;

export interface IngestProgressReporter {
  step(message: string): void;
  unit(payload: {
    knowledgeBase: KnowledgeBaseRecord;
    sourceId: string;
    sourceType: KnowledgeSourceType;
    title: string;
    unit: KnowledgeUnitRecord;
    totalUnitCount: number;
    totalCharCount: number;
    rawPreview: string;
    previewKind: PreviewKind;
    progress: { current: number; total: number };
  }): void;
}

export interface IngestExecutionResult {
  knowledgeBase: KnowledgeBaseRecord;
  source: KnowledgeSourceRecord;
  units: KnowledgeUnitRecord[];
  contextApplied: boolean;
  knowledgeContext: KnowledgeContextTrace;
  dbWritten: boolean;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isImageFile(filename: string) {
  return /\.(png|jpe?g|gif|webp)$/i.test(filename);
}

function buildUnitId(sourceId: string, sequence: number) {
  return `${sourceId}:unit:${sequence + 1}`;
}

function getSourceTitle(pathOrName: string) {
  const normalized = pathOrName.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() || pathOrName;
}

function buildSourceMetadata(sourceType: KnowledgeSourceType, title: string, input: {
  summary: string;
  terms: string[];
  entities: string[];
  structure?: { kind: string; label: string };
}): KnowledgeSourceMetadata {
  return {
    version: METADATA_VERSION,
    sourceType,
    title,
    summary: buildPreview(input.summary, 500),
    terms: normalizeTerms(input.terms),
    entities: normalizeEntities(input.entities),
    structure: normalizeStructure(input.structure),
  };
}

function buildUnitMetadata(unitType: string, input: {
  summary: string;
  terms: string[];
  entities: string[];
  relationHints: Array<{ kind: string; label: string }>;
}): KnowledgeUnitMetadata {
  return {
    version: METADATA_VERSION,
    unitType,
    summary: buildPreview(input.summary, 220),
    terms: normalizeTerms(input.terms),
    entities: normalizeEntities(input.entities),
    relationHints: normalizeRelationHints(input.relationHints),
  };
}

function buildRetrievalQuery(title: string, sourceMeta: KnowledgeSourceMetadata) {
  return uniqueStrings([
    title.replace(/\.[^.]+$/, ''),
    sourceMeta.summary,
    sourceMeta.structure?.label ?? '',
    ...sourceMeta.terms,
    ...sourceMeta.entities,
  ]).join(' ');
}

function buildUnitEmbeddingText(sourceMeta: KnowledgeSourceMetadata, unit: KnowledgeUnitRecord) {
  const relationHints = unit.metadata.relationHints.map(hint => `${hint.kind}:${hint.label}`).join('；');
  return [
    sourceMeta.summary.trim() ? `來源摘要：${sourceMeta.summary.trim()}` : '',
    sourceMeta.structure?.label ? `來源結構：${sourceMeta.structure.label}` : '',
    unit.metadata.summary.trim() ? `單位摘要：${unit.metadata.summary.trim()}` : '',
    unit.metadata.terms.length > 0 ? `檢索詞：${unit.metadata.terms.join('、')}` : '',
    unit.metadata.entities.length > 0 ? `實體：${unit.metadata.entities.join('、')}` : '',
    relationHints ? `關聯提示：${relationHints}` : '',
    `內容：${unit.content}`,
  ].filter(Boolean).join('\n');
}

function createBaseUnit(sourceId: string, knowledgeBaseId: string, chunk: Pick<TextChunk, 'index' | 'text' | 'wordCount' | 'startOffset' | 'endOffset'>): KnowledgeUnitRecord {
  return {
    id: buildUnitId(sourceId, chunk.index),
    knowledgeBaseId,
    sourceId,
    unitType: 'text-segment',
    sequence: chunk.index,
    content: chunk.text,
    preview: buildPreview(chunk.text, 240),
    charCount: chunk.text.length,
    wordCount: chunk.wordCount,
    startOffset: chunk.startOffset,
    endOffset: chunk.endOffset,
    metadata: buildUnitMetadata('text-segment', {
      summary: buildPreview(chunk.text, 180),
      terms: [],
      entities: [],
      relationHints: [],
    }),
    relations: [],
    status: 'ready',
  };
}

export class IngestApplicationService {
  constructor(
    private readonly aiProvider: AIProvider,
    private readonly promptCatalog: IngestPrompts,
    private readonly parser: DocumentParser,
    private readonly chunker: TextChunker,
    private readonly sourceRepository: KnowledgeSourceRepository,
    private readonly profileRepository: KnowledgeProfileRepository,
    private readonly unitRepository: KnowledgeUnitRepository,
    private readonly relationRepository: KnowledgeRelationRepository,
    private readonly operationRepository: KnowledgeOperationRepository,
    private readonly profileRefreshService: KnowledgeProfileRefreshService,
  ) {}

  async ingest(input: {
    file: File;
    filePath?: string;
    previewKind: PreviewKind;
    knowledgeBase: KnowledgeBaseRecord;
  }, reporter: IngestProgressReporter): Promise<IngestExecutionResult> {
    const startedAt = Date.now();
    const canonicalPath = input.filePath || input.file.name;
    const title = getSourceTitle(canonicalPath);
    const sourceId = randomUUID();
    const operation = await this.operationRepository.start({
      knowledgeBaseId: input.knowledgeBase.id,
      kind: 'ingest',
      sourceId,
      sourcePath: canonicalPath,
      metadata: { title, previewKind: input.previewKind },
    });

    try {
      const result = isImageFile(canonicalPath)
        ? await this.processImage({ ...input, canonicalPath, title, sourceId }, reporter, startedAt)
        : await this.processDocument({ ...input, canonicalPath, title, sourceId }, reporter, startedAt);

      if (result.dbWritten) {
        await this.operationRepository.complete({
          operationId: operation.id,
          summary: `Ingested ${title}`,
          metadata: {
            sourceId,
            sourceType: result.source.sourceType,
            unitCount: result.units.length,
          },
        });
      } else {
        await this.operationRepository.fail({
          operationId: operation.id,
          errorMessage: 'Source graph was generated but could not be persisted.',
          metadata: { sourceId, title },
        });
      }

      return result;
    } catch (error) {
      await this.operationRepository.fail({
        operationId: operation.id,
        errorMessage: getErrorMessage(error),
        metadata: { sourceId, title },
      });
      throw error;
    }
  }

  private async loadKnowledgeContext(knowledgeBase: KnowledgeBaseRecord, queryText: string) {
    const [profile, relatedUnits] = await Promise.all([
      this.profileRepository.get(knowledgeBase.id),
      queryText.trim()
        ? (async () => {
            const queryEmbedding = await this.aiProvider.createEmbedding({ text: queryText });
            return this.unitRepository.search({
              knowledgeBaseId: knowledgeBase.id,
              queryText,
              queryEmbedding,
              matchCount: 4,
              matchThreshold: 0.35,
              sourceTypes: ['document', 'image'],
            });
          })()
        : Promise.resolve([]),
    ]);

    const text = renderKnowledgeContext({
      profile: profile ? {
        knowledgeBaseId: profile.knowledgeBaseId,
        summary: profile.summary,
        focusAreas: profile.focusAreas,
        keyTerms: profile.keyTerms,
        sourceCount: profile.sourceCount,
        unitCount: profile.unitCount,
        version: profile.version,
      } : null,
      units: relatedUnits,
      maxUnitCount: 4,
    });

    return {
      profile,
      text,
      relatedUnits,
      trace: {
        knowledgeBaseId: knowledgeBase.id,
        knowledgeBaseName: knowledgeBase.name,
        profileVersion: profile?.version,
        profileSummary: profile?.summary,
        usedUnitCount: relatedUnits.length,
        usedSources: buildKnowledgeSourceReferences({ profile: profile ? {
          knowledgeBaseId: profile.knowledgeBaseId,
          summary: profile.summary,
          focusAreas: profile.focusAreas,
          keyTerms: profile.keyTerms,
          sourceCount: profile.sourceCount,
          unitCount: profile.unitCount,
          version: profile.version,
        } : null, units: relatedUnits }),
        fallbackTriggered: !profile || text.trim().length === 0,
      },
    };
  }

  private async analyzeDocumentSource(input: {
    filename: string;
    parsedTextPreview: string;
    units: TextChunk[];
    knowledgeContext: string;
  }) {
    if (input.units.length === 0) {
      return {
        summary: `文件 ${input.filename} 已完成解析，但目前沒有足夠內容可建立來源摘要。`,
        terms: [],
        entities: [],
      };
    }

    try {
      const raw = await this.aiProvider.generateText({
        systemPrompt: this.promptCatalog.documentSource.systemPrompt,
        prompt: this.promptCatalog.documentSource.buildPrompt(input),
      });

      return this.promptCatalog.documentSource.parse(raw);
    } catch {
      return {
        summary: buildPreview(input.parsedTextPreview, 220),
        terms: [],
        entities: [],
      };
    }
  }

  private async analyzeImageSource(input: {
    filename: string;
    imageDataUrl: string;
    knowledgeContext: string;
  }) {
    try {
      const raw = await this.aiProvider.analyzeImage({
        imageDataUrl: input.imageDataUrl,
        systemPrompt: this.promptCatalog.imageSource.systemPrompt,
        prompt: this.promptCatalog.imageSource.buildPrompt(input),
      });

      return this.promptCatalog.imageSource.parse(raw);
    } catch {
      return {
        summary: `圖片 ${input.filename} 已完成讀取，但目前只能保留基礎來源資訊。`,
        terms: [],
        entities: [],
      };
    }
  }

  private async analyzeDocumentUnit(input: {
    unit: TextChunk;
    previousUnit?: TextChunk;
    nextUnit?: TextChunk;
    knowledgeContext: string;
    sourceSummary: string;
  }) {
    try {
      const raw = await this.aiProvider.generateText({
        systemPrompt: this.promptCatalog.documentUnit.systemPrompt,
        prompt: this.promptCatalog.documentUnit.buildPrompt(input),
      });

      return this.promptCatalog.documentUnit.parse(raw);
    } catch {
      return {
        summary: buildPreview(input.unit.text, 180),
        terms: [],
        entities: [],
        relationHints: [],
      };
    }
  }

  private async analyzeImageUnit(input: {
    filename: string;
    imageDataUrl: string;
    knowledgeContext: string;
    sourceSummary: string;
  }) {
    try {
      const raw = await this.aiProvider.analyzeImage({
        imageDataUrl: input.imageDataUrl,
        systemPrompt: this.promptCatalog.imageUnit.systemPrompt,
        prompt: this.promptCatalog.imageUnit.buildPrompt(input),
      });

      return this.promptCatalog.imageUnit.parse(raw);
    } catch {
      return {
        summary: input.sourceSummary,
        terms: [],
        entities: [],
        relationHints: [],
      };
    }
  }

  private async processImage(input: {
    file: File;
    canonicalPath: string;
    title: string;
    sourceId: string;
    previewKind: PreviewKind;
    knowledgeBase: KnowledgeBaseRecord;
  }, reporter: IngestProgressReporter, startedAt: number): Promise<IngestExecutionResult> {
    reporter.step(`讀取圖片檔案內容，目標知識庫：${input.knowledgeBase.name}。`);
    const textBuffer = await input.file.arrayBuffer();
    const base64 = Buffer.from(textBuffer).toString('base64');
    const mimeType = input.file.type || 'image/jpeg';
    const imageDataUrl = `data:${mimeType};base64,${base64}`;

    const initialContext = await this.loadKnowledgeContext(input.knowledgeBase, input.title);

    reporter.step('建立圖片來源 metadata。');
    const sourceMetadata = buildSourceMetadata('image', input.title, await this.analyzeImageSource({
      filename: input.title,
      imageDataUrl,
      knowledgeContext: initialContext.text,
    }));

    const retrievalQuery = buildRetrievalQuery(input.title, sourceMetadata);
    reporter.step(retrievalQuery ? '依照來源 metadata 到知識庫檢索相關單位。' : '本次未能建立有效檢索查詢，將以知識庫摘要作為 fallback。');
    const context = await this.loadKnowledgeContext(input.knowledgeBase, retrievalQuery);
    const knowledgeContext = renderKnowledgeContext({
      profile: context.profile ? {
        knowledgeBaseId: context.profile.knowledgeBaseId,
        summary: context.profile.summary,
        focusAreas: context.profile.focusAreas,
        keyTerms: context.profile.keyTerms,
        sourceCount: context.profile.sourceCount,
        unitCount: context.profile.unitCount,
        version: context.profile.version,
      } : null,
      units: context.relatedUnits,
      maxUnitCount: 4,
    });
    const contextApplied = knowledgeContext.trim().length > 0;

    reporter.step(contextApplied ? '已注入知識庫上下文，開始建立圖片檢索單位。' : '知識庫中沒有足夠可用上下文，改以純圖片模式建立單位。');
    const unitMetadata = buildUnitMetadata('image-analysis', await this.analyzeImageUnit({
      filename: input.title,
      imageDataUrl,
      knowledgeContext,
      sourceSummary: sourceMetadata.summary,
    }));

    const unit: KnowledgeUnitRecord = {
      id: buildUnitId(input.sourceId, 0),
      knowledgeBaseId: input.knowledgeBase.id,
      sourceId: input.sourceId,
      unitType: 'image-analysis',
      sequence: 0,
      content: sourceMetadata.summary,
      preview: buildPreview(sourceMetadata.summary, 240),
      charCount: sourceMetadata.summary.length,
      wordCount: sourceMetadata.summary.split(/\s+/).filter(Boolean).length,
      startOffset: 0,
      endOffset: sourceMetadata.summary.length,
      metadata: unitMetadata,
      relations: [],
      status: 'ready',
    };

    reporter.step('圖片單位 metadata 完成，開始生成向量表示。');
    unit.embedding = await this.aiProvider.createEmbedding({ text: buildUnitEmbeddingText(sourceMetadata, unit) });

    reporter.unit({
      knowledgeBase: input.knowledgeBase,
      sourceId: input.sourceId,
      sourceType: 'image',
      title: input.title,
      unit: { ...unit, relations: [] },
      totalUnitCount: 1,
      totalCharCount: sourceMetadata.summary.length,
      rawPreview: buildPreview(sourceMetadata.summary, 400),
      previewKind: input.previewKind,
      progress: { current: 1, total: 1 },
    });

    const source: KnowledgeSourceRecord = {
      id: input.sourceId,
      knowledgeBaseId: input.knowledgeBase.id,
      canonicalPath: input.canonicalPath,
      title: input.title,
      sourceType: 'image',
      previewKind: input.previewKind,
      rawPreview: buildPreview(sourceMetadata.summary, 400),
      totalUnitCount: 1,
      totalCharCount: sourceMetadata.summary.length,
      processingDurationMs: Date.now() - startedAt,
      metadata: sourceMetadata,
      ingestStatus: 'ready',
      promptVariant: this.promptCatalog.id,
    };

    return this.persistSourceGraph({
      knowledgeBase: input.knowledgeBase,
      source,
      units: [unit],
      contextApplied,
      knowledgeContext: {
        ...context.trace,
        retrievalQuery,
        usedUnitCount: context.relatedUnits.length,
        usedSources: buildKnowledgeSourceReferences({
          profile: context.profile ? {
            knowledgeBaseId: context.profile.knowledgeBaseId,
            summary: context.profile.summary,
            focusAreas: context.profile.focusAreas,
            keyTerms: context.profile.keyTerms,
            sourceCount: context.profile.sourceCount,
            unitCount: context.profile.unitCount,
            version: context.profile.version,
          } : null,
          units: context.relatedUnits,
        }),
        fallbackTriggered: !contextApplied,
      },
      reporter,
    });
  }

  private async processDocument(input: {
    file: File;
    canonicalPath: string;
    title: string;
    sourceId: string;
    previewKind: PreviewKind;
    knowledgeBase: KnowledgeBaseRecord;
  }, reporter: IngestProgressReporter, startedAt: number): Promise<IngestExecutionResult> {
    reporter.step(`讀取文件檔案內容，目標知識庫：${input.knowledgeBase.name}。`);
    const buffer = Buffer.from(await input.file.arrayBuffer());
    const parsedText = await this.parser.parse(buffer, input.canonicalPath);

    reporter.step(`文件解析完成，抽出 ${parsedText.length} 個字元。`);
    const units = this.chunker.chunk(parsedText, 500, 100);
    const rawPreview = buildParsedPreview(parsedText);
    reporter.step(`文件已依語意邊界切成 ${units.length} 個 units（目標 500 words，重疊 100 words）。`);

    const initialContext = await this.loadKnowledgeContext(input.knowledgeBase, input.title);
    reporter.step(initialContext.text.trim().length > 0 ? '已載入知識庫摘要，開始建立來源 metadata。' : '知識庫尚未形成穩定摘要，先以文件自身內容建立來源 metadata。');

    const sourceMetadata = buildSourceMetadata('document', input.title, await this.analyzeDocumentSource({
      filename: input.title,
      parsedTextPreview: rawPreview,
      units,
      knowledgeContext: initialContext.text,
    }));

    const retrievalQuery = buildRetrievalQuery(input.title, sourceMetadata);
    const context = await this.loadKnowledgeContext(input.knowledgeBase, retrievalQuery);
    const knowledgeContext = renderKnowledgeContext({
      profile: context.profile ? {
        knowledgeBaseId: context.profile.knowledgeBaseId,
        summary: context.profile.summary,
        focusAreas: context.profile.focusAreas,
        keyTerms: context.profile.keyTerms,
        sourceCount: context.profile.sourceCount,
        unitCount: context.profile.unitCount,
        version: context.profile.version,
      } : null,
      units: context.relatedUnits,
      maxUnitCount: 4,
    });
    const contextApplied = knowledgeContext.trim().length > 0;

    const enrichedUnits: KnowledgeUnitRecord[] = [];

    for (const unit of units) {
      reporter.step(`分析第 ${unit.index + 1}/${units.length} 個 unit，建立 metadata 與向量。`);

      try {
        const unitMetadata = buildUnitMetadata('text-segment', await this.analyzeDocumentUnit({
          unit,
          previousUnit: units[unit.index - 1],
          nextUnit: units[unit.index + 1],
          knowledgeContext,
          sourceSummary: sourceMetadata.summary,
        }));

        const enrichedUnit: KnowledgeUnitRecord = {
          ...createBaseUnit(input.sourceId, input.knowledgeBase.id, unit),
          metadata: unitMetadata,
        };

        enrichedUnit.embedding = await this.aiProvider.createEmbedding({
          text: buildUnitEmbeddingText(sourceMetadata, enrichedUnit),
        });

        enrichedUnits.push(enrichedUnit);
        reporter.unit({
          knowledgeBase: input.knowledgeBase,
          sourceId: input.sourceId,
          sourceType: 'document',
          title: input.title,
          unit: { ...enrichedUnit, relations: [] },
          totalUnitCount: units.length,
          totalCharCount: parsedText.length,
          rawPreview,
          previewKind: input.previewKind,
          progress: { current: unit.index + 1, total: units.length },
        });
        reporter.step(`Unit ${unit.index + 1} 已完成 metadata 與 embedding。`);
      } catch (error) {
        const fallbackUnit: KnowledgeUnitRecord = {
          ...createBaseUnit(input.sourceId, input.knowledgeBase.id, unit),
          status: 'error',
          errorMessage: getErrorMessage(error),
        };

        enrichedUnits.push(fallbackUnit);
        reporter.unit({
          knowledgeBase: input.knowledgeBase,
          sourceId: input.sourceId,
          sourceType: 'document',
          title: input.title,
          unit: { ...fallbackUnit, relations: [] },
          totalUnitCount: units.length,
          totalCharCount: parsedText.length,
          rawPreview,
          previewKind: input.previewKind,
          progress: { current: unit.index + 1, total: units.length },
        });
        reporter.step(`Unit ${unit.index + 1} 分析失敗，已保留 fallback metadata：${fallbackUnit.errorMessage}`);
      }
    }

    reporter.step('根據 metadata 與 embedding 建立 units 之間的關聯。');
    const relationMap = buildUnitRelations(enrichedUnits.map(unit => ({
      id: unit.id,
      sequence: unit.sequence,
      meta: {
        schemaVersion: unit.metadata.version,
        unitType: unit.metadata.unitType,
        summary: unit.metadata.summary,
        terms: unit.metadata.terms,
        entities: unit.metadata.entities,
        relationHints: unit.metadata.relationHints,
      },
      status: unit.status,
      embedding: unit.embedding,
    })));

    const unitsWithRelations = enrichedUnits.map(unit => ({
      ...unit,
      relations: relationMap[unit.id] ?? [],
    }));

    const source: KnowledgeSourceRecord = {
      id: input.sourceId,
      knowledgeBaseId: input.knowledgeBase.id,
      canonicalPath: input.canonicalPath,
      title: input.title,
      sourceType: 'document',
      previewKind: input.previewKind,
      rawPreview,
      totalUnitCount: units.length,
      totalCharCount: parsedText.length,
      processingDurationMs: Date.now() - startedAt,
      metadata: sourceMetadata,
      ingestStatus: 'ready',
      promptVariant: this.promptCatalog.id,
    };

    return this.persistSourceGraph({
      knowledgeBase: input.knowledgeBase,
      source,
      units: unitsWithRelations,
      contextApplied,
      knowledgeContext: {
        ...context.trace,
        retrievalQuery,
        usedUnitCount: context.relatedUnits.length,
        usedSources: buildKnowledgeSourceReferences({
          profile: context.profile ? {
            knowledgeBaseId: context.profile.knowledgeBaseId,
            summary: context.profile.summary,
            focusAreas: context.profile.focusAreas,
            keyTerms: context.profile.keyTerms,
            sourceCount: context.profile.sourceCount,
            unitCount: context.profile.unitCount,
            version: context.profile.version,
          } : null,
          units: context.relatedUnits,
        }),
        fallbackTriggered: !contextApplied,
      },
      reporter,
    });
  }

  private async persistSourceGraph(input: {
    knowledgeBase: KnowledgeBaseRecord;
    source: KnowledgeSourceRecord;
    units: KnowledgeUnitRecord[];
    contextApplied: boolean;
    knowledgeContext: KnowledgeContextTrace;
    reporter: IngestProgressReporter;
  }): Promise<IngestExecutionResult> {
    let dbWritten = false;

    try {
      input.reporter.step('準備將來源與 units 寫入知識庫。');
      await this.sourceRepository.saveGraph({
        source: input.source,
        units: input.units,
      });

      const relations: KnowledgeUnitRelationRecord[] = input.units.flatMap(unit =>
        unit.relations.map(relation => ({
          sourceUnitId: unit.id,
          targetUnitId: relation.unitId,
          knowledgeBaseId: input.knowledgeBase.id,
          kind: relation.kind,
          score: relation.score,
          label: relation.label,
        })),
      );

      await this.relationRepository.replaceForSource({
        knowledgeBaseId: input.knowledgeBase.id,
        sourceId: input.source.id,
        relations,
      });

      dbWritten = true;
      input.reporter.step('來源與 units 已寫入知識庫。');

      try {
        await this.profileRefreshService.refresh(input.knowledgeBase);
        input.reporter.step('知識庫聚合摘要與術語輪廓已更新。');
      } catch (error) {
        input.reporter.step(`知識庫摘要刷新失敗：${getErrorMessage(error)}`);
      }
    } catch (error) {
      input.reporter.step(`來源資料寫入知識庫失敗：${getErrorMessage(error)}`);
    }

    return {
      knowledgeBase: input.knowledgeBase,
      source: input.source,
      units: input.units,
      contextApplied: input.contextApplied,
      knowledgeContext: input.knowledgeContext,
      dbWritten,
    };
  }
}
