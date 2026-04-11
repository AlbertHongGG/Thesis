import { NextResponse } from 'next/server';
import { getAIProvider } from '@/ai';
import { chunkText } from '@/lib/rag/chunker';
import { parseDocument } from '@/lib/rag/parser';
import type { IngestResult, PreviewChunk, PreviewKind } from '@/lib/workbench/types';

type ProcessStep = {
  message: string;
};

type StreamedIngestResult = IngestResult & {
  filename: string;
  status: 'processed';
  dbWritten: boolean;
  processSteps: ProcessStep[];
};

type StreamEvent =
  | { type: 'step'; message: string }
  | { type: 'result'; result: IngestResult }
  | { type: 'error'; error: string };

function buildPreview(text: string, maxLength = 80) {
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function buildParsedPreview(text: string, maxLength = 4000) {
  const normalized = text.trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}\n\n...已截斷，僅保留前 ${maxLength.toLocaleString('zh-TW')} 個字元。`;
}

function buildChunkPreviews(chunks: string[], maxChunks = 5): PreviewChunk[] {
  return chunks.slice(0, maxChunks).map((chunk, index) => ({
    index,
    preview: buildPreview(chunk, 180),
    charCount: chunk.length,
  }));
}

function getPreviewKind(filename: string): PreviewKind {
  if (filename.match(/\.(png|jpe?g|gif|webp|svg)$/i)) return 'image';
  if (filename.match(/\.(txt|csv|md|json)$/i)) return 'text';
  if (filename.match(/\.(pdf|docx)$/i)) return 'parsed-text';
  return 'unsupported';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const globalContext = formData.get('globalContext') as string || '';
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const aiProvider = getAIProvider('ollama');
    const isImage = file.name.match(/\.(png|jpe?g|gif|webp)$/i);
    const dbWriteEnabled = process.env.ENABLE_DB_WRITE === 'true';

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const processSteps: ProcessStep[] = [];
        const result: StreamedIngestResult = {
          filename: file.name,
          status: 'processed',
          dbWritten: dbWriteEnabled,
          processSteps,
          type: isImage ? 'image' : 'document',
          previewKind: getPreviewKind(file.name),
        };

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
            pushStep(`圖片已轉成 base64，MIME 類型為 ${mimeType}。`);

            const visionPrompt = globalContext.length > 0
              ? `Given the following background context from the user's documents:\n"""\n${globalContext}\n"""\n\nPlease describe this image in detail and relate it to the context if possible.`
              : 'Describe this image in detail.';
            pushStep(globalContext.length > 0 ? '套用前面文件摘要當作圖片分析上下文。' : '沒有文件上下文，直接做圖片分析。');
            pushStep('已送出到 Ollama 視覺模型，等待圖片分析結果。');

            const description = await aiProvider.analyzeImage(`data:${mimeType};base64,${base64}`, visionPrompt);
            pushStep('圖片分析完成，已取得詳細描述。');
            pushStep('開始將圖片分析描述轉成向量。');

            const embedding = await aiProvider.createEmbedding(description);
            pushStep(`圖片描述已向量化，向量維度 ${embedding.length}。`);

            if (dbWriteEnabled) {
              pushStep('資料庫寫入已啟用，準備寫入圖片分析結果。');
              try {
                // await supabaseAdmin.from('documents').insert({ filename: file.name, content: description, embedding, metadata: { type: 'image' }});
              } catch (error) {
                console.error('DB Error', error);
              }
            }

            result.type = 'image';
            result.descriptionSnippet = buildPreview(description, 100);
            result.description = description;
            result.contextApplied = globalContext.length > 0;
          } else {
            pushStep('讀取文件檔案內容。');
            const buffer = Buffer.from(await file.arrayBuffer());
            let parsedText = '';
            try {
              parsedText = await parseDocument(buffer, file.name);
            } catch (error) {
              throw new Error(`Parser failed: ${getErrorMessage(error)}`);
            }

            pushStep(`文件解析完成，抽出 ${parsedText.length} 個字元。`);

            const extractedSummary = `Document ${file.name} contains parsed text beginning with: ${parsedText.substring(0, 50).replace(/\n/g, ' ')}...`;
            const chunks = chunkText(parsedText, 500, 100);
            pushStep(`文件已切成 ${chunks.length} 個 chunks（size=500, overlap=100）。`);

            let embeddedChunks = 0;

            for (const [index, chunk] of chunks.entries()) {
              pushStep(`正在向量化第 ${index + 1}/${chunks.length} 個 chunk：${buildPreview(chunk, 60)}...`);
              const embedding = await aiProvider.createEmbedding(chunk);
              pushStep(`第 ${index + 1} 個 chunk 向量完成，維度 ${embedding.length}。`);

              if (dbWriteEnabled) {
                pushStep(`第 ${index + 1} 個 chunk 準備寫入資料庫。`);
                try {
                  // await supabaseAdmin.from('documents').insert({ filename: file.name, content: chunk, embedding, metadata: { type: 'document_chunk' } });
                } catch (error) {
                  console.error('DB chunk insert error', error);
                }
              }

              embeddedChunks++;
            }

            pushStep(`文件向量化完成，共產生 ${embeddedChunks} 個 chunks。`);
            pushStep(`文件摘要：${buildPreview(extractedSummary, 100)}...`);

            result.type = 'document';
            result.chunks = embeddedChunks;
            result.summary = extractedSummary;
            result.parsedTextPreview = buildParsedPreview(parsedText);
            result.chunkPreviews = buildChunkPreviews(chunks);
          }

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
