export type TextChunk = {
  index: number;
  text: string;
  startOffset: number;
  endOffset: number;
  wordCount: number;
};

type TextSegment = {
  text: string;
  startOffset: number;
  endOffset: number;
  wordCount: number;
};

function countWords(text: string) {
  const normalized = text.trim();

  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/).length;
}

function normalizeText(text: string) {
  return text.replace(/\r\n?/g, '\n').trim();
}

function splitLongSegment(segment: TextSegment, maxWords: number): TextSegment[] {
  if (segment.wordCount <= maxWords) {
    return [segment];
  }

  const words = segment.text.trim().split(/\s+/);
  const chunks: TextSegment[] = [];
  let localOffset = 0;

  for (let index = 0; index < words.length; index += maxWords) {
    const slice = words.slice(index, index + maxWords).join(' ');
    const startInSegment = segment.text.indexOf(slice, localOffset);
    const safeStart = startInSegment === -1 ? localOffset : startInSegment;
    const safeEnd = safeStart + slice.length;

    chunks.push({
      text: slice,
      startOffset: segment.startOffset + safeStart,
      endOffset: segment.startOffset + safeEnd,
      wordCount: countWords(slice),
    });

    localOffset = safeEnd;
  }

  return chunks;
}

function collectSentenceSegments(text: string, baseOffset: number): TextSegment[] {
  const matches = Array.from(text.matchAll(/[^.!?。！？；;\n]+(?:[.!?。！？；;]+|\n+|$)/g));
  const rawSegments = matches.length > 0
    ? matches.map(match => ({
        text: match[0].trim(),
        startOffset: baseOffset + (match.index ?? 0),
      }))
    : [{ text: text.trim(), startOffset: baseOffset }];

  return rawSegments
    .filter(segment => segment.text.length > 0)
    .flatMap(segment => splitLongSegment({
      text: segment.text,
      startOffset: segment.startOffset,
      endOffset: segment.startOffset + segment.text.length,
      wordCount: countWords(segment.text),
    }, 180));
}

function buildSegments(text: string): TextSegment[] {
  const normalized = normalizeText(text);

  if (!normalized) {
    return [];
  }

  const paragraphs = Array.from(normalized.matchAll(/[\s\S]+?(?:\n\s*\n|$)/g));
  const segments: TextSegment[] = [];

  for (const paragraph of paragraphs) {
    const rawParagraph = paragraph[0].trim();

    if (!rawParagraph) {
      continue;
    }

    const paragraphStart = (paragraph.index ?? 0) + paragraph[0].indexOf(rawParagraph);
    const paragraphWordCount = countWords(rawParagraph);

    if (paragraphWordCount <= 180) {
      segments.push({
        text: rawParagraph,
        startOffset: paragraphStart,
        endOffset: paragraphStart + rawParagraph.length,
        wordCount: paragraphWordCount,
      });
      continue;
    }

    segments.push(...collectSentenceSegments(rawParagraph, paragraphStart));
  }

  return segments;
}

function createChunk(index: number, segments: TextSegment[]): TextChunk {
  const text = segments.map(segment => segment.text).join('\n\n').trim();
  const startOffset = segments[0]?.startOffset ?? 0;
  const endOffset = segments[segments.length - 1]?.endOffset ?? startOffset;

  return {
    index,
    text,
    startOffset,
    endOffset,
    wordCount: countWords(text),
  };
}

export function chunkText(text: string, chunkSize = 1000, overlap = 200): TextChunk[] {
  const segments = buildSegments(text);

  if (segments.length === 0) {
    return [];
  }

  const chunks: TextChunk[] = [];
  let startIndex = 0;

  while (startIndex < segments.length) {
    let endIndex = startIndex;
    let wordTotal = 0;

    while (endIndex < segments.length) {
      const nextWordTotal = wordTotal + segments[endIndex].wordCount;

      if (wordTotal > 0 && nextWordTotal > chunkSize) {
        break;
      }

      wordTotal = nextWordTotal;
      endIndex += 1;
    }

    const currentSegments = segments.slice(startIndex, endIndex);

    if (currentSegments.length === 0) {
      startIndex += 1;
      continue;
    }

    chunks.push(createChunk(chunks.length, currentSegments));

    if (endIndex >= segments.length) {
      break;
    }

    let overlapWords = 0;
    let nextStartIndex = endIndex;

    for (let cursor = endIndex - 1; cursor >= startIndex; cursor -= 1) {
      overlapWords += segments[cursor].wordCount;
      nextStartIndex = cursor;

      if (overlapWords >= overlap) {
        break;
      }
    }

    startIndex = nextStartIndex <= startIndex ? startIndex + 1 : nextStartIndex;
  }

  return chunks;
}
