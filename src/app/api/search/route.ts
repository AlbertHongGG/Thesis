import { NextResponse } from 'next/server';
import { SearchService } from '@/features/search/SearchService';

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

    const searchService = new SearchService();
    const results = await searchService.search(knowledgeBaseId, query, limit);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[API/Search] Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
