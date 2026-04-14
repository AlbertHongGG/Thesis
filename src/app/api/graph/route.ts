import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const kbId = url.searchParams.get('kbId');

    if (!kbId) {
      return NextResponse.json({ error: 'kbId is required' }, { status: 400 });
    }

    // Fetch documents
    const { data: documents, error: docError } = await supabaseAdmin
      .from('rag_documents')
      .select('id, filename, summary, source_type')
      .eq('knowledge_base_id', kbId);

    if (docError) throw docError;

    // Fetch chunks with status ready
    const { data: chunks, error: chunkError } = await supabaseAdmin
      .from('rag_document_chunks')
      .select('id, document_id, content, keywords, summary, related_chunks')
      .eq('knowledge_base_id', kbId)
      .eq('status', 'ready');

    if (chunkError) throw chunkError;

    const nodes: any[] = [];
    const links: any[] = [];

    // Document nodes
    for (const doc of documents || []) {
      nodes.push({
        id: doc.id,
        name: doc.filename,
        summary: doc.summary || '',
        group: doc.id,
        val: 8,
        type: 'document',
        sourceType: doc.source_type,
      });
    }

    // Chunk nodes and links
    for (const chunk of chunks || []) {
      nodes.push({
        id: chunk.id,
        name: chunk.summary || chunk.content.substring(0, 30) + '...',
        content: chunk.content,
        keywords: chunk.keywords || [],
        group: chunk.document_id,
        val: 3,
        type: 'chunk',
      });

      // Link chunk to its parent document
      links.push({
        source: chunk.document_id,
        target: chunk.id,
        type: 'child',
        label: 'contains',
      });

      // Link chunk to related chunks
      const related = chunk.related_chunks || [];
      for (const rel of related) {
        if (rel.chunkId && rel.score) {
          links.push({
            source: chunk.id,
            target: rel.chunkId,
            type: 'related',
            score: rel.score,
          });
        }
      }
    }

    return NextResponse.json({ nodes, links });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
