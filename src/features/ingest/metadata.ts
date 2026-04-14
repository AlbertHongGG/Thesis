import type { RelationHint, RelationKind, SourceStructure } from './contracts';

const MAX_TERMS = 10;
const MAX_ENTITIES = 8;
const MAX_RELATION_HINTS = 6;

const RELATION_KIND_ALIASES: Record<string, RelationKind> = {
  'depends-on': 'depends-on',
  depends: 'depends-on',
  dependency: 'depends-on',
  prerequisite: 'depends-on',
  continues: 'continues',
  continue: 'continues',
  follows: 'continues',
  compares: 'compares',
  compare: 'compares',
  contrasts: 'compares',
  explains: 'explains',
  explain: 'explains',
  details: 'explains',
  references: 'references',
  reference: 'references',
  cites: 'references',
  supports: 'supports',
  support: 'supports',
  evidence: 'supports',
};

const STRUCTURE_KIND_ALIASES: Record<string, string> = {
  report: 'report',
  analysis: 'analysis',
  specification: 'specification',
  spec: 'specification',
  note: 'note',
  notes: 'note',
  record: 'record',
  dataset: 'dataset',
  table: 'table',
  chart: 'chart',
  graph: 'chart',
  diagram: 'diagram',
  image: 'image',
  photo: 'image',
  mixed: 'mixed',
  unknown: 'unknown',
};

export function normalizeSemanticLabel(input: unknown) {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeLabels(values: string[], limit: number) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const label = normalizeSemanticLabel(value);
    if (!label) {
      continue;
    }

    const dedupeKey = label.toLocaleLowerCase('en-US');
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    normalized.push(label);

    if (normalized.length >= limit) {
      break;
    }
  }

  return normalized;
}

export function normalizeTerms(input: unknown) {
  return dedupeLabels(Array.isArray(input) ? input.map(value => String(value)) : [], MAX_TERMS);
}

export function normalizeEntities(input: unknown) {
  return dedupeLabels(Array.isArray(input) ? input.map(value => String(value)) : [], MAX_ENTITIES);
}

export function normalizeStructure(input: unknown): SourceStructure | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const candidate = input as { kind?: unknown; label?: unknown };
  const rawKind = normalizeSemanticLabel(candidate.kind);
  const rawLabel = normalizeSemanticLabel(candidate.label);

  if (!rawKind && !rawLabel) {
    return undefined;
  }

  const kindKey = rawKind.toLocaleLowerCase('en-US');
  const kind = STRUCTURE_KIND_ALIASES[kindKey] ?? (rawKind || 'unknown').toLocaleLowerCase('en-US');
  const label = rawLabel || rawKind || 'Unknown';

  return { kind, label };
}

function normalizeRelationKind(input: unknown): RelationKind | undefined {
  const label = normalizeSemanticLabel(input).toLocaleLowerCase('en-US');
  return RELATION_KIND_ALIASES[label];
}

export function normalizeRelationHints(input: unknown) {
  if (!Array.isArray(input)) {
    return [] as RelationHint[];
  }

  const seen = new Set<string>();
  const hints: RelationHint[] = [];

  for (const item of input) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = item as { kind?: unknown; label?: unknown };
    const kind = normalizeRelationKind(candidate.kind);
    const label = normalizeSemanticLabel(candidate.label);

    if (!kind || !label) {
      continue;
    }

    const key = `${kind}:${label.toLocaleLowerCase('en-US')}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    hints.push({ kind, label });

    if (hints.length >= MAX_RELATION_HINTS) {
      break;
    }
  }

  return hints;
}