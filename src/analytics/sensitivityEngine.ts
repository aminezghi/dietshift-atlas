import {
  AFFORDABILITY_ENGINE_VERSION,
  type ObservedRetailPriceRecord,
  aggregateRetailPricesByCategory,
  evaluateRetailUnitPrice,
} from './affordabilityEngine';
import type { ClassificationMappingRecord } from './classificationEngine';
import {
  ENVIRONMENT_ENGINE_VERSION,
  aggregateEnvironmentByCategory,
  filterFoodEligibleEnvironmentRecords,
  fromAgribalyseItem,
  fromGITerroirItem,
  fromPooreNemecekItem,
  type GITerroirInput,
  type PooreLcaInput,
} from './environmentEngine';
import {
  INTEGRATED_COMPARATOR_VERSION,
  buildIntegratedCategoryProfiles,
  rankCategoriesWithinDimension,
} from './integratedComparator';
import {
  NUTRITION_ENGINE_VERSION,
  type NutrientKey,
  type StandardizedNutritionInput,
  aggregateNutritionByCategory,
} from './nutritionEngine';
import type { AgribalyseItem, EurostatCountryData } from '../types/research';
import type { AnalyticalResult } from './types';

export const SENSITIVITY_ENGINE_VERSION = '4.3.1-phase4c';
export const SMALL_RANK_CORRELATION_THRESHOLD = 10;

export type SensitivityDimensionId =
  | 'classification'
  | 'nutrition_missingness'
  | 'environmental_proxy'
  | 'package_quantity'
  | 'geographic_coverage'
  | 'aggregation';

export type UncertaintyType =
  | 'observed-data uncertainty'
  | 'missingness'
  | 'classification uncertainty'
  | 'proxy uncertainty'
  | 'methodological assumption';

export type ScenarioOrigin = 'empirical_alternative' | 'analyst_defined';

export type ScenarioType =
  | 'data_subset_sensitivity'
  | 'missingness_sensitivity'
  | 'methodological_sensitivity'
  | 'boundary_or_functional_unit_sensitivity'
  | 'diagnostic_stress_test';

export type EffectMechanism =
  | 'analytical_method_change'
  | 'sample_population_change'
  | 'functional_unit_or_boundary_change'
  | 'inclusion_exclusion_rule';

export const EFFECT_MECHANISM_LABELS: Record<EffectMechanism, string> = {
  analytical_method_change: 'Changed analytical method / estimator',
  sample_population_change: 'Changed sample population / geographic subset',
  functional_unit_or_boundary_change: 'Changed functional unit or system boundary',
  inclusion_exclusion_rule: 'Changed inclusion / exclusion rule',
};

export type ConclusionStability =
  | 'stable'
  | 'moderate_shift'
  | 'sensitive'
  | 'insufficient_overlap';

export interface UncertaintyAssumptionSpec {
  assumptionId: string;
  dimension: SensitivityDimensionId;
  analyticalDomain: string;
  description: string;
  baselineTreatment: string;
  alternativeTreatments: Array<{
    scenarioId: string;
    label: string;
    origin: ScenarioOrigin;
    scenarioType: ScenarioType;
    effectMechanism: EffectMechanism;
    summary: string;
  }>;
  evidenceOrRationale: string;
  uncertaintyType: UncertaintyType;
  affectedOutputs: string[];
  provenanceAndVersion: string;
}

export interface UnsupportedExperimentSpec {
  experimentId: string;
  dimension: SensitivityDimensionId;
  title: string;
  reasonUnsupported: string;
  requiredDataOrMethod: string;
}

export const UNCERTAINTY_ASSUMPTION_REGISTRY: readonly UncertaintyAssumptionSpec[] = [
  {
    assumptionId: 'ASSUMP_CLS_MAPPING_TIERS',
    dimension: 'classification',
    analyticalDomain: 'Cross-taxonomy harmonization (FoodEx2 / Agribalyse / OFF / COICOP)',
    description:
      'Whether category-level integrated comparisons retain ambiguous splits and approximate crosswalk links or restrict to strict hierarchical / exact taxonomic matches.',
    baselineTreatment: 'Retain all mapped rules (exact, hierarchical, approximate, ambiguous); keep unmatched isolated.',
    alternativeTreatments: [
      {
        scenarioId: 'cls_exclude_ambiguous',
        label: 'Exclude ambiguous splits (34 rules removed)',
        origin: 'empirical_alternative',
        scenarioType: 'data_subset_sensitivity',
        effectMechanism: 'inclusion_exclusion_rule',
        summary: 'Drops many-to-many / split categories (is_ambiguous = true) before building integrated profiles.',
      },
      {
        scenarioId: 'cls_strict_hierarchy_only',
        label: 'Strict exact + hierarchical only (50 rules removed)',
        origin: 'empirical_alternative',
        scenarioType: 'data_subset_sensitivity',
        effectMechanism: 'inclusion_exclusion_rule',
        summary: 'Excludes both approximate analogies and ambiguous splits.',
      },
      {
        scenarioId: 'cls_strict_exact_only',
        label: 'Exact taxonomic equivalence only (6 rules)',
        origin: 'empirical_alternative',
        scenarioType: 'data_subset_sensitivity',
        effectMechanism: 'inclusion_exclusion_rule',
        summary: 'Requires exact=1:1 equivalence; demonstrates collapse of COICOP integrated bridges.',
      },
    ],
    evidenceOrRationale:
      'Phase 3A audit showed 34 ambiguous and 16 approximate rules carry cross-taxonomy granularity loss that may shift category CO₂ and nutrient comparisons.',
    uncertaintyType: 'classification uncertainty',
    affectedOutputs: ['Support level counts', 'Category mean CO₂eq/kg', 'Category protein/kcal rankings'],
    provenanceAndVersion: `classification_mappings v4.0 / integratedComparator ${INTEGRATED_COMPARATOR_VERSION}`,
  },
  {
    assumptionId: 'ASSUMP_NUT_MISSINGNESS_STRATEGY',
    dimension: 'nutrition_missingness',
    analyticalDomain: 'Open Food Facts EU nutrition composition (3,197 SKUs)',
    description:
      'How incomplete nutrition declarations (especially optional dietary fiber with 1,348 NULLs = 42.2%) affect category averages vs listwise complete-case restriction or energy-density basis.',
    baselineTreatment: 'Available-case (pairwise) per_100g means preserving NULLs without zero imputation.',
    alternativeTreatments: [
      {
        scenarioId: 'nut_core5_complete_case',
        label: 'Core-5 complete-case (kcal, protein, sugars, sat. fat, salt all present)',
        origin: 'empirical_alternative',
        scenarioType: 'missingness_sensitivity',
        effectMechanism: 'sample_population_change',
        summary: 'Restricts denominator to products with complete mandatory 5-nutrient panels.',
      },
      {
        scenarioId: 'nut_full8_complete_case',
        label: 'Strict Full-8 complete-case (incl. optional fiber_g)',
        origin: 'empirical_alternative',
        scenarioType: 'missingness_sensitivity',
        effectMechanism: 'sample_population_change',
        summary: 'Excludes 1,348+ products missing optional fiber declaration; exposes reporting selection bias.',
      },
      {
        scenarioId: 'nut_basis_per_100kcal',
        label: 'Per-100 kcal nutrient density basis (proteins_g rank check)',
        origin: 'analyst_defined',
        scenarioType: 'boundary_or_functional_unit_sensitivity',
        effectMechanism: 'functional_unit_or_boundary_change',
        summary: 'Re-ranks categories on protein per 100 kcal (drops missing/zero-kcal items; ordinal comparison only).',
      },
    ],
    evidenceOrRationale:
      'Products declaring optional dietary fiber are disproportionately whole-grain/plant items, creating systematic denominator & composition differences relative to pairwise means.',
    uncertaintyType: 'missingness',
    affectedOutputs: ['Category nutrient denominators', 'Mean kcal / protein / fiber', 'Category nutrition ranks'],
    provenanceAndVersion: `openfoodfacts_eu.parquet / nutritionEngine ${NUTRITION_ENGINE_VERSION}`,
  },
  {
    assumptionId: 'ASSUMP_ENV_PROXY_AND_SECTOR',
    dimension: 'environmental_proxy',
    analyticalDomain: 'Agribalyse 3.1.1, Poore & Nemecek (2018), GI Terroir Registry',
    description:
      'Sensitivity of environmental category indicators to outlier skewness (mean vs median), transport exclusion, functional unit ranks, and GI non-food sector filtering.',
    baselineTreatment:
      'Agribalyse arithmetic mean per Groupe_aliment; GI strictly FOOD sector (3,037); Poore full farm-to-retail GHG.',
    alternativeTreatments: [
      {
        scenarioId: 'env_agb_median_vs_mean',
        label: 'Agribalyse CO₂eq/kg: Median vs Arithmetic Mean',
        origin: 'empirical_alternative',
        scenarioType: 'methodological_sensitivity',
        effectMechanism: 'analytical_method_change',
        summary: 'Replaces group arithmetic mean with median to isolate right-tail ruminant/cheese skew.',
      },
      {
        scenarioId: 'env_poore_exclude_transport',
        label: 'Poore & Nemecek GHG excluding transport stage',
        origin: 'empirical_alternative',
        scenarioType: 'boundary_or_functional_unit_sensitivity',
        effectMechanism: 'functional_unit_or_boundary_change',
        summary: 'Subtracts observed stage_transport from ghg_kg_co2eq_per_kg within same boundary.',
      },
      {
        scenarioId: 'env_poore_protein_unit_rank',
        label: 'Poore & Nemecek: per-kg vs per-100g protein ordinal ranks',
        origin: 'analyst_defined',
        scenarioType: 'boundary_or_functional_unit_sensitivity',
        effectMechanism: 'functional_unit_or_boundary_change',
        summary: 'Compares ordinal commodity GHG ranks when switching functional unit (excludes 13 missing protein items).',
      },
      {
        scenarioId: 'env_gi_unfiltered_alcohol_leak',
        label: 'Diagnostic stress test — invalid sector inclusion',
        origin: 'analyst_defined',
        scenarioType: 'diagnostic_stress_test',
        effectMechanism: 'inclusion_exclusion_rule',
        summary: 'Isolated boundary-violation test quantifying distortion if 3,808 non-food WINE/SPIRIT/CRAFT GI records bypass environmentEngine filtering.',
      },
    ],
    evidenceOrRationale:
      'Ruminant meat tails skew arithmetic CO₂ means, while non-food GI records distorted GI Terroir summaries prior to Phase 3C enforcement.',
    uncertaintyType: 'proxy uncertainty',
    affectedOutputs: ['Category CO₂eq/kg', 'GI eligible record counts', 'Commodity carbon rankings'],
    provenanceAndVersion: `environmentEngine ${ENVIRONMENT_ENGINE_VERSION}`,
  },
  {
    assumptionId: 'ASSUMP_AFF_PACKAGE_QUANTITY',
    dimension: 'package_quantity',
    analyticalDomain: 'Open Prices EU retail shelf receipts (1,355 SKUs)',
    description:
      'Impact of excluding 132 missing-quantity SKUs and 187 liquids from EUR/kg, analyst-defined <100g micro-pack exclusion, or viewing unnormalized package price ranks.',
    baselineTreatment: 'Verified mass SKUs only (EUR/kg, n=1,036 valid; 132 missing qty & 187 liquid excluded).',
    alternativeTreatments: [
      {
        scenarioId: 'pkg_exclude_micropacks_100g',
        label: 'Exclude < 100g micro-packs from EUR/kg (analyst threshold)',
        origin: 'analyst_defined',
        scenarioType: 'data_subset_sensitivity',
        effectMechanism: 'sample_population_change',
        summary: 'Analyst-defined 100g sample restriction testing whether small spice/condiment/snack packages drive elevated mean EUR/kg.',
      },
      {
        scenarioId: 'pkg_unnormalized_per_package',
        label: 'Unnormalized EUR/package (n=1,355, rank comparison only)',
        origin: 'analyst_defined',
        scenarioType: 'boundary_or_functional_unit_sensitivity',
        effectMechanism: 'functional_unit_or_boundary_change',
        summary: 'Quantifies category rank distortion when missing-weight & liquid SKUs are ranked by shelf package price.',
      },
      {
        scenarioId: 'pkg_liquid_per_litre_scope',
        label: 'Liquid SKUs strict EUR/L coverage (n=187)',
        origin: 'empirical_alternative',
        scenarioType: 'boundary_or_functional_unit_sensitivity',
        effectMechanism: 'sample_population_change',
        summary: 'Isolates liquid-only unit pricing coverage without mass-volume conversion.',
      },
    ],
    evidenceOrRationale:
      'Unit prices EUR/kg can be heavily skewed upward by <100g packets (vanilla, spices, yeast) and lose 9.7% coverage due to missing package weight strings.',
    uncertaintyType: 'observed-data uncertainty',
    affectedOutputs: ['Retail EUR/kg means', 'Coverage denominator', 'Category affordability ranks'],
    provenanceAndVersion: `scrapling_retail_claims.parquet / affordabilityEngine ${AFFORDABILITY_ENGINE_VERSION}`,
  },
  {
    assumptionId: 'ASSUMP_GEO_SAMPLE_COMPOSITION',
    dimension: 'geographic_coverage',
    analyticalDomain: 'Geographic skew in Open Food Facts (3,197) & Open Prices EU (1,355)',
    description:
      'Effect of non-EU rows (301 US items in OFF) and heavy French/German skew (86.9% FR in Open Prices) on pooled EU nutrition and price averages.',
    baselineTreatment: 'Full sample retained without geographic filtering.',
    alternativeTreatments: [
      {
        scenarioId: 'geo_off_europe_only',
        label: 'OFF Nutrition: Exclude non-European SKUs (e.g., 301 US)',
        origin: 'empirical_alternative',
        scenarioType: 'data_subset_sensitivity',
        effectMechanism: 'sample_population_change',
        summary: 'Filters openfoodfacts_eu strictly to European/UK primary_country entries.',
      },
      {
        scenarioId: 'geo_off_france_only',
        label: 'OFF Nutrition: France-only subset (n=1,394)',
        origin: 'empirical_alternative',
        scenarioType: 'data_subset_sensitivity',
        effectMechanism: 'sample_population_change',
        summary: 'Tests whether France (43.6% of OFF) differs systematically in sugar/kcal from pooled catalog.',
      },
      {
        scenarioId: 'geo_retail_france_only',
        label: 'Open Prices EUR/kg: France-only (FR, n=1,178)',
        origin: 'empirical_alternative',
        scenarioType: 'data_subset_sensitivity',
        effectMechanism: 'sample_population_change',
        summary: 'Isolates dominant French receipt subset.',
      },
      {
        scenarioId: 'geo_retail_germany_only',
        label: 'Open Prices EUR/kg: Germany-only (DE, n=115)',
        origin: 'empirical_alternative',
        scenarioType: 'data_subset_sensitivity',
        effectMechanism: 'sample_population_change',
        summary: 'Compares German shelf prices vs full receipt pool (ES/NL/PT n=1 remain excluded).',
      },
    ],
    evidenceOrRationale:
      'Phase 3B/3D showed openfoodfacts_eu contains ~9.4% US products and Open Prices is 86.9% French, making "EU mean" sensitive to country mix.',
    uncertaintyType: 'observed-data uncertainty',
    affectedOutputs: ['Nutrition category means', 'Retail EUR/kg category prices & coverage'],
    provenanceAndVersion: `openfoodfacts_eu + scrapling_retail_claims v4.0`,
  },
  {
    assumptionId: 'ASSUMP_AGG_ESTIMATOR_WEIGHTS',
    dimension: 'aggregation',
    analyticalDomain: 'Category location estimators & COICOP subgroup weighting (market-share weighting unavailable)',
    description:
      'Comparison between unweighted arithmetic means and medians, and between Agribalyse LCI-record-count weighting vs equal-subgroup weighting inside COICOP bridges (distinct from unavailable market-share/consumption weights).',
    baselineTreatment:
      'Unweighted SKU arithmetic mean; COICOP CO₂ weighted by Agribalyse LCI-record count per subgroup (inventory coverage, NOT consumption share).',
    alternativeTreatments: [
      {
        scenarioId: 'agg_off_median_vs_mean_energy',
        label: 'OFF Category Energy (kcal/100g): Median vs Arithmetic Mean',
        origin: 'empirical_alternative',
        scenarioType: 'methodological_sensitivity',
        effectMechanism: 'analytical_method_change',
        summary: 'Evaluates location-estimator shift across OFF categories.',
      },
      {
        scenarioId: 'agg_retail_median_vs_mean_eur_kg',
        label: 'Open Prices EUR/kg: Median vs Arithmetic Mean',
        origin: 'empirical_alternative',
        scenarioType: 'methodological_sensitivity',
        effectMechanism: 'analytical_method_change',
        summary: 'Measures outlier reduction across skewed retail unit price categories.',
      },
      {
        scenarioId: 'agg_coicop_equal_subgroup_weight',
        label: 'Integrated COICOP CO₂: Equal-Subgroup Weighting vs LCI-Record-Count Weighting',
        origin: 'analyst_defined',
        scenarioType: 'methodological_sensitivity',
        effectMechanism: 'analytical_method_change',
        summary:
          'Weights each matched Agribalyse subgroup identically (1/k) instead of by Agribalyse LCI-record count; neither reflects unavailable market-share/consumption weights.',
      },
    ],
    evidenceOrRationale:
      'LCI-record-count weighting reflects how densely Agribalyse models subgroups rather than consumer expenditure or intake shares; true market-share/consumption weights are unavailable.',
    uncertaintyType: 'methodological assumption',
    affectedOutputs: ['Category nutrition/price center', 'Integrated COICOP CO₂eq/kg & rankings'],
    provenanceAndVersion: `integratedComparator ${INTEGRATED_COMPARATOR_VERSION}`,
  },
];

export const UNSUPPORTED_SENSITIVITY_EXPERIMENTS: readonly UnsupportedExperimentSpec[] = [
  {
    experimentId: 'UNSUP_SOBOL_MONTE_CARLO',
    dimension: 'aggregation',
    title: 'Global Sobol Variance Decomposition / Parametric Monte Carlo',
    reasonUnsupported:
      'Blocked: underlying food datasets lack joint empirical probability distributions and parameter covariance matrices; assigning arbitrary uniform/normal priors to simulate variance shares is prohibited.',
    requiredDataOrMethod: 'Empirically calibrated covariance estimates across harmonized survey & LCI parameters.',
  },
  {
    experimentId: 'UNSUP_MARKET_SHARE_WEIGHTING',
    dimension: 'aggregation',
    title: 'Market-Share / Retail Sales-Volume Weighted Category Means',
    reasonUnsupported:
      'Blocked: zero verified retail sales-volume or market-share tables exist in DietShift Atlas; inventing consumption weights is strictly prohibited.',
    requiredDataOrMethod: 'Audited scanner volume shares (e.g., Eurostat/Circana category sales weights by EAN/COICOP).',
  },
  {
    experimentId: 'UNSUP_OFF_PER_SERVING',
    dimension: 'nutrition_missingness',
    title: 'Open Food Facts Per-Serving Nutrition Sensitivity',
    reasonUnsupported:
      'Blocked: serving_quantity_g is NULL across all 3,197 records (100% missingness; retained in Phase 3B backlog pending v2 API enrichment).',
    requiredDataOrMethod: 'Direct Open Food Facts v2 product serving_size enrichment without default-portion invention.',
  },
  {
    experimentId: 'UNSUP_TINY_COUNTRY_RETAIL_PRICE',
    dimension: 'geographic_coverage',
    title: 'Spain / Netherlands / Portugal Open Prices Representativeness',
    reasonUnsupported:
      'Blocked: ES, NL, and PT contain n=1 receipt each in scrapling_retail_claims (1,355 SKUs), far below minimum representative coverage.',
    requiredDataOrMethod: 'Expanded multi-retailer Open Prices ingestion across ES, NL, PT, and non-FR jurisdictions.',
  },
];

export interface SensitivityScenarioSummaryStats {
  recordTotal: number;
  validDenominator: number;
  excludedCount: number;
  categoryCount: number;
  meanAcrossCategories: number | null;
  medianAcrossCategories: number | null;
  unit: string;
}

export interface SensitivityCategoryDelta {
  category: string;
  baselineValue: number;
  scenarioValue: number;
  baselineRank: number;
  scenarioRank: number;
  rankShift: number;
  valueDelta: number | null;
  valueDeltaPct: number | null;
}

export interface SensitivityScenarioResult {
  baselineId: string;
  scenarioId: string;
  label: string;
  dimension: SensitivityDimensionId;
  assumptionId: string;
  scenarioOrigin: ScenarioOrigin;
  scenarioType: ScenarioType;
  effectMechanism: EffectMechanism;
  effectMechanismLabel: string;
  isDiagnosticOnly: boolean;
  reusedEngineAndVersion: string;
  assumptionChanges: string[];
  baselineSummary: SensitivityScenarioSummaryStats;
  scenarioSummary: SensitivityScenarioSummaryStats;
  affectedRecords: {
    count: number;
    pctOfTotal: number;
    excludedOrReclassifiedDelta: number;
    denominatorDelta: number;
  };
  deltaMetrics: {
    absoluteDiff: number | null;
    relativeDiffPct: number | null;
    comparableAcrossUnits: boolean;
    crossUnitNote: string | null;
  };
  rankingMetrics: {
    comparableCategoriesCount: number;
    pairwiseSampleSize: number;
    tiedRankGroupsCount: number;
    tiedRankGroupsBaseline: number;
    tiedRankGroupsScenario: number;
    excludedCategoriesCount: number;
    comparisonScope: string;
    smallRankSampleWarning: boolean;
    rankChangesCount: number;
    maxAbsRankShift: number;
    spearmanRho: number | null;
    conclusionStability: ConclusionStability;
    topDrivers: SensitivityCategoryDelta[];
  };
  caveats: string[];
}

export interface SensitivitySuiteInputs {
  mappings: readonly ClassificationMappingRecord[];
  nutritionInputs: readonly StandardizedNutritionInput[];
  nutritionCountryMap?: ReadonlyMap<string, string | null>;
  agribalyseItems: readonly AgribalyseItem[];
  pooreItems?: readonly PooreLcaInput[];
  giItems?: readonly GITerroirInput[];
  retailPriceRecords: readonly ObservedRetailPriceRecord[];
  hicpCountryCode: string;
  hicpData: EurostatCountryData | null;
  isHicpEuFallback: boolean;
}

const EUROPE_OFF_COUNTRIES = new Set([
  'france',
  'germany',
  'united-kingdom',
  'belgium',
  'spain',
  'italy',
  'switzerland',
  'sweden',
  'netherlands',
  'austria',
  'portugal',
  'ireland',
  'poland',
  'denmark',
  'norway',
  'finland',
  'greece',
  'czech-republic',
  'romania',
  'hungary',
  'luxembourg',
]);

function roundTo(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

function medianOf(values: readonly number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const m = Math.floor(clean.length / 2);
  return clean.length % 2 === 1 ? roundTo(clean[m], 3) : roundTo((clean[m - 1] + clean[m]) / 2, 3);
}

function meanOf(values: readonly number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return null;
  return roundTo(clean.reduce((s, v) => s + v, 0) / clean.length, 3);
}

/**
 * Average fractional ranks (1 = largest value) to preserve ties cleanly in Spearman correlation,
 * returning both rank map and count of tied rank groups (size >= 2).
 */
function assignFractionalRanks(
  entries: ReadonlyArray<{ key: string; value: number }>
): { rankMap: Map<string, number>; tiedGroupsCount: number } {
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const rankMap = new Map<string, number>();
  let tiedGroupsCount = 0;
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && Math.abs(sorted[j + 1].value - sorted[i].value) <= 1e-9) {
      j += 1;
    }
    if (j > i) tiedGroupsCount += 1;
    const avgRank = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k += 1) {
      rankMap.set(sorted[k].key, avgRank);
    }
    i = j + 1;
  }
  return { rankMap, tiedGroupsCount };
}

export function computeSpearmanRankCorrelation(
  pairs: ReadonlyArray<{ key: string; valA: number; valB: number }>
): {
  rho: number | null;
  pairwiseSampleSize: number;
  tiedRankGroupsBaseline: number;
  tiedRankGroupsScenario: number;
  tiedRankGroupsCount: number;
  rankA: Map<string, number>;
  rankB: Map<string, number>;
} {
  const { rankMap: rankA, tiedGroupsCount: tiedRankGroupsBaseline } = assignFractionalRanks(
    pairs.map((p) => ({ key: p.key, value: p.valA }))
  );
  const { rankMap: rankB, tiedGroupsCount: tiedRankGroupsScenario } = assignFractionalRanks(
    pairs.map((p) => ({ key: p.key, value: p.valB }))
  );
  const tiedRankGroupsCount = tiedRankGroupsBaseline + tiedRankGroupsScenario;

  if (pairs.length < 3) {
    return {
      rho: null,
      pairwiseSampleSize: pairs.length,
      tiedRankGroupsBaseline,
      tiedRankGroupsScenario,
      tiedRankGroupsCount,
      rankA,
      rankB,
    };
  }
  const rAs = pairs.map((p) => rankA.get(p.key)!);
  const rBs = pairs.map((p) => rankB.get(p.key)!);
  const meanA = rAs.reduce((s, x) => s + x, 0) / rAs.length;
  const meanB = rBs.reduce((s, x) => s + x, 0) / rBs.length;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let idx = 0; idx < pairs.length; idx += 1) {
    const da = rAs[idx] - meanA;
    const db = rBs[idx] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const denom = Math.sqrt(denA * denB);
  const rho = denom > 1e-9 ? roundTo(num / denom, 3) : null;
  return {
    rho,
    pairwiseSampleSize: pairs.length,
    tiedRankGroupsBaseline,
    tiedRankGroupsScenario,
    tiedRankGroupsCount,
    rankA,
    rankB,
  };
}

function classifyStability(
  commonCount: number,
  rho: number | null,
  maxShift: number
): ConclusionStability {
  if (commonCount < 3 || rho === null) return 'insufficient_overlap';
  if (rho >= 0.9 && maxShift <= 1) return 'stable';
  if (rho >= 0.7 && maxShift <= 2) return 'moderate_shift';
  return 'sensitive';
}

function lookupRegistryTreatment(scenarioId: string) {
  for (const spec of UNCERTAINTY_ASSUMPTION_REGISTRY) {
    const found = spec.alternativeTreatments.find((t) => t.scenarioId === scenarioId);
    if (found) return found;
  }
  return null;
}

function compareCategorySeries(params: {
  baselineId: string;
  scenarioId: string;
  label: string;
  dimension: SensitivityDimensionId;
  assumptionId: string;
  scenarioOrigin: ScenarioOrigin;
  scenarioType?: ScenarioType;
  effectMechanism?: EffectMechanism;
  comparisonScope?: string;
  reusedEngineAndVersion: string;
  assumptionChanges: string[];
  baseRecordsTotal: number;
  baseValidDenom: number;
  scenRecordsTotal: number;
  scenValidDenom: number;
  baseUnit: string;
  scenUnit: string;
  comparableAcrossUnits: boolean;
  crossUnitNote: string | null;
  baseCategoryMap: ReadonlyMap<string, number>;
  scenCategoryMap: ReadonlyMap<string, number>;
  affectedCount: number;
  caveats: string[];
}): SensitivityScenarioResult {
  const {
    baselineId,
    scenarioId,
    label,
    dimension,
    assumptionId,
    reusedEngineAndVersion,
    assumptionChanges,
    baseRecordsTotal,
    baseValidDenom,
    scenRecordsTotal,
    scenValidDenom,
    baseUnit,
    scenUnit,
    comparableAcrossUnits,
    crossUnitNote,
    baseCategoryMap,
    scenCategoryMap,
    affectedCount,
    caveats,
  } = params;

  const reg = lookupRegistryTreatment(scenarioId);
  const scenarioOrigin = reg?.origin ?? params.scenarioOrigin;
  const scenarioType: ScenarioType =
    params.scenarioType ?? reg?.scenarioType ?? 'methodological_sensitivity';
  const effectMechanism: EffectMechanism =
    params.effectMechanism ?? reg?.effectMechanism ?? 'analytical_method_change';
  const isDiagnosticOnly = scenarioType === 'diagnostic_stress_test';

  const baseVals = Array.from(baseCategoryMap.values());
  const scenVals = Array.from(scenCategoryMap.values());
  const baseMean = meanOf(baseVals);
  const baseMed = medianOf(baseVals);
  const scenMean = meanOf(scenVals);
  const scenMed = medianOf(scenVals);

  const absDiff =
    comparableAcrossUnits && baseMean !== null && scenMean !== null
      ? roundTo(scenMean - baseMean, 3)
      : null;
  const relDiffPct =
    absDiff !== null && baseMean !== null && Math.abs(baseMean) > 1e-9
      ? roundTo((100 * absDiff) / baseMean, 2)
      : null;

  const unionKeys = new Set([...baseCategoryMap.keys(), ...scenCategoryMap.keys()]);
  const commonKeys = Array.from(baseCategoryMap.keys()).filter((k) => scenCategoryMap.has(k));
  const excludedCategoriesCount = unionKeys.size - commonKeys.length;
  const pairs = commonKeys.map((k) => ({
    key: k,
    valA: baseCategoryMap.get(k)!,
    valB: scenCategoryMap.get(k)!,
  }));
  const {
    rho,
    pairwiseSampleSize,
    tiedRankGroupsBaseline,
    tiedRankGroupsScenario,
    tiedRankGroupsCount,
    rankA,
    rankB,
  } = computeSpearmanRankCorrelation(pairs);

  let rankChangesCount = 0;
  let maxAbsRankShift = 0;
  const drivers: SensitivityCategoryDelta[] = [];

  for (const p of pairs) {
    const rA = rankA.get(p.key)!;
    const rB = rankB.get(p.key)!;
    const shift = Math.round((rA - rB) * 10) / 10;
    const absShift = Math.abs(shift);
    if (absShift > 0) rankChangesCount += 1;
    if (absShift > maxAbsRankShift) maxAbsRankShift = absShift;

    const vDelta = comparableAcrossUnits ? roundTo(p.valB - p.valA, 3) : null;
    const vDeltaPct =
      vDelta !== null && Math.abs(p.valA) > 1e-9 ? roundTo((100 * vDelta) / p.valA, 2) : null;

    drivers.push({
      category: p.key,
      baselineValue: roundTo(p.valA, 3),
      scenarioValue: roundTo(p.valB, 3),
      baselineRank: rA,
      scenarioRank: rB,
      rankShift: shift,
      valueDelta: vDelta,
      valueDeltaPct: vDeltaPct,
    });
  }

  drivers.sort((a, b) => {
    const rDiff = Math.abs(b.rankShift) - Math.abs(a.rankShift);
    if (rDiff !== 0) return rDiff;
    return Math.abs(b.valueDeltaPct ?? 0) - Math.abs(a.valueDeltaPct ?? 0);
  });

  const baseExcluded = Math.max(0, baseRecordsTotal - baseValidDenom);
  const scenExcluded = Math.max(0, scenRecordsTotal - scenValidDenom);
  const smallRankSampleWarning = pairwiseSampleSize < SMALL_RANK_CORRELATION_THRESHOLD;
  const comparisonScope =
    params.comparisonScope ??
    `${pairwiseSampleSize} overlapping categories/items (${excludedCategoriesCount} non-overlapping excluded)`;

  return {
    baselineId,
    scenarioId,
    label,
    dimension,
    assumptionId,
    scenarioOrigin,
    scenarioType,
    effectMechanism,
    effectMechanismLabel: EFFECT_MECHANISM_LABELS[effectMechanism],
    isDiagnosticOnly,
    reusedEngineAndVersion,
    assumptionChanges,
    baselineSummary: {
      recordTotal: baseRecordsTotal,
      validDenominator: baseValidDenom,
      excludedCount: baseExcluded,
      categoryCount: baseCategoryMap.size,
      meanAcrossCategories: baseMean,
      medianAcrossCategories: baseMed,
      unit: baseUnit,
    },
    scenarioSummary: {
      recordTotal: scenRecordsTotal,
      validDenominator: scenValidDenom,
      excludedCount: scenExcluded,
      categoryCount: scenCategoryMap.size,
      meanAcrossCategories: scenMean,
      medianAcrossCategories: scenMed,
      unit: scenUnit,
    },
    affectedRecords: {
      count: affectedCount,
      pctOfTotal: baseRecordsTotal > 0 ? roundTo((100 * affectedCount) / baseRecordsTotal, 1) : 0,
      excludedOrReclassifiedDelta: scenExcluded - baseExcluded,
      denominatorDelta: scenValidDenom - baseValidDenom,
    },
    deltaMetrics: {
      absoluteDiff: absDiff,
      relativeDiffPct: relDiffPct,
      comparableAcrossUnits,
      crossUnitNote,
    },
    rankingMetrics: {
      comparableCategoriesCount: commonKeys.length,
      pairwiseSampleSize,
      tiedRankGroupsCount,
      tiedRankGroupsBaseline,
      tiedRankGroupsScenario,
      excludedCategoriesCount,
      comparisonScope,
      smallRankSampleWarning,
      rankChangesCount,
      maxAbsRankShift,
      spearmanRho: rho,
      conclusionStability: classifyStability(commonKeys.length, rho, maxAbsRankShift),
      topDrivers: drivers.slice(0, 6),
    },
    caveats: [
      ...caveats,
      ...(smallRankSampleWarning
        ? [
            `Small rank correlation sample (n=${pairwiseSampleSize} < ${SMALL_RANK_CORRELATION_THRESHOLD}): Spearman rho reflects ordinal swaps across very few categories without statistical significance claims.`,
          ]
        : []),
      ...(effectMechanism !== 'analytical_method_change'
        ? [
            `Observed difference reflects '${EFFECT_MECHANISM_LABELS[effectMechanism]}' (denominator Δ = ${scenValidDenom - baseValidDenom}), not a pure estimator effect.`,
          ]
        : []),
      'One-at-a-time scenario comparison; does not estimate global Sobol variance or causal treatment effects.',
    ],
  };
}

/**
 * Explicitly validates scenario requests and blocks fabricated weights, unmotivated distributions,
 * cross-unit arithmetic, or non-representative tiny country claims.
 */
export function validateSensitivityScenarioRequest(
  scenarioId: string
): { valid: true } | { valid: false; reason: string } {
  const unsupported = UNSUPPORTED_SENSITIVITY_EXPERIMENTS.find((u) => u.experimentId === scenarioId);
  if (unsupported) {
    return { valid: false, reason: `${unsupported.title}: ${unsupported.reasonUnsupported}` };
  }
  const knownIds = new Set(
    UNCERTAINTY_ASSUMPTION_REGISTRY.flatMap((a) => a.alternativeTreatments.map((t) => t.scenarioId))
  );
  if (!knownIds.has(scenarioId)) {
    return {
      valid: false,
      reason: `Unknown or unsupported sensitivity scenario '${scenarioId}'. Only documented registry scenarios are permitted.`,
    };
  }
  return { valid: true };
}

export function runAllSensitivityScenarios(
  inputs: SensitivitySuiteInputs
): AnalyticalResult<SensitivityScenarioResult[]> {
  const results: SensitivityScenarioResult[] = [];
  const {
    mappings,
    nutritionInputs,
    nutritionCountryMap,
    agribalyseItems,
    pooreItems = [],
    giItems = [],
    retailPriceRecords,
    hicpCountryCode,
    hicpData,
    isHicpEuFallback,
  } = inputs;

  // -------------------------------------------------------------------------
  // A. Classification Uncertainty (integratedComparator + classificationEngine)
  // -------------------------------------------------------------------------
  const baseIntegrated = buildIntegratedCategoryProfiles({
    mappings,
    nutritionInputs,
    agribalyseItems,
    retailPriceRecords,
    hicpCountryCode,
    hicpData,
    isHicpEuFallback,
    pppBenchmark: null,
    cohdLatest: null,
  });
  const baseCo2Ranks = rankCategoriesWithinDimension(baseIntegrated.data.profiles, 'agb_climate_co2eq_per_kg');
  const baseClsMap = new Map<string, number>();
  for (const r of baseCo2Ranks.data) baseClsMap.set(r.categoryLabel, r.value);
  const baseClsItemsDenom = baseIntegrated.data.profiles.reduce(
    (s, p) => s + (p.environmentPerKg?.matchedItemsDenominator ?? 0),
    0
  );

  for (const spec of [
    {
      id: 'cls_exclude_ambiguous',
      label: 'Classification: Exclude ambiguous splits',
      pred: (m: ClassificationMappingRecord) => !m.is_ambiguous,
      desc: 'Removes all 34 ambiguous multi-target taxonomy rules before CO₂ ranking.',
    },
    {
      id: 'cls_strict_hierarchy_only',
      label: 'Classification: Strict exact + hierarchical only',
      pred: (m: ClassificationMappingRecord) =>
        m.mapping_type === 'exact' || m.mapping_type === 'hierarchical' || m.mapping_type === 'unmatched',
      desc: 'Removes approximate and ambiguous rules; retains only exact and hierarchical bridges.',
    },
    {
      id: 'cls_strict_exact_only',
      label: 'Classification: Strict exact equivalence only',
      pred: (m: ClassificationMappingRecord) =>
        m.mapping_type === 'exact' || m.mapping_type === 'unmatched',
      desc: 'Requires 1:1 exact equivalence across classifications (COICOP has 0 exact bridges).',
    },
  ]) {
    const filteredMappings = mappings.filter(spec.pred);
    const scenIntegrated = buildIntegratedCategoryProfiles({
      mappings: filteredMappings,
      nutritionInputs,
      agribalyseItems,
      retailPriceRecords,
      hicpCountryCode,
      hicpData,
      isHicpEuFallback,
      pppBenchmark: null,
      cohdLatest: null,
    });
    const scenRanks = rankCategoriesWithinDimension(scenIntegrated.data.profiles, 'agb_climate_co2eq_per_kg');
    const scenMap = new Map<string, number>();
    for (const r of scenRanks.data) scenMap.set(r.categoryLabel, r.value);
    const scenItemsDenom = scenIntegrated.data.profiles.reduce(
      (s, p) => s + (p.environmentPerKg?.matchedItemsDenominator ?? 0),
      0
    );

    results.push(
      compareCategorySeries({
        baselineId: 'cls_baseline_all_mapped',
        scenarioId: spec.id,
        label: spec.label,
        dimension: 'classification',
        assumptionId: 'ASSUMP_CLS_MAPPING_TIERS',
        scenarioOrigin: 'empirical_alternative',
        reusedEngineAndVersion: `integratedComparator ${INTEGRATED_COMPARATOR_VERSION}`,
        assumptionChanges: [spec.desc],
        baseRecordsTotal: mappings.length,
        baseValidDenom: baseClsItemsDenom,
        scenRecordsTotal: mappings.length,
        scenValidDenom: scenItemsDenom,
        baseUnit: 'kg CO₂eq / kg (COICOP-bridged Agribalyse)',
        scenUnit: 'kg CO₂eq / kg (COICOP-bridged Agribalyse)',
        comparableAcrossUnits: true,
        crossUnitNote: null,
        baseCategoryMap: baseClsMap,
        scenCategoryMap: scenMap,
        affectedCount: mappings.length - filteredMappings.length,
        caveats: ['Classification similarity does not guarantee identical nutritional or LCA functional equivalence.'],
      })
    );
  }

  // -------------------------------------------------------------------------
  // B. Nutrition Missingness (nutritionEngine)
  // -------------------------------------------------------------------------
  const core5Keys: NutrientKey[] = ['energy_kcal', 'proteins_g', 'sugars_g', 'saturated_fat_g', 'salt_g'];
  const full8Keys: NutrientKey[] = [
    'energy_kcal',
    'proteins_g',
    'carbohydrates_g',
    'sugars_g',
    'fat_g',
    'saturated_fat_g',
    'fiber_g',
    'salt_g',
  ];

  const baseNut = aggregateNutritionByCategory(nutritionInputs, 'per_100g', ['energy_kcal', 'proteins_g', 'fiber_g']);
  const baseEnergyMap = new Map<string, number>();
  const baseProteinMap = new Map<string, number>();
  let baseEnergyDenom = 0;
  let baseProteinDenom = 0;

  for (const cat of baseNut.data) {
    if (cat.metrics.energy_kcal?.mean !== null && cat.metrics.energy_kcal?.mean !== undefined) {
      baseEnergyMap.set(cat.category, cat.metrics.energy_kcal.mean);
      baseEnergyDenom += cat.metrics.energy_kcal.validDenominator;
    }
    if (cat.metrics.proteins_g?.mean !== null && cat.metrics.proteins_g?.mean !== undefined) {
      baseProteinMap.set(cat.category, cat.metrics.proteins_g.mean);
      baseProteinDenom += cat.metrics.proteins_g.validDenominator;
    }
  }

  const core5Inputs = nutritionInputs.filter((p) => core5Keys.every((k) => p.per100g[k] !== null));
  const core5Nut = aggregateNutritionByCategory(core5Inputs, 'per_100g', ['energy_kcal', 'proteins_g']);
  const core5EnergyMap = new Map<string, number>();
  let core5Denom = 0;
  for (const cat of core5Nut.data) {
    if (cat.metrics.energy_kcal?.mean !== null && cat.metrics.energy_kcal?.mean !== undefined) {
      core5EnergyMap.set(cat.category, cat.metrics.energy_kcal.mean);
      core5Denom += cat.metrics.energy_kcal.validDenominator;
    }
  }
  results.push(
    compareCategorySeries({
      baselineId: 'nut_baseline_pairwise_100g',
      scenarioId: 'nut_core5_complete_case',
      label: 'Nutrition: Core-5 complete-case vs pairwise (energy_kcal)',
      dimension: 'nutrition_missingness',
      assumptionId: 'ASSUMP_NUT_MISSINGNESS_STRATEGY',
      scenarioOrigin: 'empirical_alternative',
      reusedEngineAndVersion: `nutritionEngine ${NUTRITION_ENGINE_VERSION}`,
      assumptionChanges: ['Excludes any SKU missing one or more of {kcal, protein, sugars, sat. fat, salt}.'],
      baseRecordsTotal: nutritionInputs.length,
      baseValidDenom: baseEnergyDenom,
      scenRecordsTotal: nutritionInputs.length,
      scenValidDenom: core5Denom,
      baseUnit: 'kcal / 100g',
      scenUnit: 'kcal / 100g',
      comparableAcrossUnits: true,
      crossUnitNote: null,
      baseCategoryMap: baseEnergyMap,
      scenCategoryMap: core5EnergyMap,
      affectedCount: nutritionInputs.length - core5Inputs.length,
      caveats: ['No zero imputation performed; isolates label-completeness selection bias on core panels.'],
    })
  );

  const full8Inputs = nutritionInputs.filter((p) => full8Keys.every((k) => p.per100g[k] !== null));
  const full8Nut = aggregateNutritionByCategory(full8Inputs, 'per_100g', ['energy_kcal', 'proteins_g']);
  const full8EnergyMap = new Map<string, number>();
  let full8Denom = 0;
  for (const cat of full8Nut.data) {
    if (cat.metrics.energy_kcal?.mean !== null && cat.metrics.energy_kcal?.mean !== undefined) {
      full8EnergyMap.set(cat.category, cat.metrics.energy_kcal.mean);
      full8Denom += cat.metrics.energy_kcal.validDenominator;
    }
  }
  results.push(
    compareCategorySeries({
      baselineId: 'nut_baseline_pairwise_100g',
      scenarioId: 'nut_full8_complete_case',
      label: 'Nutrition: Full-8 complete-case incl. fiber (energy_kcal)',
      dimension: 'nutrition_missingness',
      assumptionId: 'ASSUMP_NUT_MISSINGNESS_STRATEGY',
      scenarioOrigin: 'empirical_alternative',
      reusedEngineAndVersion: `nutritionEngine ${NUTRITION_ENGINE_VERSION}`,
      assumptionChanges: ['Requires all 8 nutrients present (drops products omitting optional fiber_g).'],
      baseRecordsTotal: nutritionInputs.length,
      baseValidDenom: baseEnergyDenom,
      scenRecordsTotal: nutritionInputs.length,
      scenValidDenom: full8Denom,
      baseUnit: 'kcal / 100g',
      scenUnit: 'kcal / 100g',
      comparableAcrossUnits: true,
      crossUnitNote: null,
      baseCategoryMap: baseEnergyMap,
      scenCategoryMap: full8EnergyMap,
      affectedCount: nutritionInputs.length - full8Inputs.length,
      caveats: ['Optional fiber declaration skews toward higher-fiber whole-food/cereal lines.'],
    })
  );

  const nutPer100kcal = aggregateNutritionByCategory(nutritionInputs, 'per_100kcal', ['proteins_g']);
  const prot100kcalMap = new Map<string, number>();
  let prot100kcalDenom = 0;
  for (const cat of nutPer100kcal.data) {
    if (cat.metrics.proteins_g?.mean !== null && cat.metrics.proteins_g?.mean !== undefined) {
      prot100kcalMap.set(cat.category, cat.metrics.proteins_g.mean);
      prot100kcalDenom += cat.metrics.proteins_g.validDenominator;
    }
  }
  results.push(
    compareCategorySeries({
      baselineId: 'nut_baseline_protein_per_100g',
      scenarioId: 'nut_basis_per_100kcal',
      label: 'Nutrition: Protein density per 100 kcal vs per 100g (rank check)',
      dimension: 'nutrition_missingness',
      assumptionId: 'ASSUMP_NUT_MISSINGNESS_STRATEGY',
      scenarioOrigin: 'analyst_defined',
      reusedEngineAndVersion: `nutritionEngine ${NUTRITION_ENGINE_VERSION}`,
      assumptionChanges: ['Switches nutritional functional basis from per_100g to per_100kcal (drops zero/null kcal).'],
      baseRecordsTotal: nutritionInputs.length,
      baseValidDenom: baseProteinDenom,
      scenRecordsTotal: nutritionInputs.length,
      scenValidDenom: prot100kcalDenom,
      baseUnit: 'g protein / 100g',
      scenUnit: 'g protein / 100 kcal',
      comparableAcrossUnits: false,
      crossUnitNote: 'Units differ (g/100g vs g/100kcal); only ordinal category rank shift and denominator delta are reported.',
      baseCategoryMap: baseProteinMap,
      scenCategoryMap: prot100kcalMap,
      affectedCount: Math.abs(baseProteinDenom - prot100kcalDenom),
      caveats: ['Never compute arithmetic differences across g/100g and g/100kcal.'],
    })
  );

  // -------------------------------------------------------------------------
  // C. Environmental Proxy Uncertainty (environmentEngine)
  // -------------------------------------------------------------------------
  if (agribalyseItems.length > 0) {
    const stdAgb = agribalyseItems.map(fromAgribalyseItem);
    const agbGroupAgg = aggregateEnvironmentByCategory(stdAgb, 'climate_co2eq');
    const agbMeanMap = new Map<string, number>();
    const agbMedianMap = new Map<string, number>();
    let agbDenom = 0;
    for (const c of agbGroupAgg.data) {
      if (c.mean !== null) agbMeanMap.set(c.category, c.mean);
      if (c.median !== null) agbMedianMap.set(c.category, c.median);
      agbDenom += c.validDenominator;
    }
    results.push(
      compareCategorySeries({
        baselineId: 'env_agb_group_mean',
        scenarioId: 'env_agb_median_vs_mean',
        label: 'Environment (Agribalyse CO₂): Food group median vs mean',
        dimension: 'environmental_proxy',
        assumptionId: 'ASSUMP_ENV_PROXY_AND_SECTOR',
        scenarioOrigin: 'empirical_alternative',
        reusedEngineAndVersion: `environmentEngine ${ENVIRONMENT_ENGINE_VERSION}`,
        assumptionChanges: ['Compares group median vs arithmetic mean across Agribalyse Groupe_aliment categories.'],
        baseRecordsTotal: stdAgb.length,
        baseValidDenom: agbDenom,
        scenRecordsTotal: stdAgb.length,
        scenValidDenom: agbDenom,
        baseUnit: 'kg CO₂eq / kg',
        scenUnit: 'kg CO₂eq / kg',
        comparableAcrossUnits: true,
        crossUnitNote: null,
        baseCategoryMap: agbMeanMap,
        scenCategoryMap: agbMedianMap,
        affectedCount: stdAgb.length,
        caveats: ['Retains ADEME Model Output boundary (France cradle-to-consumer LCI).'],
      })
    );
  }

  if (pooreItems.length > 0) {
    const stdPoore = pooreItems.map(fromPooreNemecekItem);
    const pooreBaseMap = new Map<string, number>();
    const pooreNoTransMap = new Map<string, number>();
    const pooreProtMap = new Map<string, number>();

    for (const p of pooreItems) {
      if (p.ghg_kg_co2eq_per_kg !== null && Number.isFinite(p.ghg_kg_co2eq_per_kg)) {
        pooreBaseMap.set(p.food_item, roundTo(p.ghg_kg_co2eq_per_kg, 2));
        if (p.stage_transport !== null && p.stage_transport !== undefined && Number.isFinite(p.stage_transport)) {
          pooreNoTransMap.set(p.food_item, roundTo(p.ghg_kg_co2eq_per_kg - p.stage_transport, 2));
        }
      }
      if (p.ghg_kg_per_100g_protein !== null && p.ghg_kg_per_100g_protein !== undefined && Number.isFinite(p.ghg_kg_per_100g_protein)) {
        pooreProtMap.set(p.food_item, roundTo(p.ghg_kg_per_100g_protein, 2));
      }
    }

    results.push(
      compareCategorySeries({
        baselineId: 'env_poore_full_ghg',
        scenarioId: 'env_poore_exclude_transport',
        label: 'Environment (Poore & Nemecek): Exclude food transport stage',
        dimension: 'environmental_proxy',
        assumptionId: 'ASSUMP_ENV_PROXY_AND_SECTOR',
        scenarioOrigin: 'empirical_alternative',
        reusedEngineAndVersion: `environmentEngine ${ENVIRONMENT_ENGINE_VERSION}`,
        assumptionChanges: ['Subtracts stage_transport from total ghg_kg_co2eq_per_kg on same commodities.'],
        baseRecordsTotal: stdPoore.length,
        baseValidDenom: pooreBaseMap.size,
        scenRecordsTotal: stdPoore.length,
        scenValidDenom: pooreNoTransMap.size,
        baseUnit: 'kg CO₂eq / kg (global LCA)',
        scenUnit: 'kg CO₂eq / kg (ex-transport global LCA)',
        comparableAcrossUnits: true,
        crossUnitNote: null,
        baseCategoryMap: pooreBaseMap,
        scenCategoryMap: pooreNoTransMap,
        affectedCount: pooreNoTransMap.size,
        caveats: ['Preserves Poore & Nemecek 2018 farm-to-retail Estimated boundary.'],
      })
    );

    results.push(
      compareCategorySeries({
        baselineId: 'env_poore_full_ghg',
        scenarioId: 'env_poore_protein_unit_rank',
        label: 'Environment (Poore & Nemecek): kg vs 100g protein GHG ranks',
        dimension: 'environmental_proxy',
        assumptionId: 'ASSUMP_ENV_PROXY_AND_SECTOR',
        scenarioOrigin: 'analyst_defined',
        reusedEngineAndVersion: `environmentEngine ${ENVIRONMENT_ENGINE_VERSION}`,
        assumptionChanges: ['Re-ranks commodities from ghg_kg_co2eq_per_kg to ghg_kg_per_100g_protein.'],
        baseRecordsTotal: stdPoore.length,
        baseValidDenom: pooreBaseMap.size,
        scenRecordsTotal: stdPoore.length,
        scenValidDenom: pooreProtMap.size,
        baseUnit: 'kg CO₂eq / kg',
        scenUnit: 'kg CO₂eq / 100g protein',
        comparableAcrossUnits: false,
        crossUnitNote: 'Incompatible functional units (per kg vs per 100g protein); only ordinal rank shifts & Spearman ρ reported.',
        baseCategoryMap: pooreBaseMap,
        scenCategoryMap: pooreProtMap,
        affectedCount: pooreBaseMap.size - pooreProtMap.size,
        caveats: ['Excludes 13 commodities missing protein equivalents rather than inventing protein content.'],
      })
    );
  }

  if (giItems.length > 0) {
    const stdGi = giItems.map(fromGITerroirItem);
    const foodEligible = filterFoodEligibleEnvironmentRecords(stdGi, false);
    const giFoodAgg = aggregateEnvironmentByCategory(stdGi, 'gi_proxy_co2_kg', {
      includeNonFoodGiSectors: false,
    });
    const giAllAgg = aggregateEnvironmentByCategory(stdGi, 'gi_proxy_co2_kg', {
      includeNonFoodGiSectors: true,
    });
    const giFoodMap = new Map<string, number>();
    const giAllMap = new Map<string, number>();
    let giFoodDenom = 0;
    let giAllDenom = 0;
    for (const c of giFoodAgg.data) {
      if (c.mean !== null) giFoodMap.set(c.category, c.mean);
      giFoodDenom += c.validDenominator;
    }
    for (const c of giAllAgg.data) {
      if (c.mean !== null) giAllMap.set(c.category, c.mean);
      giAllDenom += c.validDenominator;
    }
    results.push(
      compareCategorySeries({
        baselineId: 'env_gi_food_only',
        scenarioId: 'env_gi_unfiltered_alcohol_leak',
        label: 'Diagnostic stress test — invalid sector inclusion (GI WINE/SPIRIT/CRAFT)',
        dimension: 'environmental_proxy',
        assumptionId: 'ASSUMP_ENV_PROXY_AND_SECTOR',
        scenarioOrigin: 'analyst_defined',
        scenarioType: 'diagnostic_stress_test',
        reusedEngineAndVersion: `environmentEngine ${ENVIRONMENT_ENGINE_VERSION}`,
        assumptionChanges: ['Diagnostic stress test bypassing filterFoodEligibleEnvironmentRecords (never affects default FOOD outputs).'],
        baseRecordsTotal: stdGi.length,
        baseValidDenom: giFoodDenom,
        scenRecordsTotal: stdGi.length,
        scenValidDenom: giAllDenom,
        baseUnit: 'kg CO₂eq / kg (GI FOOD class proxy)',
        scenUnit: 'kg CO₂eq / kg (Unfiltered GI class proxy)',
        comparableAcrossUnits: true,
        crossUnitNote: null,
        baseCategoryMap: giFoodMap,
        scenCategoryMap: giAllMap,
        affectedCount: foodEligible.excludedNonFoodRecords.length,
        caveats: ['Diagnostic stress test only: NOT a valid food-sector alternative; production environmentEngine enforces FOOD-only filtering by default.'],
      })
    );
  }

  // -------------------------------------------------------------------------
  // D. Package Quantity Uncertainty (affordabilityEngine)
  // -------------------------------------------------------------------------
  const baseRetail = aggregateRetailPricesByCategory(retailPriceRecords, 'per_kg');
  const baseRetailMap = new Map<string, number>();
  let baseRetailDenom = 0;
  for (const c of baseRetail.data) {
    if (c.mean !== null) baseRetailMap.set(c.category, c.mean);
    baseRetailDenom += c.validDenominator;
  }

  const nonMicroRecords = retailPriceRecords.filter((r) => {
    const evalP = evaluateRetailUnitPrice(r, 'per_kg');
    if (!evalP.computable) return false;
    if (r.packageUnit === 'kg') return (r.packageQuantity ?? 0) >= 0.1;
    if (r.packageUnit === 'g') return (r.packageQuantity ?? 0) >= 100;
    if (r.packageUnit === 'mg') return (r.packageQuantity ?? 0) >= 100_000;
    return r.pricePerType === 'KILOGRAM';
  });
  const nonMicroAgg = aggregateRetailPricesByCategory(nonMicroRecords, 'per_kg');
  const nonMicroMap = new Map<string, number>();
  let nonMicroDenom = 0;
  for (const c of nonMicroAgg.data) {
    if (c.mean !== null) nonMicroMap.set(c.category, c.mean);
    nonMicroDenom += c.validDenominator;
  }
  results.push(
    compareCategorySeries({
      baselineId: 'pkg_baseline_eur_kg',
      scenarioId: 'pkg_exclude_micropacks_100g',
      label: 'Package Qty: Exclude < 100g micro-packs from EUR/kg (analyst threshold)',
      dimension: 'package_quantity',
      assumptionId: 'ASSUMP_AFF_PACKAGE_QUANTITY',
      scenarioOrigin: 'analyst_defined',
      reusedEngineAndVersion: `affordabilityEngine ${AFFORDABILITY_ENGINE_VERSION}`,
      assumptionChanges: ['Applies an analyst-defined <100g sample cutoff (not an observed statistical rule).'],
      baseRecordsTotal: retailPriceRecords.length,
      baseValidDenom: baseRetailDenom,
      scenRecordsTotal: retailPriceRecords.length,
      scenValidDenom: nonMicroDenom,
      baseUnit: 'EUR / kg',
      scenUnit: 'EUR / kg (>=100g)',
      comparableAcrossUnits: true,
      crossUnitNote: null,
      baseCategoryMap: baseRetailMap,
      scenCategoryMap: nonMicroMap,
      affectedCount: Math.max(0, baseRetailDenom - nonMicroDenom),
      caveats: ['Excludes 132 missing-quantity and 187 liquid SKUs in both baseline and scenario.'],
    })
  );

  const pkgAgg = aggregateRetailPricesByCategory(retailPriceRecords, 'per_package');
  const pkgMap = new Map<string, number>();
  let pkgDenom = 0;
  for (const c of pkgAgg.data) {
    if (c.mean !== null) pkgMap.set(c.category, c.mean);
    pkgDenom += c.validDenominator;
  }
  results.push(
    compareCategorySeries({
      baselineId: 'pkg_baseline_eur_kg',
      scenarioId: 'pkg_unnormalized_per_package',
      label: 'Package Qty: Unnormalized EUR/package vs EUR/kg (rank check)',
      dimension: 'package_quantity',
      assumptionId: 'ASSUMP_AFF_PACKAGE_QUANTITY',
      scenarioOrigin: 'analyst_defined',
      reusedEngineAndVersion: `affordabilityEngine ${AFFORDABILITY_ENGINE_VERSION}`,
      assumptionChanges: ['Ranks categories by shelf receipt package price (EUR/pkg) instead of weight-normalized EUR/kg.'],
      baseRecordsTotal: retailPriceRecords.length,
      baseValidDenom: baseRetailDenom,
      scenRecordsTotal: retailPriceRecords.length,
      scenValidDenom: pkgDenom,
      baseUnit: 'EUR / kg',
      scenUnit: 'EUR / package',
      comparableAcrossUnits: false,
      crossUnitNote: 'Incompatible units (EUR/kg vs EUR/package); only rank correlation and denominator gain (+319 SKUs) reported.',
      baseCategoryMap: baseRetailMap,
      scenCategoryMap: pkgMap,
      affectedCount: Math.abs(pkgDenom - baseRetailDenom),
      caveats: ['Prohibits cross-unit price subtraction or mass-vs-volume density assumption.'],
    })
  );

  const litreAgg = aggregateRetailPricesByCategory(retailPriceRecords, 'per_litre');
  const litreMap = new Map<string, number>();
  let litreDenom = 0;
  for (const c of litreAgg.data) {
    if (c.mean !== null) litreMap.set(c.category, c.mean);
    litreDenom += c.validDenominator;
  }
  results.push(
    compareCategorySeries({
      baselineId: 'pkg_baseline_eur_kg',
      scenarioId: 'pkg_liquid_per_litre_scope',
      label: 'Package Qty: Liquid SKUs strict EUR/L coverage (vs EUR/kg)',
      dimension: 'package_quantity',
      assumptionId: 'ASSUMP_AFF_PACKAGE_QUANTITY',
      scenarioOrigin: 'empirical_alternative',
      reusedEngineAndVersion: `affordabilityEngine ${AFFORDABILITY_ENGINE_VERSION}`,
      assumptionChanges: ['Isolates strictly liquid volume SKUs (EUR/L) separately from mass SKUs (EUR/kg).'],
      baseRecordsTotal: retailPriceRecords.length,
      baseValidDenom: baseRetailDenom,
      scenRecordsTotal: retailPriceRecords.length,
      scenValidDenom: litreDenom,
      baseUnit: 'EUR / kg',
      scenUnit: 'EUR / L',
      comparableAcrossUnits: false,
      crossUnitNote: 'Incompatible mass vs volume bases (EUR/kg vs EUR/L); only ordinal rank & coverage comparison shown.',
      baseCategoryMap: baseRetailMap,
      scenCategoryMap: litreMap,
      affectedCount: Math.abs(baseRetailDenom - litreDenom),
      caveats: ['Enforces strict prohibition on liquid-to-kilogram density guessing.'],
    })
  );

  // -------------------------------------------------------------------------
  // E. Geographic Coverage (OFF + Open Prices EU)
  // -------------------------------------------------------------------------
  if (nutritionCountryMap && nutritionCountryMap.size > 0) {
    const euOnlyInputs = nutritionInputs.filter((p) => {
      const c = (nutritionCountryMap.get(p.productId) ?? '').toLowerCase().trim();
      return EUROPE_OFF_COUNTRIES.has(c);
    });
    const euAgg = aggregateNutritionByCategory(euOnlyInputs, 'per_100g', ['energy_kcal']);
    const euMap = new Map<string, number>();
    let euDenom = 0;
    for (const cat of euAgg.data) {
      if (cat.metrics.energy_kcal?.mean !== null && cat.metrics.energy_kcal?.mean !== undefined) {
        euMap.set(cat.category, cat.metrics.energy_kcal.mean);
        euDenom += cat.metrics.energy_kcal.validDenominator;
      }
    }
    results.push(
      compareCategorySeries({
        baselineId: 'nut_baseline_pairwise_100g',
        scenarioId: 'geo_off_europe_only',
        label: 'Geography (OFF): Strictly European/UK SKUs (excl. US/non-EU)',
        dimension: 'geographic_coverage',
        assumptionId: 'ASSUMP_GEO_SAMPLE_COMPOSITION',
        scenarioOrigin: 'empirical_alternative',
        reusedEngineAndVersion: `nutritionEngine ${NUTRITION_ENGINE_VERSION}`,
        assumptionChanges: ['Excludes non-European products (e.g., 301 US entries) from openfoodfacts_eu.'],
        baseRecordsTotal: nutritionInputs.length,
        baseValidDenom: baseEnergyDenom,
        scenRecordsTotal: euOnlyInputs.length,
        scenValidDenom: euDenom,
        baseUnit: 'kcal / 100g',
        scenUnit: 'kcal / 100g (Europe/UK only)',
        comparableAcrossUnits: true,
        crossUnitNote: null,
        baseCategoryMap: baseEnergyMap,
        scenCategoryMap: euMap,
        affectedCount: nutritionInputs.length - euOnlyInputs.length,
        caveats: ['Isolates impact of non-EU rows inside the openfoodfacts_eu catalog snapshot.'],
      })
    );

    const frOnlyInputs = nutritionInputs.filter(
      (p) => (nutritionCountryMap.get(p.productId) ?? '').toLowerCase().trim() === 'france'
    );
    const frAgg = aggregateNutritionByCategory(frOnlyInputs, 'per_100g', ['energy_kcal']);
    const frMap = new Map<string, number>();
    let frDenom = 0;
    for (const cat of frAgg.data) {
      if (cat.metrics.energy_kcal?.mean !== null && cat.metrics.energy_kcal?.mean !== undefined) {
        frMap.set(cat.category, cat.metrics.energy_kcal.mean);
        frDenom += cat.metrics.energy_kcal.validDenominator;
      }
    }
    results.push(
      compareCategorySeries({
        baselineId: 'nut_baseline_pairwise_100g',
        scenarioId: 'geo_off_france_only',
        label: 'Geography (OFF): France-only subset vs full catalog',
        dimension: 'geographic_coverage',
        assumptionId: 'ASSUMP_GEO_SAMPLE_COMPOSITION',
        scenarioOrigin: 'empirical_alternative',
        reusedEngineAndVersion: `nutritionEngine ${NUTRITION_ENGINE_VERSION}`,
        assumptionChanges: ['Restricts OFF products strictly to primary_country = france.'],
        baseRecordsTotal: nutritionInputs.length,
        baseValidDenom: baseEnergyDenom,
        scenRecordsTotal: frOnlyInputs.length,
        scenValidDenom: frDenom,
        baseUnit: 'kcal / 100g',
        scenUnit: 'kcal / 100g (France only)',
        comparableAcrossUnits: true,
        crossUnitNote: null,
        baseCategoryMap: baseEnergyMap,
        scenCategoryMap: frMap,
        affectedCount: nutritionInputs.length - frOnlyInputs.length,
        caveats: ['Does not represent non-FR EU markets equally.'],
      })
    );
  }

  for (const geoSpec of [
    { id: 'geo_retail_france_only', code: 'FR', label: 'Geography (Open Prices): France-only EUR/kg' },
    { id: 'geo_retail_germany_only', code: 'DE', label: 'Geography (Open Prices): Germany-only EUR/kg' },
  ]) {
    const subRetail = retailPriceRecords.filter((r) => r.countryCode === geoSpec.code);
    const subAgg = aggregateRetailPricesByCategory(subRetail, 'per_kg');
    const subMap = new Map<string, number>();
    let subDenom = 0;
    for (const c of subAgg.data) {
      if (c.mean !== null) subMap.set(c.category, c.mean);
      subDenom += c.validDenominator;
    }
    results.push(
      compareCategorySeries({
        baselineId: 'pkg_baseline_eur_kg',
        scenarioId: geoSpec.id,
        label: geoSpec.label,
        dimension: 'geographic_coverage',
        assumptionId: 'ASSUMP_GEO_SAMPLE_COMPOSITION',
        scenarioOrigin: 'empirical_alternative',
        reusedEngineAndVersion: `affordabilityEngine ${AFFORDABILITY_ENGINE_VERSION}`,
        assumptionChanges: [`Restricts Open Prices EU receipt sample strictly to country_code = ${geoSpec.code}.`],
        baseRecordsTotal: retailPriceRecords.length,
        baseValidDenom: baseRetailDenom,
        scenRecordsTotal: subRetail.length,
        scenValidDenom: subDenom,
        baseUnit: 'EUR / kg',
        scenUnit: `EUR / kg (${geoSpec.code})`,
        comparableAcrossUnits: true,
        crossUnitNote: null,
        baseCategoryMap: baseRetailMap,
        scenCategoryMap: subMap,
        affectedCount: retailPriceRecords.length - subRetail.length,
        caveats: ['ES, NL, PT (n=1 each) remain excluded as non-representative.'],
      })
    );
  }

  // -------------------------------------------------------------------------
  // F. Aggregation Sensitivity (Location & Equal-Subgroup Weights)
  // -------------------------------------------------------------------------
  const offEnergyMedMap = new Map<string, number>();
  for (const cat of baseNut.data) {
    if (cat.metrics.energy_kcal?.median !== null && cat.metrics.energy_kcal?.median !== undefined) {
      offEnergyMedMap.set(cat.category, cat.metrics.energy_kcal.median);
    }
  }
  results.push(
    compareCategorySeries({
      baselineId: 'nut_baseline_pairwise_100g',
      scenarioId: 'agg_off_median_vs_mean_energy',
      label: 'Aggregation (OFF Nutrition kcal): Category Median vs Mean',
      dimension: 'aggregation',
      assumptionId: 'ASSUMP_AGG_ESTIMATOR_WEIGHTS',
      scenarioOrigin: 'empirical_alternative',
      reusedEngineAndVersion: `nutritionEngine ${NUTRITION_ENGINE_VERSION}`,
      assumptionChanges: ['Replaces arithmetic mean kcal/100g with category median on identical products.'],
      baseRecordsTotal: nutritionInputs.length,
      baseValidDenom: baseEnergyDenom,
      scenRecordsTotal: nutritionInputs.length,
      scenValidDenom: baseEnergyDenom,
      baseUnit: 'kcal / 100g (mean)',
      scenUnit: 'kcal / 100g (median)',
      comparableAcrossUnits: true,
      crossUnitNote: null,
      baseCategoryMap: baseEnergyMap,
      scenCategoryMap: offEnergyMedMap,
      affectedCount: baseEnergyDenom,
      caveats: ['Tests right/left calorie skewness without synthetic weights.'],
    })
  );

  const retailMedMap = new Map<string, number>();
  for (const c of baseRetail.data) {
    if (c.median !== null) retailMedMap.set(c.category, c.median);
  }
  results.push(
    compareCategorySeries({
      baselineId: 'pkg_baseline_eur_kg',
      scenarioId: 'agg_retail_median_vs_mean_eur_kg',
      label: 'Aggregation (Open Prices EUR/kg): Category Median vs Mean',
      dimension: 'aggregation',
      assumptionId: 'ASSUMP_AGG_ESTIMATOR_WEIGHTS',
      scenarioOrigin: 'empirical_alternative',
      reusedEngineAndVersion: `affordabilityEngine ${AFFORDABILITY_ENGINE_VERSION}`,
      assumptionChanges: ['Replaces arithmetic mean with category sample median on identical valid SKUs.'],
      baseRecordsTotal: retailPriceRecords.length,
      baseValidDenom: baseRetailDenom,
      scenRecordsTotal: retailPriceRecords.length,
      scenValidDenom: baseRetailDenom,
      baseUnit: 'EUR / kg (mean)',
      scenUnit: 'EUR / kg (median)',
      comparableAcrossUnits: true,
      crossUnitNote: null,
      baseCategoryMap: baseRetailMap,
      scenCategoryMap: retailMedMap,
      affectedCount: baseRetailDenom,
      caveats: ['Quantifies skewness distortion without inventing market-share weights.'],
    })
  );

  // COICOP Subgroup Equal Weighting vs Item-Count Weighting (reusing Agribalyse subgroups)
  if (agribalyseItems.length > 0 && baseClsMap.size > 0) {
    const stdAgb = agribalyseItems.map(fromAgribalyseItem);
    const agbSubMap = new Map<string, number[]>();
    for (const r of stdAgb) {
      const co2 = r.metrics.climate_co2eq;
      if (co2 === null || co2 === undefined) continue;
      const key = `AGB:${r.category}/${r.subCategory ?? 'other'}`;
      const arr = agbSubMap.get(key) ?? [];
      arr.push(co2);
      agbSubMap.set(key, arr);
    }
    const equalSubMap = new Map<string, number>();
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
    }
    results.push(
      compareCategorySeries({
        baselineId: 'cls_baseline_all_mapped',
        scenarioId: 'agg_coicop_equal_subgroup_weight',
        label: 'Aggregation (Integrated CO₂): Equal-Subgroup Weighting vs LCI-Record-Count Weighting',
        dimension: 'aggregation',
        assumptionId: 'ASSUMP_AGG_ESTIMATOR_WEIGHTS',
        scenarioOrigin: 'analyst_defined',
        reusedEngineAndVersion: `integratedComparator ${INTEGRATED_COMPARATOR_VERSION}`,
        assumptionChanges: [
          'Gives each matched Agribalyse subgroup equal weight (1/k) instead of weighting by Agribalyse LCI-record count.',
        ],
        baseRecordsTotal: baseClsItemsDenom,
        baseValidDenom: baseClsItemsDenom,
        scenRecordsTotal: baseClsItemsDenom,
        scenValidDenom: equalSubCount,
        baseUnit: 'kg CO₂eq / kg (LCI-record-count weighted)',
        scenUnit: 'kg CO₂eq / kg (equal-subgroup weighted)',
        comparableAcrossUnits: true,
        crossUnitNote: null,
        baseCategoryMap: baseClsMap,
        scenCategoryMap: equalSubMap,
        affectedCount: baseClsItemsDenom,
        caveats: [
          'LCI-record-count weighting reflects French Agribalyse database inventory coverage rather than consumption; market-share/consumption weighting is unavailable.',
        ],
      })
    );
  }

  return {
    data: results,
    unit: 'Dimension-specific units (never combined into a universal score)',
    provenance: {
      module: 'sensitivityEngine.runAllSensitivityScenarios',
      version: SENSITIVITY_ENGINE_VERSION,
      dataNature: 'Model Output',
      sources: Array.from(
        new Set([
          'classification_mappings.parquet',
          'openfoodfacts_eu.parquet',
          'agribalyse_31.parquet',
          'scrapling_retail_claims.parquet',
          ...(pooreItems.length > 0 ? ['global_poore_nemecek_lca.parquet'] : []),
          ...(giItems.length > 0 ? ['gi_terroir_registry.parquet'] : []),
        ])
      ),
      assumptions: [
        'Original source datasets are read-only; no imputation, probability priors, or market-share weights are fabricated.',
        'One-at-a-time scenario comparisons identify conclusion sensitivity rather than Sobol global variance or causal effects.',
      ],
    },
    missingness: {
      totalRecords: results.length,
      includedRecords: results.length,
      missingOrExcludedRecords: 0,
    },
  };
}

export function serializeSensitivityScenariosCsv(params: {
  countryCode: string;
  scenarios: readonly SensitivityScenarioResult[];
}): string {
  const esc = (v: string | number | boolean | null | undefined): string => {
    const s = v === null || v === undefined ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines: string[] = [
    `# DietShift Atlas — Empirical Sensitivity Analysis Export (Engine v${SENSITIVITY_ENGINE_VERSION})`,
    `# Active Macro HICP Context: ${params.countryCode} | Total Scenarios Exported: ${params.scenarios.length}`,
    `# Methodological Safeguards: One-at-a-time structural/data scenarios only (NOT Sobol variance); no zero-imputation; no fabricated distributions; market-share/consumption weighting is unavailable; LCI-record-count weighting reflects database inventory rather than intake; diagnostic stress tests are separated from valid alternatives.`,
    [
      'scenario_id',
      'baseline_id',
      'dimension',
      'scenario_type',
      'scenario_origin',
      'effect_mechanism',
      'is_diagnostic_only',
      'assumption_id',
      'label',
      'reused_engine',
      'baseline_total',
      'baseline_valid_denom',
      'baseline_excluded',
      'baseline_mean',
      'scenario_total',
      'scenario_valid_denom',
      'scenario_excluded',
      'scenario_mean',
      'absolute_diff',
      'relative_diff_pct',
      'unit',
      'affected_records',
      'affected_pct',
      'denominator_delta',
      'comparison_scope',
      'pairwise_sample_size',
      'tied_rank_groups',
      'excluded_categories_count',
      'small_rank_sample_warning',
      'rank_changes_count',
      'max_abs_rank_shift',
      'spearman_rho',
      'conclusion_stability',
      'assumption_changes',
      'caveats',
    ].join(','),
  ];

  for (const s of params.scenarios) {
    lines.push(
      [
        s.scenarioId,
        s.baselineId,
        s.dimension,
        s.scenarioType,
        s.scenarioOrigin,
        s.effectMechanism,
        s.isDiagnosticOnly,
        s.assumptionId,
        s.label,
        s.reusedEngineAndVersion,
        s.baselineSummary.recordTotal,
        s.baselineSummary.validDenominator,
        s.baselineSummary.excludedCount,
        s.baselineSummary.meanAcrossCategories ?? '',
        s.scenarioSummary.recordTotal,
        s.scenarioSummary.validDenominator,
        s.scenarioSummary.excludedCount,
        s.scenarioSummary.meanAcrossCategories ?? '',
        s.deltaMetrics.absoluteDiff ?? '',
        s.deltaMetrics.relativeDiffPct ?? '',
        s.scenarioSummary.unit,
        s.affectedRecords.count,
        s.affectedRecords.pctOfTotal,
        s.affectedRecords.denominatorDelta,
        s.rankingMetrics.comparisonScope,
        s.rankingMetrics.pairwiseSampleSize,
        s.rankingMetrics.tiedRankGroupsCount,
        s.rankingMetrics.excludedCategoriesCount,
        s.rankingMetrics.smallRankSampleWarning,
        s.rankingMetrics.rankChangesCount,
        s.rankingMetrics.maxAbsRankShift,
        s.rankingMetrics.spearmanRho ?? '',
        s.rankingMetrics.conclusionStability,
        s.assumptionChanges.join(' | '),
        s.caveats.join(' | '),
      ]
        .map(esc)
        .join(',')
    );
  }
  return lines.join('\n');
}
