import {
  type CoHDRecord,
  type HicpInflationAnalysis,
  type ObservedRetailPriceRecord,
  type PppBenchmarkRecord,
  analyzeHicpInflation,
  evaluateRetailUnitPrice,
  fromEurostatHicpSeries,
} from './affordabilityEngine';
import {
  type ClassificationMappingRecord,
  type ConfidenceTier,
  type MappingType,
} from './classificationEngine';
import {
  type CategoryEnvironmentAggregate,
  ENVIRONMENT_SOURCE_METADATA,
  aggregateEnvironmentByCategory,
  fromAgribalyseItem,
} from './environmentEngine';
import {
  type CategoryNutritionAggregate,
  type StandardizedNutritionInput,
  aggregateNutritionByCategory,
} from './nutritionEngine';
import type { AgribalyseItem, EurostatCountryData } from '../types/research';
import type { AnalyticalResult } from './types';

export const INTEGRATED_COMPARATOR_VERSION = '3.4.0-phase3d';

export type IntegratedSupportLevel =
  | 'directly_supported'
  | 'approximate_or_hierarchical'
  | 'ambiguous_split'
  | 'unsupported_unmatched';

export type ComparatorRankingDimension =
  | 'protein_per_100g'
  | 'fiber_per_100g'
  | 'sugars_per_100g'
  | 'energy_kcal_per_100g'
  | 'agb_climate_co2eq_per_kg'
  | 'agb_water_aware_m3_per_kg'
  | 'hicp_inflation_pct';

export interface IntegratedCategoryProfile {
  categoryId: string;
  categoryLabel: string;
  supportLevel: IntegratedSupportLevel;
  classificationEvidence: {
    foodex2Code: string | null;
    foodex2Label: string | null;
    foodex2MappingType: MappingType | 'none';
    foodex2ConfidenceTier: ConfidenceTier | 'none';
    coicopCode: string | null;
    coicopLabel: string | null;
    coicopMappingType: MappingType | 'none';
    coicopConfidenceTier: ConfidenceTier | 'none';
    matchedAgribalyseSubgroups: string[];
    ambiguousNotes: string[];
    rationaleSummary: string;
  };
  nutritionPer100g: {
    sourceDataset: string;
    totalProducts: number;
    meanKcal: number | null;
    kcalDenominator: number;
    meanProteinG: number | null;
    proteinDenominator: number;
    meanSugarsG: number | null;
    sugarsDenominator: number;
    meanFiberG: number | null;
    fiberDenominator: number;
    dataNature: 'Observed';
    disclosure: string;
  } | null;
  environmentPerKg: {
    sourceDataset: string;
    systemBoundary: string;
    geography: string;
    matchedItemsDenominator: number;
    meanCo2KgPerKg: number | null;
    meanWaterAwareM3PerKg: number | null;
    dataNature: 'Model Output';
    disclosure: string;
  } | null;
  macroInflationContext: {
    coicopCode: string;
    analysis: HicpInflationAnalysis;
    dataNature: 'Observed';
  } | null;
  observedBarcodePriceMatches: {
    matchedSkuCount: number;
    medianEurPerKg: number | null;
    sampleBarcodes: string[];
    exclusionNote: string;
  };
}

export interface IntegratedComparatorWorkspace {
  profiles: IntegratedCategoryProfile[];
  countryAffordabilityContext: {
    countryCode: string;
    isHicpEuFallback: boolean;
    pppBenchmark: PppBenchmarkRecord | null;
    cohdLatest: CoHDRecord | null;
    macroBoundaryWarning: string;
  };
  supportSummary: Record<IntegratedSupportLevel, number>;
}

export interface DimensionRankRow {
  rank: number;
  categoryId: string;
  categoryLabel: string;
  value: number;
  unit: string;
  denominator: number;
  dataNature: 'Observed' | 'Model Output';
  supportLevel: IntegratedSupportLevel;
  caveat: string;
}

export function attemptUnifiedFoodScore(
  _dimensions: { nutrition?: number; environment?: number; affordability?: number },
  _arbitraryWeights?: Record<string, number>
): { allowed: false; reason: string } {
  return {
    allowed: false,
    reason:
      'Constructing a single combined Health–Environment–Affordability score is disabled: nutrition (g/100g), modeled cradle-to-consumer LCA (kg CO2eq/kg), HICP inflation indices (2015=100), and observed retail SKU EUR/kg operate on incompatible units, boundaries, and population vs. product scales. Compare within one compatible dimension at a time.',
  };
}

function classifySupportLevel(
  fxType: MappingType | 'none',
  cpType: MappingType | 'none',
  hasMatchedAgb: boolean
): IntegratedSupportLevel {
  if (fxType === 'unmatched' || cpType === 'unmatched' || (fxType === 'none' && cpType === 'none')) {
    return 'unsupported_unmatched';
  }
  if (fxType === 'ambiguous' || cpType === 'ambiguous') {
    return 'ambiguous_split';
  }
  if (fxType === 'exact' && cpType === 'exact' && hasMatchedAgb) {
    return 'directly_supported';
  }
  return 'approximate_or_hierarchical';
}

function roundTo(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

export function buildIntegratedCategoryProfiles(params: {
  mappings: readonly ClassificationMappingRecord[];
  nutritionInputs: readonly StandardizedNutritionInput[];
  agribalyseItems: readonly AgribalyseItem[];
  retailPriceRecords: readonly ObservedRetailPriceRecord[];
  hicpCountryCode: string;
  hicpData: EurostatCountryData | null;
  isHicpEuFallback: boolean;
  pppBenchmark: PppBenchmarkRecord | null;
  cohdLatest: CoHDRecord | null;
}): AnalyticalResult<IntegratedComparatorWorkspace> {
  const {
    mappings,
    nutritionInputs,
    agribalyseItems,
    retailPriceRecords,
    hicpCountryCode,
    hicpData,
    isHicpEuFallback,
    pppBenchmark,
    cohdLatest,
  } = params;

  const offNutritionAgg = aggregateNutritionByCategory(nutritionInputs, 'per_100g', [
    'energy_kcal',
    'proteins_g',
    'sugars_g',
    'fiber_g',
  ]);
  const nutritionByCat = new Map<string, CategoryNutritionAggregate>();
  for (const cat of offNutritionAgg.data) {
    nutritionByCat.set(cat.category, cat);
  }

  // Group Agribalyse records by subgroup (Sous_groupe_aliment) for COICOP-mapped aggregation
  const stdAgb = agribalyseItems.map(fromAgribalyseItem);
  const agbClimateBySubgroup = new Map<string, CategoryEnvironmentAggregate>();
  const agbWaterBySubgroup = new Map<string, CategoryEnvironmentAggregate>();

  const agbBySub = new Map<string, ReturnType<typeof fromAgribalyseItem>[]>();
  for (const r of stdAgb) {
    const key = `AGB:${r.category}/${r.subCategory ?? 'other'}`;
    const arr = agbBySub.get(key) ?? [];
    arr.push({ ...r, category: key });
    agbBySub.set(key, arr);
  }
  const flattenedAgbSub = Array.from(agbBySub.values()).flat();
  for (const row of aggregateEnvironmentByCategory(flattenedAgbSub, 'climate_co2eq').data) {
    agbClimateBySubgroup.set(row.category, row);
  }
  for (const row of aggregateEnvironmentByCategory(flattenedAgbSub, 'water_aware_m3').data) {
    agbWaterBySubgroup.set(row.category, row);
  }

  // Exact barcode index into observed retail prices (never cross-mapped by marketing claim)
  const retailByBarcode = new Map<string, ObservedRetailPriceRecord[]>();
  for (const sku of retailPriceRecords) {
    const arr = retailByBarcode.get(sku.barcode) ?? [];
    arr.push(sku);
    retailByBarcode.set(sku.barcode, arr);
  }
  const offBarcodesByCat = new Map<string, Set<string>>();
  for (const n of nutritionInputs) {
    if (!n.barcode) continue;
    const set = offBarcodesByCat.get(n.category) ?? new Set<string>();
    set.add(n.barcode);
    offBarcodesByCat.set(n.category, set);
  }

  // Discover all distinct OFF category nodes + explicit unmatched COICOP gaps in classification_mappings
  const offCategories = Array.from(
    new Set([
      ...mappings.filter((m) => m.source_system === 'OpenFoodFacts').map((m) => m.source_label),
      ...nutritionInputs.map((n) => n.category),
    ])
  ).sort();

  const profiles: IntegratedCategoryProfile[] = [];
  const agbCtx = ENVIRONMENT_SOURCE_METADATA.agribalyse_31;

  for (const catLabel of offCategories) {
    const offFx = mappings.find(
      (m) => m.source_system === 'OpenFoodFacts' && m.source_label === catLabel && m.target_system === 'FoodEx2'
    );
    const offCp = mappings.find(
      (m) => m.source_system === 'OpenFoodFacts' && m.source_label === catLabel && m.target_system === 'COICOP'
    );

    const coicopCode = offCp?.target_code ?? null;
    const matchedAgbMaps = coicopCode
      ? mappings.filter(
          (m) =>
            m.source_system === 'Agribalyse' &&
            m.target_system === 'COICOP' &&
            m.target_code === coicopCode &&
            !m.is_unmatched
        )
      : [];

    const matchedSubCodes = matchedAgbMaps.map((m) => m.source_code);
    let agbItemsSum = 0;
    let weightedCo2 = 0;
    let weightedWater = 0;
    let waterDenom = 0;

    for (const sc of matchedSubCodes) {
      const cAgg = agbClimateBySubgroup.get(sc);
      if (cAgg && cAgg.mean !== null && cAgg.validDenominator > 0) {
        weightedCo2 += cAgg.mean * cAgg.validDenominator;
        agbItemsSum += cAgg.validDenominator;
      }
      const wAgg = agbWaterBySubgroup.get(sc);
      if (wAgg && wAgg.mean !== null && wAgg.validDenominator > 0) {
        weightedWater += wAgg.mean * wAgg.validDenominator;
        waterDenom += wAgg.validDenominator;
      }
    }

    const ambiguousNotes: string[] = [];
    if (offFx?.is_ambiguous && offFx.candidate_targets) {
      ambiguousNotes.push(`FoodEx2 split: ${offFx.candidate_targets}`);
    }
    if (offCp?.is_ambiguous && offCp.candidate_targets) {
      ambiguousNotes.push(`COICOP split: ${offCp.candidate_targets}`);
    }
    if (matchedAgbMaps.some((m) => m.is_ambiguous)) {
      ambiguousNotes.push('Matched COICOP division spans multiple Agribalyse processing/species regimes.');
    }

    const nutAgg = nutritionByCat.get(catLabel) ?? null;
    const hicpRaw = coicopCode && hicpData ? hicpData.categories[coicopCode] : null;
    const hicpResult = hicpRaw
      ? analyzeHicpInflation(
          fromEurostatHicpSeries(
            hicpCountryCode,
            coicopCode as string,
            hicpRaw.label,
            hicpRaw.series,
            isHicpEuFallback
          )
        ).data
      : null;

    // Exact barcode price matches
    const catBarcodes = offBarcodesByCat.get(catLabel) ?? new Set<string>();
    const matchedUnitPrices: number[] = [];
    const matchedBarcodes: string[] = [];
    for (const bc of catBarcodes) {
      const hits = retailByBarcode.get(bc) ?? [];
      for (const hit of hits) {
        matchedBarcodes.push(bc);
        const evalP = evaluateRetailUnitPrice(hit, 'per_kg');
        if (evalP.computable && evalP.value !== null) {
          matchedUnitPrices.push(evalP.value);
        }
      }
    }
    matchedUnitPrices.sort((a, b) => a - b);
    const mid = Math.floor(matchedUnitPrices.length / 2);
    const medianEurPerKg =
      matchedUnitPrices.length === 0
        ? null
        : matchedUnitPrices.length % 2 === 1
        ? matchedUnitPrices[mid]
        : roundTo((matchedUnitPrices[mid - 1] + matchedUnitPrices[mid]) / 2, 2);

    const supportLevel = classifySupportLevel(
      offFx?.mapping_type ?? 'none',
      offCp?.mapping_type ?? 'none',
      agbItemsSum > 0
    );

    profiles.push({
      categoryId: `OFF:${catLabel}`,
      categoryLabel: catLabel,
      supportLevel,
      classificationEvidence: {
        foodex2Code: offFx?.target_code ?? null,
        foodex2Label: offFx?.target_label ?? null,
        foodex2MappingType: offFx?.mapping_type ?? 'none',
        foodex2ConfidenceTier: offFx?.confidence_tier ?? 'none',
        coicopCode,
        coicopLabel: offCp?.target_label ?? null,
        coicopMappingType: offCp?.mapping_type ?? 'none',
        coicopConfidenceTier: offCp?.confidence_tier ?? 'none',
        matchedAgribalyseSubgroups: matchedSubCodes,
        ambiguousNotes,
        rationaleSummary:
          [offFx?.rationale, offCp?.rationale].filter(Boolean).join(' | ') ||
          'No verified taxonomy concordance rule found.',
      },
      nutritionPer100g: nutAgg
        ? {
            sourceDataset: 'openfoodfacts_eu.parquet',
            totalProducts: nutAgg.totalCategoryRecords,
            meanKcal: nutAgg.metrics.energy_kcal?.mean ?? null,
            kcalDenominator: nutAgg.metrics.energy_kcal?.validDenominator ?? 0,
            meanProteinG: nutAgg.metrics.proteins_g?.mean ?? null,
            proteinDenominator: nutAgg.metrics.proteins_g?.validDenominator ?? 0,
            meanSugarsG: nutAgg.metrics.sugars_g?.mean ?? null,
            sugarsDenominator: nutAgg.metrics.sugars_g?.validDenominator ?? 0,
            meanFiberG: nutAgg.metrics.fiber_g?.mean ?? null,
            fiberDenominator: nutAgg.metrics.fiber_g?.validDenominator ?? 0,
            dataNature: 'Observed',
            disclosure: nutAgg.categoryDisclosure,
          }
        : null,
      environmentPerKg:
        agbItemsSum > 0
          ? {
              sourceDataset: agbCtx.datasetFile,
              systemBoundary: agbCtx.systemBoundary,
              geography: agbCtx.geography,
              matchedItemsDenominator: agbItemsSum,
              meanCo2KgPerKg: roundTo(weightedCo2 / agbItemsSum, 2),
              meanWaterAwareM3PerKg: waterDenom > 0 ? roundTo(weightedWater / waterDenom, 2) : null,
              dataNature: 'Model Output',
              disclosure:
                'Unweighted mean over Agribalyse subgroups mapped via COICOP division (France cradle-to-consumer LCA model output, NOT barcode-level LCA or market-weighted consumption).',
            }
          : null,
      macroInflationContext: hicpResult
        ? {
            coicopCode: coicopCode as string,
            analysis: hicpResult,
            dataNature: 'Observed',
          }
        : null,
      observedBarcodePriceMatches: {
        matchedSkuCount: matchedBarcodes.length,
        medianEurPerKg,
        sampleBarcodes: Array.from(new Set(matchedBarcodes)).slice(0, 5),
        exclusionNote:
          matchedBarcodes.length === 0
            ? '0 exact barcode matches between Open Food Facts catalog and Open Prices EU receipts in this category; national HICP/CoHD are kept strictly separate rather than substituted as SKU prices.'
            : `${matchedBarcodes.length} exact barcode receipt match(es) observed in Open Prices EU; insufficient for category-wide retail price inference.`,
      },
    });
  }

  // Also explicitly surface unmatched COICOP macro divisions (e.g., CP0115 Oils & fats, CP012 Non-alcoholic beverages)
  for (const gap of mappings.filter((m) => m.source_system === 'COICOP' && m.is_unmatched)) {
    const hicpRaw = hicpData ? hicpData.categories[gap.source_code] : null;
    const hicpResult = hicpRaw
      ? analyzeHicpInflation(
          fromEurostatHicpSeries(hicpCountryCode, gap.source_code, hicpRaw.label, hicpRaw.series, isHicpEuFallback)
        ).data
      : null;

    profiles.push({
      categoryId: `COICOP:${gap.source_code}`,
      categoryLabel: `${gap.source_label} [Unmatched Taxonomy Gap]`,
      supportLevel: 'unsupported_unmatched',
      classificationEvidence: {
        foodex2Code: null,
        foodex2Label: null,
        foodex2MappingType: 'unmatched',
        foodex2ConfidenceTier: 'unmatched',
        coicopCode: gap.source_code,
        coicopLabel: gap.source_label,
        coicopMappingType: 'exact',
        coicopConfidenceTier: 'high',
        matchedAgribalyseSubgroups: [],
        ambiguousNotes: [gap.rationale],
        rationaleSummary: gap.rationale,
      },
      nutritionPer100g: null,
      environmentPerKg: null,
      macroInflationContext: hicpResult
        ? {
            coicopCode: gap.source_code,
            analysis: hicpResult,
            dataNature: 'Observed',
          }
        : null,
      observedBarcodePriceMatches: {
        matchedSkuCount: 0,
        medianEurPerKg: null,
        sampleBarcodes: [],
        exclusionNote: 'Unmatched taxonomy gap—no verified OFF category cluster exists.',
      },
    });
  }

  const supportSummary: Record<IntegratedSupportLevel, number> = {
    directly_supported: 0,
    approximate_or_hierarchical: 0,
    ambiguous_split: 0,
    unsupported_unmatched: 0,
  };
  for (const p of profiles) supportSummary[p.supportLevel] += 1;

  const matchedCount = profiles.length - supportSummary.unsupported_unmatched;

  return {
    data: {
      profiles,
      countryAffordabilityContext: {
        countryCode: hicpCountryCode,
        isHicpEuFallback,
        pppBenchmark,
        cohdLatest,
        macroBoundaryWarning:
          'National Eurostat HICP (2015=100), Food PLI (EU27=100), and World Bank CoHD (ICP PPP USD/day) describe country/population macro economics—never single product shelf prices.',
      },
      supportSummary,
    },
    unit: 'multi_dimensional_category_profiles_unmerged',
    provenance: {
      module: 'integratedComparator.buildIntegratedCategoryProfiles',
      version: INTEGRATED_COMPARATOR_VERSION,
      dataNature: 'Mixed',
      sources: [
        'classification_mappings.parquet',
        'openfoodfacts_eu.parquet',
        'agribalyse_31.parquet',
        'scrapling_retail_claims.parquet',
        'Eurostat prc_hicp_aind / prc_ppp_ind / World Bank CoHD',
      ],
      assumptions: [
        'Nutrition (Observed per 100g), Environment (Model Output FR cradle-to-consumer per kg), and Affordability (Observed EU receipts EUR/kg vs Macro HICP/PPP/CoHD) remain strictly unmerged.',
        'Taxonomy bridges follow classification_mappings rules explicitly preserving ambiguous splits and unmatched gaps.',
      ],
    },
    missingness: {
      totalRecords: profiles.length,
      includedRecords: matchedCount,
      missingOrExcludedRecords: supportSummary.unsupported_unmatched,
    },
  };
}

export function rankCategoriesWithinDimension(
  profiles: readonly IntegratedCategoryProfile[],
  dimension: ComparatorRankingDimension,
  descending: boolean = true
): AnalyticalResult<DimensionRankRow[]> {
  const candidates: Omit<DimensionRankRow, 'rank'>[] = [];
  let unit = '';
  let dataNature: 'Observed' | 'Model Output' = 'Observed';

  for (const p of profiles) {
    let val: number | null = null;
    let denom = 0;
    let caveat = '';

    if (dimension === 'protein_per_100g' && p.nutritionPer100g) {
      val = p.nutritionPer100g.meanProteinG;
      denom = p.nutritionPer100g.proteinDenominator;
      unit = 'g / 100g';
      dataNature = 'Observed';
      caveat = `Unweighted mean across n=${denom} OFF barcodes`;
    } else if (dimension === 'fiber_per_100g' && p.nutritionPer100g) {
      val = p.nutritionPer100g.meanFiberG;
      denom = p.nutritionPer100g.fiberDenominator;
      unit = 'g / 100g';
      dataNature = 'Observed';
      caveat = `Unweighted mean across n=${denom} OFF barcodes`;
    } else if (dimension === 'sugars_per_100g' && p.nutritionPer100g) {
      val = p.nutritionPer100g.meanSugarsG;
      denom = p.nutritionPer100g.sugarsDenominator;
      unit = 'g / 100g';
      dataNature = 'Observed';
      caveat = `Unweighted mean across n=${denom} OFF barcodes`;
    } else if (dimension === 'energy_kcal_per_100g' && p.nutritionPer100g) {
      val = p.nutritionPer100g.meanKcal;
      denom = p.nutritionPer100g.kcalDenominator;
      unit = 'kcal / 100g';
      dataNature = 'Observed';
      caveat = `Unweighted mean across n=${denom} OFF barcodes`;
    } else if (dimension === 'agb_climate_co2eq_per_kg' && p.environmentPerKg) {
      val = p.environmentPerKg.meanCo2KgPerKg;
      denom = p.environmentPerKg.matchedItemsDenominator;
      unit = 'kg CO2eq / kg';
      dataNature = 'Model Output';
      caveat = `Agribalyse FR LCA Model Output via COICOP (${p.classificationEvidence.coicopCode ?? 'none'})`;
    } else if (dimension === 'agb_water_aware_m3_per_kg' && p.environmentPerKg) {
      val = p.environmentPerKg.meanWaterAwareM3PerKg;
      denom = p.environmentPerKg.matchedItemsDenominator;
      unit = 'm3 world eq / kg';
      dataNature = 'Model Output';
      caveat = `Agribalyse FR AWARE Model Output via COICOP (${p.classificationEvidence.coicopCode ?? 'none'})`;
    } else if (dimension === 'hicp_inflation_pct' && p.macroInflationContext) {
      val = p.macroInflationContext.analysis.cumulativeChangePct;
      denom = 1;
      unit = '% change (2015–2025 HICP)';
      dataNature = 'Observed';
      caveat = `${p.macroInflationContext.analysis.countryCode} ${p.macroInflationContext.coicopCode} basket index`;
    }

    if (val !== null && Number.isFinite(val)) {
      candidates.push({
        categoryId: p.categoryId,
        categoryLabel: p.categoryLabel,
        value: val,
        unit,
        denominator: denom,
        dataNature,
        supportLevel: p.supportLevel,
        caveat,
      });
    }
  }

  candidates.sort((a, b) => (descending ? b.value - a.value : a.value - b.value));
  const ranked: DimensionRankRow[] = candidates.map((c, idx) => ({ rank: idx + 1, ...c }));

  return {
    data: ranked,
    unit: unit || dimension,
    provenance: {
      module: 'integratedComparator.rankCategoriesWithinDimension',
      version: INTEGRATED_COMPARATOR_VERSION,
      dataNature,
      sources: ['Integrated Category Profiles (single-dimension projection)'],
      assumptions: [
        `Ranks strictly within compatible single dimension '${dimension}' (${unit || 'N/A'}); categories missing this dimension are excluded rather than imputed.`,
      ],
    },
    missingness: {
      totalRecords: profiles.length,
      includedRecords: ranked.length,
      missingOrExcludedRecords: profiles.length - ranked.length,
    },
  };
}
