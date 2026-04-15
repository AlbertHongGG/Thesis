export type KnowledgeBaseStatus = 'active' | 'archived';
export type KnowledgeSourceType = 'document' | 'image';
export type PreviewKind = 'image' | 'text' | 'parsed-text' | 'unsupported';
export type KnowledgeRelationKind = 'depends-on' | 'continues' | 'compares' | 'explains' | 'references' | 'supports';
export type KnowledgeUnitStatus = 'ready' | 'error';

export interface SourceStructure {
  kind: string;
  label: string;
}

export interface RelationHint {
  kind: KnowledgeRelationKind;
  label: string;
}

export interface KnowledgeUnitRelation {
  unitId: string;
  kind: KnowledgeRelationKind;
  score: number;
  label: string;
}

export interface KnowledgeUnitRelationRecord {
  sourceUnitId: string;
  targetUnitId: string;
  knowledgeBaseId: string;
  kind: KnowledgeRelationKind;
  score: number;
  label: string;
}

export interface KnowledgeSourceMetadata {
  version: number;
  sourceType: KnowledgeSourceType;
  title: string;
  summary: string;
  terms: string[];
  entities: string[];
  structure?: SourceStructure;
}

export interface KnowledgeUnitMetadata {
  version: number;
  unitType: string;
  summary: string;
  terms: string[];
  entities: string[];
  relationHints: RelationHint[];
}

export interface KnowledgeBaseRecord {
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
}

export interface KnowledgeProfileRecord {
  knowledgeBaseId: string;
  summary: string;
  focusAreas: string[];
  keyTerms: string[];
  sourceCount: number;
  unitCount: number;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeSourceRecord {
  id: string;
  knowledgeBaseId: string;
  canonicalPath: string;
  title: string;
  sourceType: KnowledgeSourceType;
  previewKind: PreviewKind;
  rawPreview?: string;
  totalUnitCount: number;
  totalCharCount: number;
  processingDurationMs?: number;
  metadata: KnowledgeSourceMetadata;
  ingestStatus: 'ready' | 'error' | 'archived';
  promptVariant: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeUnitRecord {
  id: string;
  knowledgeBaseId: string;
  sourceId: string;
  unitType: string;
  sequence: number;
  content: string;
  preview: string;
  charCount: number;
  wordCount: number;
  startOffset: number;
  endOffset: number;
  metadata: KnowledgeUnitMetadata;
  relations: KnowledgeUnitRelation[];
  status: KnowledgeUnitStatus;
  errorMessage?: string;
  embedding?: number[];
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeSourceMaterial {
  title: string;
  summary: string;
  terms: string[];
}

export interface KnowledgeUnitMatch {
  id: string;
  knowledgeBaseId: string;
  sourceId: string;
  title: string;
  canonicalPath: string;
  sourceType: KnowledgeSourceType;
  unitType: string;
  content: string;
  preview: string;
  summary: string;
  similarity: number;
  terms: string[];
  entities: string[];
  relationHints: string[];
}

export interface KnowledgeSourceReference {
  kind: 'profile' | 'source' | 'unit';
  sourceId: string;
  label: string;
  detail?: string;
  similarity?: number;
  documentId?: string;
  sourceType?: KnowledgeSourceType;
}

export interface KnowledgeContextTrace {
  knowledgeBaseId: string;
  knowledgeBaseName?: string;
  profileVersion?: number;
  profileSummary?: string;
  retrievalQuery?: string;
  usedUnitCount: number;
  usedSources: KnowledgeSourceReference[];
  fallbackTriggered?: boolean;
}

export interface KnowledgeGraphNode {
  id: string;
  name: string;
  fullName?: string;
  group: string;
  val: number;
  type: 'source' | 'unit' | 'folder';
  summary?: string;
  content?: string;
  terms?: string[];
  entities?: string[];
  sourceType?: string;
  unitType?: string;
}

export interface KnowledgeGraphLink {
  source: string;
  target: string;
  type: 'child' | 'related' | 'hierarchy';
  label?: string;
  score?: number;
}

export interface KnowledgeGraphProjection {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
}

export interface EnsureKnowledgeBaseInput {
  id?: string;
  slug?: string;
  name?: string;
  description?: string;
}

export interface PersistKnowledgeProfileInput {
  knowledgeBaseId: string;
  summary: string;
  focusAreas: string[];
  keyTerms: string[];
  sourceCount: number;
  unitCount: number;
}

export interface ReplaceKnowledgeSourceGraphInput {
  source: KnowledgeSourceRecord;
  units: KnowledgeUnitRecord[];
}

export interface SearchKnowledgeUnitsInput {
  knowledgeBaseId: string;
  queryText: string;
  queryEmbedding: number[];
  matchCount?: number;
  matchThreshold?: number;
  sourceTypes?: KnowledgeSourceType[];
}

export interface KnowledgeBaseStats {
  sourceCount: number;
  unitCount: number;
}
