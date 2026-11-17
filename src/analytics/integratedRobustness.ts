import {
  AFFORDABILITY_ENGINE_VERSION,
  type CoHDRecord,
  type ObservedRetailPriceRecord,
  type PppBenchmarkRecord,
  aggregateRetailPricesByCategory,
  evaluateRetailUnitPrice,
} from './affordabilityEngine';
import type { ClassificationMappingRecord } from './classificationEngine';
import {
  ENVIRONMENT_ENGINE_VERSION,
  ENVIRONMENT_SOURCE_METADATA,
  type GITerroirInput,
  type PooreLcaInput,
  aggregateEnvironmentByCategory,
  filterFoodEligibleEnvironmentRecords,
  fromAgribalyseItem,
  fromGITerroirItem,
  fromPooreNemecekItem,
} from './environmentEngine';
import {
  type ComparatorRankingDimension,
  INTEGRATED_COMPARATOR_VERSION,
  type IntegratedSupportLevel,
  buildIntegratedCategoryProfiles,
  rankCategoriesWithinDimension,
} from './integratedComparator';
import {
  NUTRIENT_KEYS,
  NUTRITION_ENGINE_VERSION,
  type NutrientKey,
  type StandardizedNutritionInput,
  aggregateNutritionByCategory,
} from './nutritionEngine';
import {
  EFFECT_MECHANISM_LABELS,
  type EffectMechanism,
  SMALL_RANK_CORRELATION_THRESHOLD,
  type ScenarioOrigin,
  type ScenarioType,
  computeSpearmanRankCorrelation,
} from './sensitivityEngine';
import type { AgribalyseItem, EurostatCountryData } from '../types/research';
import type { AnalyticalResult } from './types';

export const INTEGRATED_ROBUSTNESS_VERSION = '4.4.0-phase4d';
export const MIN_GROUP_STABILITY_UNIVERSE = 6;

export type RobustnessLayerId =
  | 'classification'
  | 'nutrition'
  | 'environment'
  | 'affordability';

export type PermittedRobustnessRankingDimension = Exclude<
  ComparatorRankingDimension,
  'hicp_inflation_pct'
>;

export const PERMITTED_ROBUSTNESS_RANKING_DIMENSIONS: readonly PermittedRobustnessRankingDimension[] =
  [
    'agb_climate_co2eq_per_kg',
    'agb_water_aware_m3_per_kg',
    'protein_per_100g',
    'fiber_per_100g',
    'sugars_per_100g',
    'energy_kcal_per_100g',
  ];

export interface RobustnessScenarioSpec {
  scenarioId: string;
  baselineId: string;
  layer: RobustnessLayerId;
  label: string;
  scenarioType: ScenarioType;
  scenarioOrigin: ScenarioOrigin;
  effectMechanism: EffectMechanism;
  assumptionId: string;
  assumptionSummary: string;
  evidenceOrRationale: string;
}

export const INTEGRATED_ROBUSTNESS_REGISTRY: readonly RobustnessScenarioSpec[] = [
  {
    scenarioId: 'rob_cls_exclude_ambiguous',
    baselineId: 'rob_cls_baseline',
    layer: 'classification',
    label: 'Classification: Exclude ambiguous splits (34 rules removed)',
    scenarioType: 'data_subset_sensitivity',
    scenarioOrigin: 'empirical_alternative',
    effectMechanism: 'inclusion_exclusion_rule',
    assumptionId: 'ASSUMP_CLS_MAPPING_TIERS',
    assumptionSummary: 'Drops is_ambiguous=true rules before building integrated profiles.',
    evidenceOrRationale: 'Ambiguous COICOP splits combine nutritionally & environmentally distinct groups.',
  },
  {
    scenarioId: 'rob_cls_strict_hierarchy',
    baselineId: 'rob_cls_baseline',
    layer: 'classification',
    label: 'Classification: Exact + hierarchical only (50 rules removed)',
    scenarioType: 'data_subset_sensitivity',
    scenarioOrigin: 'empirical_alternative',
    effectMechanism: 'inclusion_exclusion_rule',
    assumptionId: 'ASSUMP_CLS_MAPPING_TIERS',
    assumptionSummary: 'Drops both approximate analogies and ambiguous splits.',
    evidenceOrRationale: 'Tests integrated category bridge survival when only strict taxonomic links remain.',
  },
  {
    scenarioId: 'rob_cls_exact_only',
    baselineId: 'rob_cls_baseline',
    layer: 'classification',
    label: 'Classification: Strict exact equivalence only (0 COICOP bridges)',
    scenarioType: 'data_subset_sensitivity',
    scenarioOrigin: 'empirical_alternative',
    effectMechanism: 'inclusion_exclusion_rule',
    assumptionId: 'ASSUMP_CLS_MAPPING_TIERS',
    assumptionSummary: 'Requires mapping_type=exact (only 1 OFF->FoodEx2 exact match exists; 0 OFF->COICOP exact bridges).',
    evidenceOrRationale: 'Demonstrates collapse of COICOP-Agribalyse bridges when exact equivalence is required.',
  },
  {
    scenarioId: 'rob_nut_core5_cc',
    baselineId: 'rob_nut_baseline_per100g',
    layer: 'nutrition',
    label: 'Nutrition: Core-5 complete-case vs pairwise per_100g (protein_per_100g)',
    scenarioType: 'missingness_sensitivity',
    scenarioOrigin: 'empirical_alternative',
    effectMechanism: 'sample_population_change',
    assumptionId: 'ASSUMP_NUT_MISSINGNESS_STRATEGY',
    assumptionSummary: 'Restricts SKUs to complete mandatory Core-5 panel (n=3,130 vs 3,169 pairwise protein).',
    evidenceOrRationale: 'Measures category protein rank & mean sensitivity to partial nutrition panel gaps.',
  },
  {
    scenarioId: 'rob_nut_full8_cc',
    baselineId: 'rob_nut_baseline_per100g',
    layer: 'nutrition',
    label: 'Nutrition: Full-8 complete-case incl. optional fiber (protein_per_100g)',
    scenarioType: 'missingness_sensitivity',
    scenarioOrigin: 'empirical_alternative',
    effectMechanism: 'sample_population_change',
    assumptionId: 'ASSUMP_NUT_MISSINGNESS_STRATEGY',
    assumptionSummary: 'Restricts to SKUs with all 8 nutrients incl. fiber_g (n=1,846 vs 3,169).',
    evidenceOrRationale: 'Whole-food lines declare fiber disproportionately; isolates optional-fiber selection bias.',
  },
  {
    scenarioId: 'rob_nut_derived_per100kcal',
    baselineId: 'rob_nut_baseline_per100g',
    layer: 'nutrition',
    label: 'Nutrition: Derived per-100 kcal vs observed per-100g (rank only)',
    scenarioType: 'boundary_or_functional_unit_sensitivity',
    scenarioOrigin: 'analyst_defined',
    effectMechanism: 'functional_unit_or_boundary_change',
    assumptionId: 'ASSUMP_NUT_MISSINGNESS_STRATEGY',
    assumptionSummary: 'Evaluates nutrient-specific denominators intersecting positive energy (3,097) and nutrient availability.',
    evidenceOrRationale: 'Shifts comparison from mass density to energy density; never subtracts g/100g from g/100kcal.',
  },
  {
    scenarioId: 'rob_env_agb_lci_count_vs_equal_subgroup',
    baselineId: 'rob_env_agb_lci_count',
    layer: 'environment',
    label: 'Environment (Agribalyse Model Output): Equal-subgroup (1/k) vs LCI-record-count weights',
    scenarioType: 'methodological_sensitivity',
    scenarioOrigin: 'analyst_defined',
    effectMechanism: 'analytical_method_change',
    assumptionId: 'ASSUMP_AGG_ESTIMATOR_WEIGHTS',
    assumptionSummary: 'Compares Agribalyse LCI-record-count weighting (0 duplicate subgroups verified) against equal-subgroup (1/k) weights.',
    evidenceOrRationale: 'Neither reflects consumption/market-share weights (unavailable); measures LCI subgroup density influence.',
  },
  {
    scenarioId: 'rob_env_agb_median_vs_mean',
    baselineId: 'rob_env_agb_group_mean',
    layer: 'environment',
    label: 'Environment (Agribalyse Model Output): Groupe median vs arithmetic mean CO₂',
    scenarioType: 'methodological_sensitivity',
    scenarioOrigin: 'empirical_alternative',
    effectMechanism: 'analytical_method_change',
    assumptionId: 'ASSUMP_ENV_PROXY_AND_SECTOR',
    assumptionSummary: 'Compares Agribalyse Groupe_aliment median vs mean across CO₂eq/kg within identical LCI boundary.',
    evidenceOrRationale: 'Tests ruminant tail skewness across all 2,451 modeled French LCI items.',
  },
  {
    scenarioId: 'rob_env_poore_excl_transport',
    baselineId: 'rob_env_poore_full',
    layer: 'environment',
    label: 'Environment (Poore & Nemecek Estimated): Exclude transport stage (rank & magnitude)',
    scenarioType: 'boundary_or_functional_unit_sensitivity',
    scenarioOrigin: 'empirical_alternative',
    effectMechanism: 'functional_unit_or_boundary_change',
    assumptionId: 'ASSUMP_ENV_PROXY_AND_SECTOR',
    assumptionSummary: 'Evaluated strictly on Poore global farm-to-retail commodities (never mixed with Agribalyse).',
    evidenceOrRationale: 'Verifies whether food-miles alter global commodity GHG ranks.',
  },
  {
    scenarioId: 'rob_env_poore_protein_unit',
    baselineId: 'rob_env_poore_full',
    layer: 'environment',
    label: 'Environment (Poore & Nemecek Estimated): per-100g protein vs per-kg GHG (rank only)',
    scenarioType: 'boundary_or_functional_unit_sensitivity',
    scenarioOrigin: 'analyst_defined',
    effectMechanism: 'functional_unit_or_boundary_change',
    assumptionId: 'ASSUMP_ENV_PROXY_AND_SECTOR',
    assumptionSummary: 'Switches functional unit to 100g protein (excludes 13 missing-protein commodities).',
    evidenceOrRationale: 'Assesses functional-unit rank shifts independently of Agribalyse and GI proxies.',
  },
  {
    scenarioId: 'rob_aff_fr_subset',
    baselineId: 'rob_aff_full_sku',
    layer: 'affordability',
    label: 'Affordability Coverage: France-only vs Full Open Prices SKU stream (descriptive)',
    scenarioType: 'data_subset_sensitivity',
    scenarioOrigin: 'empirical_alternative',
    effectMechanism: 'sample_population_change',
    assumptionId: 'ASSUMP_GEO_SAMPLE_COMPOSITION',
    assumptionSummary: 'Recomputes valid EUR/kg (904/1,178), EUR/L (172), and exact OFF barcode overlap independently for FR.',
    evidenceOrRationale: 'Preserves 2 EUR/kg + 2 EUR/L match split without fabricating category-level retail rank stability.',
  },
  {
    scenarioId: 'rob_aff_de_subset',
    baselineId: 'rob_aff_full_sku',
    layer: 'affordability',
    label: 'Affordability Coverage: Germany-only vs Full Open Prices SKU stream (descriptive)',
    scenarioType: 'data_subset_sensitivity',
    scenarioOrigin: 'empirical_alternative',
    effectMechanism: 'sample_population_change',
    assumptionId: 'ASSUMP_GEO_SAMPLE_COMPOSITION',
    assumptionSummary: 'Recomputes valid EUR/kg (94/115), EUR/L (6), and exact OFF barcode overlap independently for DE (0 matches).',
    evidenceOrRationale: 'Demonstrates complete absence of OFF-Open Prices barcode overlap in the DE slice.',
  },
];

export type GroupStabilityStatus =
  | 'computed'
  | 'insufficient_group_stability_universe'
  | 'not_applicable_descriptive_only';

export interface TopBottomStabilityResult {
  commonUniverseSize: number;
  status: GroupStabilityStatus;
  kCutoff: number;
  topKBaseIds: string[];
  topKScenIds: string[];
  topKRealizedSizes: { baseline: number; scenario: number };
  topKJaccard: number | null;
  topKEntering: string[];
  topKExiting: string[];
  bottomKBaseIds: string[];
  bottomKScenIds: string[];
  bottomKRealizedSizes: { baseline: number; scenario: number };
  bottomKJaccard: number | null;
  bottomKEntering: string[];
  bottomKExiting: string[];
  topBottomOverlapBase: string[];
  topBottomOverlapScen: string[];
  note: string;
}

export interface IntegratedComparisonUniverse {
  commonCategoryIds: string[];
  commonUniverseSize: number;
  baselineOnlyExcludedIds: string[];
  scenarioOnlyExcludedIds: string[];
  exclusionReason: string;
}

export interface IntegratedRankingStability {
  dimension: string;
  baselineDimension: string;
  scenarioDimension: string;
  unit: string;
  pairwiseSampleSize: number;
  tiedRankGroupsCount: number;
  excludedCategoriesCount: number;
  spearmanRho: number | null;
  smallRankSampleWarning: boolean;
  groupStability: TopBottomStabilityResult;
  comparisonNote?: string;
}

export interface EnvironmentalWeightingGrainMetadata {
  totalAgribalyseLciCatalogCount: number;
  validLciRecordCount: number;
  categoryLciRecordPairCount: number;
  totalCoicopMappedSubgroupCount: number;
  uniqueLciSubgroupCount: number;
  categorySubgroupPairCount: number;
  sharedSubgroupInstancesCount: number;
  eligibleCategoryCount: number;
  finalCategoryEstimateCount: number;
  aggregationWeightingMethod: {
    baseline: 'lci_record_count_per_category_weighted_mean';
    scenario: 'equal_subgroup_weight_1_over_k_per_category';
  };
  grainExplanation: string;
}

export interface RetailSubsetEvidenceStats {
  subsetCode: 'FULL' | 'FR' | 'DE';
  rawSkuCount: number;
  validMassEurKgCount: number;
  validLiquidEurLCount: number;
  missingQuantityCount: number;
  exactOffBarcodeTotalMatches: number;
  exactOffBarcodeMassEurKgMatches: number;
  exactOffBarcodeLiquidEurLMatches: number;
  matchedCategoriesEurKg: string[];
  matchedCategoriesEurL: string[];
  note: string;
}

export interface IntegratedRobustnessResult {
  robustnessVersion: string;
  scenarioId: string;
  baselineId: string;
  layer: RobustnessLayerId;
  label: string;
  scenarioType: ScenarioType;
  scenarioOrigin: ScenarioOrigin;
  effectMechanism: EffectMechanism;
  effectMechanismLabel: string;
  assumptionId: string;
  reusedEngineAndVersion: string;
  comparisonUniverse: IntegratedComparisonUniverse;
  denominators: {
    baselineTotal: number;
    baselineValid: number;
    baselineExcluded: number;
    scenarioTotal: number;
    scenarioValid: number;
    scenarioExcluded: number;
    denominatorDelta: number | null;
    denominatorGrainComparable: boolean;
    denominatorDeltaBlockedReason: string | null;
    positiveEnergyEligibleCount?: number;
    nutrientSpecificBaselineDenominators?: Partial<Record<NutrientKey, number>>;
    nutrientSpecificScenarioDenominators?: Partial<Record<NutrientKey, number>>;
    supportMigrationCounts?: Record<IntegratedSupportLevel, number>;
    environmentalWeightingGrain?: EnvironmentalWeightingGrainMetadata;
    retailBaselineSubset?: RetailSubsetEvidenceStats;
    retailScenarioSubset?: RetailSubsetEvidenceStats;
  };
  valueSummary: {
    comparableAcrossUnits: boolean;
    baselineMean: number | null;
    scenarioMean: number | null;
    absoluteDiff: number | null;
    relativeDiffPct: number | null;
    unit: string;
    crossUnitNote: string | null;
  };
  rankingStability: IntegratedRankingStability | null;
  dimensionRankings: IntegratedRankingStability[];
  rankingBlockedReason: string | null;
  caveats: string[];
}

export type CategoryEvidenceLayerId =
  | 'classification_bridge'
  | 'nutrition_per_100g'
  | 'nutrition_per_100kcal'
  | 'nutrition_per_serving'
  | 'environment_agribalyse'
  | 'environment_poore'
  | 'environment_gi_proxy'
  | 'affordability_retail_sku_eur_kg';

export const CATEGORY_EVIDENCE_LAYER_ORDER: readonly CategoryEvidenceLayerId[] = [
  'classification_bridge',
  'nutrition_per_100g',
  'nutrition_per_100kcal',
  'nutrition_per_serving',
  'environment_agribalyse',
  'environment_poore',
  'environment_gi_proxy',
  'affordability_retail_sku_eur_kg',
];

export type EvidenceNatureTag = 'Observed' | 'Estimated' | 'Model Output' | 'Proxy' | 'Missing';

export interface CategoryLayerCell {
  layerId: CategoryEvidenceLayerId;
  evidenceNature: EvidenceNatureTag;
  availabilityStatus: 'supported' | 'partial' | 'unsupported_blocked';
  validDenominator: number;
  sourceDatasetAndVersion: string;
  mappingOrMatchingStatus: string;
  functionalUnit: string;
  geographyAndBoundary: string;
  scope: 'category_level';
  blockingOrMissingnessReason: string | null;
}

export interface CategoryEvidenceCoverageRow {
  categoryId: string;
  categoryLabel: string;
  overallSupportLevel: IntegratedSupportLevel;
  supportedLayerCount: number;
  totalLayerCount: number;
  layers: Record<CategoryEvidenceLayerId, CategoryLayerCell>;
}

export interface MacroContextEvidencePanel {
  scope: 'macro_country_level';
  countryCode: string;
  hicp: {
    evidenceNature: 'Observed';
    isEuFallback: boolean;
    seriesAvailableCount: number;
    note: string;
  };
  ppp: {
    evidenceNature: 'Observed' | 'Missing';
    foodPriceLevelIndexEu27: number | null;
    referenceYear: number | null;
    note: string;
  };
  cohd: {
    evidenceNature: 'Observed' | 'Missing';
    costPerDayPppUsd: number | null;
    unaffordablePct: number | null;
    year: number | null;
    note: string;
  };
  categoryRankingEligibility: 'prohibited_macro_context_only';
}

export interface IntegratedRobustnessWorkspace {
  scenarios: IntegratedRobustnessResult[];
  evidenceMatrix: CategoryEvidenceCoverageRow[];
  macroContext: MacroContextEvidencePanel;
  lciSubgroupOverlapCheck: {
    totalAgribalyseCatalogCount: number;
    validUniqueLciRecordCount: number;
    categoryLciRecordPairCount: number;
    distinctSubgroupsMapped: number;
    activeUniqueSubgroupsCount: number;
    categorySubgroupPairCount: number;
    duplicateSubgroupCodesCount: number;
    eligibleCategoryCount: number;
    weightingNote: string;
  };
  perServingUnavailableDisclosure: string;
}

function roundTo(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

function meanOf(vals: readonly number[]): number | null {
  const c = vals.filter((v) => Number.isFinite(v));
  if (c.length === 0) return null;
  return roundTo(c.reduce((s, v) => s + v, 0) / c.length, 3);
}

/**
 * Computes Jaccard similarity J(A, B) = |A ∩ B| / |A ∪ B|.
 */
function jaccardSet(a: readonly string[], b: readonly string[]): number {
  const sA = new Set(a);
  const sB = new Set(b);
  const union = new Set([...sA, ...sB]);
  if (union.size === 0) return 1;
  let inter = 0;
  for (const x of sA) {
    if (sB.has(x)) inter += 1;
  }
  return roundTo(inter / union.size, 3);
}

/**
 * Selects top-K or bottom-K sets on a sorted score list, retaining ALL entries tied
 * at the K-th cutoff value to prevent arbitrary tie-breaking instability.
 */
function selectCutoffGroupWithTies(
  entries: ReadonlyArray<{ id: string; value: number }>,
  k: number,
  direction: 'top' | 'bottom'
): string[] {
  if (k <= 0 || entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) =>
    direction === 'top' ? b.value - a.value : a.value - b.value
  );
  const cutoffIdx = Math.min(k - 1, sorted.length - 1);
  const cutoffVal = sorted[cutoffIdx].value;
  return sorted
    .filter((e) =>
      direction === 'top' ? e.value >= cutoffVal - 1e-9 : e.value <= cutoffVal + 1e-9
    )
    .map((e) => e.id)
    .sort();
}

/**
 * Evaluates common-universe Top-K and Bottom-K set retention (K = min(3, n)),
 * requiring commonUniverseSize >= 6 before reporting Jaccard stability metrics.
 */
export function computeTopBottomStability(
  commonPairs: ReadonlyArray<{ key: string; valA: number; valB: number }>,
  minUniverseSize: number = MIN_GROUP_STABILITY_UNIVERSE
): TopBottomStabilityResult {
  const n = commonPairs.length;
  const k = Math.min(3, n);

  if (n < minUniverseSize) {
    return {
      commonUniverseSize: n,
      status: 'insufficient_group_stability_universe',
      kCutoff: k,
      topKBaseIds: [],
      topKScenIds: [],
      topKRealizedSizes: { baseline: 0, scenario: 0 },
      topKJaccard: null,
      topKEntering: [],
      topKExiting: [],
      bottomKBaseIds: [],
      bottomKScenIds: [],
      bottomKRealizedSizes: { baseline: 0, scenario: 0 },
      bottomKJaccard: null,
      bottomKEntering: [],
      bottomKExiting: [],
      topBottomOverlapBase: [],
      topBottomOverlapScen: [],
      note: `Common universe n=${n} < ${minUniverseSize} required categories; top/bottom group retention suppressed ('insufficient_group_stability_universe').`,
    };
  }

  const baseEntries = commonPairs.map((p) => ({ id: p.key, value: p.valA }));
  const scenEntries = commonPairs.map((p) => ({ id: p.key, value: p.valB }));

  const topBase = selectCutoffGroupWithTies(baseEntries, k, 'top');
  const topScen = selectCutoffGroupWithTies(scenEntries, k, 'top');
  const botBase = selectCutoffGroupWithTies(baseEntries, k, 'bottom');
  const botScen = selectCutoffGroupWithTies(scenEntries, k, 'bottom');

  const topEntering = topScen.filter((id) => !topBase.includes(id));
  const topExiting = topBase.filter((id) => !topScen.includes(id));
  const botEntering = botScen.filter((id) => !botBase.includes(id));
  const botExiting = botBase.filter((id) => !botScen.includes(id));

  const topBotBase = topBase.filter((id) => botBase.includes(id));
  const topBotScen = topScen.filter((id) => botScen.includes(id));

  const tieNotes: string[] = [];
  if (topBase.length > k || topScen.length > k || botBase.length > k || botScen.length > k) {
    tieNotes.push(
      `Cutoff ties expanded group sizes beyond K=${k} (top: ${topBase.length}/${topScen.length}, bottom: ${botBase.length}/${botScen.length}).`
    );
  }
  if (topBotBase.length > 0 || topBotScen.length > 0) {
    tieNotes.push(
      `Top/bottom overlap occurred (${topBotBase.length} baseline, ${topBotScen.length} scenario categories appear in both tails due to ties or n=${n}).`
    );
  }

  return {
    commonUniverseSize: n,
    status: 'computed',
    kCutoff: k,
    topKBaseIds: topBase,
    topKScenIds: topScen,
    topKRealizedSizes: { baseline: topBase.length, scenario: topScen.length },
    topKJaccard: jaccardSet(topBase, topScen),
    topKEntering: topEntering,
    topKExiting: topExiting,
    bottomKBaseIds: botBase,
    bottomKScenIds: botScen,
    bottomKRealizedSizes: { baseline: botBase.length, scenario: botScen.length },
    bottomKJaccard: jaccardSet(botBase, botScen),
    bottomKEntering: botEntering,
    bottomKExiting: botExiting,
    topBottomOverlapBase: topBotBase,
    topBottomOverlapScen: topBotScen,
    note:
      tieNotes.join(' ') ||
      `Computed strictly over common universe n=${n} (>=${minUniverseSize}), K=${k}; ties at cutoff retained without arbitrary tie-breaks.`,
  };
}

/**
 * Guard refusing HICP or macro dimensions from being used as category-level robustness ranking dimensions.
 */
export function assertPermittedRobustnessDimension(
  dimension: string
): asserts dimension is PermittedRobustnessRankingDimension {
  if (
    dimension === 'hicp_inflation_pct' ||
    !PERMITTED_ROBUSTNESS_RANKING_DIMENSIONS.includes(dimension as PermittedRobustnessRankingDimension)
  ) {
    throw new Error(
      `Dimension '${dimension}' is prohibited for Phase 4D category-level robustness ranking: HICP, PPP, and CoHD are macro/national indices rather than independent category-level observations.`
    );
  }
}

/**
 * Guard blocking denominator difference arithmetic across incompatible analytical grains
 * (e.g., LCI-record links vs category-subgroup pairs).
 */
export function assertDenominatorGrainCompatibility(
  baselineGrain: string,
  scenarioGrain: string
): void {
  if (baselineGrain !== scenarioGrain) {
    throw new Error(
      `Incompatible denominator grains ('${baselineGrain}' vs '${scenarioGrain}'): ordinary denominatorDelta subtraction is blocked.`
    );
  }
}

function buildComparisonAndRanking(
  baseMap: ReadonlyMap<string, number>,
  scenMap: ReadonlyMap<string, number>,
  dimension: string,
  unit: string,
  exclusionReason: string,
  options?: {
    baselineDimension?: string;
    scenarioDimension?: string;
    comparisonNote?: string;
  }
): {
  universe: IntegratedComparisonUniverse;
  ranking: IntegratedRankingStability;
} {
  const baseKeys = Array.from(baseMap.keys());
  const scenKeys = Array.from(scenMap.keys());
  const commonIds = baseKeys.filter((k) => scenMap.has(k)).sort();
  const baseOnly = baseKeys.filter((k) => !scenMap.has(k)).sort();
  const scenOnly = scenKeys.filter((k) => !baseMap.has(k)).sort();

  const commonPairs = commonIds.map((k) => ({
    key: k,
    valA: baseMap.get(k)!,
    valB: scenMap.get(k)!,
  }));

  const { rho, pairwiseSampleSize, tiedRankGroupsCount } =
    computeSpearmanRankCorrelation(commonPairs);
  const groupStability = computeTopBottomStability(commonPairs, MIN_GROUP_STABILITY_UNIVERSE);

  return {
    universe: {
      commonCategoryIds: commonIds,
      commonUniverseSize: commonIds.length,
      baselineOnlyExcludedIds: baseOnly,
      scenarioOnlyExcludedIds: scenOnly,
      exclusionReason,
    },
    ranking: {
      dimension,
      baselineDimension: options?.baselineDimension ?? dimension,
      scenarioDimension: options?.scenarioDimension ?? dimension,
      unit,
      pairwiseSampleSize,
      tiedRankGroupsCount,
      excludedCategoriesCount: baseOnly.length + scenOnly.length,
      spearmanRho: rho,
      smallRankSampleWarning: pairwiseSampleSize < SMALL_RANK_CORRELATION_THRESHOLD,
      groupStability,
      comparisonNote: options?.comparisonNote,
    },
  };
}

/**
 * Computes exact SKU counts and exact OFF barcode overlap splits (EUR/kg vs EUR/L)
 * independently for the requested retail slice—never assuming uniform national distribution.
 */
export function inspectRetailSubsetEvidence(
  subsetRecords: readonly ObservedRetailPriceRecord[],
  offBarcodesByCat: ReadonlyMap<string, string>,
  subsetCode: 'FULL' | 'FR' | 'DE'
): RetailSubsetEvidenceStats {
  let validMassEurKgCount = 0;
  let validLiquidEurLCount = 0;
  let missingQuantityCount = 0;

  let exactOffBarcodeTotalMatches = 0;
  let exactOffBarcodeMassEurKgMatches = 0;
  let exactOffBarcodeLiquidEurLMatches = 0;
  const matchedCatsKg = new Set<string>();
  const matchedCatsL = new Set<string>();

  for (const r of subsetRecords) {
    const evalKg = evaluateRetailUnitPrice(r, 'per_kg');
    const evalL = evaluateRetailUnitPrice(r, 'per_litre');
    if (evalKg.computable) validMassEurKgCount += 1;
    else if (evalL.computable) validLiquidEurLCount += 1;
    else if (evalKg.exclusionReason === 'missing_package_quantity') missingQuantityCount += 1;

    const offCat = offBarcodesByCat.get(r.barcode);
    if (offCat) {
      exactOffBarcodeTotalMatches += 1;
      if (evalKg.computable) {
        exactOffBarcodeMassEurKgMatches += 1;
        matchedCatsKg.add(offCat);
      } else if (evalL.computable) {
        exactOffBarcodeLiquidEurLMatches += 1;
        matchedCatsL.add(offCat);
      }
    }
  }

  return {
    subsetCode,
    rawSkuCount: subsetRecords.length,
    validMassEurKgCount,
    validLiquidEurLCount,
    missingQuantityCount,
    exactOffBarcodeTotalMatches,
    exactOffBarcodeMassEurKgMatches,
    exactOffBarcodeLiquidEurLMatches,
    matchedCategoriesEurKg: Array.from(matchedCatsKg).sort(),
    matchedCategoriesEurL: Array.from(matchedCatsL).sort(),
    note: `${subsetCode}: ${subsetRecords.length} raw SKUs (${validMassEurKgCount} valid EUR/kg, ${validLiquidEurLCount} valid EUR/L, ${missingQuantityCount} missing quantity); ${exactOffBarcodeTotalMatches} exact OFF barcode overlap (${exactOffBarcodeMassEurKgMatches} EUR/kg, ${exactOffBarcodeLiquidEurLMatches} EUR/L).`,
  };
}

/**
 * Rough commodity alignment lookup linking OFF category nodes cleanly to direct Poore & Nemecek items
 * ONLY where an explicit commodity match exists (never fabricating composite UPF matches).
 */
const OFF_TO_POORE_COMMODITIES: Readonly<Record<string, readonly string[]>> = {
  'Bovine, Pork & Poultry Meats': [
    'Beef (beef herd)',
    'Beef (dairy herd)',
    'Lamb & Mutton',
    'Pig Meat',
    'Poultry Meat',
  ],
  'Dairy Milk, Cheese & Yogurt': ['Milk', 'Cheese'],
  'Fish & Seafood': ['Fish (farmed)', 'Prawns (farmed)'],
  'Fresh & Frozen Vegetables & Fruits': [
    'Tomatoes',
    'Onions & Leeks',
    'Root Vegetables',
    'Brassicas',
    'Other Vegetables',
    'Apples',
    'Bananas',
    'Berries & Grapes',
    'Citrus Fruit',
  ],
  'Legumes, Pulses & Tofu': ['Pulses', 'Peas', 'Tofu', 'Other Pulses'],
  'Nuts, Seeds & Healthy Oils': ['Nuts', 'Groundnuts', 'Olive Oil', 'Rapeseed Oil', 'Sunflower Oil'],
  'Plant-Based Milk & Dairy Alternatives': ['Soymilk'],
  'Whole Grains, Oats & Cereals': ['Oatmeal', 'Wheat & Rye', 'Rice', 'Maize', 'Barley'],
};

const OFF_TO_GI_FOOD_CLASSES: Readonly<Record<string, readonly string[]>> = {
  'Bovine, Pork & Poultry Meats': ['Fresh meat (and offal)', 'Meat products (cooked, salted, smoked, etc.)'],
  'Dairy Milk, Cheese & Yogurt': ['Cheeses', 'Other products of animal origin (eggs, honey, dairy products except butter, milks etc.)'],
  'Fish & Seafood': ['Fresh fish, molluscs, and crustaceans and products derived therefrom'],
  'Fresh & Frozen Vegetables & Fruits': ['Fruit, vegetables and cereals fresh or processed'],
  'Legumes, Pulses & Tofu': ['Fruit, vegetables and cereals fresh or processed'],
  'Nuts, Seeds & Healthy Oils': ['Oils and fats (butter, margarine, oil, etc.)'],
  'Whole Grains, Oats & Cereals': ['Bread, pastry, cakes, confectionery, biscuits and other baker\'s wares', 'Fruit, vegetables and cereals fresh or processed'],
};

export interface IntegratedRobustnessInputs {
  mappings: readonly ClassificationMappingRecord[];
  nutritionInputs: readonly StandardizedNutritionInput[];
  agribalyseItems: readonly AgribalyseItem[];
  pooreItems: readonly PooreLcaInput[];
  giItems: readonly GITerroirInput[];
  retailPriceRecords: readonly ObservedRetailPriceRecord[];
  hicpCountryCode: string;
  hicpData: EurostatCountryData | null;
  isHicpEuFallback: boolean;
  pppBenchmark: PppBenchmarkRecord | null;
  cohdLatest: CoHDRecord | null;
}

export function evaluateIntegratedRobustnessSuite(
  inputs: IntegratedRobustnessInputs
): AnalyticalResult<IntegratedRobustnessWorkspace> {
  const {
    mappings,
    nutritionInputs,
    agribalyseItems,
    pooreItems,
    giItems,
    retailPriceRecords,
    hicpCountryCode,
    hicpData,
    isHicpEuFallback,
    pppBenchmark,
    cohdLatest,
  } = inputs;

  const scenarios: IntegratedRobustnessResult[] = [];
  const regMap = new Map(INTEGRATED_ROBUSTNESS_REGISTRY.map((r) => [r.scenarioId, r]));

  // Verify zero duplicate AGB->COICOP subgroup mappings (no double-counting check)
  const agbSubCounts = new Map<string, number>();
  for (const m of mappings) {
    if (m.source_system === 'Agribalyse' && m.target_system === 'COICOP' && !m.is_unmatched) {
      agbSubCounts.set(m.source_code, (agbSubCounts.get(m.source_code) ?? 0) + 1);
    }
  }
  const duplicateSubgroupCodesCount = Array.from(agbSubCounts.values()).filter((c) => c > 1).length;

  // -------------------------------------------------------------------------
  // 1. Classification Regimes (exact comparator reuse, HICP excluded from rank)
  // -------------------------------------------------------------------------
  const baseIntegrated = buildIntegratedCategoryProfiles({
    mappings,
    nutritionInputs,
    agribalyseItems,
    retailPriceRecords,
    hicpCountryCode,
    hicpData,
    isHicpEuFallback,
    pppBenchmark,
    cohdLatest,
  });

  const baseCo2RankRows = rankCategoriesWithinDimension(
    baseIntegrated.data.profiles,
    'agb_climate_co2eq_per_kg'
  ).data;
  const baseWaterRankRows = rankCategoriesWithinDimension(
    baseIntegrated.data.profiles,
    'agb_water_aware_m3_per_kg'
  ).data;
  const baseClsCo2Map = new Map(baseCo2RankRows.map((r) => [r.categoryLabel, r.value]));
  const baseClsWaterMap = new Map(baseWaterRankRows.map((r) => [r.categoryLabel, r.value]));
  const baseClsDenom = baseIntegrated.data.profiles.reduce(
    (s, p) => s + (p.environmentPerKg?.matchedItemsDenominator ?? 0),
    0
  );

  // Reconcile Agribalyse grain counts once (shared between Environment weighting & workspace disclosure)
  const activeUniqueSubgroups = new Set<string>();
  let categorySubgroupPairCount = 0;
  let agbEligibleCategoryCount = 0;
  for (const prof of baseIntegrated.data.profiles) {
    if (prof.environmentPerKg && prof.classificationEvidence.matchedAgribalyseSubgroups.length > 0) {
      agbEligibleCategoryCount += 1;
      categorySubgroupPairCount += prof.classificationEvidence.matchedAgribalyseSubgroups.length;
      for (const sc of prof.classificationEvidence.matchedAgribalyseSubgroups) {
        activeUniqueSubgroups.add(sc);
      }
    }
  }
  const stdAgbAll = agribalyseItems.map(fromAgribalyseItem);
  const validUniqueMappedLciCount = stdAgbAll.filter((r) => {
    const sc = `AGB:${r.category}/${r.subCategory ?? 'other'}`;
    return activeUniqueSubgroups.has(sc) && r.metrics.climate_co2eq !== null;
  }).length;

  for (const clsCfg of [
    {
      id: 'rob_cls_exclude_ambiguous',
      pred: (m: ClassificationMappingRecord) => !m.is_ambiguous,
      note: 'Drops all is_ambiguous rules across FoodEx2, COICOP, and Agribalyse.',
    },
    {
      id: 'rob_cls_strict_hierarchy',
      pred: (m: ClassificationMappingRecord) =>
        m.mapping_type === 'exact' || m.mapping_type === 'hierarchical' || m.mapping_type === 'unmatched',
      note: 'Restricts bridges to exact and hierarchical rules only.',
    },
    {
      id: 'rob_cls_exact_only',
      pred: (m: ClassificationMappingRecord) =>
        m.mapping_type === 'exact' || m.mapping_type === 'unmatched',
      note: 'Retains strictly exact=1:1 equivalences; 0 OFF->COICOP exact bridges exist.',
    },
  ]) {
    const spec = regMap.get(clsCfg.id)!;
    const subMappings = mappings.filter(clsCfg.pred);
    const scenInt = buildIntegratedCategoryProfiles({
      mappings: subMappings,
      nutritionInputs,
      agribalyseItems,
      retailPriceRecords,
      hicpCountryCode,
      hicpData,
      isHicpEuFallback,
      pppBenchmark,
      cohdLatest,
    });
    const scenCo2Rows = rankCategoriesWithinDimension(
      scenInt.data.profiles,
      'agb_climate_co2eq_per_kg'
    ).data;
    const scenWaterRows = rankCategoriesWithinDimension(
      scenInt.data.profiles,
      'agb_water_aware_m3_per_kg'
    ).data;
    const scenClsCo2Map = new Map(scenCo2Rows.map((r) => [r.categoryLabel, r.value]));
    const scenClsWaterMap = new Map(scenWaterRows.map((r) => [r.categoryLabel, r.value]));
    const scenDenom = scenInt.data.profiles.reduce(
      (s, p) => s + (p.environmentPerKg?.matchedItemsDenominator ?? 0),
      0
    );

    const baseMean = meanOf(Array.from(baseClsCo2Map.values()));
    const scenMean = meanOf(Array.from(scenClsCo2Map.values()));
    const absDiff = baseMean !== null && scenMean !== null ? roundTo(scenMean - baseMean, 3) : null;
    const relPct =
      absDiff !== null && baseMean !== null && Math.abs(baseMean) > 1e-9
        ? roundTo((100 * absDiff) / baseMean, 2)
        : null;

    const { universe, ranking } = buildComparisonAndRanking(
      baseClsCo2Map,
      scenClsCo2Map,
      'agb_climate_co2eq_per_kg',
      'kg CO2eq / kg',
      clsCfg.note
    );
    const { ranking: rankingWater } = buildComparisonAndRanking(
      baseClsWaterMap,
      scenClsWaterMap,
      'agb_water_aware_m3_per_kg',
      'm3 world eq / kg',
      clsCfg.note
    );

    scenarios.push({
      robustnessVersion: INTEGRATED_ROBUSTNESS_VERSION,
      scenarioId: spec.scenarioId,
      baselineId: spec.baselineId,
      layer: 'classification',
      label: spec.label,
      scenarioType: spec.scenarioType,
      scenarioOrigin: spec.scenarioOrigin,
      effectMechanism: spec.effectMechanism,
      effectMechanismLabel: EFFECT_MECHANISM_LABELS[spec.effectMechanism],
      assumptionId: spec.assumptionId,
      reusedEngineAndVersion: `integratedComparator ${INTEGRATED_COMPARATOR_VERSION}`,
      comparisonUniverse: universe,
      denominators: {
        baselineTotal: mappings.length,
        baselineValid: baseClsDenom,
        baselineExcluded: Math.max(0, mappings.length - subMappings.length),
        scenarioTotal: subMappings.length,
        scenarioValid: scenDenom,
        scenarioExcluded: mappings.length - subMappings.length,
        denominatorDelta: scenDenom - baseClsDenom,
        denominatorGrainComparable: true,
        denominatorDeltaBlockedReason: null,
        supportMigrationCounts: scenInt.data.supportSummary,
      },
      valueSummary: {
        comparableAcrossUnits: true,
        baselineMean: baseMean,
        scenarioMean: scenMean,
        absoluteDiff: absDiff,
        relativeDiffPct: relPct,
        unit: 'kg CO2eq / kg',
        crossUnitNote: null,
      },
      rankingStability: scenClsCo2Map.size === 0 ? null : ranking,
      dimensionRankings: scenClsCo2Map.size === 0 ? [] : [ranking, rankingWater],
      rankingBlockedReason:
        scenClsCo2Map.size === 0
          ? 'Exact-only regime yields 0 usable OFF->COICOP->Agribalyse bridges (0 eligible ranking categories).'
          : null,
      caveats: [
        'Mapping counts (rules) differ from usable category bridges (categories attaining FoodEx2 + COICOP->Agribalyse links).',
        'Confidence labels are categorical taxonomy judgements, not probability distributions.',
      ],
    });
  }

  // -------------------------------------------------------------------------
  // 2. Nutrition Completeness & Positive-Energy / Per-100kcal Intersection Denominators
  // -------------------------------------------------------------------------
  const core5Keys: NutrientKey[] = ['energy_kcal', 'proteins_g', 'sugars_g', 'saturated_fat_g', 'salt_g'];
  const full8Keys: NutrientKey[] = [...NUTRIENT_KEYS];

  const baseNut100g = aggregateNutritionByCategory(nutritionInputs, 'per_100g', NUTRIENT_KEYS);
  const baseNutrientDenoms: Partial<Record<NutrientKey, number>> = {};
  for (const k of NUTRIENT_KEYS) {
    baseNutrientDenoms[k] = baseNut100g.data.reduce(
      (s, c) => s + (c.metrics[k]?.validDenominator ?? 0),
      0
    );
  }
  const baseProtMap = new Map<string, number>();
  for (const c of baseNut100g.data) {
    const val = c.metrics.proteins_g?.mean;
    if (val !== null && val !== undefined) baseProtMap.set(c.category, val);
  }
  const baseProtValid = baseNutrientDenoms.proteins_g ?? 0;

  for (const nutCfg of [
    {
      id: 'rob_nut_core5_cc',
      basis: 'per_100g' as const,
      subset: nutritionInputs.filter((p) => core5Keys.every((k) => p.per100g[k] !== null)),
      note: 'Core-5 mandatory nutrients all present (common denominator).',
      comparable: true,
    },
    {
      id: 'rob_nut_full8_cc',
      basis: 'per_100g' as const,
      subset: nutritionInputs.filter((p) => full8Keys.every((k) => p.per100g[k] !== null)),
      note: 'All 8 nutrients including optional fiber_g present (common denominator).',
      comparable: true,
    },
    {
      id: 'rob_nut_derived_per100kcal',
      basis: 'per_100kcal' as const,
      subset: nutritionInputs,
      note: 'Positive energy (energy_kcal > 0) intersected separately with each nutrient (no cross-unit value delta).',
      comparable: false,
    },
  ]) {
    const spec = regMap.get(nutCfg.id)!;
    const agg = aggregateNutritionByCategory(nutCfg.subset, nutCfg.basis, NUTRIENT_KEYS);
    const scenDenoms: Partial<Record<NutrientKey, number>> = {};
    for (const k of NUTRIENT_KEYS) {
      scenDenoms[k] = agg.data.reduce((s, c) => s + (c.metrics[k]?.validDenominator ?? 0), 0);
    }
    const positiveEnergyEligibleCount =
      nutCfg.basis === 'per_100kcal'
        ? nutritionInputs.filter(
            (p) => p.per100g.energy_kcal !== null && p.per100g.energy_kcal > 0
          ).length
        : undefined;

    const scenProtMap = new Map<string, number>();
    for (const c of agg.data) {
      const val = c.metrics.proteins_g?.mean;
      if (val !== null && val !== undefined) scenProtMap.set(c.category, val);
    }
    const scenProtValid = scenDenoms.proteins_g ?? 0;

    const baseMean = meanOf(Array.from(baseProtMap.values()));
    const scenMean = meanOf(Array.from(scenProtMap.values()));
    const absDiff =
      nutCfg.comparable && baseMean !== null && scenMean !== null
        ? roundTo(scenMean - baseMean, 3)
        : null;
    const relPct =
      absDiff !== null && baseMean !== null && Math.abs(baseMean) > 1e-9
        ? roundTo((100 * absDiff) / baseMean, 2)
        : null;

    const { universe, ranking } = buildComparisonAndRanking(
      baseProtMap,
      scenProtMap,
      nutCfg.basis === 'per_100g' ? 'protein_per_100g' : 'protein_per_100kcal',
      nutCfg.basis === 'per_100g' ? 'g / 100g' : 'g / 100 kcal',
      nutCfg.note,
      {
        baselineDimension: 'protein_per_100g',
        scenarioDimension: nutCfg.basis === 'per_100g' ? 'protein_per_100g' : 'protein_per_100kcal',
        comparisonNote:
          nutCfg.basis === 'per_100g'
            ? 'Single-nutrient observed per_100g rank correlation.'
            : 'Ordinal rank correlation comparing protein_per_100g vs derived protein_per_100kcal (no cross-unit difference).',
      }
    );

    const buildSingleNutrientMap = (
      cats: typeof baseNut100g.data,
      key: NutrientKey
    ): Map<string, number> => {
      const m = new Map<string, number>();
      for (const c of cats) {
        const val = c.metrics[key]?.mean;
        if (val !== null && val !== undefined) m.set(c.category, val);
      }
      return m;
    };

    const nutrientDimensionSpecs: Array<{
      nutrientKey: NutrientKey;
      baseDim: string;
      scenDim: string;
      unit: string;
    }> =
      nutCfg.basis === 'per_100g'
        ? [
            { nutrientKey: 'proteins_g', baseDim: 'protein_per_100g', scenDim: 'protein_per_100g', unit: 'g / 100g' },
            { nutrientKey: 'fiber_g', baseDim: 'fiber_per_100g', scenDim: 'fiber_per_100g', unit: 'g / 100g' },
            { nutrientKey: 'sugars_g', baseDim: 'sugars_per_100g', scenDim: 'sugars_per_100g', unit: 'g / 100g' },
            { nutrientKey: 'energy_kcal', baseDim: 'energy_kcal_per_100g', scenDim: 'energy_kcal_per_100g', unit: 'kcal / 100g' },
          ]
        : [
            { nutrientKey: 'proteins_g', baseDim: 'protein_per_100g', scenDim: 'protein_per_100kcal', unit: 'g / 100 kcal' },
            { nutrientKey: 'fiber_g', baseDim: 'fiber_per_100g', scenDim: 'fiber_per_100kcal', unit: 'g / 100 kcal' },
            { nutrientKey: 'sugars_g', baseDim: 'sugars_per_100g', scenDim: 'sugars_per_100kcal', unit: 'g / 100 kcal' },
          ];

    const nutDimensionRankings: IntegratedRankingStability[] = nutrientDimensionSpecs.map((ds) =>
      ds.nutrientKey === 'proteins_g'
        ? ranking
        : buildComparisonAndRanking(
            buildSingleNutrientMap(baseNut100g.data, ds.nutrientKey),
            buildSingleNutrientMap(agg.data, ds.nutrientKey),
            ds.scenDim,
            ds.unit,
            nutCfg.note,
            {
              baselineDimension: ds.baseDim,
              scenarioDimension: ds.scenDim,
              comparisonNote: `Single-nutrient comparison (${ds.baseDim} vs ${ds.scenDim}); never combined with other nutrients.`,
            }
          ).ranking
    );

    scenarios.push({
      robustnessVersion: INTEGRATED_ROBUSTNESS_VERSION,
      scenarioId: spec.scenarioId,
      baselineId: spec.baselineId,
      layer: 'nutrition',
      label: spec.label,
      scenarioType: spec.scenarioType,
      scenarioOrigin: spec.scenarioOrigin,
      effectMechanism: spec.effectMechanism,
      effectMechanismLabel: EFFECT_MECHANISM_LABELS[spec.effectMechanism],
      assumptionId: spec.assumptionId,
      reusedEngineAndVersion: `nutritionEngine ${NUTRITION_ENGINE_VERSION}`,
      comparisonUniverse: universe,
      denominators: {
        baselineTotal: nutritionInputs.length,
        baselineValid: baseProtValid,
        baselineExcluded: nutritionInputs.length - baseProtValid,
        scenarioTotal: nutCfg.subset.length,
        scenarioValid: scenProtValid,
        scenarioExcluded: nutritionInputs.length - scenProtValid,
        denominatorDelta: scenProtValid - baseProtValid,
        denominatorGrainComparable: true,
        denominatorDeltaBlockedReason: null,
        positiveEnergyEligibleCount,
        nutrientSpecificBaselineDenominators: baseNutrientDenoms,
        nutrientSpecificScenarioDenominators: scenDenoms,
      },
      valueSummary: {
        comparableAcrossUnits: nutCfg.comparable,
        baselineMean: baseMean,
        scenarioMean: scenMean,
        absoluteDiff: absDiff,
        relativeDiffPct: relPct,
        unit: nutCfg.basis === 'per_100g' ? 'g / 100g' : 'g / 100 kcal',
        crossUnitNote: nutCfg.comparable
          ? null
          : 'Cross-unit arithmetic suppressed (g/100g vs g/100kcal); ordinal protein ranking and nutrient-specific positive-energy denominators preserved.',
      },
      rankingStability: ranking,
      dimensionRankings: nutDimensionRankings,
      rankingBlockedReason: null,
      caveats: [
        'per_serving remains Unavailable across openfoodfacts_eu (3,197/3,197 missing serving_quantity_g).',
        ...(positiveEnergyEligibleCount !== undefined
          ? [
              `${positiveEnergyEligibleCount} positive-energy items form the eligible pool; each nutrient reports its own intersecting non-null denominator.`,
            ]
          : []),
      ],
    });
  }

  // -------------------------------------------------------------------------
  // 3. Environmental Streams (Agribalyse vs Poore Kept Strictly Separate)
  // -------------------------------------------------------------------------
  if (agribalyseItems.length > 0) {
    const stdAgb = stdAgbAll;
    const agbSubMap = new Map<string, number[]>();
    const agbSubWaterMap = new Map<string, number[]>();
    for (const r of stdAgb) {
      const key = `AGB:${r.category}/${r.subCategory ?? 'other'}`;
      if (r.metrics.climate_co2eq !== null && r.metrics.climate_co2eq !== undefined) {
        const arr = agbSubMap.get(key) ?? [];
        arr.push(r.metrics.climate_co2eq);
        agbSubMap.set(key, arr);
      }
      if (r.metrics.water_aware_m3 !== null && r.metrics.water_aware_m3 !== undefined) {
        const wArr = agbSubWaterMap.get(key) ?? [];
        wArr.push(r.metrics.water_aware_m3);
        agbSubWaterMap.set(key, wArr);
      }
    }

    const equalSubMap = new Map<string, number>();
    const equalSubWaterMap = new Map<string, number>();
    let equalSubCount = 0;
    for (const prof of baseIntegrated.data.profiles) {
      const subCodes = prof.classificationEvidence.matchedAgribalyseSubgroups;
      if (!prof.environmentPerKg || subCodes.length === 0) continue;
      const subMeans = subCodes
        .map((sc) => {
          const arr = agbSubMap.get(sc);
          return arr && arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
        })
        .filter((v): v is number => v !== null);
      if (subMeans.length > 0) {
        equalSubMap.set(prof.categoryLabel, roundTo(subMeans.reduce((s, v) => s + v, 0) / subMeans.length, 2));
        equalSubCount += subMeans.length;
      }
      const subWaterMeans = subCodes
        .map((sc) => {
          const arr = agbSubWaterMap.get(sc);
          return arr && arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
        })
        .filter((v): v is number => v !== null);
      if (subWaterMeans.length > 0) {
        equalSubWaterMap.set(
          prof.categoryLabel,
          roundTo(subWaterMeans.reduce((s, v) => s + v, 0) / subWaterMeans.length, 2)
        );
      }
    }

    const specW = regMap.get('rob_env_agb_lci_count_vs_equal_subgroup')!;
    const baseMeanW = meanOf(Array.from(baseClsCo2Map.values()));
    const scenMeanW = meanOf(Array.from(equalSubMap.values()));
    const absW = baseMeanW !== null && scenMeanW !== null ? roundTo(scenMeanW - baseMeanW, 3) : null;
    const relW = absW !== null && baseMeanW ? roundTo((100 * absW) / baseMeanW, 2) : null;
    const { universe: univW, ranking: rankW } = buildComparisonAndRanking(
      baseClsCo2Map,
      equalSubMap,
      'agb_climate_co2eq_per_kg',
      'kg CO2eq / kg',
      'Equal-subgroup weighting (1/k) vs Agribalyse LCI-record-count weighting over identical COICOP bridges.',
      {
        comparisonNote: 'Single environmental indicator (agb_climate_co2eq_per_kg) across weighting regimes.',
      }
    );
    const { ranking: rankWWater } = buildComparisonAndRanking(
      baseClsWaterMap,
      equalSubWaterMap,
      'agb_water_aware_m3_per_kg',
      'm3 world eq / kg',
      'Equal-subgroup weighting (1/k) vs Agribalyse LCI-record-count weighting over identical COICOP bridges.',
      {
        comparisonNote: 'Single environmental indicator (agb_water_aware_m3_per_kg) across weighting regimes.',
      }
    );

    const sharedSubgroupInstancesCount = Math.max(0, equalSubCount - activeUniqueSubgroups.size);
    const grainBlockedMsg = `Incompatible analytical grains: baseline aggregates ${baseClsDenom} category-LCI-record assignments (${validUniqueMappedLciCount} unique mapped LCI items across ${equalSubMap.size} categories), whereas scenario weights ${equalSubCount} category-subgroup pairs (${activeUniqueSubgroups.size} active unique subgroups of ${agbSubCounts.size} total COICOP-mapped subgroups). Subtraction is blocked.`;

    scenarios.push({
      robustnessVersion: INTEGRATED_ROBUSTNESS_VERSION,
      scenarioId: specW.scenarioId,
      baselineId: specW.baselineId,
      layer: 'environment',
      label: specW.label,
      scenarioType: specW.scenarioType,
      scenarioOrigin: specW.scenarioOrigin,
      effectMechanism: specW.effectMechanism,
      effectMechanismLabel: EFFECT_MECHANISM_LABELS[specW.effectMechanism],
      assumptionId: specW.assumptionId,
      reusedEngineAndVersion: `integratedComparator ${INTEGRATED_COMPARATOR_VERSION}`,
      comparisonUniverse: univW,
      denominators: {
        baselineTotal: stdAgb.length,
        baselineValid: validUniqueMappedLciCount,
        baselineExcluded: stdAgb.length - validUniqueMappedLciCount,
        scenarioTotal: agbSubCounts.size,
        scenarioValid: equalSubCount,
        scenarioExcluded: Math.max(0, agbSubCounts.size - activeUniqueSubgroups.size),
        denominatorDelta: null,
        denominatorGrainComparable: false,
        denominatorDeltaBlockedReason: grainBlockedMsg,
        environmentalWeightingGrain: {
          totalAgribalyseLciCatalogCount: stdAgb.length,
          validLciRecordCount: validUniqueMappedLciCount,
          categoryLciRecordPairCount: baseClsDenom,
          totalCoicopMappedSubgroupCount: agbSubCounts.size,
          uniqueLciSubgroupCount: activeUniqueSubgroups.size,
          categorySubgroupPairCount: equalSubCount,
          sharedSubgroupInstancesCount,
          eligibleCategoryCount: equalSubMap.size,
          finalCategoryEstimateCount: equalSubMap.size,
          aggregationWeightingMethod: {
            baseline: 'lci_record_count_per_category_weighted_mean',
            scenario: 'equal_subgroup_weight_1_over_k_per_category',
          },
          grainExplanation: `${stdAgb.length} total Agribalyse items -> ${validUniqueMappedLciCount} unique mapped LCI items across ${activeUniqueSubgroups.size} active subgroups (${agbSubCounts.size} total Agribalyse->COICOP rules incl. 5 in unmatched CP012) -> ${sharedSubgroupInstancesCount} shared subgroup assignments (CP0114: 6, CP0117: 6, CP0119: 16) produce ${equalSubCount} category-subgroup pairs and ${baseClsDenom} category-LCI links yielding ${equalSubMap.size} final category estimates.`,
        },
      },
      valueSummary: {
        comparableAcrossUnits: true,
        baselineMean: baseMeanW,
        scenarioMean: scenMeanW,
        absoluteDiff: absW,
        relativeDiffPct: relW,
        unit: 'kg CO2eq / kg (Agribalyse Model Output)',
        crossUnitNote: null,
      },
      rankingStability: rankW,
      dimensionRankings: [rankW, rankWWater],
      rankingBlockedReason: null,
      caveats: [
        grainBlockedMsg,
        `Duplicate AGB->COICOP subgroup codes verified: ${duplicateSubgroupCodesCount} (no within-COICOP double-counting).`,
        'LCI-record-count weighting reflects French Agribalyse database inventory coverage rather than consumption; market-share/consumption weighting is unavailable.',
      ],
    });

    // Estimator sensitivity within Agribalyse Groupe_aliment
    const agbGrpAgg = aggregateEnvironmentByCategory(stdAgb, 'climate_co2eq');
    const agbWaterGrpAgg = aggregateEnvironmentByCategory(stdAgb, 'water_aware_m3');
    const agbMeanMap = new Map<string, number>();
    const agbMedMap = new Map<string, number>();
    const agbWaterMeanMap = new Map<string, number>();
    const agbWaterMedMap = new Map<string, number>();
    let agbGrpDenom = 0;
    for (const c of agbGrpAgg.data) {
      if (c.mean !== null) agbMeanMap.set(c.category, c.mean);
      if (c.median !== null) agbMedMap.set(c.category, c.median);
      agbGrpDenom += c.validDenominator;
    }
    for (const c of agbWaterGrpAgg.data) {
      if (c.mean !== null) agbWaterMeanMap.set(c.category, c.mean);
      if (c.median !== null) agbWaterMedMap.set(c.category, c.median);
    }
    const specM = regMap.get('rob_env_agb_median_vs_mean')!;
    const baseMeanM = meanOf(Array.from(agbMeanMap.values()));
    const scenMeanM = meanOf(Array.from(agbMedMap.values()));
    const absM = baseMeanM !== null && scenMeanM !== null ? roundTo(scenMeanM - baseMeanM, 3) : null;
    const relM = absM !== null && baseMeanM ? roundTo((100 * absM) / baseMeanM, 2) : null;
    const { universe: univM, ranking: rankM } = buildComparisonAndRanking(
      agbMeanMap,
      agbMedMap,
      'agb_climate_co2eq_per_kg',
      'kg CO2eq / kg',
      'Group median vs arithmetic mean across all 11 Agribalyse Groupe_aliment categories.',
      {
        baselineDimension: 'agb_climate_co2eq_per_kg (mean)',
        scenarioDimension: 'agb_climate_co2eq_per_kg (median)',
        comparisonNote: 'Median vs arithmetic mean estimator check strictly within agb_climate_co2eq_per_kg.',
      }
    );
    const { ranking: rankMWater } = buildComparisonAndRanking(
      agbWaterMeanMap,
      agbWaterMedMap,
      'agb_water_aware_m3_per_kg',
      'm3 world eq / kg',
      'Group median vs arithmetic mean across all 11 Agribalyse Groupe_aliment categories.',
      {
        baselineDimension: 'agb_water_aware_m3_per_kg (mean)',
        scenarioDimension: 'agb_water_aware_m3_per_kg (median)',
        comparisonNote: 'Median vs arithmetic mean estimator check strictly within agb_water_aware_m3_per_kg.',
      }
    );
    scenarios.push({
      robustnessVersion: INTEGRATED_ROBUSTNESS_VERSION,
      scenarioId: specM.scenarioId,
      baselineId: specM.baselineId,
      layer: 'environment',
      label: specM.label,
      scenarioType: specM.scenarioType,
      scenarioOrigin: specM.scenarioOrigin,
      effectMechanism: specM.effectMechanism,
      effectMechanismLabel: EFFECT_MECHANISM_LABELS[specM.effectMechanism],
      assumptionId: specM.assumptionId,
      reusedEngineAndVersion: `environmentEngine ${ENVIRONMENT_ENGINE_VERSION}`,
      comparisonUniverse: univM,
      denominators: {
        baselineTotal: stdAgb.length,
        baselineValid: agbGrpDenom,
        baselineExcluded: stdAgb.length - agbGrpDenom,
        scenarioTotal: stdAgb.length,
        scenarioValid: agbGrpDenom,
        scenarioExcluded: stdAgb.length - agbGrpDenom,
        denominatorDelta: 0,
        denominatorGrainComparable: true,
        denominatorDeltaBlockedReason: null,
      },
      valueSummary: {
        comparableAcrossUnits: true,
        baselineMean: baseMeanM,
        scenarioMean: scenMeanM,
        absoluteDiff: absM,
        relativeDiffPct: relM,
        unit: 'kg CO2eq / kg (Agribalyse Model Output)',
        crossUnitNote: null,
      },
      rankingStability: rankM,
      dimensionRankings: [rankM, rankMWater],
      rankingBlockedReason: null,
      caveats: ['Kept strictly within ADEME Agribalyse 3.1.1 French cradle-to-consumer Model Output boundary.'],
    });
  }

  if (pooreItems.length > 0) {
    const stdPoore = pooreItems.map(fromPooreNemecekItem);
    const pooreFull = new Map<string, number>();
    const pooreNoTr = new Map<string, number>();
    const pooreProt = new Map<string, number>();

    for (const p of pooreItems) {
      if (p.ghg_kg_co2eq_per_kg !== null && Number.isFinite(p.ghg_kg_co2eq_per_kg)) {
        pooreFull.set(p.food_item, roundTo(p.ghg_kg_co2eq_per_kg, 2));
        if (p.stage_transport !== null && p.stage_transport !== undefined && Number.isFinite(p.stage_transport)) {
          pooreNoTr.set(p.food_item, roundTo(p.ghg_kg_co2eq_per_kg - p.stage_transport, 2));
        }
      }
      if (
        p.ghg_kg_per_100g_protein !== null &&
        p.ghg_kg_per_100g_protein !== undefined &&
        Number.isFinite(p.ghg_kg_per_100g_protein)
      ) {
        pooreProt.set(p.food_item, roundTo(p.ghg_kg_per_100g_protein, 2));
      }
    }

    const specTr = regMap.get('rob_env_poore_excl_transport')!;
    const bmTr = meanOf(Array.from(pooreFull.values()));
    const smTr = meanOf(Array.from(pooreNoTr.values()));
    const absTr = bmTr !== null && smTr !== null ? roundTo(smTr - bmTr, 3) : null;
    const relTr = absTr !== null && bmTr ? roundTo((100 * absTr) / bmTr, 2) : null;
    const { universe: uTr, ranking: rTr } = buildComparisonAndRanking(
      pooreFull,
      pooreNoTr,
      'poore_ghg_per_kg_excl_transport',
      'kg CO2eq / kg',
      'Poore & Nemecek global commodities excluding stage_transport (separate from Agribalyse).'
    );
    scenarios.push({
      robustnessVersion: INTEGRATED_ROBUSTNESS_VERSION,
      scenarioId: specTr.scenarioId,
      baselineId: specTr.baselineId,
      layer: 'environment',
      label: specTr.label,
      scenarioType: specTr.scenarioType,
      scenarioOrigin: specTr.scenarioOrigin,
      effectMechanism: specTr.effectMechanism,
      effectMechanismLabel: EFFECT_MECHANISM_LABELS[specTr.effectMechanism],
      assumptionId: specTr.assumptionId,
      reusedEngineAndVersion: `environmentEngine ${ENVIRONMENT_ENGINE_VERSION}`,
      comparisonUniverse: uTr,
      denominators: {
        baselineTotal: stdPoore.length,
        baselineValid: pooreFull.size,
        baselineExcluded: stdPoore.length - pooreFull.size,
        scenarioTotal: stdPoore.length,
        scenarioValid: pooreNoTr.size,
        scenarioExcluded: stdPoore.length - pooreNoTr.size,
        denominatorDelta: pooreNoTr.size - pooreFull.size,
        denominatorGrainComparable: true,
        denominatorDeltaBlockedReason: null,
      },
      valueSummary: {
        comparableAcrossUnits: true,
        baselineMean: bmTr,
        scenarioMean: smTr,
        absoluteDiff: absTr,
        relativeDiffPct: relTr,
        unit: 'kg CO2eq / kg (Poore Global Estimated)',
        crossUnitNote: null,
      },
      rankingStability: rTr,
      dimensionRankings: [rTr],
      rankingBlockedReason: null,
      caveats: ['Evaluated strictly inside Poore & Nemecek Estimated farm-to-retail boundary (never mixed with Agribalyse).'],
    });

    const specPr = regMap.get('rob_env_poore_protein_unit')!;
    const bmPr = meanOf(Array.from(pooreFull.values()));
    const smPr = meanOf(Array.from(pooreProt.values()));
    const { universe: uPr, ranking: rPr } = buildComparisonAndRanking(
      pooreFull,
      pooreProt,
      'poore_ghg_per_100g_protein_rank_only',
      'kg CO2eq / 100g protein',
      'Excludes 13 Poore commodities lacking verified protein factor; ordinal rank comparison only.',
      {
        baselineDimension: 'poore_ghg_per_kg',
        scenarioDimension: 'poore_ghg_per_100g_protein_rank_only',
        comparisonNote: 'Ordinal rank comparison across functional units (per kg vs per 100g protein); value subtraction blocked.',
      }
    );
    scenarios.push({
      robustnessVersion: INTEGRATED_ROBUSTNESS_VERSION,
      scenarioId: specPr.scenarioId,
      baselineId: specPr.baselineId,
      layer: 'environment',
      label: specPr.label,
      scenarioType: specPr.scenarioType,
      scenarioOrigin: specPr.scenarioOrigin,
      effectMechanism: specPr.effectMechanism,
      effectMechanismLabel: EFFECT_MECHANISM_LABELS[specPr.effectMechanism],
      assumptionId: specPr.assumptionId,
      reusedEngineAndVersion: `environmentEngine ${ENVIRONMENT_ENGINE_VERSION}`,
      comparisonUniverse: uPr,
      denominators: {
        baselineTotal: stdPoore.length,
        baselineValid: pooreFull.size,
        baselineExcluded: stdPoore.length - pooreFull.size,
        scenarioTotal: stdPoore.length,
        scenarioValid: pooreProt.size,
        scenarioExcluded: stdPoore.length - pooreProt.size,
        denominatorDelta: pooreProt.size - pooreFull.size,
        denominatorGrainComparable: true,
        denominatorDeltaBlockedReason: null,
      },
      valueSummary: {
        comparableAcrossUnits: false,
        baselineMean: bmPr,
        scenarioMean: smPr,
        absoluteDiff: null,
        relativeDiffPct: null,
        unit: 'kg CO2eq / 100g protein',
        crossUnitNote: 'Incompatible functional units (per kg vs per 100g protein); value delta blocked, ordinal rank & Jaccard retained.',
      },
      rankingStability: rPr,
      dimensionRankings: [rPr],
      rankingBlockedReason: null,
      caveats: ['Global Estimated Poore commodities only; missing protein values preserved as excluded.'],
    });
  }

  // -------------------------------------------------------------------------
  // 4. Affordability Coverage (Descriptive SKU Overlap Only — Zero Synthetic Ranks)
  // -------------------------------------------------------------------------
  const offBarcodeToCategory = new Map<string, string>();
  for (const n of nutritionInputs) {
    if (n.barcode) offBarcodeToCategory.set(n.barcode, n.category);
  }
  const retailFullStats = inspectRetailSubsetEvidence(retailPriceRecords, offBarcodeToCategory, 'FULL');
  const retailFrStats = inspectRetailSubsetEvidence(
    retailPriceRecords.filter((r) => r.countryCode === 'FR'),
    offBarcodeToCategory,
    'FR'
  );
  const retailDeStats = inspectRetailSubsetEvidence(
    retailPriceRecords.filter((r) => r.countryCode === 'DE'),
    offBarcodeToCategory,
    'DE'
  );

  for (const affCfg of [
    { id: 'rob_aff_fr_subset', stats: retailFrStats, subRecs: retailPriceRecords.filter((r) => r.countryCode === 'FR') },
    { id: 'rob_aff_de_subset', stats: retailDeStats, subRecs: retailPriceRecords.filter((r) => r.countryCode === 'DE') },
  ]) {
    const spec = regMap.get(affCfg.id)!;
    const baseKgAgg = aggregateRetailPricesByCategory(retailPriceRecords, 'per_kg');
    const scenKgAgg = aggregateRetailPricesByCategory(affCfg.subRecs, 'per_kg');
    const baseKgMean = meanOf(
      baseKgAgg.data.map((c) => c.mean).filter((v): v is number => v !== null)
    );
    const scenKgMean = meanOf(
      scenKgAgg.data.map((c) => c.mean).filter((v): v is number => v !== null)
    );
    const absAff =
      baseKgMean !== null && scenKgMean !== null ? roundTo(scenKgMean - baseKgMean, 3) : null;
    const relAff = absAff !== null && baseKgMean ? roundTo((100 * absAff) / baseKgMean, 2) : null;

    scenarios.push({
      robustnessVersion: INTEGRATED_ROBUSTNESS_VERSION,
      scenarioId: spec.scenarioId,
      baselineId: spec.baselineId,
      layer: 'affordability',
      label: spec.label,
      scenarioType: spec.scenarioType,
      scenarioOrigin: spec.scenarioOrigin,
      effectMechanism: spec.effectMechanism,
      effectMechanismLabel: EFFECT_MECHANISM_LABELS[spec.effectMechanism],
      assumptionId: spec.assumptionId,
      reusedEngineAndVersion: `affordabilityEngine ${AFFORDABILITY_ENGINE_VERSION}`,
      comparisonUniverse: {
        commonCategoryIds: affCfg.stats.matchedCategoriesEurKg,
        commonUniverseSize: affCfg.stats.matchedCategoriesEurKg.length,
        baselineOnlyExcludedIds: retailFullStats.matchedCategoriesEurKg.filter(
          (c) => !affCfg.stats.matchedCategoriesEurKg.includes(c)
        ),
        scenarioOnlyExcludedIds: [],
        exclusionReason: `${affCfg.stats.subsetCode} exact OFF EUR/kg barcode matches: ${affCfg.stats.exactOffBarcodeMassEurKgMatches} (${affCfg.stats.exactOffBarcodeTotalMatches} total barcode overlap incl. ${affCfg.stats.exactOffBarcodeLiquidEurLMatches} EUR/L liquids).`,
      },
      denominators: {
        baselineTotal: retailFullStats.rawSkuCount,
        baselineValid: retailFullStats.validMassEurKgCount,
        baselineExcluded: retailFullStats.rawSkuCount - retailFullStats.validMassEurKgCount,
        scenarioTotal: affCfg.stats.rawSkuCount,
        scenarioValid: affCfg.stats.validMassEurKgCount,
        scenarioExcluded: affCfg.stats.rawSkuCount - affCfg.stats.validMassEurKgCount,
        denominatorDelta: affCfg.stats.validMassEurKgCount - retailFullStats.validMassEurKgCount,
        denominatorGrainComparable: true,
        denominatorDeltaBlockedReason: null,
        retailBaselineSubset: retailFullStats,
        retailScenarioSubset: affCfg.stats,
      },
      valueSummary: {
        comparableAcrossUnits: true,
        baselineMean: baseKgMean,
        scenarioMean: scenKgMean,
        absoluteDiff: absAff,
        relativeDiffPct: relAff,
        unit: 'EUR / kg (Observed receipt category unweighted mean)',
        crossUnitNote: null,
      },
      rankingStability: null,
      dimensionRankings: [],
      rankingBlockedReason:
        'descriptive_sku_evidence_only: 0 to 2 exact OFF EUR/kg barcode matches across categories cannot support category-level affordability ranking stability.',
      caveats: [
        'HICP (2015=100), PPP PLI, and World Bank CoHD remain strictly national macro context and never substitute for category retail SKU prices.',
        `FULL has 4 exact OFF matches (2 EUR/kg, 2 EUR/L); FR has 4 (2 EUR/kg, 2 EUR/L); DE has 0 matches.`,
      ],
    });
  }

  // -------------------------------------------------------------------------
  // 5. Build 13-Category × 8-Layer Evidence Coverage Matrix & Separate Macro Panel
  // -------------------------------------------------------------------------
  const pooreMap = new Map(pooreItems.map((p) => [p.food_item, p]));
  const giStdFood = filterFoodEligibleEnvironmentRecords(giItems.map(fromGITerroirItem), false);
  const giByClass = new Map<string, number>();
  for (const r of giStdFood.eligibleRecords) {
    giByClass.set(r.category, (giByClass.get(r.category) ?? 0) + 1);
  }
  const agbCtx = ENVIRONMENT_SOURCE_METADATA.agribalyse_31;
  const pooreCtx = ENVIRONMENT_SOURCE_METADATA.poore_nemecek_2018;
  const giCtx = ENVIRONMENT_SOURCE_METADATA.gi_terroir_proxy;

  // Map liquid vs kg retail barcode matches per OFF category
  const offBarcodeLiquidMatchesByCat = new Map<string, number>();
  const offBarcodeMassMatchesByCat = new Map<string, number>();
  for (const r of retailPriceRecords) {
    const cat = offBarcodeToCategory.get(r.barcode);
    if (!cat) continue;
    if (evaluateRetailUnitPrice(r, 'per_kg').computable) {
      offBarcodeMassMatchesByCat.set(cat, (offBarcodeMassMatchesByCat.get(cat) ?? 0) + 1);
    } else if (evaluateRetailUnitPrice(r, 'per_litre').computable) {
      offBarcodeLiquidMatchesByCat.set(cat, (offBarcodeLiquidMatchesByCat.get(cat) ?? 0) + 1);
    }
  }

  const evidenceMatrix: CategoryEvidenceCoverageRow[] = baseIntegrated.data.profiles.map((prof) => {
    const isUnmatchedGap = prof.categoryId.startsWith('COICOP:');
    const fxType = prof.classificationEvidence.foodex2MappingType;
    const cpType = prof.classificationEvidence.coicopMappingType;

    const classificationCell: CategoryLayerCell = {
      layerId: 'classification_bridge',
      evidenceNature: prof.supportLevel === 'unsupported_unmatched' ? 'Missing' : 'Model Output',
      availabilityStatus:
        prof.supportLevel === 'unsupported_unmatched'
          ? 'unsupported_blocked'
          : prof.supportLevel === 'ambiguous_split' || prof.supportLevel === 'approximate_or_hierarchical'
          ? 'partial'
          : 'supported',
      validDenominator: prof.classificationEvidence.matchedAgribalyseSubgroups.length,
      sourceDatasetAndVersion: 'classification_mappings.parquet v4.0',
      mappingOrMatchingStatus: `FoodEx2=${fxType}, COICOP=${cpType}`,
      functionalUnit: 'Taxonomy category concordance',
      geographyAndBoundary: 'EFSA / EU-COICOP / France Agribalyse / OFF EU',
      scope: 'category_level',
      blockingOrMissingnessReason:
        prof.supportLevel === 'unsupported_unmatched'
          ? prof.classificationEvidence.rationaleSummary
          : null,
    };

    const nut100gDenom = prof.nutritionPer100g?.proteinDenominator ?? 0;
    const nut100gCell: CategoryLayerCell = {
      layerId: 'nutrition_per_100g',
      evidenceNature: prof.nutritionPer100g && nut100gDenom > 0 ? 'Observed' : 'Missing',
      availabilityStatus: prof.nutritionPer100g && nut100gDenom > 0 ? 'supported' : 'unsupported_blocked',
      validDenominator: nut100gDenom,
      sourceDatasetAndVersion: `openfoodfacts_eu.parquet / nutritionEngine ${NUTRITION_ENGINE_VERSION}`,
      mappingOrMatchingStatus: prof.nutritionPer100g ? 'Direct OFF category cluster' : 'Unmatched COICOP gap',
      functionalUnit: 'per 100g',
      geographyAndBoundary: 'OFF EU snapshot (incl. non-EU rows flagged in Phase 4C)',
      scope: 'category_level',
      blockingOrMissingnessReason: prof.nutritionPer100g
        ? null
        : 'No verified OFF category cluster exists for this unmatched COICOP division.',
    };

    // Per-100kcal positive energy denominator intersected with protein for this category
    const catPositiveKcalDenom = isUnmatchedGap
      ? 0
      : nutritionInputs.filter(
          (p) =>
            p.category === prof.categoryLabel &&
            p.per100g.energy_kcal !== null &&
            p.per100g.energy_kcal > 0 &&
            p.per100g.proteins_g !== null
        ).length;
    const nut100kcalCell: CategoryLayerCell = {
      layerId: 'nutrition_per_100kcal',
      evidenceNature: catPositiveKcalDenom > 0 ? 'Estimated' : 'Missing',
      availabilityStatus: catPositiveKcalDenom > 0 ? 'supported' : 'unsupported_blocked',
      validDenominator: catPositiveKcalDenom,
      sourceDatasetAndVersion: `openfoodfacts_eu.parquet / nutritionEngine ${NUTRITION_ENGINE_VERSION}`,
      mappingOrMatchingStatus:
        catPositiveKcalDenom > 0 ? 'Derived via positive-energy rule (energy > 0)' : 'Unmatched COICOP gap',
      functionalUnit: 'per 100 kcal',
      geographyAndBoundary: 'Derived ratio using Observed OFF nutrients (energy_kcal > 0)',
      scope: 'category_level',
      blockingOrMissingnessReason:
        catPositiveKcalDenom > 0
          ? null
          : isUnmatchedGap
          ? 'Unmatched COICOP gap lacks OFF SKUs.'
          : 'Zero products satisfy energy_kcal > 0 with non-null nutrient.',
    };

    const nutServingCell: CategoryLayerCell = {
      layerId: 'nutrition_per_serving',
      evidenceNature: 'Missing',
      availabilityStatus: 'unsupported_blocked',
      validDenominator: 0,
      sourceDatasetAndVersion: `openfoodfacts_eu.parquet / nutritionEngine ${NUTRITION_ENGINE_VERSION}`,
      mappingOrMatchingStatus: 'Unavailable across all 3,197 SKUs',
      functionalUnit: 'per serving',
      geographyAndBoundary: 'Serving sizes not present in OFF snapshot (never invented)',
      scope: 'category_level',
      blockingOrMissingnessReason:
        'serving_quantity_g is 100% NULL in openfoodfacts_eu (retained in Phase 3B follow-up backlog).',
    };

    const envAgbDenom = prof.environmentPerKg?.matchedItemsDenominator ?? 0;
    const envAgbCell: CategoryLayerCell = {
      layerId: 'environment_agribalyse',
      evidenceNature: prof.environmentPerKg && envAgbDenom > 0 ? 'Model Output' : 'Missing',
      availabilityStatus:
        prof.environmentPerKg && envAgbDenom > 0 ? 'supported' : 'unsupported_blocked',
      validDenominator: envAgbDenom,
      sourceDatasetAndVersion: `${agbCtx.datasetFile} / environmentEngine ${ENVIRONMENT_ENGINE_VERSION}`,
      mappingOrMatchingStatus:
        prof.environmentPerKg && envAgbDenom > 0
          ? `COICOP ${prof.classificationEvidence.coicopCode} (${prof.classificationEvidence.matchedAgribalyseSubgroups.length} subgroups)`
          : 'Unmatched taxonomy bridge',
      functionalUnit: 'per 1 kg food',
      geographyAndBoundary: `${agbCtx.geography}; ${agbCtx.systemBoundary}`,
      scope: 'category_level',
      blockingOrMissingnessReason: prof.environmentPerKg
        ? null
        : 'No verified COICOP->Agribalyse subgroup link.',
    };

    const pooreMatchedNames = (OFF_TO_POORE_COMMODITIES[prof.categoryLabel] ?? []).filter((nm) =>
      pooreMap.has(nm)
    );
    const envPooreCell: CategoryLayerCell = {
      layerId: 'environment_poore',
      evidenceNature: pooreMatchedNames.length > 0 ? 'Estimated' : 'Missing',
      availabilityStatus: pooreMatchedNames.length > 0 ? 'partial' : 'unsupported_blocked',
      validDenominator: pooreMatchedNames.length,
      sourceDatasetAndVersion: `${pooreCtx.datasetFile} / environmentEngine ${ENVIRONMENT_ENGINE_VERSION}`,
      mappingOrMatchingStatus:
        pooreMatchedNames.length > 0
          ? `Global commodity reference (${pooreMatchedNames.length} commodities, unmerged)`
          : 'No direct Poore & Nemecek single-commodity analogue',
      functionalUnit: 'per 1 kg retail commodity',
      geographyAndBoundary: `${pooreCtx.geography}; ${pooreCtx.systemBoundary}`,
      scope: 'category_level',
      blockingOrMissingnessReason:
        pooreMatchedNames.length > 0
          ? null
          : 'Composite ultra-processed / substitute or unmatched COICOP division lacks raw Poore commodity items.',
    };

    const giMatchedCount = (OFF_TO_GI_FOOD_CLASSES[prof.categoryLabel] ?? []).reduce(
      (sum, clsName) => sum + (giByClass.get(clsName) ?? 0),
      0
    );
    const giDatasetAbsent = giItems.length === 0;
    const envGiCell: CategoryLayerCell = {
      layerId: 'environment_gi_proxy',
      evidenceNature: giMatchedCount > 0 ? 'Proxy' : 'Missing',
      availabilityStatus: giMatchedCount > 0 ? 'partial' : 'unsupported_blocked',
      validDenominator: giMatchedCount,
      sourceDatasetAndVersion: giDatasetAbsent
        ? `${giCtx.datasetFile} (unavailable / excluded) / environmentEngine ${ENVIRONMENT_ENGINE_VERSION}`
        : `${giCtx.datasetFile} / environmentEngine ${ENVIRONMENT_ENGINE_VERSION}`,
      mappingOrMatchingStatus:
        giMatchedCount > 0
          ? 'Auxiliary FOOD-only GI class proxy (non-LCI)'
          : giDatasetAbsent
          ? 'GI Terroir dataset unavailable or excluded in distribution'
          : 'No matched FOOD GI proxy class',
      functionalUnit: 'per 1 kg proxy benchmark',
      geographyAndBoundary: giDatasetAbsent
        ? 'Unavailable in Track A open archive (FOOD-only benchmark omitted)'
        : `${giCtx.geography}; FOOD-only eligible (3,037)`,
      scope: 'category_level',
      blockingOrMissingnessReason:
        giMatchedCount > 0
          ? 'Auxiliary rule-assigned class proxy only; cannot substitute for missing LCI evidence.'
          : giDatasetAbsent
          ? 'GI Terroir dataset unavailable or excluded in this distribution; cell kept Missing without fabricated fallback.'
          : 'No FOOD-sector GI terroir class proxy mapped to this category.',
    };

    const kgHits = isUnmatchedGap ? 0 : offBarcodeMassMatchesByCat.get(prof.categoryLabel) ?? 0;
    const lHits = isUnmatchedGap ? 0 : offBarcodeLiquidMatchesByCat.get(prof.categoryLabel) ?? 0;
    const affCell: CategoryLayerCell = {
      layerId: 'affordability_retail_sku_eur_kg',
      evidenceNature: kgHits > 0 ? 'Observed' : 'Missing',
      availabilityStatus: kgHits > 0 ? 'partial' : 'unsupported_blocked',
      validDenominator: kgHits,
      sourceDatasetAndVersion: `scrapling_retail_claims.parquet / affordabilityEngine ${AFFORDABILITY_ENGINE_VERSION}`,
      mappingOrMatchingStatus:
        kgHits > 0
          ? `${kgHits} exact EUR/kg barcode match(es) in FR/Full (0 in DE)`
          : lHits > 0
          ? `0 EUR/kg matches (${lHits} exact EUR/L liquid matches excluded from per_kg)`
          : '0 exact barcode overlaps with Open Prices EU',
      functionalUnit: 'EUR / kg retail shelf SKU',
      geographyAndBoundary: 'FR-concentrated shelf receipts (cannot generalize to national category prices)',
      scope: 'category_level',
      blockingOrMissingnessReason:
        kgHits > 0
          ? `Only ${kgHits} exact SKU receipt match; insufficient for category-wide price inference.`
          : lHits > 0
          ? `${lHits} matched liquid SKU(s) reported strictly on EUR/L (mass-vs-volume conversion blocked).`
          : 'No exact barcode overlap between OFF EU catalog and Open Prices receipts.',
    };

    const layers: Record<CategoryEvidenceLayerId, CategoryLayerCell> = {
      classification_bridge: classificationCell,
      nutrition_per_100g: nut100gCell,
      nutrition_per_100kcal: nut100kcalCell,
      nutrition_per_serving: nutServingCell,
      environment_agribalyse: envAgbCell,
      environment_poore: envPooreCell,
      environment_gi_proxy: envGiCell,
      affordability_retail_sku_eur_kg: affCell,
    };

    const supportedLayerCount = CATEGORY_EVIDENCE_LAYER_ORDER.filter(
      (id) => layers[id].availabilityStatus !== 'unsupported_blocked'
    ).length;

    return {
      categoryId: prof.categoryId,
      categoryLabel: prof.categoryLabel,
      overallSupportLevel: prof.supportLevel,
      supportedLayerCount,
      totalLayerCount: CATEGORY_EVIDENCE_LAYER_ORDER.length,
      layers,
    };
  });

  // Separate Macro Context (HICP, PPP, CoHD)
  const macroInflationNodes = baseIntegrated.data.profiles.filter(
    (p) => p.macroInflationContext !== null
  );
  const macroContext: MacroContextEvidencePanel = {
    scope: 'macro_country_level',
    countryCode: hicpCountryCode,
    hicp: {
      evidenceNature: 'Observed',
      isEuFallback: isHicpEuFallback,
      seriesAvailableCount: macroInflationNodes.length,
      note: isHicpEuFallback
        ? `Displaying Eurostat EU27_2020 HICP fallback because [${hicpCountryCode}] lacks prc_hicp_aind; macro index (2015=100) only.`
        : `Eurostat [${hicpCountryCode}] macro COICOP inflation index (2015=100); cannot be ranked as SKU prices.`,
    },
    ppp: {
      evidenceNature: pppBenchmark ? 'Observed' : 'Missing',
      foodPriceLevelIndexEu27: pppBenchmark?.foodPriceLevelIndex ?? null,
      referenceYear: pppBenchmark?.referenceYear ?? null,
      note: pppBenchmark
        ? `Eurostat prc_ppp_ind Food Price Level Index (${pppBenchmark.referenceYear}, EU27_2020=100) = ${pppBenchmark.foodPriceLevelIndex}; macro comparability only.`
        : `No Eurostat Food PLI record available for [${hicpCountryCode}].`,
    },
    cohd: {
      evidenceNature: cohdLatest && cohdLatest.costHealthyDietPppUsd !== null ? 'Observed' : 'Missing',
      costPerDayPppUsd: cohdLatest?.costHealthyDietPppUsd ?? null,
      unaffordablePct: cohdLatest?.unaffordablePct ?? null,
      year: cohdLatest?.year ?? null,
      note: cohdLatest
        ? `World Bank / FAO Cost of a Healthy Diet (${cohdLatest.year}) = ${cohdLatest.costHealthyDietPppUsd} ICP PPP USD/day; national threshold context only.`
        : `No World Bank CoHD record matched for [${hicpCountryCode}].`,
    },
    categoryRankingEligibility: 'prohibited_macro_context_only',
  };

  return {
    data: {
      scenarios,
      evidenceMatrix,
      macroContext,
      lciSubgroupOverlapCheck: {
        totalAgribalyseCatalogCount: stdAgbAll.length,
        validUniqueLciRecordCount: validUniqueMappedLciCount,
        categoryLciRecordPairCount: baseClsDenom,
        distinctSubgroupsMapped: agbSubCounts.size,
        activeUniqueSubgroupsCount: activeUniqueSubgroups.size,
        categorySubgroupPairCount,
        duplicateSubgroupCodesCount,
        eligibleCategoryCount: agbEligibleCategoryCount,
        weightingNote:
          'Agribalyse-to-COICOP subgroup codes have 0 within-COICOP duplicates; 60 total COICOP-mapped subgroups (55 active in OFF categories + 5 in unmatched CP012) yield 83 category-subgroup pairs (28 shared across CP0114, CP0117, CP0119) and 3,114 category-LCI links from 2,161 unique LCI items across 11 eligible categories. Market-share weighting remains unavailable.',
      },
      perServingUnavailableDisclosure:
        'Per-serving nutrition calculations remain unavailable across openfoodfacts_eu (3,197/3,197 serving_quantity_g = NULL).',
    },
    unit: 'Integrated category robustness diagnostics (unmerged multi-layer architecture)',
    provenance: {
      module: 'integratedRobustness.evaluateIntegratedRobustnessSuite',
      version: INTEGRATED_ROBUSTNESS_VERSION,
      dataNature: 'Mixed',
      sources: [
        'classification_mappings.parquet v4.0',
        'openfoodfacts_eu.parquet',
        'agribalyse_31.parquet',
        'global_poore_nemecek_lca.parquet',
        'gi_terroir_registry.parquet (FOOD-only)',
        'scrapling_retail_claims.parquet',
        'Eurostat HICP / PPP & World Bank CoHD (macro context only)',
      ],
      assumptions: [
        'Reuses all Phase 3A-3D and Phase 4C engines cleanly; never constructs unified multi-dimensional scores or market-share weights.',
        'Macro HICP/PPP/CoHD indices are barred from category-level ranking stability.',
      ],
    },
    missingness: {
      totalRecords: evidenceMatrix.length,
      includedRecords: evidenceMatrix.filter((r) => r.supportedLayerCount > 1).length,
      missingOrExcludedRecords: evidenceMatrix.filter((r) => r.overallSupportLevel === 'unsupported_unmatched').length,
    },
  };
}

export function serializeIntegratedRobustnessCsv(params: {
  countryCode: string;
  workspace: IntegratedRobustnessWorkspace;
}): string {
  const esc = (v: string | number | boolean | null | undefined): string => {
    const s = v === null || v === undefined ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const { workspace, countryCode } = params;
  const lines: string[] = [
    `# DietShift Atlas — Phase 4D Integrated Comparator Robustness Export (v${INTEGRATED_ROBUSTNESS_VERSION})`,
    `# Macro Context [${countryCode}]: HICP(fallback=${workspace.macroContext.hicp.isEuFallback}, series=${workspace.macroContext.hicp.seriesAvailableCount}) | PPP Food PLI=${workspace.macroContext.ppp.foodPriceLevelIndexEu27 ?? 'N/A'} | CoHD=${workspace.macroContext.cohd.costPerDayPppUsd ?? 'N/A'} ICP PPP USD/d | Category ranking eligibility=${workspace.macroContext.categoryRankingEligibility}`,
    `# Duplicate AGB->COICOP subgroups: ${workspace.lciSubgroupOverlapCheck.duplicateSubgroupCodesCount} | ${workspace.perServingUnavailableDisclosure}`,
    [
      'scenario_id',
      'baseline_id',
      'layer',
      'scenario_type',
      'scenario_origin',
      'effect_mechanism',
      'assumption_id',
      'reused_engine',
      'common_universe_size',
      'baseline_only_excluded',
      'scenario_only_excluded',
      'baseline_valid_denom',
      'scenario_valid_denom',
      'denominator_delta',
      'denominator_grain_comparable',
      'denominator_delta_blocked_reason',
      'positive_energy_eligible_count',
      'comparable_across_units',
      'baseline_mean',
      'scenario_mean',
      'absolute_diff',
      'relative_diff_pct',
      'unit',
      'ranking_dimension',
      'pairwise_sample_size',
      'tied_rank_groups',
      'spearman_rho',
      'small_rank_sample_warning',
      'group_stability_status',
      'k_cutoff',
      'top_k_jaccard',
      'bottom_k_jaccard',
      'top_k_realized_sizes',
      'bottom_k_realized_sizes',
      'ranking_blocked_reason',
      'caveats',
    ].join(','),
  ];

  for (const s of workspace.scenarios) {
    const rs = s.rankingStability;
    const gs = rs?.groupStability;
    lines.push(
      [
        s.scenarioId,
        s.baselineId,
        s.layer,
        s.scenarioType,
        s.scenarioOrigin,
        s.effectMechanism,
        s.assumptionId,
        s.reusedEngineAndVersion,
        s.comparisonUniverse.commonUniverseSize,
        s.comparisonUniverse.baselineOnlyExcludedIds.join('; '),
        s.comparisonUniverse.scenarioOnlyExcludedIds.join('; '),
        s.denominators.baselineValid,
        s.denominators.scenarioValid,
        s.denominators.denominatorDelta ?? '',
        s.denominators.denominatorGrainComparable,
        s.denominators.denominatorDeltaBlockedReason ?? '',
        s.denominators.positiveEnergyEligibleCount ?? '',
        s.valueSummary.comparableAcrossUnits,
        s.valueSummary.baselineMean ?? '',
        s.valueSummary.scenarioMean ?? '',
        s.valueSummary.absoluteDiff ?? '',
        s.valueSummary.relativeDiffPct ?? '',
        s.valueSummary.unit,
        rs?.dimension ?? '',
        rs?.pairwiseSampleSize ?? '',
        rs?.tiedRankGroupsCount ?? '',
        rs?.spearmanRho ?? '',
        rs?.smallRankSampleWarning ?? '',
        gs?.status ?? 'not_applicable_descriptive_only',
        gs?.kCutoff ?? '',
        gs?.topKJaccard ?? '',
        gs?.bottomKJaccard ?? '',
        gs ? `${gs.topKRealizedSizes.baseline}/${gs.topKRealizedSizes.scenario}` : '',
        gs ? `${gs.bottomKRealizedSizes.baseline}/${gs.bottomKRealizedSizes.scenario}` : '',
        s.rankingBlockedReason ?? '',
        s.caveats.join(' | '),
      ]
        .map(esc)
        .join(',')
    );
  }

  lines.push('');
  lines.push(
    [
      '# EVIDENCE_MATRIX_CATEGORY',
      'support_level',
      'supported_layers_of_8',
      ...CATEGORY_EVIDENCE_LAYER_ORDER.map((l) => `${l}_nature(denom)`),
    ].join(',')
  );
  for (const row of workspace.evidenceMatrix) {
    lines.push(
      [
        row.categoryLabel,
        row.overallSupportLevel,
        `${row.supportedLayerCount}/${row.totalLayerCount}`,
        ...CATEGORY_EVIDENCE_LAYER_ORDER.map(
          (l) => `${row.layers[l].evidenceNature}(${row.layers[l].validDenominator})`
        ),
      ]
        .map(esc)
        .join(',')
    );
  }

  lines.push('');
  lines.push(
    [
      '# DIMENSION_RANKINGS_BREAKDOWN',
      'scenario_id',
      'dimension',
      'baseline_dimension',
      'scenario_dimension',
      'unit',
      'pairwise_sample_size',
      'spearman_rho',
      'small_rank_sample_warning',
      'group_stability_status',
      'top_k_jaccard',
      'bottom_k_jaccard',
    ].join(',')
  );
  for (const s of workspace.scenarios) {
    for (const dr of s.dimensionRankings) {
      lines.push(
        [
          'DIM_RANK',
          s.scenarioId,
          dr.dimension,
          dr.baselineDimension,
          dr.scenarioDimension,
          dr.unit,
          dr.pairwiseSampleSize,
          dr.spearmanRho ?? '',
          dr.smallRankSampleWarning,
          dr.groupStability.status,
          dr.groupStability.topKJaccard ?? '',
          dr.groupStability.bottomKJaccard ?? '',
        ]
          .map(esc)
          .join(',')
      );
    }
  }

  return lines.join('\n');
}
