import { NextResponse } from 'next/server';
import { encodeStreamEvent } from '@/features/ingest/contracts';
import { getPreviewKind } from '@/lib/workbench/filePreview';
import { createServerApp, assertDatabaseWriteEnabled } from '@/composition/server/createServerApp';
import { toIngestResultDto, toIngestUnitProgressDto } from '@/composition/server/dtoMappers';

export const runtime = 'nodejs';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function POST(req: Request) {
  try {
    assertDatabaseWriteEnabled();
    const app = createServerApp();
    const formData = await req.formData();
    const file = formData.get('file');
    const knowledgeBaseValue = formData.get('knowledgeBaseId');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const knowledgeBaseId = typeof knowledgeBaseValue === 'string' ? knowledgeBaseValue : '';
    const filePathValue = formData.get('filePath');
    const filePath = typeof filePathValue === 'string' ? filePathValue : undefined;
    const previewKind = getPreviewKind(file.name);
    const knowledgeBase = await app.knowledgeBaseService.ensureKnowledgeBase({ id: knowledgeBaseId || undefined });
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: Parameters<typeof encodeStreamEvent>[0]) => {
          controller.enqueue(encoder.encode(encodeStreamEvent(event)));
        };

        try {
          const result = await app.ingestService.ingest(
            {
              file,
              filePath,
              previewKind,
              knowledgeBase,
            },
            {
              step(message) {
                send({ type: 'step', message });
              },
              unit(payload) {
                send(toIngestUnitProgressDto(payload));
              },
            },
          );

          send({ type: 'result', result: toIngestResultDto(result) });
        } catch (error) {
          send({ type: 'error', error: getErrorMessage(error) });
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
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
