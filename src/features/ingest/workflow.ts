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
import type { IngestPromptVariant } from './prompts';
import { buildChunkRelations } from './relations';
import type { IngestRepository, PersistableDocumentChunk } from './repository';
import { ChunkAnalysisService } from './services/ChunkAnalysisService';
import { DocumentSummaryService } from './services/DocumentSummaryService';
import { ImageAnalysisService } from './services/ImageAnalysisService';
import { buildParsedPreview, buildPreview } from './text';

type EnrichedChunk = PersistableDocumentChunk;

type IngestWorkflowInput = {
  file: File;
  globalContext: string;
  previewKind: PreviewKind;
};

type IngestWorkflowOptions = {
  runtime: AIRuntime;
  prompts: IngestPromptVariant;
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

export class IngestWorkflow {
  private readonly chunkAnalysisService: ChunkAnalysisService;
  private readonly summaryService: DocumentSummaryService;
  private readonly imageAnalysisService: ImageAnalysisService;
  private readonly now: () => number;
  private readonly createId: () => string;

  constructor(private readonly options: IngestWorkflowOptions) {
    this.chunkAnalysisService = new ChunkAnalysisService(options.runtime, options.prompts.chunkAnalysis);
    this.summaryService = new DocumentSummaryService(options.runtime, options.prompts.documentSummary);
    this.imageAnalysisService = new ImageAnalysisService(options.runtime, options.prompts.imageAnalysis);
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

  private async processImage(input: IngestWorkflowInput, emit: IngestEventHandler): Promise<ImageIngestResult> {
    const startedAt = this.now();
    const contextApplied = input.globalContext.trim().length > 0;

    this.emitStep(emit, '讀取圖片檔案內容。');
    const textBuffer = await input.file.arrayBuffer();
    const base64 = Buffer.from(textBuffer).toString('base64');
    const mimeType = input.file.type || 'image/jpeg';

    this.emitStep(emit, contextApplied ? '套用前面文件摘要當作圖片分析上下文。' : '沒有文件上下文，直接做圖片分析。');
    this.emitStep(emit, '送出至 AI runtime 進行圖片理解。');
    const description = await this.imageAnalysisService.analyze(`data:${mimeType};base64,${base64}`, input.globalContext);

    this.emitStep(emit, '圖片分析完成，開始生成向量表示。');
    const embeddingVector = await this.options.runtime.createEmbedding({
      text: description,
    });

    const result: ImageIngestResult = {
      type: 'image',
      previewKind: input.previewKind,
      processingDurationMs: this.now() - startedAt,
      description,
      descriptionSnippet: buildPreview(description, 120),
      contextApplied,
      dbWritten: false,
    };

    if (this.options.repository) {
      this.emitStep(emit, '準備將圖片分析結果寫入資料庫。');

      try {
        await this.options.repository.saveImage({
          fileName: input.file.name,
          previewKind: input.previewKind,
          result,
          description,
          descriptionSnippet: result.descriptionSnippet ?? '',
          embeddingVector,
          promptVariant: this.options.prompts.id,
        });
        result.dbWritten = true;
        this.emitStep(emit, '圖片分析結果已寫入資料庫。');
      } catch (error) {
        this.emitStep(emit, `圖片結果寫入資料庫失敗：${getErrorMessage(error)}`);
      }
    }

    return result;
  }

  private async processDocument(input: IngestWorkflowInput, emit: IngestEventHandler): Promise<DocumentIngestResult> {
    const startedAt = this.now();
    const contextApplied = input.globalContext.trim().length > 0;
    const documentId = this.createId();

    this.emitStep(emit, '讀取文件檔案內容。');
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

    const enrichedChunks: EnrichedChunk[] = [];

    for (const chunk of chunks) {
      this.emitStep(emit, `分析第 ${chunk.index + 1}/${chunks.length} 個 chunk，建立摘要與向量。`);

      try {
        const [analysis, embedding] = await Promise.all([
          this.chunkAnalysisService.analyze({
            chunk,
            previousChunk: chunks[chunk.index - 1],
            nextChunk: chunks[chunk.index + 1],
            globalContext: input.globalContext,
          }),
          this.options.runtime.createEmbedding({ text: chunk.text }),
        ]);

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
      input.globalContext,
    );

    const result: DocumentIngestResult = {
      type: 'document',
      previewKind: input.previewKind,
      documentId,
      chunkCount: chunks.length,
      totalCharCount: parsedText.length,
      processingDurationMs: this.now() - startedAt,
      summary,
      parsedTextPreview,
      chunkAnalyses: chunksWithRelations.map(chunk => this.stripChunkEmbedding(chunk)),
      contextApplied,
      dbWritten: false,
    };

    if (this.options.repository) {
      this.emitStep(emit, '準備將文件與 chunk 分析結果寫入資料庫。');

      try {
        await this.options.repository.saveDocument({
          fileName: input.file.name,
          previewKind: input.previewKind,
          result,
          chunks: chunksWithRelations,
          promptVariant: this.options.prompts.id,
        });
        result.dbWritten = true;
        this.emitStep(emit, '文件與 chunk 分析結果已寫入資料庫。');
      } catch (error) {
        this.emitStep(emit, `文件結果寫入資料庫失敗：${getErrorMessage(error)}`);
      }
    }

    return result;
  }
}