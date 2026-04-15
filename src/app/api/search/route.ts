import { NextResponse } from 'next/server';
import { createServerApp } from '@/modules/shared/server/createServerApp';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, knowledgeBaseId, limit = 5 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Valid query string is required' }, { status: 400 });
    }

    if (!knowledgeBaseId || typeof knowledgeBaseId !== 'string') {
      return NextResponse.json({ error: 'knowledgeBaseId is required' }, { status: 400 });
    }

    const app = createServerApp();
    const results = await app.searchService.search(knowledgeBaseId, query, limit);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[API/Search] Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
