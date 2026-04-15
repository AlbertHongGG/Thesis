export const DEFAULT_KNOWLEDGE_BASE_ID = '00000000-0000-0000-0000-000000000001';
export const DEFAULT_KNOWLEDGE_BASE_NAME = 'Thesis Research';
export const DEFAULT_KNOWLEDGE_BASE_SLUG = 'thesis-research';

export function slugifyKnowledgeBaseName(name: string) {
  const normalized = name.trim().toLowerCase();

  if (!normalized) {
    return DEFAULT_KNOWLEDGE_BASE_SLUG;
  }

  const slug = normalized
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/[-\s]+/g, '-');

  return slug || DEFAULT_KNOWLEDGE_BASE_SLUG;
}

export function uniqueStrings(values: string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}