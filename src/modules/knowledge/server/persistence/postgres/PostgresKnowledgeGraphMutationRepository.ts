import type { PoolClient } from 'pg';
import type {
  KnowledgeSourceRecord,
  KnowledgeUnitRecord,
  KnowledgeUnitRelationRecord,
} from '@/domain/knowledge/types';
import type { KnowledgeGraphMutationRepository } from '@/modules/shared/server/ports/repositories';
import { getPostgresPool } from '@/modules/shared/server/postgres';

function normalizeEmbedding(embedding: number[]) {
  return embedding.map(value => Number(value.toFixed(8)));
}

function toVectorLiteral(embedding?: number[]) {
  if (!embedding || embedding.length === 0) {
    return null;
  }

  return `[${normalizeEmbedding(embedding).join(',')}]`;
}

function toJsonbLiteral(value: unknown) {
  if (value == null) {
    return null;
  }

  return JSON.stringify(value);
}

async function upsertSource(client: PoolClient, source: KnowledgeSourceRecord) {
  await client.query(
    `
      insert into public.knowledge_sources (
        id,
        knowledge_base_id,
        canonical_path,
        title,
        source_type,
        preview_kind,
        raw_preview,
        summary,
        terms,
        entities,
        structure,
        total_unit_count,
        total_char_count,
        processing_duration_ms,
        ingest_status,
        prompt_variant,
        metadata_version
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17
      )
      on conflict (id) do update set
        knowledge_base_id = excluded.knowledge_base_id,
        canonical_path = excluded.canonical_path,
        title = excluded.title,
        source_type = excluded.source_type,
        preview_kind = excluded.preview_kind,
        raw_preview = excluded.raw_preview,
        summary = excluded.summary,
        terms = excluded.terms,
        entities = excluded.entities,
        structure = excluded.structure,
        total_unit_count = excluded.total_unit_count,
        total_char_count = excluded.total_char_count,
        processing_duration_ms = excluded.processing_duration_ms,
        ingest_status = excluded.ingest_status,
        prompt_variant = excluded.prompt_variant,
        metadata_version = excluded.metadata_version
    `,
    [
      source.id,
      source.knowledgeBaseId,
      source.canonicalPath,
      source.title,
      source.sourceType,
      source.previewKind,
      source.rawPreview ?? null,
      source.metadata.summary,
      source.metadata.terms,
      source.metadata.entities,
      toJsonbLiteral(source.metadata.structure),
      source.totalUnitCount,
      source.totalCharCount,
      source.processingDurationMs ?? null,
      source.ingestStatus,
      source.promptVariant,
      source.metadata.version,
    ],
  );
}

async function replaceUnits(client: PoolClient, source: KnowledgeSourceRecord, units: KnowledgeUnitRecord[]) {
  await client.query('delete from public.knowledge_units where source_id = $1', [source.id]);

  for (const unit of units) {
    await client.query(
      `
        insert into public.knowledge_units (
          id,
          knowledge_base_id,
          source_id,
          unit_type,
          sequence,
          content,
          preview,
          summary,
          terms,
          entities,
          relation_hints,
          status,
          error_message,
          embedding,
          embedding_dimensions,
          word_count,
          char_count,
          start_offset,
          end_offset,
          metadata_version
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14::extensions.vector, $15, $16, $17, $18, $19, $20
        )
        on conflict (id) do update set
          knowledge_base_id = excluded.knowledge_base_id,
          source_id = excluded.source_id,
          unit_type = excluded.unit_type,
          sequence = excluded.sequence,
          content = excluded.content,
          preview = excluded.preview,
          summary = excluded.summary,
          terms = excluded.terms,
          entities = excluded.entities,
          relation_hints = excluded.relation_hints,
          status = excluded.status,
          error_message = excluded.error_message,
          embedding = excluded.embedding,
          embedding_dimensions = excluded.embedding_dimensions,
          word_count = excluded.word_count,
          char_count = excluded.char_count,
          start_offset = excluded.start_offset,
          end_offset = excluded.end_offset,
          metadata_version = excluded.metadata_version
      `,
      [
        unit.id,
        unit.knowledgeBaseId,
        unit.sourceId,
        unit.unitType,
        unit.sequence,
        unit.content,
        unit.preview,
        unit.metadata.summary,
        unit.metadata.terms,
        unit.metadata.entities,
        toJsonbLiteral(unit.metadata.relationHints),
        unit.status,
        unit.errorMessage ?? null,
        toVectorLiteral(unit.embedding),
        unit.embedding?.length ?? null,
        unit.wordCount,
        unit.charCount,
        unit.startOffset,
        unit.endOffset,
        unit.metadata.version,
      ],
    );
  }
}

async function replaceRelations(client: PoolClient, knowledgeBaseId: string, relations: KnowledgeUnitRelationRecord[]) {
  if (relations.length === 0) {
    return;
  }

  for (const relation of relations) {
    await client.query(
      `
        insert into public.knowledge_unit_relations (
          source_unit_id,
          target_unit_id,
          knowledge_base_id,
          relation_kind,
          relation_label,
          score
        )
        values ($1, $2, $3, $4, $5, $6)
        on conflict (source_unit_id, target_unit_id, relation_kind) do update set
          knowledge_base_id = excluded.knowledge_base_id,
          relation_label = excluded.relation_label,
          score = excluded.score
      `,
      [
        relation.sourceUnitId,
        relation.targetUnitId,
        knowledgeBaseId,
        relation.kind,
        relation.label,
        relation.score,
      ],
    );
  }
}

export class PostgresKnowledgeGraphMutationRepository implements KnowledgeGraphMutationRepository {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async replaceSourceGraph(input: {
    source: KnowledgeSourceRecord;
    units: KnowledgeUnitRecord[];
    relations: KnowledgeUnitRelationRecord[];
  }): Promise<void> {
    const client = await getPostgresPool(this.env).connect();

    try {
      await client.query('begin');
      await upsertSource(client, input.source);
      await replaceUnits(client, input.source, input.units);
      await replaceRelations(client, input.source.knowledgeBaseId, input.relations);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
