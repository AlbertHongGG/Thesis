export function extractJsonObject(rawText: string) {
  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? rawText;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Chunk analysis did not return JSON.');
  }

  return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
}

export function normalizeKeywords(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map(keyword => (typeof keyword === 'string' ? keyword.trim() : ''))
    .filter(Boolean)
    .slice(0, 8);
}