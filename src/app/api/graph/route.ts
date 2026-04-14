import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

function cosineSimilarity(left: number[], right: number[]) {
  if (!left || !right || left.length === 0 || right.length === 0 || left.length !== right.length) return 0;
  let dot = 0, leftNorm = 0, rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

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

    // Fetch chunks with status ready including embeddings
    const { data: chunks, error: chunkError } = await supabaseAdmin
      .from('rag_document_chunks')
      .select('id, document_id, content, keywords, summary, related_chunks, embedding')
      .eq('knowledge_base_id', kbId)
      .eq('status', 'ready');

    if (chunkError) throw chunkError;

    const nodes: any[] = [];
    const links: any[] = [];

    // Document and Folder nodes
    const folders = new Set<string>();

    for (const doc of documents || []) {
      const parts = doc.filename.split('/');
      let currentPath = '';

      // Build folder hierarchy if the file has path information
      if (parts.length > 1) {
        for (let i = 0; i < parts.length - 1; i++) {
          const prevPath = currentPath;
          currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
          
          if (!folders.has(currentPath)) {
            folders.add(currentPath);
            nodes.push({
              id: `folder:${currentPath}`,
              name: parts[i], 
              group: 'folder',
              val: 12,
              type: 'folder',
            });
            
            if (prevPath) {
               links.push({
                 source: `folder:${prevPath}`,
                 target: `folder:${currentPath}`,
                 type: 'hierarchy',
               });
            }
          }
        }
        
        // Link the final folder to the document
        links.push({
          source: `folder:${currentPath}`,
          target: doc.id,
          type: 'hierarchy',
        });
      }

      nodes.push({
        id: doc.id,
        name: doc.filename, // Display the full path for disambiguation
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

      // Link chunk to related chunks (internal to the document, computed at ingest)
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

    // Parse embeddings for dynamic cross-document relations
    const chunksWithEmbeddings = (chunks || []).map(chunk => {
      let parsed = null;
      if (chunk.embedding) {
        try {
          parsed = typeof chunk.embedding === 'string' ? JSON.parse(chunk.embedding) : chunk.embedding;
        } catch (e) {
           // ignore
        }
      }
      return { ...chunk, parsedEmbedding: parsed };
    });

    const MIN_CROSS_RELATION_SCORE = 0.35; // slightly strictly threshold across docs
    const MAX_CROSS_LINKS = 2; // Prevent excessive graph density

    // Compute cross-document Links
    for (let i = 0; i < chunksWithEmbeddings.length; i++) {
      const source = chunksWithEmbeddings[i];
      if (!source.parsedEmbedding) continue;

      const candidates = [];
      for (let j = 0; j < chunksWithEmbeddings.length; j++) {
        const target = chunksWithEmbeddings[j];
        // Only evaluate chunks that belong to DIFFERENT documents
        if (source.document_id !== target.document_id && target.parsedEmbedding) {
          const score = cosineSimilarity(source.parsedEmbedding, target.parsedEmbedding);
          if (score >= MIN_CROSS_RELATION_SCORE) {
             candidates.push({ targetId: target.id, score });
          }
        }
      }

      // Sort matches and keep top N
      candidates.sort((a, b) => b.score - a.score);
      const topMatches = candidates.slice(0, MAX_CROSS_LINKS);

      for (const match of topMatches) {
        links.push({
          source: source.id,
          target: match.targetId,
          type: 'related',
          score: match.score,
        });
      }
    }

    return NextResponse.json({ nodes, links });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const kbId = url.searchParams.get('kbId');
    const documentId = url.searchParams.get('documentId');
    const folderPath = url.searchParams.get('folderPath');
    const deleteAll = url.searchParams.get('deleteAll') === 'true';

    if (!kbId) {
      return NextResponse.json({ error: 'kbId is required' }, { status: 400 });
    }

    if (deleteAll) {
      const { error } = await supabaseAdmin.from('rag_documents').delete().eq('knowledge_base_id', kbId);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'All documents deleted.' });
    }

    if (folderPath) {
      // Use like operator to delete anything under that logical folder path
      // Note: The % wildcard ensures anything matching folderPath/ gets captured
      const { error } = await supabaseAdmin
        .from('rag_documents')
        .delete()
        .eq('knowledge_base_id', kbId)
        .like('filename', `${folderPath}/%`);
      if (error) throw error;
      return NextResponse.json({ success: true, message: `Folder ${folderPath} deleted.` });
    }

    if (documentId) {
      const { error } = await supabaseAdmin.from('rag_documents').delete().eq('id', documentId);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Document deleted.' });
    }

    return NextResponse.json({ error: 'No valid deletion target provided.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
