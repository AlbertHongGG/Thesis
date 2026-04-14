import { buildPreview, clampContext } from './text';

export const DEFAULT_KNOWLEDGE_BASE_NAME = 'Thesis Research';
export const DEFAULT_KNOWLEDGE_BASE_SLUG = 'thesis-research';

export type KnowledgeBaseStatus = 'active' | 'archived';
export type KnowledgeSourceType = 'document' | 'image';
export type KnowledgeSourceReferenceKind = 'profile' | 'source' | 'unit';

export type KnowledgeBaseRecord = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: KnowledgeBaseStatus;
  sourceCount: number;
  unitCount: number;
  profileVersion: number;
  createdAt?: string;
  updatedAt?: string;
};

export type KnowledgeProfileRecord = {
  knowledgeBaseId: string;
  summary: string;
  focusAreas: string[];
  keyTerms: string[];
  sourceCount: number;
  unitCount: number;
  version: number;
  createdAt?: string;
  updatedAt?: string;
};

export type KnowledgeUnitMatch = {
  id: string;
  knowledgeBaseId: string;
  sourceId: string;
  title: string;
  canonicalPath: string;
  sourceType: KnowledgeSourceType;
  unitType: string;
  content: string;
  summary: string;
  similarity: number;
  terms: string[];
  entities: string[];
  relationHints: string[];
  preview: string;
};

export type KnowledgeSourceReference = {
  kind: KnowledgeSourceReferenceKind;
  sourceId: string;
  label: string;
  detail?: string;
  similarity?: number;
  documentId?: string;
  sourceType?: KnowledgeSourceType;
};

export type KnowledgeContextTrace = {
  knowledgeBaseId: string;
  knowledgeBaseName?: string;
  profileVersion?: number;
  profileSummary?: string;
  retrievalQuery?: string;
  usedUnitCount: number;
  usedSources: KnowledgeSourceReference[];
  fallbackTriggered?: boolean;
};

export type KnowledgeBaseInput = {
  id?: string;
  slug?: string;
  name?: string;
  description?: string;
};

export type KnowledgeBaseMaintenanceAction = 'rebuild-profile' | 'reindex';

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

export function renderKnowledgeContext(input: {
  profile?: KnowledgeProfileRecord | null;
  units?: KnowledgeUnitMatch[];
  maxUnitCount?: number;
}) {
  const sections: string[] = [];
  const profile = input.profile;
  const units = (input.units ?? []).slice(0, input.maxUnitCount ?? 4);

  if (profile) {
    sections.push(`【領域摘要】\n${clampContext(profile.summary, 1400) || '目前尚未建立知識庫摘要。'}`);

    if (profile.keyTerms.length > 0) {
      sections.push(`【核心術語】\n${profile.keyTerms.slice(0, 12).join('、')}`);
    }

    if (profile.focusAreas.length > 0) {
      sections.push(`【重點面向】\n${profile.focusAreas.slice(0, 8).join('；')}`);
    }
  }

  if (units.length > 0) {
    sections.push([
      '【相關知識片段】',
      ...units.map((unit, index) => {
        const terms = unit.terms.length > 0 ? ` 術語：${unit.terms.join('、')}` : '';
        const entities = unit.entities.length > 0 ? ` 實體：${unit.entities.join('、')}` : '';
        const relations = unit.relationHints.length > 0 ? ` 關聯：${unit.relationHints.join('；')}` : '';
        return `${index + 1}. ${unit.title}｜相似度 ${Math.round(unit.similarity * 100)}%｜摘要：${buildPreview(unit.summary || unit.content, 220)}${terms}${entities}${relations}`;
      }),
    ].join('\n'));
  }

  return sections.filter(Boolean).join('\n\n').trim();
}

export function buildKnowledgeSourceReferences(input: {
  profile?: KnowledgeProfileRecord | null;
  units?: KnowledgeUnitMatch[];
}) {
  const references: KnowledgeSourceReference[] = [];

  if (input.profile) {
    references.push({
      kind: 'profile',
      sourceId: input.profile.knowledgeBaseId,
      label: '知識庫摘要',
      detail: buildPreview(input.profile.summary, 180),
    });
  }

  for (const unit of input.units ?? []) {
    references.push({
      kind: 'unit',
      sourceId: unit.id,
      label: unit.title,
      detail: buildPreview(unit.summary || unit.content, 180),
      similarity: unit.similarity,
      documentId: unit.sourceId,
      sourceType: unit.sourceType,
    });
  }

  return references;
}