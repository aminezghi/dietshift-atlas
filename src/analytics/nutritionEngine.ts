import type { OFFProduct } from '../types/research';
import type { AnalyticalResult, DataNature } from './types';

export const NUTRITION_ENGINE_VERSION = '3.1.0-phase3b';

export type ComparisonBasis = 'per_100g' | 'per_100kcal' | 'per_serving';

export type NutrientKey =
  | 'energy_kcal'
  | 'proteins_g'
  | 'carbohydrates_g'
  | 'sugars_g'
  | 'fat_g'
  | 'saturated_fat_g'
  | 'fiber_g'
  | 'salt_g';

export const NUTRIENT_KEYS: NutrientKey[] = [
  'energy_kcal',
  'proteins_g',
  'carbohydrates_g',
  'sugars_g',
  'fat_g',
  'saturated_fat_g',
  'fiber_g',
  'salt_g',
];

export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  energy_kcal: 'Energy',
  proteins_g: 'Protein',
  carbohydrates_g: 'Carbohydrates',
  sugars_g: 'Sugars',
  fat_g: 'Total Fat',
  saturated_fat_g: 'Saturated Fat',
  fiber_g: 'Dietary Fiber',
  salt_g: 'Salt',
};

export type ExclusionReason =
  | 'missing_nutrient_value'
  | 'missing_energy'
  | 'non_positive_energy'
  | 'missing_serving_quantity'
  | 'invalid_serving_quantity';

export type ProfileCompleteness = 'complete' | 'partial' | 'missing';

export type ServingProvenance =
  | 'observed_mass_grams'
  | 'parsed_mass_unit'
  | 'parsed_volume_1g_ml_assumption'
  | 'unavailable';

export interface ParsedServingInfo {
  grams: number | null;
  rawServingSize: string | null;
  provenance: ServingProvenance;
  assumptionNote: string | null;
  invalidReason: 'missing_serving_quantity' | 'invalid_serving_quantity' | null;
}

export interface StandardizedNutritionInput {
  productId: string;
  barcode: string | null;
  name: string;
  category: string;
  sourceDataset: string;
  sourceRecordRef: string;
  dataNature: Extract<DataNature, 'Observed' | 'Estimated' | 'Model Output'>;
  servingQuantityG: number | null;
  servingSizeLabel: string | null;
  per100g: Record<NutrientKey, number | null>;
}

export interface ScraplingNutritionShape {
  barcode: string;
  product_name: string;
  fenomeno_category: string;
  energy_kcal: number | null;
  proteins_g: number | null;
  carbohydrates_g: number | null;
  sugars_g: number | null;
  saturated_fats_g: number | null;
  fiber_g: number | null;
  salt_g: number | null;
  serving_quantity_g?: number | null;
  serving_size?: string | null;
  data_source?: string;
}

export interface EvaluatedNutrientValue {
  key: NutrientKey;
  label: string;
  value: number | null;
  unit: string;
  originalPer100gValue: number | null;
  originalUnit: string;
  valueKind: 'observed' | 'derived' | 'missing' | 'excluded';
  transformation: string;
  exclusionReason: ExclusionReason | null;
}

export interface EvaluatedProductNutrition {
  productId: string;
  barcode: string | null;
  name: string;
  category: string;
  basis: ComparisonBasis;
  computableForBasis: boolean;
  basisExclusionReason: 'missing_energy' | 'non_positive_energy' | 'missing_serving_quantity' | 'invalid_serving_quantity' | null;
  servingInfo: ParsedServingInfo;
  completeness: ProfileCompleteness;
  presentNutrientCount: number;
  missingNutrientCount: number;
  values: Record<NutrientKey, EvaluatedNutrientValue>;
  sourceDataset: string;
  sourceRecordRef: string;
  dataNature: Extract<DataNature, 'Observed' | 'Estimated' | 'Model Output'>;
  calculationVersion: string;
}

export interface NutrientMetricSummary {
  nutrient: NutrientKey;
  label: string;
  basis: ComparisonBasis;
  unit: string;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  validDenominator: number;
  totalRecords: number;
  missingOrExcludedCount: number;
  coveragePct: number;
  exclusionReasons: Record<string, number>;
}

export interface CategoryNutritionAggregate {
  category: string;
  basis: ComparisonBasis;
  totalCategoryRecords: number;
  completenessBreakdown: Record<ProfileCompleteness, number>;
  metrics: Partial<Record<NutrientKey, NutrientMetricSummary>>;
  categoryDisclosure: string;
}

export interface DatasetNutritionCoverage {
  basis: ComparisonBasis;
  totalRecords: number;
  computableForBasisRecords: number;
  excludedForBasisRecords: number;
  completenessBreakdown: Record<ProfileCompleteness, number>;
  exclusionReasons: Record<string, number>;
  perNutrientCoverage: Record<NutrientKey, { valid: number; missingOrExcluded: number; coveragePct: number }>;
}

function cleanNum(val: number | null | undefined): number | null {
  if (val === null || val === undefined || typeof val !== 'number' || !Number.isFinite(val)) {
    return null;
  }
  return val < 0 ? null : val;
}

function roundTo(val: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(val * f) / f;
}

export function convertMassUnit(
  value: number | null,
  fromUnit: 'mg' | 'g' | 'kg',
  toUnit: 'mg' | 'g' | 'kg'
): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  const toGrams: Record<'mg' | 'g' | 'kg', number> = {
    mg: 0.001,
    g: 1,
    kg: 1000,
  };
  const grams = value * toGrams[fromUnit];
  return roundTo(grams / toGrams[toUnit], 6);
}

export function convertEnergyKjToKcal(kj: number | null): number | null {
  if (kj === null || !Number.isFinite(kj) || kj < 0) return null;
  return roundTo(kj / 4.184, 2);
}

export function parseServingSize(
  servingQuantityG: number | null | undefined,
  servingSizeLabel: string | null | undefined
): ParsedServingInfo {
  const rawStr = servingSizeLabel ? servingSizeLabel.trim() : null;

  if (servingQuantityG !== null && servingQuantityG !== undefined) {
    if (typeof servingQuantityG === 'number' && Number.isFinite(servingQuantityG) && servingQuantityG > 0) {
      return {
        grams: roundTo(servingQuantityG, 2),
        rawServingSize: rawStr,
        provenance: 'observed_mass_grams',
        assumptionNote: null,
        invalidReason: null,
      };
    }
    return {
      grams: null,
      rawServingSize: rawStr,
      provenance: 'unavailable',
      assumptionNote: null,
      invalidReason: 'invalid_serving_quantity',
    };
  }

  if (!rawStr) {
    return {
      grams: null,
      rawServingSize: null,
      provenance: 'unavailable',
      assumptionNote: null,
      invalidReason: 'missing_serving_quantity',
    };
  }

  const match = rawStr.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|mg|ml|cl|l)\b/i);
  if (!match) {
    return {
      grams: null,
      rawServingSize: rawStr,
      provenance: 'unavailable',
      assumptionNote: 'Unparseable serving unit; no standard serving assumed.',
      invalidReason: 'invalid_serving_quantity',
    };
  }

  const num = Number(match[1].replace(',', '.'));
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(num) || num <= 0) {
    return {
      grams: null,
      rawServingSize: rawStr,
      provenance: 'unavailable',
      assumptionNote: null,
      invalidReason: 'invalid_serving_quantity',
    };
  }

  if (unit === 'g' || unit === 'kg' || unit === 'mg') {
    const grams = convertMassUnit(num, unit, 'g');
    return {
      grams: grams !== null ? roundTo(grams, 2) : null,
      rawServingSize: rawStr,
      provenance: 'parsed_mass_unit',
      assumptionNote: unit === 'g' ? null : `Converted ${num} ${unit} to grams.`,
      invalidReason: grams && grams > 0 ? null : 'invalid_serving_quantity',
    };
  }

  const mlMultiplier: Record<string, number> = { ml: 1, cl: 10, l: 1000 };
  const ml = num * mlMultiplier[unit];
  return {
    grams: roundTo(ml, 2),
    rawServingSize: rawStr,
    provenance: 'parsed_volume_1g_ml_assumption',
    assumptionNote: `Parsed volumetric serving (${num} ${unit}) assuming 1.0 g/ml density.`,
    invalidReason: null,
  };
}

export function fromOFFProduct(p: OFFProduct): StandardizedNutritionInput {
  return {
    productId: p.code,
    barcode: p.code || null,
    name: p.name,
    category: p.category,
    sourceDataset: 'openfoodfacts_eu.parquet',
    sourceRecordRef: `openfoodfacts:${p.code}`,
    dataNature: 'Observed',
    servingQuantityG: p.serving_quantity_g ?? null,
    servingSizeLabel: p.serving_size ?? null,
    per100g: {
      energy_kcal: cleanNum(p.energy_kcal_100g),
      proteins_g: cleanNum(p.proteins_100g),
      carbohydrates_g: cleanNum(p.carbohydrates_100g),
      sugars_g: cleanNum(p.sugars_100g),
      fat_g: cleanNum(p.fat_100g),
      saturated_fat_g: cleanNum(p.saturated_fat_100g),
      fiber_g: cleanNum(p.fiber_100g),
      salt_g: cleanNum(p.salt_100g),
    },
  };
}

export function fromScraplingProduct(p: ScraplingNutritionShape): StandardizedNutritionInput {
  return {
    productId: p.barcode,
    barcode: p.barcode || null,
    name: p.product_name,
    category: p.fenomeno_category,
    sourceDataset: 'scrapling_retail_claims.parquet',
    sourceRecordRef: `scrapling:${p.barcode}`,
    dataNature: 'Observed',
    servingQuantityG: p.serving_quantity_g ?? null,
    servingSizeLabel: p.serving_size ?? null,
    per100g: {
      energy_kcal: cleanNum(p.energy_kcal),
      proteins_g: cleanNum(p.proteins_g),
      carbohydrates_g: cleanNum(p.carbohydrates_g),
      sugars_g: cleanNum(p.sugars_g),
      fat_g: null,
      saturated_fat_g: cleanNum(p.saturated_fats_g),
      fiber_g: cleanNum(p.fiber_g),
      salt_g: cleanNum(p.salt_g),
    },
  };
}

function unitForBasis(key: NutrientKey, basis: ComparisonBasis): string {
  const isEnergy = key === 'energy_kcal';
  if (basis === 'per_100g') return isEnergy ? 'kcal/100g' : 'g/100g';
  if (basis === 'per_100kcal') return isEnergy ? 'kcal/100kcal' : 'g/100kcal';
  return isEnergy ? 'kcal/serving' : 'g/serving';
}

export function evaluateProductNutrition(
  input: StandardizedNutritionInput,
  basis: ComparisonBasis
): EvaluatedProductNutrition {
  const presentNutrientCount = NUTRIENT_KEYS.filter((k) => input.per100g[k] !== null).length;
  const missingNutrientCount = NUTRIENT_KEYS.length - presentNutrientCount;
  const completeness: ProfileCompleteness =
    presentNutrientCount === NUTRIENT_KEYS.length
      ? 'complete'
      : presentNutrientCount >= 1
      ? 'partial'
      : 'missing';

  const servingInfo = parseServingSize(input.servingQuantityG, input.servingSizeLabel);
  const rawEnergy = input.per100g.energy_kcal;

  let basisExclusionReason: EvaluatedProductNutrition['basisExclusionReason'] = null;
  if (basis === 'per_100kcal') {
    if (rawEnergy === null) basisExclusionReason = 'missing_energy';
    else if (rawEnergy <= 0) basisExclusionReason = 'non_positive_energy';
  } else if (basis === 'per_serving') {
    if (servingInfo.grams === null || servingInfo.grams <= 0) {
      basisExclusionReason = servingInfo.invalidReason ?? 'missing_serving_quantity';
    }
  }

  const values = {} as Record<NutrientKey, EvaluatedNutrientValue>;

  for (const key of NUTRIENT_KEYS) {
    const orig = input.per100g[key];
    const origUnit = key === 'energy_kcal' ? 'kcal/100g' : 'g/100g';
    const targetUnit = unitForBasis(key, basis);

    if (basisExclusionReason !== null) {
      values[key] = {
        key,
        label: NUTRIENT_LABELS[key],
        value: null,
        unit: targetUnit,
        originalPer100gValue: orig,
        originalUnit: origUnit,
        valueKind: 'excluded',
        transformation: `Excluded from ${basis} (${basisExclusionReason})`,
        exclusionReason: basisExclusionReason,
      };
      continue;
    }

    if (orig === null) {
      values[key] = {
        key,
        label: NUTRIENT_LABELS[key],
        value: null,
        unit: targetUnit,
        originalPer100gValue: null,
        originalUnit: origUnit,
        valueKind: 'missing',
        transformation: 'Original value NULL (preserved missing; never imputed as 0)',
        exclusionReason: 'missing_nutrient_value',
      };
      continue;
    }

    if (basis === 'per_100g') {
      values[key] = {
        key,
        label: NUTRIENT_LABELS[key],
        value: orig,
        unit: targetUnit,
        originalPer100gValue: orig,
        originalUnit: origUnit,
        valueKind: 'observed',
        transformation: 'Identity per 100g (no rescaling)',
        exclusionReason: null,
      };
    } else if (basis === 'per_100kcal') {
      const denomKcal = rawEnergy as number;
      const derived = key === 'energy_kcal' ? 100 : roundTo((orig * 100) / denomKcal, 3);
      values[key] = {
        key,
        label: NUTRIENT_LABELS[key],
        value: derived,
        unit: targetUnit,
        originalPer100gValue: orig,
        originalUnit: origUnit,
        valueKind: 'derived',
        transformation:
          key === 'energy_kcal'
            ? 'Reference denominator normalized to 100 kcal'
            : `(${orig} ${origUnit} / ${denomKcal} kcal/100g) * 100`,
        exclusionReason: null,
      };
    } else {
      const sg = servingInfo.grams as number;
      const derived = roundTo((orig * sg) / 100, 3);
      values[key] = {
        key,
        label: NUTRIENT_LABELS[key],
        value: derived,
        unit: targetUnit,
        originalPer100gValue: orig,
        originalUnit: origUnit,
        valueKind: 'derived',
        transformation: `(${orig} ${origUnit} * ${sg}g serving) / 100${
          servingInfo.assumptionNote ? ` [${servingInfo.assumptionNote}]` : ''
        }`,
        exclusionReason: null,
      };
    }
  }

  return {
    productId: input.productId,
    barcode: input.barcode,
    name: input.name,
    category: input.category,
    basis,
    computableForBasis: basisExclusionReason === null,
    basisExclusionReason,
    servingInfo,
    completeness,
    presentNutrientCount,
    missingNutrientCount,
    values,
    sourceDataset: input.sourceDataset,
    sourceRecordRef: input.sourceRecordRef,
    dataNature: input.dataNature,
    calculationVersion: NUTRITION_ENGINE_VERSION,
  };
}

function computeMedian(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildNutrientSummary(
  evaluated: readonly EvaluatedProductNutrition[],
  nutrient: NutrientKey,
  basis: ComparisonBasis
): NutrientMetricSummary {
  const validVals: number[] = [];
  const exclusionReasons: Record<string, number> = {};

  for (const row of evaluated) {
    const cell = row.values[nutrient];
    if (cell.value !== null && Number.isFinite(cell.value)) {
      validVals.push(cell.value);
    } else {
      const reason = cell.exclusionReason ?? 'missing_nutrient_value';
      exclusionReasons[reason] = (exclusionReasons[reason] ?? 0) + 1;
    }
  }

  const total = evaluated.length;
  const validCount = validVals.length;
  const sorted = [...validVals].sort((a, b) => a - b);

  return {
    nutrient,
    label: NUTRIENT_LABELS[nutrient],
    basis,
    unit: unitForBasis(nutrient, basis),
    mean: validCount > 0 ? roundTo(validVals.reduce((s, v) => s + v, 0) / validCount, 2) : null,
    median: validCount > 0 ? roundTo(computeMedian(sorted), 2) : null,
    min: validCount > 0 ? roundTo(sorted[0], 2) : null,
    max: validCount > 0 ? roundTo(sorted[sorted.length - 1], 2) : null,
    validDenominator: validCount,
    totalRecords: total,
    missingOrExcludedCount: total - validCount,
    coveragePct: total > 0 ? roundTo((validCount / total) * 100, 1) : 0,
    exclusionReasons,
  };
}

export function summarizeNutrientMetric(
  inputs: readonly StandardizedNutritionInput[],
  nutrient: NutrientKey,
  basis: ComparisonBasis
): AnalyticalResult<NutrientMetricSummary> {
  const evaluated = inputs.map((item) => evaluateProductNutrition(item, basis));
  const summary = buildNutrientSummary(evaluated, nutrient, basis);

  return {
    data: summary,
    unit: summary.unit,
    provenance: {
      module: 'nutritionEngine.summarizeNutrientMetric',
      version: NUTRITION_ENGINE_VERSION,
      dataNature: basis === 'per_100g' ? 'Observed' : 'Model Output',
      sources: Array.from(new Set(inputs.map((i) => i.sourceDataset))),
      assumptions: [
        `Fixed comparison basis: ${basis} (never compares or averages incompatible units).`,
        'Missing nutrient values remain NULL and are excluded from means/medians; genuine zero values are retained in denominator n.',
        ...(basis === 'per_100kcal'
          ? ['Requires energy_kcal_100g > 0; missing or zero-energy items are excluded rather than imputed.']
          : []),
        ...(basis === 'per_serving'
          ? ['Requires observed serving_quantity_g or parseable serving_size; standard serving sizes are never assumed.']
          : []),
      ],
    },
    missingness: {
      totalRecords: summary.totalRecords,
      includedRecords: summary.validDenominator,
      missingOrExcludedRecords: summary.missingOrExcludedCount,
    },
  };
}

export function summarizeNutritionDataset(
  inputs: readonly StandardizedNutritionInput[],
  basis: ComparisonBasis
): AnalyticalResult<DatasetNutritionCoverage> {
  const evaluated = inputs.map((i) => evaluateProductNutrition(i, basis));
  const completenessBreakdown: Record<ProfileCompleteness, number> = {
    complete: 0,
    partial: 0,
    missing: 0,
  };
  const exclusionReasons: Record<string, number> = {};
  let computableForBasisRecords = 0;

  for (const row of evaluated) {
    completenessBreakdown[row.completeness] += 1;
    if (row.computableForBasis) {
      computableForBasisRecords += 1;
    } else if (row.basisExclusionReason) {
      exclusionReasons[row.basisExclusionReason] =
        (exclusionReasons[row.basisExclusionReason] ?? 0) + 1;
    }
  }

  const perNutrientCoverage = {} as DatasetNutritionCoverage['perNutrientCoverage'];
  for (const key of NUTRIENT_KEYS) {
    const valid = evaluated.filter((r) => r.values[key].value !== null).length;
    const total = evaluated.length;
    perNutrientCoverage[key] = {
      valid,
      missingOrExcluded: total - valid,
      coveragePct: total > 0 ? roundTo((valid / total) * 100, 1) : 0,
    };
  }

  const totalRecords = evaluated.length;
  return {
    data: {
      basis,
      totalRecords,
      computableForBasisRecords,
      excludedForBasisRecords: totalRecords - computableForBasisRecords,
      completenessBreakdown,
      exclusionReasons,
      perNutrientCoverage,
    },
    unit: basis,
    provenance: {
      module: 'nutritionEngine.summarizeNutritionDataset',
      version: NUTRITION_ENGINE_VERSION,
      dataNature: basis === 'per_100g' ? 'Observed' : 'Model Output',
      sources: Array.from(new Set(inputs.map((i) => i.sourceDataset))),
      assumptions: [
        'Complete profile requires all 8 core nutrients present; partial has 1–7; missing has 0.',
        'Observed zeros count as valid numeric values and are never collapsed with NULL.',
      ],
    },
    missingness: {
      totalRecords,
      includedRecords: computableForBasisRecords,
      missingOrExcludedRecords: totalRecords - computableForBasisRecords,
    },
  };
}

export function aggregateNutritionByCategory(
  inputs: readonly StandardizedNutritionInput[],
  basis: ComparisonBasis,
  nutrients: readonly NutrientKey[] = ['energy_kcal', 'proteins_g', 'sugars_g', 'saturated_fat_g', 'fiber_g', 'salt_g']
): AnalyticalResult<CategoryNutritionAggregate[]> {
  const evaluated = inputs.map((i) => evaluateProductNutrition(i, basis));
  const byCategory = new Map<string, EvaluatedProductNutrition[]>();

  for (const row of evaluated) {
    const list = byCategory.get(row.category) ?? [];
    list.push(row);
    byCategory.set(row.category, list);
  }

  const aggregates: CategoryNutritionAggregate[] = [];
  for (const [category, rows] of Array.from(byCategory.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const completenessBreakdown: Record<ProfileCompleteness, number> = {
      complete: 0,
      partial: 0,
      missing: 0,
    };
    for (const r of rows) completenessBreakdown[r.completeness] += 1;

    const metrics: Partial<Record<NutrientKey, NutrientMetricSummary>> = {};
    for (const nk of nutrients) {
      metrics[nk] = buildNutrientSummary(rows, nk, basis);
    }

    aggregates.push({
      category,
      basis,
      totalCategoryRecords: rows.length,
      completenessBreakdown,
      metrics,
      categoryDisclosure: `Category aggregate over ${rows.length} product rows on '${basis}' basis; does not represent any single barcode's observed composition.`,
    });
  }

  const computableCount = evaluated.filter((r) => r.computableForBasis).length;
  return {
    data: aggregates,
    unit: basis,
    provenance: {
      module: 'nutritionEngine.aggregateNutritionByCategory',
      version: NUTRITION_ENGINE_VERSION,
      dataNature: basis === 'per_100g' ? 'Observed' : 'Model Output',
      sources: Array.from(new Set(inputs.map((i) => i.sourceDataset))),
      assumptions: [
        `Category aggregates calculated separately per nutrient using explicit observed/derived denominators on '${basis}' basis.`,
        'Category averages describe pooled distribution moments, never individual product observations.',
      ],
    },
    missingness: {
      totalRecords: evaluated.length,
      includedRecords: computableCount,
      missingOrExcludedRecords: evaluated.length - computableCount,
    },
  };
}

export interface NovaFilteredProductsResult {
  filtered: OFFProduct[];
  baseCategorySearchMatchedCount: number;
  knownNovaMatchedCount: number;
  missingNovaMatchedCount: number;
  excludedNonMatchingNovaCount: number;
  excludedMissingNovaCount: number;
}

/**
 * Filters Open Food Facts rows by category, search query, and NOVA selection while
 * keeping missing/NULL NOVA classification counts explicit instead of silently hiding them.
 */
export function filterProductsWithNovaAudit(
  products: readonly OFFProduct[],
  params: {
    selectedCategory: string;
    selectedNova: readonly number[];
    includeMissingNova: boolean;
    searchQuery: string;
  }
): NovaFilteredProductsResult {
  const q = params.searchQuery.trim().toLowerCase();
  const baseMatched = products.filter((p) => {
    const matchCat = params.selectedCategory === 'ALL' || p.category === params.selectedCategory;
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  let missingNovaMatchedCount = 0;
  let knownNovaMatchedCount = 0;
  let excludedNonMatchingNovaCount = 0;
  let excludedMissingNovaCount = 0;
  const filtered: OFFProduct[] = [];

  for (const p of baseMatched) {
    if (p.nova_group == null) {
      missingNovaMatchedCount += 1;
      if (params.includeMissingNova) {
        filtered.push(p);
      } else {
        excludedMissingNovaCount += 1;
      }
    } else {
      knownNovaMatchedCount += 1;
      if (params.selectedNova.includes(p.nova_group)) {
        filtered.push(p);
      } else {
        excludedNonMatchingNovaCount += 1;
      }
    }
  }

  return {
    filtered,
    baseCategorySearchMatchedCount: baseMatched.length,
    knownNovaMatchedCount,
    missingNovaMatchedCount,
    excludedNonMatchingNovaCount,
    excludedMissingNovaCount,
  };
}
