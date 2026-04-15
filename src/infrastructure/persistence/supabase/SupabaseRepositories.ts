import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EnsureKnowledgeBaseInput,
  KnowledgeBaseRecord,
  KnowledgeBaseStats,
  KnowledgeProfileRecord,
  KnowledgeSourceMaterial,
  KnowledgeSourceRecord,
  KnowledgeUnitMatch,
  KnowledgeUnitRecord,
  KnowledgeUnitRelationRecord,
  PersistKnowledgeProfileInput,
  ReplaceKnowledgeSourceGraphInput,
  SearchKnowledgeUnitsInput,
} from '@/domain/knowledge/types';
import type {
  KnowledgeBaseRepository,
  KnowledgeOperationRepository,
  KnowledgeProfileRepository,
  KnowledgeRelationRepository,
  KnowledgeSourceRepository,
  KnowledgeUnitRepository,
} from '@/application/ports/repositories';
import type { KnowledgeOperationRecord } from '@/domain/operations/types';
import {
  DEFAULT_KNOWLEDGE_BASE_NAME,
  DEFAULT_KNOWLEDGE_BASE_SLUG,
  slugifyKnowledgeBaseName,
  uniqueStrings,
} from '@/domain/knowledge/defaults';

type JsonRecord = Record<string, unknown>;

type KnowledgeBaseRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: KnowledgeBaseRecord['status'];
  created_at: string | null;
  updated_at: string | null;
};

type KnowledgeProfileSummaryRow = {
  knowledge_base_id: string;
  source_count: number | null;
  unit_count: number | null;
  version: number | null;
};

type KnowledgeProfileRow = KnowledgeProfileSummaryRow & {
  summary: string | null;
  focus_areas: unknown;
  key_terms: unknown;
  created_at: string | null;
  updated_at: string | null;
};

type KnowledgeSourceRow = {
  id: string;
  knowledge_base_id: string;
  canonical_path: string;
  title: string;
  source_type: string;
  preview_kind: KnowledgeSourceRecord['previewKind'];
  raw_preview: string | null;
  total_unit_count: number | null;
  total_char_count: number | null;
  processing_duration_ms: number | null;
  summary: string | null;
  terms: unknown;
  entities: unknown;
  structure: unknown;
  ingest_status: KnowledgeSourceRecord['ingestStatus'];
  prompt_variant: string | null;
  metadata_version: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type KnowledgeUnitRow = {
  id: string;
  knowledge_base_id: string;
  source_id: string;
  unit_type: string;
  sequence: number;
  content: string | null;
  preview: string | null;
  char_count: number | null;
  word_count: number | null;
  start_offset: number | null;
  end_offset: number | null;
  summary: string | null;
  terms: unknown;
  entities: unknown;
  relation_hints: unknown;
  metadata_version: number | null;
  status: KnowledgeUnitRecord['status'];
  error_message: string | null;
  embedding: unknown;
  created_at: string | null;
  updated_at: string | null;
};

type KnowledgeRelationRow = {
  source_unit_id: string;
  target_unit_id: string;
  knowledge_base_id: string;
  relation_kind: KnowledgeUnitRelationRecord['kind'];
  relation_label: string;
  score: number | null;
};

type KnowledgeOperationRow = {
  id: string;
  knowledge_base_id: string;
  operation_kind: KnowledgeOperationRecord['kind'];
  status: KnowledgeOperationRecord['status'];
  source_id: string | null;
  source_path: string | null;
  summary: string | null;
  error_message: string | null;
  metadata: unknown;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
};

type KnowledgeProfileSourceMaterialRow = {
  title: string | null;
  summary: string | null;
  terms: unknown;
};

type SearchMatchRow = {
  id: string;
  knowledge_base_id: string;
  source_id: string;
  title: string;
  canonical_path: string;
  source_type: string;
  unit_type: string;
  content: string;
  preview: string;
  summary: string | null;
  similarity: number | null;
  terms: unknown;
  entities: unknown;
  relation_hints: unknown;
};

type UnitIdRow = { id: string };

const KNOWLEDGE_RELATION_KINDS = new Set<KnowledgeUnitRelationRecord['kind']>([
  'depends-on',
  'continues',
  'compares',
  'explains',
  'references',
  'supports',
]);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function isKnowledgeRelationKind(value: unknown): value is KnowledgeUnitRelationRecord['kind'] {
  return typeof value === 'string' && KNOWLEDGE_RELATION_KINDS.has(value as KnowledgeUnitRelationRecord['kind']);
}

function normalizeEmbedding(embedding: number[]) {
  return embedding.map(value => Number(value.toFixed(8)));
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function mapKnowledgeBaseRow(row: KnowledgeBaseRow, profile?: KnowledgeProfileSummaryRow): KnowledgeBaseRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    sourceCount: profile?.source_count ?? 0,
    unitCount: profile?.unit_count ?? 0,
    profileVersion: profile?.version ?? 0,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapKnowledgeProfileRow(row: KnowledgeProfileRow): KnowledgeProfileRecord {
  return {
    knowledgeBaseId: row.knowledge_base_id,
    summary: row.summary ?? '',
    focusAreas: toStringArray(row.focus_areas),
    keyTerms: toStringArray(row.key_terms),
    sourceCount: row.source_count ?? 0,
    unitCount: row.unit_count ?? 0,
    version: row.version ?? 0,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapKnowledgeSourceRow(row: KnowledgeSourceRow): KnowledgeSourceRecord {
  return {
    id: row.id,
    knowledgeBaseId: row.knowledge_base_id,
    canonicalPath: row.canonical_path,
    title: row.title,
    sourceType: row.source_type === 'image' ? 'image' : 'document',
    previewKind: row.preview_kind,
    rawPreview: row.raw_preview ?? undefined,
    totalUnitCount: row.total_unit_count ?? 0,
    totalCharCount: row.total_char_count ?? 0,
    processingDurationMs: row.processing_duration_ms ?? undefined,
    metadata: {
      version: row.metadata_version ?? 1,
      sourceType: row.source_type === 'image' ? 'image' : 'document',
      title: row.title,
      summary: row.summary ?? '',
      terms: toStringArray(row.terms),
      entities: toStringArray(row.entities),
      structure: isRecord(row.structure)
        ? {
            kind: typeof row.structure.kind === 'string' ? row.structure.kind : 'unknown',
            label: typeof row.structure.label === 'string' ? row.structure.label : 'Unknown',
          }
        : undefined,
    },
    ingestStatus: row.ingest_status,
    promptVariant: row.prompt_variant ?? 'ingest',
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapKnowledgeUnitRow(row: KnowledgeUnitRow): KnowledgeUnitRecord {
  const embedding = Array.isArray(row.embedding)
    ? row.embedding.map((value: unknown) => Number(value))
    : typeof row.embedding === 'string'
      ? (() => {
          try {
            const parsed = JSON.parse(row.embedding) as unknown;
            return Array.isArray(parsed) ? parsed.map((value: unknown) => Number(value)) : undefined;
          } catch {
            return undefined;
          }
        })()
      : undefined;

  return {
    id: row.id,
    knowledgeBaseId: row.knowledge_base_id,
    sourceId: row.source_id,
    unitType: row.unit_type,
    sequence: row.sequence,
    content: row.content ?? '',
    preview: row.preview ?? '',
    charCount: row.char_count ?? 0,
    wordCount: row.word_count ?? 0,
    startOffset: row.start_offset ?? 0,
    endOffset: row.end_offset ?? 0,
    metadata: {
      version: row.metadata_version ?? 1,
      unitType: row.unit_type,
      summary: row.summary ?? '',
      terms: toStringArray(row.terms),
      entities: toStringArray(row.entities),
      relationHints: Array.isArray(row.relation_hints)
        ? row.relation_hints
            .filter((hint): hint is { kind: KnowledgeUnitRelationRecord['kind']; label: string } => {
              return isRecord(hint) && isKnowledgeRelationKind(hint.kind) && typeof hint.label === 'string';
            })
            .map(hint => ({ kind: hint.kind, label: hint.label }))
        : [],
    },
    relations: [],
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    embedding,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapKnowledgeRelationRow(row: KnowledgeRelationRow): KnowledgeUnitRelationRecord {
  return {
    sourceUnitId: row.source_unit_id,
    targetUnitId: row.target_unit_id,
    knowledgeBaseId: row.knowledge_base_id,
    kind: row.relation_kind,
    label: row.relation_label,
    score: Number(row.score ?? 0),
  };
}

function mapKnowledgeOperationRow(row: KnowledgeOperationRow): KnowledgeOperationRecord {
  return {
    id: row.id,
    knowledgeBaseId: row.knowledge_base_id,
    kind: row.operation_kind,
    status: row.status,
    sourceId: row.source_id ?? undefined,
    sourcePath: row.source_path ?? undefined,
    summary: row.summary ?? undefined,
    errorMessage: row.error_message ?? undefined,
    metadata: isRecord(row.metadata) ? row.metadata : undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}

export class SupabaseKnowledgeBaseRepository implements KnowledgeBaseRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<KnowledgeBaseRecord[]> {
    const [baseResponse, profileResponse] = await Promise.all([
      this.client.from('knowledge_bases').select('*').order('updated_at', { ascending: false }),
      this.client.from('knowledge_profiles').select('knowledge_base_id, source_count, unit_count, version'),
    ]);

    if (baseResponse.error) {
      throw baseResponse.error;
    }

    if (profileResponse.error) {
      throw profileResponse.error;
    }

    const profileMap = new Map((profileResponse.data ?? []).map((row: unknown) => {
      const typedRow = row as KnowledgeProfileSummaryRow;
      return [typedRow.knowledge_base_id, typedRow] as const;
    }));

    return (baseResponse.data ?? []).map((row: unknown) => {
      const typedRow = row as KnowledgeBaseRow;
      return mapKnowledgeBaseRow(typedRow, profileMap.get(typedRow.id));
    });
  }

  async get(id: string): Promise<KnowledgeBaseRecord | null> {
    const { data, error } = await this.client.from('knowledge_bases').select('*').eq('id', id).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const { data: profileData, error: profileError } = await this.client
      .from('knowledge_profiles')
      .select('knowledge_base_id, source_count, unit_count, version')
      .eq('knowledge_base_id', id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    return mapKnowledgeBaseRow(data as KnowledgeBaseRow, (profileData as KnowledgeProfileSummaryRow | null) ?? undefined);
  }

  async ensure(input: EnsureKnowledgeBaseInput = {}): Promise<KnowledgeBaseRecord> {
    if (input.id) {
      const existing = await this.get(input.id);
      if (existing) {
        return existing;
      }
    }

    const name = input.name?.trim() || DEFAULT_KNOWLEDGE_BASE_NAME;
    const slug = input.slug?.trim() || slugifyKnowledgeBaseName(name || DEFAULT_KNOWLEDGE_BASE_SLUG);
    const { data: slugMatch, error: slugError } = await this.client
      .from('knowledge_bases')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (slugError) {
      throw slugError;
    }

    if (slugMatch) {
      return mapKnowledgeBaseRow(slugMatch as KnowledgeBaseRow);
    }

    const id = input.id ?? randomUUID();
    const { error } = await this.client.from('knowledge_bases').upsert({
      id,
      slug,
      name,
      description: input.description ?? null,
      status: 'active',
    });

    if (error) {
      throw error;
    }

    const { error: profileError } = await this.client.from('knowledge_profiles').upsert({
      knowledge_base_id: id,
      summary: '',
      focus_areas: [],
      key_terms: [],
      source_count: 0,
      unit_count: 0,
      version: 0,
    });

    if (profileError) {
      throw profileError;
    }

    return {
      id,
      slug,
      name,
      description: input.description,
      status: 'active',
      sourceCount: 0,
      unitCount: 0,
      profileVersion: 0,
    };
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from('knowledge_bases').delete().eq('id', id);

    if (error) {
      throw error;
    }
  }
}

export class SupabaseKnowledgeProfileRepository implements KnowledgeProfileRepository {
  constructor(private readonly client: SupabaseClient) {}

  async get(knowledgeBaseId: string): Promise<KnowledgeProfileRecord | null> {
    const { data, error } = await this.client
      .from('knowledge_profiles')
      .select('*')
      .eq('knowledge_base_id', knowledgeBaseId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapKnowledgeProfileRow(data as KnowledgeProfileRow) : null;
  }

  async save(input: PersistKnowledgeProfileInput): Promise<KnowledgeProfileRecord> {
    const current = await this.get(input.knowledgeBaseId);
    const { data, error } = await this.client
      .from('knowledge_profiles')
      .upsert({
        knowledge_base_id: input.knowledgeBaseId,
        summary: input.summary,
        focus_areas: uniqueStrings(input.focusAreas),
        key_terms: uniqueStrings(input.keyTerms),
        source_count: input.sourceCount,
        unit_count: input.unitCount,
        version: (current?.version ?? 0) + 1,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapKnowledgeProfileRow(data as KnowledgeProfileRow);
  }

  async listSourceMaterials(knowledgeBaseId: string, limit = 12): Promise<KnowledgeSourceMaterial[]> {
    const { data, error } = await this.client
      .from('knowledge_sources')
      .select('title, summary, terms')
      .eq('knowledge_base_id', knowledgeBaseId)
      .neq('ingest_status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data ?? [])
      .map((row: unknown) => {
        const typedRow = row as KnowledgeProfileSourceMaterialRow;
        return {
          title: typedRow.title ?? 'Unknown source',
          summary: typedRow.summary ?? '',
          terms: toStringArray(typedRow.terms),
        };
      })
      .filter(row => row.summary.trim().length > 0);
  }
}

export class SupabaseKnowledgeSourceRepository implements KnowledgeSourceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async saveGraph(input: ReplaceKnowledgeSourceGraphInput): Promise<void> {
    const { source, units } = input;

    const sourceResponse = await this.client.from('knowledge_sources').upsert({
      id: source.id,
      knowledge_base_id: source.knowledgeBaseId,
      canonical_path: source.canonicalPath,
      title: source.title,
      source_type: source.sourceType,
      preview_kind: source.previewKind,
      raw_preview: source.rawPreview ?? null,
      summary: source.metadata.summary,
      terms: source.metadata.terms,
      entities: source.metadata.entities,
      structure: source.metadata.structure ?? null,
      total_unit_count: source.totalUnitCount,
      total_char_count: source.totalCharCount,
      processing_duration_ms: source.processingDurationMs ?? null,
      ingest_status: source.ingestStatus,
      prompt_variant: source.promptVariant,
      metadata_version: source.metadata.version,
    });

    if (sourceResponse.error) {
      throw sourceResponse.error;
    }

    const deleteUnitsResponse = await this.client.from('knowledge_units').delete().eq('source_id', source.id);
    if (deleteUnitsResponse.error) {
      throw deleteUnitsResponse.error;
    }

    if (units.length === 0) {
      return;
    }

    const unitResponse = await this.client.from('knowledge_units').upsert(
      units.map(unit => ({
        id: unit.id,
        knowledge_base_id: unit.knowledgeBaseId,
        source_id: unit.sourceId,
        unit_type: unit.unitType,
        sequence: unit.sequence,
        content: unit.content,
        preview: unit.preview,
        summary: unit.metadata.summary,
        terms: unit.metadata.terms,
        entities: unit.metadata.entities,
        relation_hints: unit.metadata.relationHints,
        status: unit.status,
        error_message: unit.errorMessage ?? null,
        embedding: unit.embedding ? normalizeEmbedding(unit.embedding) : null,
        embedding_dimensions: unit.embedding?.length ?? null,
        word_count: unit.wordCount,
        char_count: unit.charCount,
        start_offset: unit.startOffset,
        end_offset: unit.endOffset,
        metadata_version: unit.metadata.version,
      })),
    );

    if (unitResponse.error) {
      throw unitResponse.error;
    }
  }

  async listByKnowledgeBase(knowledgeBaseId: string): Promise<KnowledgeSourceRecord[]> {
    const { data, error } = await this.client
      .from('knowledge_sources')
      .select('*')
      .eq('knowledge_base_id', knowledgeBaseId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: unknown) => mapKnowledgeSourceRow(row as KnowledgeSourceRow));
  }

  async getStats(knowledgeBaseId: string): Promise<KnowledgeBaseStats> {
    const [sourceResponse, unitResponse] = await Promise.all([
      this.client
        .from('knowledge_sources')
        .select('id', { count: 'exact', head: true })
        .eq('knowledge_base_id', knowledgeBaseId)
        .neq('ingest_status', 'archived'),
      this.client
        .from('knowledge_units')
        .select('id', { count: 'exact', head: true })
        .eq('knowledge_base_id', knowledgeBaseId)
        .eq('status', 'ready'),
    ]);

    if (sourceResponse.error) {
      throw sourceResponse.error;
    }

    if (unitResponse.error) {
      throw unitResponse.error;
    }

    return {
      sourceCount: sourceResponse.count ?? 0,
      unitCount: unitResponse.count ?? 0,
    };
  }

  async deleteById(sourceId: string): Promise<void> {
    const { error } = await this.client.from('knowledge_sources').delete().eq('id', sourceId);

    if (error) {
      throw error;
    }
  }

  async deleteByPathPrefix(knowledgeBaseId: string, pathPrefix: string): Promise<void> {
    const { error } = await this.client
      .from('knowledge_sources')
      .delete()
      .eq('knowledge_base_id', knowledgeBaseId)
      .like('canonical_path', `${pathPrefix}/%`);

    if (error) {
      throw error;
    }
  }

  async deleteByKnowledgeBase(knowledgeBaseId: string): Promise<void> {
    const { error } = await this.client.from('knowledge_sources').delete().eq('knowledge_base_id', knowledgeBaseId);

    if (error) {
      throw error;
    }
  }
}

export class SupabaseKnowledgeUnitRepository implements KnowledgeUnitRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByKnowledgeBase(knowledgeBaseId: string): Promise<KnowledgeUnitRecord[]> {
    const { data, error } = await this.client
      .from('knowledge_units')
      .select('*')
      .eq('knowledge_base_id', knowledgeBaseId)
      .order('source_id', { ascending: true })
      .order('sequence', { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: unknown) => mapKnowledgeUnitRow(row as KnowledgeUnitRow));
  }

  async listForReindex(knowledgeBaseId: string): Promise<KnowledgeUnitRecord[]> {
    return this.listByKnowledgeBase(knowledgeBaseId);
  }

  async search(input: SearchKnowledgeUnitsInput): Promise<KnowledgeUnitMatch[]> {
    const { data, error } = await this.client.rpc('match_knowledge_units', {
      query_embedding: normalizeEmbedding(input.queryEmbedding),
      kb_id: input.knowledgeBaseId,
      match_threshold: input.matchThreshold ?? 0.35,
      match_count: input.matchCount ?? 4,
      source_types: input.sourceTypes ?? ['document'],
    });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: unknown) => {
      const typedRow = row as SearchMatchRow;
      return {
        id: typedRow.id,
        knowledgeBaseId: typedRow.knowledge_base_id,
        sourceId: typedRow.source_id,
        title: typedRow.title,
        canonicalPath: typedRow.canonical_path,
        sourceType: typedRow.source_type === 'image' ? 'image' : 'document',
        unitType: typedRow.unit_type,
        content: typedRow.content,
        preview: typedRow.preview,
        summary: typedRow.summary ?? '',
        similarity: Number(typedRow.similarity ?? 0),
        terms: toStringArray(typedRow.terms),
        entities: toStringArray(typedRow.entities),
        relationHints: toStringArray(typedRow.relation_hints),
      };
    });
  }
}

export class SupabaseKnowledgeRelationRepository implements KnowledgeRelationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async replaceForSource(input: {
    knowledgeBaseId: string;
    sourceId: string;
    relations: KnowledgeUnitRelationRecord[];
  }): Promise<void> {
    const { data: sourceUnits, error: unitError } = await this.client
      .from('knowledge_units')
      .select('id')
      .eq('source_id', input.sourceId);

    if (unitError) {
      throw unitError;
    }

    const unitIds = (sourceUnits ?? []).map((row: unknown) => (row as UnitIdRow).id);

    if (unitIds.length > 0) {
      const deleteResponse = await this.client
        .from('knowledge_unit_relations')
        .delete()
        .in('source_unit_id', unitIds);

      if (deleteResponse.error) {
        throw deleteResponse.error;
      }
    }

    if (input.relations.length === 0) {
      return;
    }

    const insertResponse = await this.client.from('knowledge_unit_relations').upsert(
      input.relations.map(relation => ({
        source_unit_id: relation.sourceUnitId,
        target_unit_id: relation.targetUnitId,
        knowledge_base_id: relation.knowledgeBaseId,
        relation_kind: relation.kind,
        relation_label: relation.label,
        score: relation.score,
      })),
    );

    if (insertResponse.error) {
      throw insertResponse.error;
    }
  }

  async listByKnowledgeBase(knowledgeBaseId: string): Promise<KnowledgeUnitRelationRecord[]> {
    const { data, error } = await this.client
      .from('knowledge_unit_relations')
      .select('*')
      .eq('knowledge_base_id', knowledgeBaseId);

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: unknown) => mapKnowledgeRelationRow(row as KnowledgeRelationRow));
  }
}

export class SupabaseKnowledgeOperationRepository implements KnowledgeOperationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async start(input: {
    knowledgeBaseId: string;
    kind: 'ingest' | 'rebuild-profile' | 'reindex';
    sourceId?: string;
    sourcePath?: string;
    metadata?: Record<string, unknown>;
  }): Promise<KnowledgeOperationRecord> {
    const { data, error } = await this.client
      .from('knowledge_operations')
      .insert({
        id: randomUUID(),
        knowledge_base_id: input.knowledgeBaseId,
        operation_kind: input.kind,
        status: 'running',
        source_id: input.sourceId ?? null,
        source_path: input.sourcePath ?? null,
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapKnowledgeOperationRow(data);
  }

  async complete(input: {
    operationId: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.client
      .from('knowledge_operations')
      .update({
        status: 'completed',
        summary: input.summary ?? null,
        metadata: input.metadata ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', input.operationId);

    if (error) {
      throw error;
    }
  }

  async fail(input: {
    operationId: string;
    errorMessage: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.client
      .from('knowledge_operations')
      .update({
        status: 'failed',
        error_message: input.errorMessage,
        metadata: input.metadata ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', input.operationId);

    if (error) {
      throw error;
    }
  }
}
