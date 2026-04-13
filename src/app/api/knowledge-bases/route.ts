import { NextResponse } from 'next/server';
import { SupabaseIngestRepository } from '@/features/ingest/SupabaseIngestRepository';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

function getRepository() {
  const dbWriteEnabled = process.env.ENABLE_DB_WRITE === 'true';
  const dbConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE);

  if (!dbWriteEnabled || !dbConfigured) {
    throw new Error('Knowledge base management requires ENABLE_DB_WRITE and Supabase credentials.');
  }

  return new SupabaseIngestRepository(supabaseAdmin);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function GET() {
  try {
    const repository = getRepository();
    const knowledgeBases = await repository.listKnowledgeBases();
    return NextResponse.json({ knowledgeBases });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const repository = getRepository();
    const body = await req.json().catch(() => ({}));
    const knowledgeBase = await repository.ensureKnowledgeBase({
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
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Knowledge base id is required' }, { status: 400 });
    }

    const repository = getRepository();
    await repository.deleteKnowledgeBase(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}