import { randomUUID } from 'node:crypto';
import type { AIRuntime } from '@/ai';
import { chunkText, type TextChunk } from '@/lib/rag/chunker';
import { parseDocument } from '@/lib/rag/parser';
import type {
  IngestResult,
  IngestStreamEvent,
  IngestUnit,
  PreviewKind,
  SourceMeta,
  UnitMeta,
} from './contracts';
import { INGEST_CONTRACT_VERSION } from './contracts';
import {
  buildKnowledgeSourceReferences,
  renderKnowledgeContext,
  uniqueStrings,
  type KnowledgeBaseRecord,
  type KnowledgeProfileRecord,
  type KnowledgeUnitMatch,
} from './knowledge';
import type { IngestPrompts } from './prompts';
import { buildUnitRelations } from './relations';
import type { IngestRepository, PersistableUnit } from './repository';
import { KnowledgeProfileService } from './services/KnowledgeProfileService';
import { SourceMetadataService } from './services/SourceMetadataService';
import { UnitMetadataService } from './services/UnitMetadataService';
import { buildParsedPreview, buildPreview } from './text';

type EnrichedUnit = PersistableUnit;

type IngestWorkflowInput = {
  file: File;
  filePath?: string;
  previewKind: PreviewKind;
  knowledgeBase: KnowledgeBaseRecord;
};

type IngestWorkflowOptions = {
  runtime: AIRuntime;
  prompts: IngestPrompts;
  repository?: IngestRepository;
  now?: () => number;
  createId?: () => string;
};

type IngestEventHandler = (event: IngestStreamEvent) => void;

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

function buildUnitEmbeddingText(sourceMeta: SourceMeta, unit: IngestUnit) {
  const relationHints = unit.meta.relationHints.map(hint => `${hint.kind}:${hint.label}`).join('；');
  return [
    sourceMeta.summary.trim() ? `來源摘要：${sourceMeta.summary.trim()}` : '',
    sourceMeta.structure?.label ? `來源結構：${sourceMeta.structure.label}` : '',
    unit.meta.summary.trim() ? `單位摘要：${unit.meta.summary.trim()}` : '',
    unit.meta.terms.length > 0 ? `檢索詞：${unit.meta.terms.join('、')}` : '',
    unit.meta.entities.length > 0 ? `實體：${unit.meta.entities.join('、')}` : '',
    relationHints ? `關聯提示：${relationHints}` : '',
    `內容：${unit.content}`,
  ].filter(Boolean).join('\n');
}

function buildRetrievalQuery(title: string, sourceMeta: SourceMeta) {
  return uniqueStrings([
    title.replace(/\.[^.]+$/, ''),
    sourceMeta.summary,
    sourceMeta.structure?.label ?? '',
    ...sourceMeta.terms,
    ...sourceMeta.entities,
  ]).join(' ');
}

function buildSourceMeta(sourceType: SourceMeta['sourceType'], title: string, input: Omit<SourceMeta, 'schemaVersion' | 'sourceType' | 'title'>): SourceMeta {
  return {
    schemaVersion: INGEST_CONTRACT_VERSION,
    sourceType,
    title,
    summary: input.summary,
    terms: input.terms,
    entities: input.entities,
    structure: input.structure,
  };
}

function buildUnitMeta(unitType: string, input: Omit<UnitMeta, 'schemaVersion' | 'unitType'>): UnitMeta {
  return {
    schemaVersion: INGEST_CONTRACT_VERSION,
    unitType,
    summary: input.summary,
    terms: input.terms,
    entities: input.entities,
    relationHints: input.relationHints,
  };
}

export class IngestWorkflow {
  private readonly sourceMetadataService: SourceMetadataService;
  private readonly unitMetadataService: UnitMetadataService;
  private readonly knowledgeProfileService: KnowledgeProfileService;
  private readonly now: () => number;
  private readonly createId: () => string;

  constructor(private readonly options: IngestWorkflowOptions) {
    this.sourceMetadataService = new SourceMetadataService(
      options.runtime,
      options.prompts.documentSource,
      options.prompts.imageSource,
    );
    this.unitMetadataService = new UnitMetadataService(options.runtime, options.prompts.documentUnit, options.prompts.imageUnit);
    this.knowledgeProfileService = new KnowledgeProfileService(options.runtime, options.prompts.knowledgeProfile);
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? randomUUID;
  }

  async run(input: IngestWorkflowInput, emit: IngestEventHandler): Promise<IngestResult> {
    const filename = input.filePath || input.file.name;
    if (isImageFile(filename)) {
      return this.processImage(input, emit);
    }

    return this.processDocument(input, emit);
  }

  private emitStep(emit: IngestEventHandler, message: string) {
    emit({ type: 'step', message });
  }

  private buildBaseUnit(sourceId: string, unitType: string, chunk: Pick<TextChunk, 'index' | 'text' | 'wordCount' | 'startOffset' | 'endOffset'>): EnrichedUnit {
    return {
      id: buildUnitId(sourceId, chunk.index),
      sourceId,
      unitType,
      sequence: chunk.index,
      content: chunk.text,
      preview: buildPreview(chunk.text, 240),
      charCount: chunk.text.length,
      wordCount: chunk.wordCount,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      meta: buildUnitMeta(unitType, {
        summary: buildPreview(chunk.text, 180),
        terms: [],
        entities: [],
        relationHints: [],
      }),
      relatedUnits: [],
      status: 'ready',
    };
  }

  private async loadProfileContext(knowledgeBase: KnowledgeBaseRecord) {
    if (!this.options.repository) {
      return {
        profile: null as KnowledgeProfileRecord | null,
        text: '',
        trace: {
          knowledgeBaseId: knowledgeBase.id,
          knowledgeBaseName: knowledgeBase.name,
          usedUnitCount: 0,
          usedSources: [],
          fallbackTriggered: true,
        },
      };
    }

    const profile = await this.options.repository.getKnowledgeProfile(knowledgeBase.id);
    const text = renderKnowledgeContext({ profile });

    return {
      profile,
      text,
      trace: {
        knowledgeBaseId: knowledgeBase.id,
        knowledgeBaseName: knowledgeBase.name,
        profileVersion: profile?.version,
        profileSummary: profile?.summary,
        usedUnitCount: 0,
        usedSources: buildKnowledgeSourceReferences({ profile }),
        fallbackTriggered: !profile || text.trim().length === 0,
      },
    };
  }

  private async refreshKnowledgeProfile(knowledgeBase: KnowledgeBaseRecord, emit: IngestEventHandler) {
    if (!this.options.repository) {
      return null;
    }

    this.emitStep(emit, '更新知識庫聚合摘要與術語輪廓。');
    const [sources, stats] = await Promise.all([
      this.options.repository.listKnowledgeProfileSources(knowledgeBase.id, 16),
      this.options.repository.getKnowledgeBaseStats(knowledgeBase.id),
    ]);

    const profile = await this.knowledgeProfileService.summarize({
      knowledgeBaseName: knowledgeBase.name,
      sources: sources.map(source => ({
        title: source.title,
        summary: source.summary,
        terms: source.terms,
      })),
    });

    return this.options.repository.saveKnowledgeProfile({
      knowledgeBaseId: knowledgeBase.id,
      summary: profile.summary,
      focusAreas: profile.focusAreas,
      keyTerms: profile.keyTerms,
      sourceCount: stats.sourceCount,
      unitCount: stats.unitCount,
    });
  }

  private async retrieveKnowledgeUnits(knowledgeBase: KnowledgeBaseRecord, queryText: string, matchCount = 4) {
    if (!this.options.repository || !queryText.trim()) {
      return [] as KnowledgeUnitMatch[];
    }

    const queryEmbedding = await this.options.runtime.createEmbedding({ text: queryText });
    return this.options.repository.retrieveRelevantUnits({
      knowledgeBaseId: knowledgeBase.id,
      queryText,
      queryEmbedding,
      matchCount,
      matchThreshold: 0.35,
      sourceTypes: ['document', 'image'],
    });
  }

  private async processImage(input: IngestWorkflowInput, emit: IngestEventHandler): Promise<IngestResult> {
    const startedAt = this.now();
    const canonicalPath = input.filePath || input.file.name;
    const title = getSourceTitle(canonicalPath);
    const sourceId = this.createId();

    this.emitStep(emit, `讀取圖片檔案內容，目標知識庫：${input.knowledgeBase.name}。`);
    const textBuffer = await input.file.arrayBuffer();
    const base64 = Buffer.from(textBuffer).toString('base64');
    const mimeType = input.file.type || 'image/jpeg';
    const imageDataUrl = `data:${mimeType};base64,${base64}`;
    const profileContext = await this.loadProfileContext(input.knowledgeBase);

    this.emitStep(emit, '建立圖片來源 metadata。');
    const sourceMeta = buildSourceMeta('image', title, await this.sourceMetadataService.analyzeImage({
      filename: title,
      imageDataUrl,
      knowledgeContext: profileContext.text,
    }));
    const retrievalQuery = buildRetrievalQuery(title, sourceMeta);
    this.emitStep(emit, retrievalQuery ? '依照來源 metadata 到知識庫檢索相關單位。' : '本次未能建立有效檢索查詢，將以知識庫摘要作為 fallback。');
    const retrievedUnits = await this.retrieveKnowledgeUnits(input.knowledgeBase, retrievalQuery);

    const knowledgeContext = renderKnowledgeContext({
      profile: profileContext.profile,
      units: retrievedUnits,
      maxUnitCount: 4,
    });
    const contextApplied = knowledgeContext.trim().length > 0;

    this.emitStep(emit, contextApplied ? '已注入知識庫上下文，開始建立圖片檢索單位。' : '知識庫中沒有足夠可用上下文，改以純圖片模式建立單位。');
    const unitMeta = buildUnitMeta('image-analysis', await this.unitMetadataService.analyzeImageUnit({
      filename: title,
      imageDataUrl,
      knowledgeContext,
      sourceSummary: sourceMeta.summary,
    }));

    const unit: EnrichedUnit = {
      id: buildUnitId(sourceId, 0),
      sourceId,
      unitType: 'image-analysis',
      sequence: 0,
      content: sourceMeta.summary,
      preview: buildPreview(sourceMeta.summary, 240),
      charCount: sourceMeta.summary.length,
      wordCount: sourceMeta.summary.split(/\s+/).filter(Boolean).length,
      startOffset: 0,
      endOffset: sourceMeta.summary.length,
      meta: unitMeta,
      relatedUnits: [],
      status: 'ready',
    };

    this.emitStep(emit, '圖片單位 metadata 完成，開始生成向量表示。');
    const embedding = await this.options.runtime.createEmbedding({ text: buildUnitEmbeddingText(sourceMeta, unit) });
    unit.embedding = embedding;

    const knowledgeContextTrace = {
      knowledgeBaseId: input.knowledgeBase.id,
      knowledgeBaseName: input.knowledgeBase.name,
      profileVersion: profileContext.profile?.version,
      profileSummary: profileContext.profile?.summary,
      retrievalQuery,
      usedUnitCount: retrievedUnits.length,
      usedSources: buildKnowledgeSourceReferences({
        profile: profileContext.profile,
        units: retrievedUnits,
      }),
      fallbackTriggered: !contextApplied,
    };

    emit({
      type: 'unit',
      knowledgeBaseId: input.knowledgeBase.id,
      knowledgeBaseName: input.knowledgeBase.name,
      sourceId,
      sourceType: 'image',
      title,
      unit: {
        ...unit,
        relatedUnits: [],
      },
      totalUnitCount: 1,
      totalCharCount: sourceMeta.summary.length,
      rawPreview: buildPreview(sourceMeta.summary, 400),
      previewKind: input.previewKind,
      progress: { current: 1, total: 1 },
    });

    const result: IngestResult = {
      type: 'source',
      knowledgeBaseId: input.knowledgeBase.id,
      knowledgeBaseName: input.knowledgeBase.name,
      previewKind: input.previewKind,
      sourceId,
      sourceType: 'image',
      title,
      totalUnitCount: 1,
      totalCharCount: sourceMeta.summary.length,
      processingDurationMs: this.now() - startedAt,
      rawPreview: buildPreview(sourceMeta.summary, 400),
      meta: sourceMeta,
      units: [{ ...unit, relatedUnits: [] }],
      contextApplied,
      knowledgeContext: knowledgeContextTrace,
      dbWritten: false,
    };

    if (this.options.repository) {
      this.emitStep(emit, '準備將圖片來源與單位寫入知識庫。');

      try {
        await this.options.repository.saveSource({
          knowledgeBaseId: input.knowledgeBase.id,
          canonicalPath,
          previewKind: input.previewKind,
          result,
          units: [unit],
          promptVariant: this.options.prompts.id,
        });
        result.dbWritten = true;
        this.emitStep(emit, '圖片來源與單位已寫入知識庫。');
        await this.refreshKnowledgeProfile(input.knowledgeBase, emit);
      } catch (error) {
        this.emitStep(emit, `圖片資料寫入知識庫失敗：${getErrorMessage(error)}`);
      }
    }

    return result;
  }

  private async processDocument(input: IngestWorkflowInput, emit: IngestEventHandler): Promise<IngestResult> {
    const startedAt = this.now();
    const sourceId = this.createId();
    const canonicalPath = input.filePath || input.file.name;
    const title = getSourceTitle(canonicalPath);
    const profileContext = await this.loadProfileContext(input.knowledgeBase);

    this.emitStep(emit, `讀取文件檔案內容，目標知識庫：${input.knowledgeBase.name}。`);
    const buffer = Buffer.from(await input.file.arrayBuffer());

    let parsedText = '';
    try {
      parsedText = await parseDocument(buffer, canonicalPath);
    } catch (error) {
      throw new Error(`Parser failed: ${getErrorMessage(error)}`);
    }

    this.emitStep(emit, `文件解析完成，抽出 ${parsedText.length} 個字元。`);
    const units = chunkText(parsedText, 500, 100);
    const rawPreview = buildParsedPreview(parsedText);
    this.emitStep(emit, `文件已依語意邊界切成 ${units.length} 個 units（目標 500 words，重疊 100 words）。`);

    this.emitStep(emit, profileContext.text.trim().length > 0 ? '已載入知識庫摘要，開始建立來源 metadata。' : '知識庫尚未形成穩定摘要，先以文件自身內容建立來源 metadata。');
    const sourceMeta = buildSourceMeta('document', title, await this.sourceMetadataService.analyzeDocument({
      filename: title,
      parsedTextPreview: rawPreview,
      units,
      knowledgeContext: profileContext.text,
    }));
    const retrievalQuery = buildRetrievalQuery(title, sourceMeta);
    const retrievedUnits = await this.retrieveKnowledgeUnits(input.knowledgeBase, retrievalQuery);
    const knowledgeContext = renderKnowledgeContext({
      profile: profileContext.profile,
      units: retrievedUnits,
      maxUnitCount: 4,
    });
    const contextApplied = knowledgeContext.trim().length > 0;

    const enrichedUnits: EnrichedUnit[] = [];

    for (const unit of units) {
      this.emitStep(emit, `分析第 ${unit.index + 1}/${units.length} 個 unit，建立 metadata 與向量。`);

      try {
        const unitMeta = buildUnitMeta('text-segment', await this.unitMetadataService.analyzeDocumentUnit({
          unit,
          previousUnit: units[unit.index - 1],
          nextUnit: units[unit.index + 1],
          knowledgeContext,
          sourceSummary: sourceMeta.summary,
        }));

        const enrichedUnit: EnrichedUnit = {
          ...this.buildBaseUnit(sourceId, 'text-segment', unit),
          meta: unitMeta,
        };

        const embedding = await this.options.runtime.createEmbedding({
          text: buildUnitEmbeddingText(sourceMeta, enrichedUnit),
        });

        enrichedUnit.embedding = embedding;

        enrichedUnits.push(enrichedUnit);
        emit({
          type: 'unit',
          knowledgeBaseId: input.knowledgeBase.id,
          knowledgeBaseName: input.knowledgeBase.name,
          sourceId,
          sourceType: 'document',
          title,
          unit: {
            ...enrichedUnit,
            relatedUnits: [],
          },
          totalUnitCount: units.length,
          totalCharCount: parsedText.length,
          rawPreview,
          previewKind: input.previewKind,
          progress: { current: unit.index + 1, total: units.length },
        });
        this.emitStep(emit, `Unit ${unit.index + 1} 已完成 metadata 與 embedding。`);
      } catch (error) {
        const fallbackUnit: EnrichedUnit = {
          ...this.buildBaseUnit(sourceId, 'text-segment', unit),
          status: 'error',
          errorMessage: getErrorMessage(error),
        };

        enrichedUnits.push(fallbackUnit);
        emit({
          type: 'unit',
          knowledgeBaseId: input.knowledgeBase.id,
          knowledgeBaseName: input.knowledgeBase.name,
          sourceId,
          sourceType: 'document',
          title,
          unit: {
            ...fallbackUnit,
            relatedUnits: [],
          },
          totalUnitCount: units.length,
          totalCharCount: parsedText.length,
          rawPreview,
          previewKind: input.previewKind,
          progress: { current: unit.index + 1, total: units.length },
        });
        this.emitStep(emit, `Unit ${unit.index + 1} 分析失敗，已保留 fallback metadata：${fallbackUnit.errorMessage}`);
      }
    }

    this.emitStep(emit, '根據 metadata 與 embedding 建立 units 之間的關聯。');
    const relationMap = buildUnitRelations(enrichedUnits.map(unit => ({
      id: unit.id,
      sequence: unit.sequence,
      meta: unit.meta,
      status: unit.status,
      embedding: unit.embedding,
    })));
    const unitsWithRelations = enrichedUnits.map(unit => ({
      ...unit,
      relatedUnits: relationMap[unit.id] ?? [],
    }));

    const result: IngestResult = {
      type: 'source',
      knowledgeBaseId: input.knowledgeBase.id,
      knowledgeBaseName: input.knowledgeBase.name,
      previewKind: input.previewKind,
      sourceId,
      sourceType: 'document',
      title,
      totalUnitCount: units.length,
      totalCharCount: parsedText.length,
      processingDurationMs: this.now() - startedAt,
      rawPreview,
      meta: sourceMeta,
      units: unitsWithRelations.map(unit => ({ ...unit })),
      contextApplied,
      knowledgeContext: {
        ...profileContext.trace,
        retrievalQuery,
        usedUnitCount: retrievedUnits.length,
        usedSources: buildKnowledgeSourceReferences({ profile: profileContext.profile, units: retrievedUnits }),
        fallbackTriggered: !contextApplied,
      },
      dbWritten: false,
    };

    if (this.options.repository) {
      this.emitStep(emit, '準備將來源與 units 寫入知識庫。');

      try {
        await this.options.repository.saveSource({
          knowledgeBaseId: input.knowledgeBase.id,
          canonicalPath,
          previewKind: input.previewKind,
          result,
          units: unitsWithRelations,
          promptVariant: this.options.prompts.id,
        });
        result.dbWritten = true;
        this.emitStep(emit, '來源與 units 已寫入知識庫。');
        await this.refreshKnowledgeProfile(input.knowledgeBase, emit);
      } catch (error) {
        this.emitStep(emit, `來源資料寫入知識庫失敗：${getErrorMessage(error)}`);
      }
    }

    return result;
  }
}