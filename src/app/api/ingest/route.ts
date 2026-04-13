import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAIProvider } from '@/ai';
import { chunkText, type TextChunk } from '@/lib/rag/chunker';
import { parseDocument } from '@/lib/rag/parser';
import { supabaseAdmin } from '@/lib/supabase';
import { getPreviewKind } from '@/lib/workbench/filePreview';
import type {
  DocumentChunkAnalysis,
  DocumentIngestResult,
  IngestResult,
  PreviewKind,
} from '@/lib/workbench/types';

type ProcessStep = {
  message: string;
};

type StreamedImageResult = Extract<IngestResult, { type: 'image' }> & {
  filename: string;
  status: 'processed';
  processSteps: ProcessStep[];
};

type StreamedDocumentResult = Extract<IngestResult, { type: 'document' }> & {
  filename: string;
  status: 'processed';
  processSteps: ProcessStep[];
};

type StreamEvent =
  | { type: 'step'; message: string }
  | {
      type: 'chunk';
      chunk: DocumentChunkAnalysis;
      documentId: string;
      chunkCount: number;
      totalCharCount: number;
      parsedTextPreview: string;
      previewKind: PreviewKind;
      progress: { current: number; total: number };
    }
  | { type: 'result'; result: IngestResult }
  | { type: 'error'; error: string };

type ChunkAnalysisPayload = {
  summary?: string;
  keywords?: string[];
  bridgingContext?: string;
};

type EnrichedChunk = DocumentChunkAnalysis & {
  embedding?: number[];
};

const MAX_CONTEXT_CHARS = 1800;
const MAX_PARSED_PREVIEW_CHARS = 4000;
const MIN_RELATION_SCORE = 0.24;
const MAX_RELATED_CHUNKS = 3;

function buildPreview(text: string, maxLength = 180) {
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function buildParsedPreview(text: string, maxLength = MAX_PARSED_PREVIEW_CHARS) {
  const normalized = text.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}\n\n...已截斷，僅保留前 ${maxLength.toLocaleString('zh-TW')} 個字元。`;
}

function clampContext(text: string, maxLength = MAX_CONTEXT_CHARS) {
  const normalized = text.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `...${normalized.slice(-maxLength)}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function extractJsonObject(rawText: string) {
  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? rawText;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Chunk analysis did not return JSON.');
  }

  return JSON.parse(candidate.slice(start, end + 1)) as ChunkAnalysisPayload;
}

function normalizeKeywords(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map(keyword => (typeof keyword === 'string' ? keyword.trim() : ''))
    .filter(Boolean)
    .slice(0, 8);
}

function buildChunkId(documentId: string, index: number) {
  return `${documentId}:chunk:${index + 1}`;
}

function buildChunkAnalysisPrompt(chunk: TextChunk, previousChunk: TextChunk | undefined, nextChunk: TextChunk | undefined, globalContext: string) {
  const contextSection = globalContext.trim().length > 0
    ? `\nPrevious document context:\n${clampContext(globalContext)}\n`
    : '';

  return [
    'Analyze the following document chunk for downstream RAG retrieval.',
    'Return strict JSON with keys: summary (string), keywords (string array), bridgingContext (string).',
    'The summary must be concise but preserve specific facts and terminology.',
    'Keywords should be short Traditional Chinese or English phrases that help retrieval.',
    'bridgingContext should explain what adjacent chunk context may matter when this chunk is retrieved alone.',
    contextSection,
    previousChunk ? `Previous chunk preview:\n${buildPreview(previousChunk.text, 260)}\n` : 'Previous chunk preview:\n(none)\n',
    nextChunk ? `Next chunk preview:\n${buildPreview(nextChunk.text, 260)}\n` : 'Next chunk preview:\n(none)\n',
    `Chunk content:\n${chunk.text}`,
  ].join('\n');
}

async function analyzeChunk(
  aiProvider: ReturnType<typeof getAIProvider>,
  chunk: TextChunk,
  previousChunk: TextChunk | undefined,
  nextChunk: TextChunk | undefined,
  globalContext: string,
): Promise<ChunkAnalysisPayload> {
  const raw = await aiProvider.generateText(
    buildChunkAnalysisPrompt(chunk, previousChunk, nextChunk, globalContext),
    'You are a precise retrieval preprocessing system. Return strict JSON only with no markdown fences and no extra commentary.',
  );

  const parsed = extractJsonObject(raw);

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
    keywords: normalizeKeywords(parsed.keywords),
    bridgingContext: typeof parsed.bridgingContext === 'string' ? parsed.bridgingContext.trim() : '',
  };
}

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function buildRelationLabel(source: EnrichedChunk, target: EnrichedChunk) {
  const sharedKeywords = source.keywords.filter(keyword => target.keywords.includes(keyword)).slice(0, 2);

  if (sharedKeywords.length > 0) {
    return `共同主題：${sharedKeywords.join('、')}`;
  }

  return `與 Chunk ${target.index + 1} 的語意內容高度相近`;
}

function attachChunkRelations(chunks: EnrichedChunk[]) {
  return chunks.map(source => {
    if (!source.embedding || source.status === 'error') {
      return {
        ...source,
        relatedChunks: [],
      } satisfies EnrichedChunk;
    }

    const relatedChunks = chunks
      .filter(target => target.id !== source.id && target.embedding && target.status !== 'error')
      .map(target => ({
        target,
        score: cosineSimilarity(source.embedding ?? [], target.embedding ?? []),
      }))
      .filter(candidate => candidate.score >= MIN_RELATION_SCORE)
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_RELATED_CHUNKS)
      .map(candidate => ({
        chunkId: candidate.target.id,
        score: Number(candidate.score.toFixed(4)),
        label: buildRelationLabel(source, candidate.target),
      }));

    return {
      ...source,
      relatedChunks,
    } satisfies EnrichedChunk;
  });
}

async function buildDocumentSummary(
  aiProvider: ReturnType<typeof getAIProvider>,
  filename: string,
  chunkAnalyses: EnrichedChunk[],
  globalContext: string,
) {
  const usableChunks = chunkAnalyses.filter(chunk => chunk.summary.trim().length > 0).slice(0, 12);

  if (usableChunks.length === 0) {
    return `文件 ${filename} 已完成解析，但沒有足夠的 chunk 摘要可供整合。`;
  }

  const prompt = [
    `請根據以下文件 chunk 摘要，為文件 ${filename} 產出一段精煉的繁體中文總摘要。`,
    '摘要要保留核心主題、重要術語、關鍵限制或依賴，不要只是改寫第一段內容。',
    globalContext.trim().length > 0 ? `可參考先前文件脈絡：\n${clampContext(globalContext)}\n` : '',
    usableChunks.map(chunk => `Chunk ${chunk.index + 1}: ${chunk.summary}`).join('\n'),
  ].join('\n');

  try {
    const summary = await aiProvider.generateText(
      prompt,
      '請輸出單一段繁體中文摘要，不要使用項目符號，也不要附加多餘說明。',
    );

    return summary.trim();
  } catch {
    return usableChunks.map(chunk => chunk.summary).join(' ');
  }
}

function toVectorLiteral(embedding: number[]) {
  return `[${embedding.map(value => Number(value.toFixed(8))).join(',')}]`;
}

function stripChunkEmbedding(chunk: EnrichedChunk): DocumentChunkAnalysis {
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
    embeddingDimensions: chunk.embeddingDimensions,
    embeddingModel: chunk.embeddingModel,
    analysisModel: chunk.analysisModel,
    status: chunk.status,
    errorMessage: chunk.errorMessage,
  };
}

async function persistImageResult(params: {
  fileName: string;
  previewKind: PreviewKind;
  description: string;
  descriptionSnippet: string;
  contextApplied: boolean;
  embedding: number[];
  processingDurationMs: number;
}) {
  const documentId = randomUUID();

  const { error } = await supabaseAdmin.from('rag_documents').upsert({
    id: documentId,
    filename: params.fileName,
    source_type: 'image',
    preview_kind: params.previewKind,
    description: params.description,
    source_preview: params.descriptionSnippet,
    context_applied: params.contextApplied,
    chunk_count: 0,
    total_char_count: params.description.length,
    processing_duration_ms: params.processingDurationMs,
    metadata: {
      embedding_dimensions: params.embedding.length,
      embedding_model: process.env.OLLAMA_EMBEDDING_MODEL || '',
      vision_model: process.env.OLLAMA_VISION_MODEL || '',
      embedding: toVectorLiteral(params.embedding),
    },
  });

  if (error) {
    throw error;
  }
}

async function persistDocumentResult(params: {
  fileName: string;
  previewKind: PreviewKind;
  result: DocumentIngestResult;
  chunkAnalyses: EnrichedChunk[];
}) {
  const documentResponse = await supabaseAdmin.from('rag_documents').upsert({
    id: params.result.documentId,
    filename: params.fileName,
    source_type: 'document',
    preview_kind: params.previewKind,
    summary: params.result.summary,
    parsed_text_preview: params.result.parsedTextPreview,
    source_preview: buildPreview(params.result.summary || params.result.parsedTextPreview || '', 280),
    context_applied: params.result.contextApplied,
    chunk_count: params.result.chunkCount,
    total_char_count: params.result.totalCharCount,
    processing_duration_ms: params.result.processingDurationMs,
    metadata: {
      analysis_model: process.env.OLLAMA_TEXT_MODEL || '',
      embedding_model: process.env.OLLAMA_EMBEDDING_MODEL || '',
    },
  });

  if (documentResponse.error) {
    throw documentResponse.error;
  }

  if (params.chunkAnalyses.length === 0) {
    return;
  }

  const chunkResponse = await supabaseAdmin.from('rag_document_chunks').upsert(
    params.chunkAnalyses.map(chunk => ({
      id: chunk.id,
      document_id: params.result.documentId,
      chunk_index: chunk.index,
      content: chunk.text,
      preview: chunk.preview,
      summary: chunk.summary,
      keywords: chunk.keywords,
      bridging_context: chunk.bridgingContext,
      related_chunks: chunk.relatedChunks,
      embedding: chunk.embedding ? toVectorLiteral(chunk.embedding) : null,
      embedding_dimensions: chunk.embeddingDimensions ?? null,
      word_count: chunk.wordCount,
      char_count: chunk.charCount,
      start_offset: chunk.startOffset,
      end_offset: chunk.endOffset,
      status: chunk.status,
      analysis_model: chunk.analysisModel ?? null,
      embedding_model: chunk.embeddingModel ?? null,
      metadata: {
        error_message: chunk.errorMessage ?? null,
      },
    })),
  );

  if (chunkResponse.error) {
    throw chunkResponse.error;
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const globalContext = (formData.get('globalContext') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const aiProvider = getAIProvider('ollama');
    const isImage = file.name.match(/\.(png|jpe?g|gif|webp)$/i);
    const previewKind = getPreviewKind(file.name);
    const dbWriteEnabled = process.env.ENABLE_DB_WRITE === 'true';
    const dbConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const requestStartedAt = Date.now();
        const processSteps: ProcessStep[] = [];

        const sendEvent = (event: StreamEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        const pushStep = (message: string) => {
          processSteps.push({ message });
          sendEvent({ type: 'step', message });
        };

        try {
          if (isImage) {
            pushStep('讀取圖片檔案內容。');
            const textBuffer = await file.arrayBuffer();
            const base64 = Buffer.from(textBuffer).toString('base64');
            const mimeType = file.type || 'image/jpeg';
            const contextApplied = globalContext.trim().length > 0;
            const visionPrompt = contextApplied
              ? `Given the following background context from earlier documents:\n${clampContext(globalContext)}\n\nDescribe this image in detail and connect it to the provided context when relevant.`
              : 'Describe this image in detail.';

            pushStep(contextApplied ? '套用前面文件摘要當作圖片分析上下文。' : '沒有文件上下文，直接做圖片分析。');
            pushStep('送出至 Ollama 視覺模型進行圖片理解。');

            const description = await aiProvider.analyzeImage(`data:${mimeType};base64,${base64}`, visionPrompt);
            pushStep('圖片分析完成，開始生成向量表示。');
            const embedding = await aiProvider.createEmbedding(description);

            const processingDurationMs = Date.now() - requestStartedAt;
            const descriptionSnippet = buildPreview(description, 120);
            let dbWritten = false;

            if (dbWriteEnabled && dbConfigured) {
              pushStep('準備將圖片分析結果寫入 Supabase。');
              try {
                await persistImageResult({
                  fileName: file.name,
                  previewKind,
                  description,
                  descriptionSnippet,
                  contextApplied,
                  embedding,
                  processingDurationMs,
                });
                dbWritten = true;
                pushStep('圖片分析結果已寫入 Supabase。');
              } catch (error) {
                pushStep(`圖片結果寫入 Supabase 失敗：${getErrorMessage(error)}`);
              }
            }

            const result: StreamedImageResult = {
              filename: file.name,
              status: 'processed',
              processSteps,
              type: 'image',
              previewKind,
              description,
              descriptionSnippet,
              contextApplied,
              dbWritten,
              processingDurationMs,
            };

            sendEvent({ type: 'result', result });
            return;
          }

          const documentId = randomUUID();
          pushStep('讀取文件檔案內容。');
          const buffer = Buffer.from(await file.arrayBuffer());
          let parsedText = '';

          try {
            parsedText = await parseDocument(buffer, file.name);
          } catch (error) {
            throw new Error(`Parser failed: ${getErrorMessage(error)}`);
          }

          pushStep(`文件解析完成，抽出 ${parsedText.length} 個字元。`);
          const chunks = chunkText(parsedText, 500, 100);
          const parsedTextPreview = buildParsedPreview(parsedText);
          const contextApplied = globalContext.trim().length > 0;
          pushStep(`文件已依語意邊界切成 ${chunks.length} 個 chunks（目標 500 words，重疊 100 words）。`);

          const analyzedChunks: EnrichedChunk[] = [];

          for (const [index, chunk] of chunks.entries()) {
            pushStep(`分析第 ${index + 1}/${chunks.length} 個 chunk，建立摘要與向量。`);

            try {
              const [analysis, embedding] = await Promise.all([
                analyzeChunk(aiProvider, chunk, chunks[index - 1], chunks[index + 1], globalContext),
                aiProvider.createEmbedding(chunk.text),
              ]);

              const enrichedChunk: EnrichedChunk = {
                id: buildChunkId(documentId, index),
                index,
                text: chunk.text,
                preview: buildPreview(chunk.text, 240),
                charCount: chunk.text.length,
                wordCount: chunk.wordCount,
                startOffset: chunk.startOffset,
                endOffset: chunk.endOffset,
                summary: analysis.summary?.trim() || buildPreview(chunk.text, 180),
                keywords: analysis.keywords ?? [],
                bridgingContext: analysis.bridgingContext?.trim() || '',
                relatedChunks: [],
                embeddingDimensions: embedding.length,
                embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || '',
                analysisModel: process.env.OLLAMA_TEXT_MODEL || '',
                status: 'ready',
                embedding,
              };

              analyzedChunks.push(enrichedChunk);
              sendEvent({
                type: 'chunk',
                chunk: { ...enrichedChunk, relatedChunks: [] },
                documentId,
                chunkCount: chunks.length,
                totalCharCount: parsedText.length,
                parsedTextPreview,
                previewKind,
                progress: { current: index + 1, total: chunks.length },
              });
              pushStep(`Chunk ${index + 1} 已完成摘要、關鍵詞與 embedding。`);
            } catch (error) {
              const fallbackChunk: EnrichedChunk = {
                id: buildChunkId(documentId, index),
                index,
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
                embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || '',
                analysisModel: process.env.OLLAMA_TEXT_MODEL || '',
                status: 'error',
                errorMessage: getErrorMessage(error),
              };

              analyzedChunks.push(fallbackChunk);
              sendEvent({
                type: 'chunk',
                chunk: fallbackChunk,
                documentId,
                chunkCount: chunks.length,
                totalCharCount: parsedText.length,
                parsedTextPreview,
                previewKind,
                progress: { current: index + 1, total: chunks.length },
              });
              pushStep(`Chunk ${index + 1} 分析失敗，已保留 fallback 摘要：${fallbackChunk.errorMessage}`);
            }
          }

          pushStep('根據 embedding 建立 chunk 之間的語意關聯。');
          const chunksWithRelations = attachChunkRelations(analyzedChunks);
          const summary = await buildDocumentSummary(aiProvider, file.name, chunksWithRelations, globalContext);
          const processingDurationMs = Date.now() - requestStartedAt;
          let dbWritten = false;

          const result: StreamedDocumentResult = {
            filename: file.name,
            status: 'processed',
            processSteps,
            type: 'document',
            previewKind,
            documentId,
            chunkCount: chunks.length,
            totalCharCount: parsedText.length,
            processingDurationMs,
            summary,
            parsedTextPreview,
            chunkAnalyses: chunksWithRelations.map(stripChunkEmbedding),
            contextApplied,
            dbWritten: false,
          };

          if (dbWriteEnabled && dbConfigured) {
            pushStep('準備將文件與 chunk 分析結果寫入 Supabase。');
            try {
              await persistDocumentResult({
                fileName: file.name,
                previewKind,
                result,
                chunkAnalyses: chunksWithRelations,
              });
              dbWritten = true;
              pushStep('文件與 chunk 分析結果已寫入 Supabase。');
            } catch (error) {
              pushStep(`文件結果寫入 Supabase 失敗：${getErrorMessage(error)}`);
            }
          }

          result.dbWritten = dbWritten;
          sendEvent({ type: 'result', result });
        } catch (error) {
          sendEvent({ type: 'error', error: getErrorMessage(error) });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (error) {
    console.error('Ingest API Error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
