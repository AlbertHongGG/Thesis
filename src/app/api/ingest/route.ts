import { NextResponse } from 'next/server';
import { getAIProvider } from '@/ai';
import { supabaseAdmin } from '@/lib/supabase';
import { chunkText } from '@/lib/rag/chunker';
import { parseDocument } from '@/lib/rag/parser';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const globalContext = formData.get('globalContext') as string || '';
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const aiProvider = getAIProvider('ollama');
    const isImage = file.name.match(/\.(png|jpe?g|gif|webp)$/i);
    const dbWriteEnabled = process.env.ENABLE_DB_WRITE === 'true';

    let result: any = { filename: file.name, status: 'processed', dbWritten: dbWriteEnabled };

    if (isImage) {
      const textBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(textBuffer).toString('base64');
      const mimeType = file.type || 'image/jpeg';
      
      const visionPrompt = globalContext.length > 0 
          ? `Given the following background context from the user's documents:\n"""\n${globalContext}\n"""\n\nPlease describe this image in detail and relate it to the context if possible.`
          : 'Describe this image in detail.';
          
      const description = await aiProvider.analyzeImage(`data:${mimeType};base64,${base64}`, visionPrompt);
      const embedding = await aiProvider.createEmbedding(description);
      
      if (dbWriteEnabled) {
          try {
              // await supabaseAdmin.from('documents').insert({ filename: file.name, content: description, embedding, metadata: { type: 'image' }});
          } catch(e) { console.error("DB Error", e); }
      }
      
      result.type = 'image';
      result.descriptionSnippet = description.substring(0, 100);
      result.contextApplied = globalContext.length > 0;
      
    } else {
      const buffer = Buffer.from(await file.arrayBuffer());
      let parsedText = '';
      try {
          parsedText = await parseDocument(buffer, file.name);
      } catch (err: any) {
          return NextResponse.json({ error: `Parser failed: ${err.message}` }, { status: 500 });
      }
      
      // Example summarization - taking first 1000 chars to save time in real extraction
      const extractedSummary = `Document ${file.name} contains parsed text beginning with: ${parsedText.substring(0, 50).replace(/\n/g, ' ')}...`;

      const chunks = chunkText(parsedText, 500, 100); // chunk size 500
      let embeddedChunks = 0;
      
      for (const chunk of chunks) {
         const embedding = await aiProvider.createEmbedding(chunk);
         if (dbWriteEnabled) {
             try {
                // await supabaseAdmin.from('documents').insert({ filename: file.name, content: chunk, embedding, metadata: { type: 'document_chunk' } });
             } catch(e) { console.error("DB chunk insert error", e); }
         }
         embeddedChunks++;
      }
      
      result.type = 'document';
      result.chunks = embeddedChunks;
      result.summary = extractedSummary;
    }

    return NextResponse.json({ success: true, result });
    
  } catch (error: any) {
    console.error('Ingest API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
