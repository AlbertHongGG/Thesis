import { NextResponse } from 'next/server';
import type { KnowledgeBaseMaintenanceAction } from '@/domain/operations/types';
import { assertDatabaseWriteEnabled, createServerApp } from '@/composition/server/createServerApp';

export const runtime = 'nodejs';

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
    assertDatabaseWriteEnabled();
    const app = createServerApp();
    const { knowledgeBaseId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action as KnowledgeBaseMaintenanceAction : null;

    if (!action || (action !== 'rebuild-profile' && action !== 'reindex')) {
      return NextResponse.json({ error: 'Valid maintenance action is required' }, { status: 400 });
    }

    const result = action === 'reindex'
      ? await app.knowledgeBaseService.reindex(knowledgeBaseId)
      : await app.knowledgeBaseService.rebuildProfile(knowledgeBaseId);

    return NextResponse.json({ result });
  } catch (error) {
    const message = getErrorMessage(error);
    const status = message === 'Knowledge base not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}