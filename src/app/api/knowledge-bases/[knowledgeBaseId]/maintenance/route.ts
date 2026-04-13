import { NextResponse } from 'next/server';
import { createAiRuntimeFromConfig } from '@/ai';
import { loadIngestFeatureConfig } from '@/features/ingest/config';
import type { KnowledgeBaseMaintenanceAction } from '@/features/ingest/knowledge';
import { SupabaseIngestRepository } from '@/features/ingest/SupabaseIngestRepository';
import { KnowledgeProfileService } from '@/features/ingest/services/KnowledgeProfileService';
import { KnowledgeMaintenanceService } from '@/features/ingest/services/KnowledgeMaintenanceService';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

function getRepository() {
  const dbWriteEnabled = process.env.ENABLE_DB_WRITE === 'true';
  const dbConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE);

  if (!dbWriteEnabled || !dbConfigured) {
    throw new Error('Knowledge base maintenance requires ENABLE_DB_WRITE and Supabase credentials.');
  }

  return new SupabaseIngestRepository(supabaseAdmin);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ knowledgeBaseId: string }> },
) {
  try {
    const { knowledgeBaseId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action as KnowledgeBaseMaintenanceAction : null;

    if (!action || (action !== 'rebuild-profile' && action !== 'reindex')) {
      return NextResponse.json({ error: 'Valid maintenance action is required' }, { status: 400 });
    }

    const repository = getRepository();
    const knowledgeBase = await repository.getKnowledgeBase(knowledgeBaseId);

    if (!knowledgeBase) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
    }

    const featureConfig = loadIngestFeatureConfig();
    const runtimeClient = createAiRuntimeFromConfig(featureConfig.runtime);
    const profileService = new KnowledgeProfileService(runtimeClient, featureConfig.prompts.knowledgeProfile);
    const maintenanceService = new KnowledgeMaintenanceService(runtimeClient, repository, profileService);

    const result = action === 'reindex'
      ? await maintenanceService.reindex(knowledgeBase)
      : await maintenanceService.rebuildProfile(knowledgeBase);

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}