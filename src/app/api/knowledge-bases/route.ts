import { NextResponse } from 'next/server';
import { assertDatabaseWriteEnabled, createServerApp } from '@/modules/shared/server/createServerApp';

export const runtime = 'nodejs';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  return String(error);
}

export async function GET() {
  try {
    const app = createServerApp();
    const knowledgeBases = await app.knowledgeBaseService.listKnowledgeBases();
    return NextResponse.json({ knowledgeBases });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    assertDatabaseWriteEnabled();
    const app = createServerApp();
    const body = await req.json().catch(() => ({}));
    const knowledgeBase = await app.knowledgeBaseService.ensureKnowledgeBase({
      id: typeof body.id === 'string' ? body.id : undefined,
      slug: typeof body.slug === 'string' ? body.slug : undefined,
      name: typeof body.name === 'string' ? body.name : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
    });

    return NextResponse.json({ knowledgeBase }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    assertDatabaseWriteEnabled();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Knowledge base id is required' }, { status: 400 });
    }

    const app = createServerApp();
    await app.knowledgeBaseService.deleteKnowledgeBase(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}