export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  // Enhanced naive word-based chunker for quick extraction
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  
  if (words.length <= chunkSize) {
    return [text];
  }
  
  const step = chunkSize - overlap;
  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
  }
  
  return chunks;
}
