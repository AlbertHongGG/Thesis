import { randomUUID } from 'node:crypto';
import type { AIRuntime } from '@/ai';
import { chunkText, type TextChunk } from '@/lib/rag/chunker';
import { parseDocument } from '@/lib/rag/parser';
import type {
  DocumentChunkAnalysis,
  DocumentIngestResult,
  ImageIngestResult,
  IngestResult,
  IngestStreamEvent,
  PreviewKind,
} from './contracts';
import {
  buildKnowledgeSourceReferences,
  renderKnowledgeContext,
  uniqueStrings,
  type KnowledgeBaseRecord,
  type KnowledgeChunkMatch,
  type KnowledgeProfileRecord,
} from './knowledge';
import type { IngestPrompts } from './prompts';
import { buildChunkRelations } from './relations';
import type { IngestRepository, PersistableDocumentChunk } from './repository';
import { ChunkAnalysisService } from './services/ChunkAnalysisService';
import { DocumentOverviewService } from './services/DocumentOverviewService';
import { DocumentSummaryService } from './services/DocumentSummaryService';
import { ImageAnalysisService } from './services/ImageAnalysisService';
import { KnowledgeProfileService } from './services/KnowledgeProfileService';
import { buildParsedPreview, buildPreview } from './text';

type EnrichedChunk = PersistableDocumentChunk;

type IngestWorkflowInput = {
  file: File;
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

function buildChunkId(documentId: string, index: number) {
  return `${documentId}:chunk:${index + 1}`;
}

function buildChunkEmbeddingText(documentOverview: string, summary: string, chunk: TextChunk, keywords: string[]) {
  return [
    documentOverview.trim() ? `文件總覽：${documentOverview.trim()}` : '',
    summary.trim() ? `當前 chunk 摘要：${summary.trim()}` : '',
    keywords.length > 0 ? `關鍵詞：${keywords.join('、')}` : '',
    `原始 chunk 內容：${chunk.text}`,
  ].filter(Boolean).join('\n');
}

function buildImageRetrievalQuery(filename: string, hints: {
  summary: string;
  chartType: string;
  keywords: string[];
  candidateQueries: string[];
  visibleText: string[];
}) {
  return uniqueStrings([
    filename.replace(/\.[^.]+$/, ''),
    hints.summary,
    hints.chartType,
    ...hints.keywords,
    ...hints.candidateQueries,
    ...hints.visibleText,
  ]).join(' ');
}

export class IngestWorkflow {
  private readonly overviewService: DocumentOverviewService;
  private readonly chunkAnalysisService: ChunkAnalysisService;
  private readonly summaryService: DocumentSummaryService;
  private readonly imageAnalysisService: ImageAnalysisService;
  private readonly knowledgeProfileService: KnowledgeProfileService;
  private readonly now: () => number;
  private readonly createId: () => string;

  constructor(private readonly options: IngestWorkflowOptions) {
    this.overviewService = new DocumentOverviewService(options.runtime, options.prompts.documentOverview);
    this.chunkAnalysisService = new ChunkAnalysisService(options.runtime, options.prompts.chunkAnalysis);
    this.summaryService = new DocumentSummaryService(options.runtime, options.prompts.documentSummary);
    this.imageAnalysisService = new ImageAnalysisService(
      options.runtime,
      options.prompts.imageQuery,
      options.prompts.imageAnalysis,
    );
    this.knowledgeProfileService = new KnowledgeProfileService(options.runtime, options.prompts.knowledgeProfile);
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? randomUUID;
  }

  async run(input: IngestWorkflowInput, emit: IngestEventHandler): Promise<IngestResult> {
    if (isImageFile(input.file.name)) {
      return this.processImage(input, emit);
    }

    return this.processDocument(input, emit);
  }

  private emitStep(emit: IngestEventHandler, message: string) {
    emit({ type: 'step', message });
  }

  private buildBaseChunk(documentId: string, chunk: TextChunk): EnrichedChunk {
    return {
      id: buildChunkId(documentId, chunk.index),
      index: chunk.index,
      text: chunk.text,
      preview: buildPreview(chunk.text, 240),
      charCount: chunk.text.length,
      wordCount: chunk.wordCount,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      summary: buildPreview(chunk.text, 180),
      keywords: [],
      bridgingContext: '',
      relatedChunks: [],
      status: 'ready',
    };
  }

  private stripChunkEmbedding(chunk: EnrichedChunk): DocumentChunkAnalysis {
    return {
      id: chunk.id,
      index: chunk.index,
      text: chunk.text,
      preview: chunk.preview,
      charCount: chunk.charCount,
      wordCount: chunk.wordCount,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      summary: chunk.summary,
      keywords: [...chunk.keywords],
      bridgingContext: chunk.bridgingContext,
      relatedChunks: chunk.relatedChunks.map(relation => ({ ...relation })),
      status: chunk.status,
      errorMessage: chunk.errorMessage,
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
          usedChunkCount: 0,
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
        usedChunkCount: 0,
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
      sources,
    });

    return this.options.repository.saveKnowledgeProfile({
      knowledgeBaseId: knowledgeBase.id,
      summary: profile.summary,
      focusAreas: profile.focusAreas,
      keyTerms: profile.keyTerms,
      researchQuestions: profile.researchQuestions,
      methods: profile.methods,
      recentUpdates: profile.recentUpdates,
      sourceCount: stats.sourceCount,
      chunkCount: stats.chunkCount,
    });
  }

  private async retrieveKnowledgeChunks(knowledgeBase: KnowledgeBaseRecord, queryText: string, matchCount = 4) {
    if (!this.options.repository || !queryText.trim()) {
      return [] as KnowledgeChunkMatch[];
    }

    const queryEmbedding = await this.options.runtime.createEmbedding({ text: queryText });
    return this.options.repository.retrieveRelevantChunks({
      knowledgeBaseId: knowledgeBase.id,
      queryText,
      queryEmbedding,
      matchCount,
      matchThreshold: 0.35,
      sourceTypes: ['document'],
    });
  }

  private async processImage(input: IngestWorkflowInput, emit: IngestEventHandler): Promise<ImageIngestResult> {
    const startedAt = this.now();

    this.emitStep(emit, `讀取圖片檔案內容，目標知識庫：${input.knowledgeBase.name}。`);
    const textBuffer = await input.file.arrayBuffer();
    const base64 = Buffer.from(textBuffer).toString('base64');
    const mimeType = input.file.type || 'image/jpeg';
    const imageDataUrl = `data:${mimeType};base64,${base64}`;

    this.emitStep(emit, '先建立圖片的初步理解與檢索線索。');
    const hints = await this.imageAnalysisService.buildRetrievalHints(imageDataUrl, input.file.name);
    const retrievalQuery = buildImageRetrievalQuery(input.file.name, hints);

    this.emitStep(emit, retrievalQuery ? '依照圖片線索到知識庫檢索相關片段。' : '本次未能建立有效檢索線索，將以知識庫摘要或純圖片理解作為 fallback。');
    const [profileContext, retrievedChunks] = await Promise.all([
      this.loadProfileContext(input.knowledgeBase),
      this.retrieveKnowledgeChunks(input.knowledgeBase, retrievalQuery),
    ]);

    const knowledgeContext = renderKnowledgeContext({
      profile: profileContext.profile,
      chunks: retrievedChunks,
      maxChunkCount: 4,
    });
    const contextApplied = knowledgeContext.trim().length > 0;

    this.emitStep(emit, contextApplied ? '已注入知識庫摘要與相關片段，開始正式圖片分析。' : '知識庫中沒有足夠可用上下文，改以純圖片理解模式分析。');
    const description = await this.imageAnalysisService.analyze({
      imageDataUrl,
      knowledgeContext,
      preliminarySummary: hints.summary,
      retrievalQuery,
    });

    this.emitStep(emit, '圖片分析完成，開始生成向量表示。');
    const embeddingVector = await this.options.runtime.createEmbedding({ text: description });

    const knowledgeContextTrace = {
      knowledgeBaseId: input.knowledgeBase.id,
      knowledgeBaseName: input.knowledgeBase.name,
      profileVersion: profileContext.profile?.version,
      profileSummary: profileContext.profile?.summary,
      retrievalQuery,
      usedChunkCount: retrievedChunks.length,
      usedSources: buildKnowledgeSourceReferences({
        profile: profileContext.profile,
        chunks: retrievedChunks,
      }),
      fallbackTriggered: !contextApplied,
    };

    const result: ImageIngestResult = {
      type: 'image',
      knowledgeBaseId: input.knowledgeBase.id,
      knowledgeBaseName: input.knowledgeBase.name,
      previewKind: input.previewKind,
      processingDurationMs: this.now() - startedAt,
      description,
      descriptionSnippet: buildPreview(description, 120),
      contextApplied,
      knowledgeContext: knowledgeContextTrace,
      dbWritten: false,
    };

    if (this.options.repository) {
      this.emitStep(emit, '準備將圖片分析結果寫入知識庫。');

      try {
        await this.options.repository.saveImage({
          knowledgeBaseId: input.knowledgeBase.id,
          fileName: input.file.name,
          previewKind: input.previewKind,
          result,
          description,
          descriptionSnippet: result.descriptionSnippet ?? '',
          embeddingVector,
          promptVariant: this.options.prompts.id,
        });
        result.dbWritten = true;
        this.emitStep(emit, '圖片分析結果已寫入知識庫。');
        await this.refreshKnowledgeProfile(input.knowledgeBase, emit);
      } catch (error) {
        this.emitStep(emit, `圖片結果寫入知識庫失敗：${getErrorMessage(error)}`);
      }
    }

    return result;
  }

  private async processDocument(input: IngestWorkflowInput, emit: IngestEventHandler): Promise<DocumentIngestResult> {
    const startedAt = this.now();
    const documentId = this.createId();
    const profileContext = await this.loadProfileContext(input.knowledgeBase);
    const contextApplied = profileContext.text.trim().length > 0;

    this.emitStep(emit, `讀取文件檔案內容，目標知識庫：${input.knowledgeBase.name}。`);
    const buffer = Buffer.from(await input.file.arrayBuffer());

    let parsedText = '';
    try {
      parsedText = await parseDocument(buffer, input.file.name);
    } catch (error) {
      throw new Error(`Parser failed: ${getErrorMessage(error)}`);
    }

    this.emitStep(emit, `文件解析完成，抽出 ${parsedText.length} 個字元。`);
    const chunks = chunkText(parsedText, 500, 100);
    const parsedTextPreview = buildParsedPreview(parsedText);
    this.emitStep(emit, `文件已依語意邊界切成 ${chunks.length} 個 chunks（目標 500 words，重疊 100 words）。`);

    this.emitStep(emit, contextApplied ? '已載入既有知識庫摘要，將作為本次文件分析脈絡。' : '知識庫尚未形成穩定摘要，先以文件自身脈絡建立新知識。');
    const documentOverview = await this.overviewService.summarize(
      input.file.name,
      chunks,
      parsedTextPreview,
      profileContext.text,
    );

    const enrichedChunks: EnrichedChunk[] = [];

    for (const chunk of chunks) {
      this.emitStep(emit, `分析第 ${chunk.index + 1}/${chunks.length} 個 chunk，建立摘要與向量。`);

      try {
        const analysis = await this.chunkAnalysisService.analyze({
          chunk,
          previousChunk: chunks[chunk.index - 1],
          nextChunk: chunks[chunk.index + 1],
          knowledgeContext: profileContext.text,
          documentOverview,
        });
        const embedding = await this.options.runtime.createEmbedding({
          text: buildChunkEmbeddingText(documentOverview, analysis.summary, chunk, analysis.keywords),
        });

        const enrichedChunk: EnrichedChunk = {
          ...this.buildBaseChunk(documentId, chunk),
          summary: analysis.summary || buildPreview(chunk.text, 180),
          keywords: analysis.keywords,
          bridgingContext: analysis.bridgingContext,
          embedding,
          status: 'ready',
        };

        enrichedChunks.push(enrichedChunk);
        emit({
          type: 'chunk',
          knowledgeBaseId: input.knowledgeBase.id,
          knowledgeBaseName: input.knowledgeBase.name,
          chunk: this.stripChunkEmbedding(enrichedChunk),
          documentId,
          chunkCount: chunks.length,
          totalCharCount: parsedText.length,
          parsedTextPreview,
          previewKind: input.previewKind,
          progress: { current: chunk.index + 1, total: chunks.length },
        });
        this.emitStep(emit, `Chunk ${chunk.index + 1} 已完成摘要、關鍵詞與 embedding。`);
      } catch (error) {
        const fallbackChunk: EnrichedChunk = {
          ...this.buildBaseChunk(documentId, chunk),
          status: 'error',
          errorMessage: getErrorMessage(error),
        };

        enrichedChunks.push(fallbackChunk);
        emit({
          type: 'chunk',
          knowledgeBaseId: input.knowledgeBase.id,
          knowledgeBaseName: input.knowledgeBase.name,
          chunk: this.stripChunkEmbedding(fallbackChunk),
          documentId,
          chunkCount: chunks.length,
          totalCharCount: parsedText.length,
          parsedTextPreview,
          previewKind: input.previewKind,
          progress: { current: chunk.index + 1, total: chunks.length },
        });
        this.emitStep(emit, `Chunk ${chunk.index + 1} 分析失敗，已保留 fallback 摘要：${fallbackChunk.errorMessage}`);
      }
    }

    this.emitStep(emit, '根據 embedding 建立 chunk 之間的語意關聯。');
    const relationMap = buildChunkRelations(enrichedChunks);
    const chunksWithRelations = enrichedChunks.map(chunk => ({
      ...chunk,
      relatedChunks: relationMap[chunk.id] ?? [],
    }));

    const summary = await this.summaryService.summarize(
      input.file.name,
      chunksWithRelations.map(chunk => this.stripChunkEmbedding(chunk)),
      profileContext.text,
      documentOverview,
    );

    const result: DocumentIngestResult = {
      type: 'document',
      knowledgeBaseId: input.knowledgeBase.id,
      knowledgeBaseName: input.knowledgeBase.name,
      previewKind: input.previewKind,
      documentId,
      chunkCount: chunks.length,
      totalCharCount: parsedText.length,
      processingDurationMs: this.now() - startedAt,
      summary,
      parsedTextPreview,
      chunkAnalyses: chunksWithRelations.map(chunk => this.stripChunkEmbedding(chunk)),
      contextApplied,
      knowledgeContext: profileContext.trace,
      dbWritten: false,
    };

    if (this.options.repository) {
      this.emitStep(emit, '準備將文件與 chunk 分析結果寫入知識庫。');

      try {
        await this.options.repository.saveDocument({
          knowledgeBaseId: input.knowledgeBase.id,
          fileName: input.file.name,
          previewKind: input.previewKind,
          result,
          chunks: chunksWithRelations,
          promptVariant: this.options.prompts.id,
        });
        result.dbWritten = true;
        this.emitStep(emit, '文件與 chunk 分析結果已寫入知識庫。');
        await this.refreshKnowledgeProfile(input.knowledgeBase, emit);
      } catch (error) {
        this.emitStep(emit, `文件結果寫入知識庫失敗：${getErrorMessage(error)}`);
      }
    }

    return result;
  }
}