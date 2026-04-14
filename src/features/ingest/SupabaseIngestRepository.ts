import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SourceMeta, UnitMeta } from './contracts';
import {
  DEFAULT_KNOWLEDGE_BASE_NAME,
  DEFAULT_KNOWLEDGE_BASE_SLUG,
  slugifyKnowledgeBaseName,
  uniqueStrings,
  type KnowledgeBaseInput,
  type KnowledgeBaseRecord,
  type KnowledgeProfileRecord,
  type KnowledgeUnitMatch,
} from './knowledge';
import type {
  IngestRepository,
  KnowledgeProfileSourceMaterial,
  PersistKnowledgeProfileParams,
  PersistSourceParams,
  ReindexableUnit,
  RetrieveRelevantUnitsParams,
} from './repository';

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

function mapSourceMeta(value: any): SourceMeta {
  const meta = value && typeof value === 'object' ? value : {};
  return {
    schemaVersion: meta.schemaVersion ?? 5,
    sourceType: meta.sourceType === 'image' ? 'image' : 'document',
    title: typeof meta.title === 'string' ? meta.title : '',
    summary: typeof meta.summary === 'string' ? meta.summary : '',
    terms: toStringArray(meta.terms),
    entities: toStringArray(meta.entities),
    structure: meta.structure && typeof meta.structure === 'object'
      ? {
          kind: typeof meta.structure.kind === 'string' ? meta.structure.kind : 'unknown',
          label: typeof meta.structure.label === 'string' ? meta.structure.label : 'Unknown',
        }
      : undefined,
  };
}

function mapUnitMeta(value: any): UnitMeta {
  const meta = value && typeof value === 'object' ? value : {};
  return {
    schemaVersion: meta.schemaVersion ?? 5,
    unitType: typeof meta.unitType === 'string' ? meta.unitType : 'text-segment',
    summary: typeof meta.summary === 'string' ? meta.summary : '',
    terms: toStringArray(meta.terms),
    entities: toStringArray(meta.entities),
    relationHints: Array.isArray(meta.relationHints)
      ? meta.relationHints
          .filter((hint: any) => hint && typeof hint === 'object' && typeof hint.kind === 'string' && typeof hint.label === 'string')
          .map((hint: any) => ({ kind: hint.kind, label: hint.label }))
      : [],
  };
}

function mapKnowledgeProfileRow(row: any): KnowledgeProfileRecord {
  return {
    knowledgeBaseId: row.knowledge_base_id,
    summary: row.summary ?? '',
    focusAreas: toStringArray(row.focus_areas),
    keyTerms: toStringArray(row.key_terms),
    sourceCount: row.source_count ?? 0,
    unitCount: row.unit_count ?? 0,
    version: row.version ?? 1,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapKnowledgeBaseRow(row: any, profile?: any): KnowledgeBaseRecord {
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

export class SupabaseIngestRepository implements IngestRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listKnowledgeBases(): Promise<KnowledgeBaseRecord[]> {
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

    const profileMap = new Map((profileResponse.data ?? []).map(row => [row.knowledge_base_id, row]));
    return (baseResponse.data ?? []).map(row => mapKnowledgeBaseRow(row, profileMap.get(row.id)));
  }

  async ensureKnowledgeBase(input: KnowledgeBaseInput = {}): Promise<KnowledgeBaseRecord> {
    if (input.id) {
      const existingById = await this.fetchKnowledgeBaseById(input.id);
      if (existingById) {
        return existingById;
      }
    }

    const name = input.name?.trim() || DEFAULT_KNOWLEDGE_BASE_NAME;
    const slug = input.slug?.trim() || slugifyKnowledgeBaseName(name || DEFAULT_KNOWLEDGE_BASE_SLUG);

    const existingBySlug = await this.fetchKnowledgeBaseBySlug(slug);
    if (existingBySlug) {
      return existingBySlug;
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

  async getKnowledgeBase(id: string): Promise<KnowledgeBaseRecord | null> {
    return this.fetchKnowledgeBaseById(id);
  }

  async deleteKnowledgeBase(id: string): Promise<void> {
    const { error } = await this.client.from('knowledge_bases').delete().eq('id', id);

    if (error) {
      throw error;
    }
  }

  async getKnowledgeBaseStats(knowledgeBaseId: string) {
    const [sourceResponse, chunkResponse] = await Promise.all([
      this.client
        .from('rag_sources')
        .select('id', { count: 'exact', head: true })
        .eq('knowledge_base_id', knowledgeBaseId)
        .neq('ingest_status', 'archived'),
      this.client
        .from('rag_units')
        .select('id', { count: 'exact', head: true })
        .eq('knowledge_base_id', knowledgeBaseId)
        .eq('status', 'ready'),
    ]);

    if (sourceResponse.error) {
      throw sourceResponse.error;
    }

    if (chunkResponse.error) {
      throw chunkResponse.error;
    }

    return {
      sourceCount: sourceResponse.count ?? 0,
      unitCount: chunkResponse.count ?? 0,
    };
  }

  async getKnowledgeProfile(knowledgeBaseId: string): Promise<KnowledgeProfileRecord | null> {
    const { data, error } = await this.client
      .from('knowledge_profiles')
      .select('*')
      .eq('knowledge_base_id', knowledgeBaseId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapKnowledgeProfileRow(data) : null;
  }

  async saveKnowledgeProfile(params: PersistKnowledgeProfileParams): Promise<KnowledgeProfileRecord> {
    const current = await this.getKnowledgeProfile(params.knowledgeBaseId);
    const nextVersion = (current?.version ?? 0) + 1;

    const payload = {
      knowledge_base_id: params.knowledgeBaseId,
      summary: params.summary,
      focus_areas: uniqueStrings(params.focusAreas),
      key_terms: uniqueStrings(params.keyTerms),
      source_count: params.sourceCount,
      unit_count: params.unitCount,
      version: nextVersion,
    };

    const { data, error } = await this.client
      .from('knowledge_profiles')
      .upsert(payload)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapKnowledgeProfileRow(data);
  }

  async listKnowledgeProfileSources(knowledgeBaseId: string, limit = 12): Promise<KnowledgeProfileSourceMaterial[]> {
    const { data: sources, error: sourceError } = await this.client
      .from('rag_sources')
      .select('title, meta')
      .eq('knowledge_base_id', knowledgeBaseId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (sourceError) {
      throw sourceError;
    }

    return ((sources ?? []).map((row: any) => {
      const meta = mapSourceMeta(row.meta);
      return {
        title: row.title ?? meta.title,
        summary: meta.summary,
        terms: meta.terms,
      };
    })).filter(row => row.summary.trim().length > 0);
  }

  async listUnitsForReindex(knowledgeBaseId: string): Promise<ReindexableUnit[]> {
    const { data, error } = await this.client
      .from('rag_units')
      .select('id, source_id, unit_type, sequence, content, status, meta, rag_sources!inner(title, canonical_path, source_type, meta)')
      .eq('knowledge_base_id', knowledgeBaseId)
      .eq('rag_sources.knowledge_base_id', knowledgeBaseId)
      .order('source_id', { ascending: true })
      .order('sequence', { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      sourceId: row.source_id,
      title: row.rag_sources?.title ?? 'Unknown source',
      canonicalPath: row.rag_sources?.canonical_path ?? row.rag_sources?.title ?? 'Unknown source',
      sourceType: row.rag_sources?.source_type === 'image' ? 'image' : 'document',
      sourceMeta: mapSourceMeta(row.rag_sources?.meta),
      unitType: row.unit_type,
      sequence: row.sequence,
      content: row.content ?? '',
      meta: mapUnitMeta(row.meta),
      status: row.status,
    }));
  }

  async saveReindexedUnits(params: {
    knowledgeBaseId: string;
    units: Array<{
      id: string;
      embedding: number[] | null;
      embeddingDimensions: number | null;
      relatedUnits: Array<{ unitId: string; kind: string; score: number; label: string }>;
    }>;
  }): Promise<void> {
    if (params.units.length === 0) {
      return;
    }

    const { error } = await this.client.from('rag_units').upsert(
      params.units.map(unit => ({
        id: unit.id,
        knowledge_base_id: params.knowledgeBaseId,
        embedding: unit.embedding ? normalizeEmbedding(unit.embedding) : null,
        embedding_dimensions: unit.embeddingDimensions,
        related_units: unit.relatedUnits,
      })),
    );

    if (error) {
      throw error;
    }
  }

  async retrieveRelevantUnits(params: RetrieveRelevantUnitsParams): Promise<KnowledgeUnitMatch[]> {
    const { data, error } = await this.client.rpc('match_rag_units', {
      query_embedding: normalizeEmbedding(params.queryEmbedding),
      kb_id: params.knowledgeBaseId,
      match_threshold: params.matchThreshold ?? 0.35,
      match_count: params.matchCount ?? 4,
      source_types: params.sourceTypes ?? ['document'],
    });

    if (error) {
      throw error;
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      knowledgeBaseId: row.knowledge_base_id,
      sourceId: row.source_id,
      title: row.title,
      canonicalPath: row.canonical_path,
      sourceType: row.source_type,
      unitType: row.unit_type,
      content: row.content,
      preview: row.preview,
      summary: row.summary || '',
      similarity: row.similarity,
      terms: toStringArray(row.terms),
      entities: toStringArray(row.entities),
      relationHints: toStringArray(row.relation_hints),
    }));
  }

  async saveSource(params: PersistSourceParams): Promise<void> {
    const sourceResponse = await this.client.from('rag_sources').upsert({
      id: params.result.sourceId,
      knowledge_base_id: params.knowledgeBaseId,
      title: params.result.title,
      canonical_path: params.canonicalPath,
      source_type: params.result.sourceType,
      ingest_status: 'ready',
      preview_kind: params.previewKind,
      raw_preview: params.result.rawPreview,
      total_unit_count: params.result.totalUnitCount,
      total_char_count: params.result.totalCharCount,
      processing_duration_ms: params.result.processingDurationMs,
      meta: params.result.meta,
    });

    if (sourceResponse.error) {
      throw sourceResponse.error;
    }

    if (params.units.length === 0) {
      return;
    }

    const unitResponse = await this.client.from('rag_units').upsert(
      params.units.map(unit => ({
        id: unit.id,
        knowledge_base_id: params.knowledgeBaseId,
        source_id: params.result.sourceId,
        unit_type: unit.unitType,
        sequence: unit.sequence,
        content: unit.content,
        preview: unit.preview,
        related_units: unit.relatedUnits,
        embedding: unit.embedding ? normalizeEmbedding(unit.embedding) : null,
        embedding_dimensions: unit.embedding?.length ?? null,
        word_count: unit.wordCount,
        char_count: unit.charCount,
        start_offset: unit.startOffset,
        end_offset: unit.endOffset,
        status: unit.status,
        meta: unit.meta,
      })),
    );

    if (unitResponse.error) {
      throw unitResponse.error;
    }
  }

  private async fetchKnowledgeBaseById(id: string) {
    const { data, error } = await this.client.from('knowledge_bases').select('*').eq('id', id).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const profile = await this.getKnowledgeProfile(id);
    return mapKnowledgeBaseRow(data, profile ? {
      source_count: profile.sourceCount,
      unit_count: profile.unitCount,
      version: profile.version,
    } : undefined);
  }

  private async fetchKnowledgeBaseBySlug(slug: string) {
    const { data, error } = await this.client.from('knowledge_bases').select('*').eq('slug', slug).maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const profile = await this.getKnowledgeProfile(data.id);
    return mapKnowledgeBaseRow(data, profile ? {
      source_count: profile.sourceCount,
      unit_count: profile.unitCount,
      version: profile.version,
    } : undefined);
  }
}