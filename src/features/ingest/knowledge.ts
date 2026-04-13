import { buildPreview, clampContext } from './text';

export const DEFAULT_KNOWLEDGE_BASE_NAME = 'Thesis Research';
export const DEFAULT_KNOWLEDGE_BASE_SLUG = 'thesis-research';

export type KnowledgeBaseStatus = 'active' | 'archived';
export type KnowledgeSourceType = 'document' | 'image';
export type KnowledgeSourceReferenceKind = 'profile' | 'chunk' | 'document' | 'image';

export type KnowledgeBaseRecord = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  status: KnowledgeBaseStatus;
  sourceCount: number;
  chunkCount: number;
  profileVersion: number;
  createdAt?: string;
  updatedAt?: string;
};

export type KnowledgeProfileRecord = {
  knowledgeBaseId: string;
  summary: string;
  focusAreas: string[];
  keyTerms: string[];
  researchQuestions: string[];
  methods: string[];
  recentUpdates: string[];
  sourceCount: number;
  chunkCount: number;
  version: number;
  createdAt?: string;
  updatedAt?: string;
};

export type KnowledgeChunkMatch = {
  id: string;
  knowledgeBaseId: string;
  documentId: string;
  filename: string;
  sourceType: KnowledgeSourceType;
  content: string;
  summary: string;
  similarity: number;
  keywords: string[];
  bridgingContext?: string;
  preview?: string;
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
  usedChunkCount: number;
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
  chunks?: KnowledgeChunkMatch[];
  maxChunkCount?: number;
}) {
  const sections: string[] = [];
  const profile = input.profile;
  const chunks = (input.chunks ?? []).slice(0, input.maxChunkCount ?? 4);

  if (profile) {
    sections.push(`【領域摘要】\n${clampContext(profile.summary, 1400) || '目前尚未建立知識庫摘要。'}`);

    if (profile.keyTerms.length > 0) {
      sections.push(`【核心術語】\n${profile.keyTerms.slice(0, 12).join('、')}`);
    }

    if (profile.focusAreas.length > 0) {
      sections.push(`【重點面向】\n${profile.focusAreas.slice(0, 8).join('；')}`);
    }

    if (profile.researchQuestions.length > 0) {
      sections.push(`【研究問題】\n${profile.researchQuestions.slice(0, 5).join('；')}`);
    }

    if (profile.methods.length > 0) {
      sections.push(`【方法線索】\n${profile.methods.slice(0, 6).join('；')}`);
    }

    if (profile.recentUpdates.length > 0) {
      sections.push(`【近期補充】\n${profile.recentUpdates.slice(0, 4).join('；')}`);
    }
  }

  if (chunks.length > 0) {
    sections.push([
      '【相關知識片段】',
      ...chunks.map((chunk, index) => {
        const keywords = chunk.keywords.length > 0 ? ` 關鍵詞：${chunk.keywords.join('、')}` : '';
        const relation = chunk.bridgingContext ? ` 脈絡：${buildPreview(chunk.bridgingContext, 180)}` : '';
        return `${index + 1}. ${chunk.filename}｜相似度 ${Math.round(chunk.similarity * 100)}%｜摘要：${buildPreview(chunk.summary || chunk.content, 220)}${keywords}${relation}`;
      }),
    ].join('\n'));
  }

  return sections.filter(Boolean).join('\n\n').trim();
}

export function buildKnowledgeSourceReferences(input: {
  profile?: KnowledgeProfileRecord | null;
  chunks?: KnowledgeChunkMatch[];
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

  for (const chunk of input.chunks ?? []) {
    references.push({
      kind: 'chunk',
      sourceId: chunk.id,
      label: chunk.filename,
      detail: buildPreview(chunk.summary || chunk.content, 180),
      similarity: chunk.similarity,
      documentId: chunk.documentId,
      sourceType: chunk.sourceType,
    });
  }

  return references;
}