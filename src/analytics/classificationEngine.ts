import type { AnalyticalResult } from './types';

export type TaxonomySystem = 'FoodEx2' | 'Agribalyse' | 'OpenFoodFacts' | 'COICOP';

export type MappingType =
  | 'exact'
  | 'hierarchical'
  | 'approximate'
  | 'ambiguous'
  | 'unmatched';

export type HierarchyDirection = 'equivalent' | 'broader' | 'narrower';

export type ConfidenceTier = 'high' | 'moderate' | 'low' | 'unmatched';

export interface ClassificationMappingRecord {
  mapping_id: string;
  source_system: TaxonomySystem;
  source_code: string;
  source_label: string;
  source_parent_label: string | null;
  source_item_count: number;
  target_system: TaxonomySystem;
  target_code: string | null;
  target_label: string | null;
  mapping_type: MappingType;
  hierarchy_direction: HierarchyDirection | null;
  confidence_tier: ConfidenceTier;
  is_ambiguous: boolean;
  is_unmatched: boolean;
  candidate_targets: string | null;
  representative_agb_code: string | null;
  rationale: string;
  source_reference: string;
  mapping_version: string;
}

export interface ClassificationFilter {
  searchQuery?: string;
  sourceSystem?: TaxonomySystem | 'ALL';
  targetSystem?: TaxonomySystem | 'ALL';
  mappingTypes?: MappingType[];
  confidenceTiers?: ConfidenceTier[];
  onlyAmbiguous?: boolean;
  onlyUnmatched?: boolean;
}

export interface ClassificationSummary {
  totalRules: number;
  totalSourceItemsCovered: number;
  byMappingType: Record<MappingType, number>;
  byConfidenceTier: Record<ConfidenceTier, number>;
  bySourceSystem: Record<TaxonomySystem, number>;
  exactOrHierarchicalPct: number;
  ambiguousCount: number;
  unmatchedCount: number;
}

export const TAXONOMY_SYSTEMS: TaxonomySystem[] = [
  'Agribalyse',
  'FoodEx2',
  'OpenFoodFacts',
  'COICOP',
];

export const MAPPING_TYPES: MappingType[] = [
  'exact',
  'hierarchical',
  'approximate',
  'ambiguous',
  'unmatched',
];

export const CONFIDENCE_TIERS: ConfidenceTier[] = [
  'high',
  'moderate',
  'low',
  'unmatched',
];

export function filterMappings(
  records: readonly ClassificationMappingRecord[],
  filter: ClassificationFilter = {}
): ClassificationMappingRecord[] {
  const q = (filter.searchQuery ?? '').trim().toLowerCase();
  const typeSet = filter.mappingTypes?.length ? new Set(filter.mappingTypes) : null;
  const confSet = filter.confidenceTiers?.length ? new Set(filter.confidenceTiers) : null;

  return records.filter((rec) => {
    if (filter.sourceSystem && filter.sourceSystem !== 'ALL' && rec.source_system !== filter.sourceSystem) {
      return false;
    }
    if (filter.targetSystem && filter.targetSystem !== 'ALL' && rec.target_system !== filter.targetSystem) {
      return false;
    }
    if (typeSet && !typeSet.has(rec.mapping_type)) {
      return false;
    }
    if (confSet && !confSet.has(rec.confidence_tier)) {
      return false;
    }
    if (filter.onlyAmbiguous && !rec.is_ambiguous) {
      return false;
    }
    if (filter.onlyUnmatched && !rec.is_unmatched) {
      return false;
    }
    if (!q) {
      return true;
    }
    const haystack = [
      rec.mapping_id,
      rec.source_code,
      rec.source_label,
      rec.source_parent_label ?? '',
      rec.target_code ?? '',
      rec.target_label ?? '',
      rec.candidate_targets ?? '',
      rec.representative_agb_code ?? '',
      rec.rationale,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function summarizeMappings(
  records: readonly ClassificationMappingRecord[]
): AnalyticalResult<ClassificationSummary> {
  const byMappingType: Record<MappingType, number> = {
    exact: 0,
    hierarchical: 0,
    approximate: 0,
    ambiguous: 0,
    unmatched: 0,
  };
  const byConfidenceTier: Record<ConfidenceTier, number> = {
    high: 0,
    moderate: 0,
    low: 0,
    unmatched: 0,
  };
  const bySourceSystem: Record<TaxonomySystem, number> = {
    Agribalyse: 0,
    FoodEx2: 0,
    OpenFoodFacts: 0,
    COICOP: 0,
  };

  let totalSourceItemsCovered = 0;
  let ambiguousCount = 0;
  let unmatchedCount = 0;

  for (const r of records) {
    byMappingType[r.mapping_type] = (byMappingType[r.mapping_type] ?? 0) + 1;
    byConfidenceTier[r.confidence_tier] = (byConfidenceTier[r.confidence_tier] ?? 0) + 1;
    bySourceSystem[r.source_system] = (bySourceSystem[r.source_system] ?? 0) + 1;
    totalSourceItemsCovered += Number.isFinite(r.source_item_count) ? r.source_item_count : 0;
    if (r.is_ambiguous || r.mapping_type === 'ambiguous') ambiguousCount += 1;
    if (r.is_unmatched || r.mapping_type === 'unmatched') unmatchedCount += 1;
  }

  const totalRules = records.length;
  const cleanCount = byMappingType.exact + byMappingType.hierarchical;
  const exactOrHierarchicalPct =
    totalRules > 0 ? Math.round((cleanCount / totalRules) * 1000) / 10 : 0;

  return {
    data: {
      totalRules,
      totalSourceItemsCovered,
      byMappingType,
      byConfidenceTier,
      bySourceSystem,
      exactOrHierarchicalPct,
      ambiguousCount,
      unmatchedCount,
    },
    unit: 'classification_mapping_rules',
    provenance: {
      module: 'classificationEngine.summarizeMappings',
      version: records[0]?.mapping_version ?? '3.0.0-phase3a',
      dataNature: 'Manually Compiled',
      sources: Array.from(new Set(records.map((r) => r.source_reference))).filter(Boolean),
      assumptions: [
        'Exact equivalences are assigned only for direct 1:1 taxonomic scope matches.',
        'Unmatched records preserve NULL targets and qualitative confidence_tier = unmatched instead of fabricated bridges.',
      ],
    },
    missingness: {
      totalRecords: totalRules,
      includedRecords: totalRules - unmatchedCount,
      missingOrExcludedRecords: unmatchedCount,
    },
  };
}

export function findMappingsForCategory(
  records: readonly ClassificationMappingRecord[],
  system: TaxonomySystem,
  codeOrLabel: string
): ClassificationMappingRecord[] {
  const token = codeOrLabel.trim().toLowerCase();
  if (!token) return [];
  return records.filter(
    (r) =>
      (r.source_system === system &&
        (r.source_code.toLowerCase().includes(token) ||
          r.source_label.toLowerCase().includes(token))) ||
      (r.target_system === system &&
        ((r.target_code ?? '').toLowerCase().includes(token) ||
          (r.target_label ?? '').toLowerCase().includes(token) ||
          (r.candidate_targets ?? '').toLowerCase().includes(token)))
  );
}

const CSV_COLUMNS: (keyof ClassificationMappingRecord)[] = [
  'mapping_id',
  'source_system',
  'source_code',
  'source_label',
  'source_parent_label',
  'source_item_count',
  'target_system',
  'target_code',
  'target_label',
  'mapping_type',
  'hierarchy_direction',
  'confidence_tier',
  'is_ambiguous',
  'is_unmatched',
  'candidate_targets',
  'representative_agb_code',
  'rationale',
  'source_reference',
  'mapping_version',
];

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeMappingsToCsv(
  records: readonly ClassificationMappingRecord[]
): string {
  const header = CSV_COLUMNS.join(',');
  const lines = records.map((rec) =>
    CSV_COLUMNS.map((col) => escapeCsvCell(rec[col])).join(',')
  );
  return [header, ...lines].join('\n');
}

export function serializeMappingsToJson(
  records: readonly ClassificationMappingRecord[],
  filter?: ClassificationFilter
): string {
  const summary = summarizeMappings(records);
  return JSON.stringify(
    {
      schema_version: '3.0.0-phase3a',
      exported_at_utc: new Date().toISOString(),
      filter_applied: filter ?? {},
      summary: summary.data,
      provenance: summary.provenance,
      missingness: summary.missingness,
      records,
    },
    null,
    2
  );
}
