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
    const { data: sources, error: sourceError } = await supabaseAdmin
      .from('rag_sources')
      .select('id, title, canonical_path, source_type, meta')
      .eq('knowledge_base_id', kbId);

    if (sourceError) throw sourceError;

    // Fetch units with status ready including embeddings
    const { data: units, error: unitError } = await supabaseAdmin
      .from('rag_units')
      .select('id, source_id, unit_type, content, related_units, embedding, meta')
      .eq('knowledge_base_id', kbId)
      .eq('status', 'ready');

    if (unitError) throw unitError;

    const nodes: any[] = [];
    const links: any[] = [];

    // Document and Folder nodes
    const folders = new Set<string>();

    for (const source of sources || []) {
      const parts = (source.canonical_path || source.title).split('/');
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
          target: source.id,
          type: 'hierarchy',
        });
      }

      const sourceMeta = source.meta && typeof source.meta === 'object' ? source.meta : {};

      nodes.push({
        id: source.id,
        name: source.title,
        fullName: source.canonical_path,
        summary: typeof sourceMeta.summary === 'string' ? sourceMeta.summary : '',
        terms: Array.isArray(sourceMeta.terms) ? sourceMeta.terms : [],
        entities: Array.isArray(sourceMeta.entities) ? sourceMeta.entities : [],
        group: source.id,
        val: 8,
        type: 'source',
        sourceType: source.source_type,
      });
    }

    // Unit nodes and links
    for (const unit of units || []) {
      const unitMeta = unit.meta && typeof unit.meta === 'object' ? unit.meta : {};
      nodes.push({
        id: unit.id,
        name: typeof unitMeta.summary === 'string' ? unitMeta.summary : unit.content.substring(0, 30) + '...',
        summary: typeof unitMeta.summary === 'string' ? unitMeta.summary : '',
        content: unit.content,
        terms: Array.isArray(unitMeta.terms) ? unitMeta.terms : [],
        entities: Array.isArray(unitMeta.entities) ? unitMeta.entities : [],
        unitType: unit.unit_type,
        group: unit.source_id,
        val: 3,
        type: 'unit',
      });

      // Link unit to its parent source
      links.push({
        source: unit.source_id,
        target: unit.id,
        type: 'child',
        label: 'contains',
      });

      // Link unit to related units (computed at ingest)
      const related = unit.related_units || [];
      for (const rel of related) {
        if (rel.unitId && rel.score) {
          links.push({
            source: unit.id,
            target: rel.unitId,
            type: 'related',
            score: rel.score,
          });
        }
      }
    }

    // Parse embeddings for dynamic cross-document relations
    const unitsWithEmbeddings = (units || []).map(unit => {
      let parsed = null;
      if (unit.embedding) {
        try {
          parsed = typeof unit.embedding === 'string' ? JSON.parse(unit.embedding) : unit.embedding;
        } catch (e) {
           // ignore
        }
      }
      return { ...unit, parsedEmbedding: parsed };
    });

    const MIN_CROSS_RELATION_SCORE = 0.35; // slightly strictly threshold across docs
    const MAX_CROSS_LINKS = 2; // Prevent excessive graph density

    // Compute cross-document Links
    for (let i = 0; i < unitsWithEmbeddings.length; i++) {
      const source = unitsWithEmbeddings[i];
      if (!source.parsedEmbedding) continue;

      const candidates = [];
      for (let j = 0; j < unitsWithEmbeddings.length; j++) {
        const target = unitsWithEmbeddings[j];
        // Only evaluate units that belong to DIFFERENT sources
        if (source.source_id !== target.source_id && target.parsedEmbedding) {
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
      const { error } = await supabaseAdmin.from('rag_sources').delete().eq('knowledge_base_id', kbId);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'All documents deleted.' });
    }

    if (folderPath) {
      // Use like operator to delete anything under that logical folder path
      // Note: The % wildcard ensures anything matching folderPath/ gets captured
      const { error } = await supabaseAdmin
        .from('rag_sources')
        .delete()
        .eq('knowledge_base_id', kbId)
        .like('canonical_path', `${folderPath}/%`);
      if (error) throw error;
      return NextResponse.json({ success: true, message: `Folder ${folderPath} deleted.` });
    }

    if (documentId) {
      const { error } = await supabaseAdmin.from('rag_sources').delete().eq('id', documentId);
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Document deleted.' });
    }

    return NextResponse.json({ error: 'No valid deletion target provided.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
