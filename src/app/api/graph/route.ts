import { NextResponse } from 'next/server';
import { assertDatabaseWriteEnabled, createServerApp } from '@/composition/server/createServerApp';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const app = createServerApp();
    const url = new URL(req.url);
    const kbId = url.searchParams.get('kbId');

    if (!kbId) {
      return NextResponse.json({ error: 'kbId is required' }, { status: 400 });
    }

    const graph = await app.graphService.getGraph(kbId);

    return NextResponse.json(graph);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    assertDatabaseWriteEnabled();
    const app = createServerApp();
    const url = new URL(req.url);
    const kbId = url.searchParams.get('kbId');
    const documentId = url.searchParams.get('documentId');
    const folderPath = url.searchParams.get('folderPath');
    const deleteAll = url.searchParams.get('deleteAll') === 'true';

    if (!kbId) {
      return NextResponse.json({ error: 'kbId is required' }, { status: 400 });
    }

    const result = await app.graphService.deleteGraphTarget({
      knowledgeBaseId: kbId,
      documentId: documentId ?? undefined,
      folderPath: folderPath ?? undefined,
      deleteAll,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === 'No valid deletion target provided.' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
