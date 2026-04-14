import { NextResponse } from 'next/server';
import { createAiRuntimeFromConfig } from '@/ai';
import { loadIngestFeatureConfig } from '@/features/ingest/config';
import { encodeStreamEvent } from '@/features/ingest/contracts';
import { SupabaseIngestRepository } from '@/features/ingest/SupabaseIngestRepository';
import {
  DEFAULT_KNOWLEDGE_BASE_NAME,
  DEFAULT_KNOWLEDGE_BASE_SLUG,
  type KnowledgeBaseRecord,
} from '@/features/ingest/knowledge';
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

function createFallbackKnowledgeBase(id?: string): KnowledgeBaseRecord {
  return {
    id: id || '00000000-0000-0000-0000-000000000001',
    slug: DEFAULT_KNOWLEDGE_BASE_SLUG,
    name: DEFAULT_KNOWLEDGE_BASE_NAME,
    status: 'active',
    sourceCount: 0,
    chunkCount: 0,
    profileVersion: 0,
  };
}

export async function POST(req: Request) {
  try {
    const featureConfig = loadIngestFeatureConfig();
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
    const repository = createRepository();
    const knowledgeBase = repository
      ? await repository.ensureKnowledgeBase({ id: knowledgeBaseId || undefined })
      : createFallbackKnowledgeBase(knowledgeBaseId || undefined);
    const workflow = new IngestWorkflow({
      runtime: createAiRuntimeFromConfig(featureConfig.runtime),
      prompts: featureConfig.prompts,
      repository,
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
              filePath,
              previewKind,
              knowledgeBase,
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
