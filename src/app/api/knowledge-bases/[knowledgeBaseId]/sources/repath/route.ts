import { NextResponse } from 'next/server';
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
    const body = await req.json().catch(() => ({})) as { items?: unknown };
    const items = Array.isArray(body.items)
      ? body.items.filter((item: unknown): item is { sourceId: string; canonicalPath: string } => {
          if (!item || typeof item !== 'object') {
            return false;
          }

          const candidate = item as { sourceId?: unknown; canonicalPath?: unknown };
          return typeof candidate.sourceId === 'string'
            && candidate.sourceId.trim().length > 0
            && typeof candidate.canonicalPath === 'string'
            && candidate.canonicalPath.trim().length > 0;
        })
      : [];

    if (items.length === 0) {
      return NextResponse.json({ error: 'At least one valid repath item is required' }, { status: 400 });
    }

    const result = await app.knowledgeBaseService.repathSources({
      knowledgeBaseId,
      items,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = getErrorMessage(error);
    const status = message === 'Knowledge base not found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
