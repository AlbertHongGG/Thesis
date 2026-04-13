import { NextResponse } from 'next/server';
import { createAiRuntimeFromConfig } from '@/ai';
import { loadIngestFeatureConfig } from '@/features/ingest/config';
import { encodeStreamEvent } from '@/features/ingest/contracts';
import { SupabaseIngestRepository } from '@/features/ingest/SupabaseIngestRepository';
import { IngestWorkflow } from '@/features/ingest/workflow';
import { supabaseAdmin } from '@/lib/supabase';
import { getPreviewKind } from '@/lib/workbench/filePreview';

export const runtime = 'nodejs';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function createRepository() {
  const dbWriteEnabled = process.env.ENABLE_DB_WRITE === 'true';
  const dbConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE);

  if (!dbWriteEnabled || !dbConfigured) {
    return undefined;
  }

  return new SupabaseIngestRepository(supabaseAdmin);
}

export async function POST(req: Request) {
  try {
    const featureConfig = loadIngestFeatureConfig();
    const formData = await req.formData();
    const file = formData.get('file');
    const globalContextValue = formData.get('globalContext');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const globalContext = typeof globalContextValue === 'string' ? globalContextValue : '';
    const previewKind = getPreviewKind(file.name);
    const workflow = new IngestWorkflow({
      runtime: createAiRuntimeFromConfig(featureConfig.runtime),
      prompts: featureConfig.prompts,
      repository: createRepository(),
    });
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: Parameters<typeof encodeStreamEvent>[0]) => {
          controller.enqueue(encoder.encode(encodeStreamEvent(event)));
        };

        try {
          const result = await workflow.run(
            {
              file,
              globalContext,
              previewKind,
            },
            send,
          );

          send({ type: 'result', result });
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
