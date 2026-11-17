import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  type CoHDRecord,
  type PppBenchmarkRecord,
  fromEurostatPppCalibration,
  fromOpenPricesSku,
  type OpenPricesSkuInput,
} from './affordabilityEngine';
import type { ClassificationMappingRecord } from './classificationEngine';
import type { GITerroirInput, PooreLcaInput } from './environmentEngine';
import { fromOFFProduct, NUTRIENT_KEYS } from './nutritionEngine';
import {
  CATEGORY_EVIDENCE_LAYER_ORDER,
  INTEGRATED_ROBUSTNESS_REGISTRY,
  INTEGRATED_ROBUSTNESS_VERSION,
  MIN_GROUP_STABILITY_UNIVERSE,
  assertDenominatorGrainCompatibility,
  assertPermittedRobustnessDimension,
  computeTopBottomStability,
  evaluateIntegratedRobustnessSuite,
  serializeIntegratedRobustnessCsv,
} from './integratedRobustness';
import type { AgribalyseItem, EurostatCountryData, OFFProduct } from '../types/research';
import { FIXTURE_GI_ITEMS } from '../test/fixtures/atlasFixtures';

describe('integratedRobustness (Phase 4D)', () => {
  it('blocks hicp_inflation_pct and incompatible denominator grain subtraction', () => {
    expect(() => assertPermittedRobustnessDimension('hicp_inflation_pct')).toThrow(
      /prohibited for Phase 4D category-level robustness ranking/
    );
    expect(() => assertPermittedRobustnessDimension('unknown_metric')).toThrow(/prohibited/);
    expect(() => assertPermittedRobustnessDimension('agb_climate_co2eq_per_kg')).not.toThrow();
    expect(() => assertPermittedRobustnessDimension('protein_per_100g')).not.toThrow();
    expect(() =>
      assertDenominatorGrainCompatibility('category_lci_record_assignment', 'category_subgroup_pair')
    ).toThrow(/Incompatible denominator grains/);
    expect(() =>
      assertDenominatorGrainCompatibility('category_subgroup_pair', 'category_subgroup_pair')
    ).not.toThrow();
  });

  it('enforces n >= 6 minimum universe for Top-K/Bottom-K stability and handles cutoff ties cleanly', () => {
    // 5 common categories -> insufficient_group_stability_universe
    const small = computeTopBottomStability([
      { key: 'cat1', valA: 10, valB: 10 },
      { key: 'cat2', valA: 20, valB: 20 },
      { key: 'cat3', valA: 30, valB: 30 },
      { key: 'cat4', valA: 40, valB: 40 },
      { key: 'cat5', valA: 50, valB: 50 },
    ]);
    expect(small.commonUniverseSize).toBe(5);
    expect(small.status).toBe('insufficient_group_stability_universe');
    expect(small.topKJaccard).toBeNull();
    expect(small.bottomKJaccard).toBeNull();

    // 7 common categories with cutoff tie at K=3 (two categories tied at value 30 on scenario)
    const tied = computeTopBottomStability([
      { key: 'c1', valA: 70, valB: 70 },
      { key: 'c2', valA: 60, valB: 60 },
      { key: 'c3', valA: 50, valB: 30 }, // tied at cutoff 30 in scenario bottom
      { key: 'c4', valA: 40, valB: 50 },
      { key: 'c5', valA: 30, valB: 30 },
      { key: 'c6', valA: 20, valB: 20 },
      { key: 'c7', valA: 10, valB: 10 },
    ]);
    expect(tied.status).toBe('computed');
    expect(tied.kCutoff).toBe(3);
    expect(tied.topKRealizedSizes).toEqual({ baseline: 3, scenario: 3 });
    expect(tied.bottomKRealizedSizes.baseline).toBe(3);
    // In scenario, bottom-3 values are 10, 20, 30 -> c7(10), c6(20), c5(30), c3(30) => 4 items
    expect(tied.bottomKRealizedSizes.scenario).toBe(4);
    expect(tied.bottomKScenIds).toEqual(['c3', 'c5', 'c6', 'c7']);
    expect(tied.bottomKJaccard).toBe(0.75);
  });

  it('executes all 12 Phase 4D robustness scenarios, 13x8 evidence matrix, and macro isolation on real workspace datasets', () => {
    const baseDir = path.resolve(process.cwd(), 'public/data');
    const mappings = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'classification_mappings.json'), 'utf-8')
    ) as ClassificationMappingRecord[];
    const offRaw = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'off_expanded_rows.json'), 'utf-8')
    ) as OFFProduct[];
    const agribalyse = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'agribalyse_full.json'), 'utf-8')
    ) as AgribalyseItem[];
    const globalBench = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'global_benchmarks.json'), 'utf-8')
    ) as {
      poore_nemecek_lca: PooreLcaInput[];
      ppp_food_price_level?: Array<{
        country_code: string;
        reference_year: number;
        food_price_level_eu27: number;
      }>;
      cohd_affordability?: Array<{
        country_code: string;
        year: number;
        cost_healthy_diet_ppp_usd: number | null;
        unaffordable_pct: number | null;
      }>;
    };
    const giPath = path.join(baseDir, 'gi_terroir_bundle.json');
    const giBundle = fs.existsSync(giPath)
      ? (JSON.parse(fs.readFileSync(giPath, 'utf-8')) as { gi_terroir_records: GITerroirInput[] })
      : { gi_terroir_records: FIXTURE_GI_ITEMS };
    const scraplingRaw = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'scrapling_retail_claims.json'), 'utf-8')
    ) as OpenPricesSkuInput[];
    const liveBundle = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'live_research_bundle.json'), 'utf-8')
    ) as { eurostat: Record<string, EurostatCountryData> };

    const nutritionInputs = offRaw.map(fromOFFProduct);
    const retailPriceRecords = scraplingRaw.map(fromOpenPricesSku);

    const pppFr = globalBench.ppp_food_price_level?.find((r) => r.country_code === 'FR');
    const pppBenchmark: PppBenchmarkRecord | null = pppFr
      ? fromEurostatPppCalibration(pppFr.country_code, pppFr.food_price_level_eu27, pppFr.reference_year)
      : null;

    const cohdRowsFr = (globalBench.cohd_affordability ?? [])
      .filter((r) => r.country_code === 'FR')
      .sort((a, b) => b.year - a.year);
    const cohdLatest: CoHDRecord | null = cohdRowsFr[0]
      ? {
          iso3: 'FRA',
          countryName: 'France',
          year: cohdRowsFr[0].year,
          costHealthyDietPppUsd: cohdRowsFr[0].cost_healthy_diet_ppp_usd,
          unaffordablePct: cohdRowsFr[0].unaffordable_pct,
          unaffordableMillions: null,
          currencyBasis: 'ICP PPP USD / person / day',
          basketDefinition: 'Least-cost healthy diet reference basket',
          householdContext: 'National adult equivalent',
          sourceName: 'World Bank / FAO',
          dataNature: 'Observed',
        }
      : null;

    const res = evaluateIntegratedRobustnessSuite({
      mappings,
      nutritionInputs,
      agribalyseItems: agribalyse,
      pooreItems: globalBench.poore_nemecek_lca,
      giItems: giBundle.gi_terroir_records,
      retailPriceRecords,
      hicpCountryCode: 'FR',
      hicpData: liveBundle.eurostat.FR ?? null,
      isHicpEuFallback: false,
      pppBenchmark,
      cohdLatest,
    });

    expect(res.provenance.version).toBe(INTEGRATED_ROBUSTNESS_VERSION);
    expect(res.data.scenarios).toHaveLength(INTEGRATED_ROBUSTNESS_REGISTRY.length);
    const byId = new Map(res.data.scenarios.map((s) => [s.scenarioId, s]));

    // 1. Classification checks (separate CO2 vs Water AWARE, preserving n=5 small-sample warnings)
    const clsAmb = byId.get('rob_cls_exclude_ambiguous')!;
    expect(clsAmb.comparisonUniverse.commonUniverseSize).toBeLessThan(MIN_GROUP_STABILITY_UNIVERSE);
    expect(clsAmb.rankingStability).not.toBeNull();
    expect(clsAmb.rankingStability!.dimension).toBe('agb_climate_co2eq_per_kg');
    expect(clsAmb.rankingStability!.pairwiseSampleSize).toBe(5);
    expect(clsAmb.rankingStability!.smallRankSampleWarning).toBe(true);
    expect(clsAmb.rankingStability!.groupStability.status).toBe(
      'insufficient_group_stability_universe'
    );
    expect(clsAmb.rankingStability!.groupStability.topKJaccard).toBeNull();
    expect(clsAmb.dimensionRankings.map((d) => d.dimension)).toEqual([
      'agb_climate_co2eq_per_kg',
      'agb_water_aware_m3_per_kg',
    ]);
    for (const dr of clsAmb.dimensionRankings) {
      expect(dr.pairwiseSampleSize).toBe(5);
      expect(dr.smallRankSampleWarning).toBe(true);
    }

    const clsExact = byId.get('rob_cls_exact_only')!;
    expect(clsExact.comparisonUniverse.commonUniverseSize).toBe(0);
    expect(clsExact.rankingStability).toBeNull();
    expect(clsExact.dimensionRankings).toEqual([]);
    expect(clsExact.rankingBlockedReason).toContain('0 usable OFF->COICOP->Agribalyse bridges');

    // 2. Nutrition denominators, positive-energy per-100kcal, and strict per-nutrient separation
    const core5 = byId.get('rob_nut_core5_cc')!;
    expect(core5.denominators.nutrientSpecificBaselineDenominators?.proteins_g).toBe(3169);
    expect(core5.denominators.nutrientSpecificBaselineDenominators?.fiber_g).toBe(1849);
    expect(core5.denominators.scenarioValid).toBe(3130);
    expect(core5.valueSummary.comparableAcrossUnits).toBe(true);
    expect(core5.dimensionRankings.map((d) => d.dimension)).toEqual([
      'protein_per_100g',
      'fiber_per_100g',
      'sugars_per_100g',
      'energy_kcal_per_100g',
    ]);

    const full8 = byId.get('rob_nut_full8_cc')!;
    expect(full8.denominators.scenarioValid).toBe(1846);
    expect(full8.rankingStability?.groupStability.status).toBe('computed');
    expect(full8.dimensionRankings.map((d) => d.dimension)).toEqual([
      'protein_per_100g',
      'fiber_per_100g',
      'sugars_per_100g',
      'energy_kcal_per_100g',
    ]);

    const per100kcal = byId.get('rob_nut_derived_per100kcal')!;
    expect(per100kcal.denominators.positiveEnergyEligibleCount).toBe(3097);
    // Nutrient-specific intersecting denominators are distinct, not blindly 3,097 across all nutrients
    const kcalDenoms = per100kcal.denominators.nutrientSpecificScenarioDenominators!;
    expect(kcalDenoms.energy_kcal).toBe(3097);
    expect(kcalDenoms.proteins_g).toBeLessThanOrEqual(3097);
    expect(kcalDenoms.fiber_g).toBeLessThan(2000);
    for (const nk of NUTRIENT_KEYS) {
      expect(kcalDenoms[nk]).toBeTypeOf('number');
    }
    expect(per100kcal.valueSummary.comparableAcrossUnits).toBe(false);
    expect(per100kcal.valueSummary.absoluteDiff).toBeNull();
    expect(per100kcal.valueSummary.relativeDiffPct).toBeNull();
    expect(per100kcal.rankingStability?.dimension).toBe('protein_per_100kcal');
    expect(per100kcal.rankingStability?.spearmanRho).not.toBeNull();
    expect(per100kcal.dimensionRankings.map((d) => d.dimension)).toEqual([
      'protein_per_100kcal',
      'fiber_per_100kcal',
      'sugars_per_100kcal',
    ]);
    expect(res.data.perServingUnavailableDisclosure).toContain('3,197/3,197');

    // 3. Environment checks: distinct LCI/subgroup/pair/category grains & blocked incompatible delta
    expect(res.data.lciSubgroupOverlapCheck.duplicateSubgroupCodesCount).toBe(0);
    expect(res.data.lciSubgroupOverlapCheck.totalAgribalyseCatalogCount).toBe(2451);
    expect(res.data.lciSubgroupOverlapCheck.validUniqueLciRecordCount).toBe(2161);
    expect(res.data.lciSubgroupOverlapCheck.categoryLciRecordPairCount).toBe(3114);
    expect(res.data.lciSubgroupOverlapCheck.distinctSubgroupsMapped).toBe(60);
    expect(res.data.lciSubgroupOverlapCheck.activeUniqueSubgroupsCount).toBe(55);
    expect(res.data.lciSubgroupOverlapCheck.categorySubgroupPairCount).toBe(83);
    expect(res.data.lciSubgroupOverlapCheck.eligibleCategoryCount).toBe(11);

    const envEq = byId.get('rob_env_agb_lci_count_vs_equal_subgroup')!;
    expect(envEq.valueSummary.comparableAcrossUnits).toBe(true);
    expect(envEq.denominators.denominatorDelta).toBeNull();
    expect(envEq.denominators.denominatorGrainComparable).toBe(false);
    expect(envEq.denominators.denominatorDeltaBlockedReason).toContain('Incompatible analytical grains');
    expect(envEq.denominators.environmentalWeightingGrain).toMatchObject({
      totalAgribalyseLciCatalogCount: 2451,
      validLciRecordCount: 2161,
      categoryLciRecordPairCount: 3114,
      totalCoicopMappedSubgroupCount: 60,
      uniqueLciSubgroupCount: 55,
      categorySubgroupPairCount: 83,
      sharedSubgroupInstancesCount: 28,
      eligibleCategoryCount: 11,
      finalCategoryEstimateCount: 11,
    });
    expect(envEq.rankingStability?.dimension).toBe('agb_climate_co2eq_per_kg');
    expect(envEq.rankingStability?.spearmanRho).not.toBeNull();
    expect(envEq.dimensionRankings.map((d) => d.dimension)).toEqual([
      'agb_climate_co2eq_per_kg',
      'agb_water_aware_m3_per_kg',
    ]);

    const envMed = byId.get('rob_env_agb_median_vs_mean')!;
    expect(envMed.rankingStability?.pairwiseSampleSize).toBe(11);
    expect(envMed.dimensionRankings.map((d) => d.dimension)).toEqual([
      'agb_climate_co2eq_per_kg',
      'agb_water_aware_m3_per_kg',
    ]);

    // Global invariant across all 12 scenarios: every ranking correlation identifies its explicit single dimension
    for (const s of res.data.scenarios) {
      if (s.rankingStability) {
        expect(s.rankingStability.dimension).toBeTruthy();
        expect(s.rankingStability.baselineDimension).toBeTruthy();
        expect(s.rankingStability.scenarioDimension).toBeTruthy();
        expect(s.dimensionRankings.length).toBeGreaterThanOrEqual(1);
      }
      const dims = s.dimensionRankings.map((d) => d.dimension);
      expect(new Set(dims).size).toBe(dims.length);
    }

    const pooreNoTr = byId.get('rob_env_poore_excl_transport')!;
    expect(pooreNoTr.valueSummary.comparableAcrossUnits).toBe(true);
    expect(pooreNoTr.rankingStability?.spearmanRho).not.toBeNull();

    const pooreProt = byId.get('rob_env_poore_protein_unit')!;
    expect(pooreProt.valueSummary.comparableAcrossUnits).toBe(false);
    expect(pooreProt.valueSummary.absoluteDiff).toBeNull();
    expect(pooreProt.rankingStability?.spearmanRho).not.toBeNull();

    // 4. Affordability descriptive subsets (FULL / FR / DE)
    const affFr = byId.get('rob_aff_fr_subset')!;
    expect(affFr.denominators.retailBaselineSubset?.rawSkuCount).toBe(1355);
    expect(affFr.denominators.retailBaselineSubset?.validMassEurKgCount).toBe(1036);
    expect(affFr.denominators.retailBaselineSubset?.validLiquidEurLCount).toBe(187);
    expect(affFr.denominators.retailBaselineSubset?.exactOffBarcodeTotalMatches).toBe(4);
    expect(affFr.denominators.retailBaselineSubset?.exactOffBarcodeMassEurKgMatches).toBe(2);
    expect(affFr.denominators.retailBaselineSubset?.exactOffBarcodeLiquidEurLMatches).toBe(2);

    expect(affFr.denominators.retailScenarioSubset?.rawSkuCount).toBe(1178);
    expect(affFr.denominators.retailScenarioSubset?.validMassEurKgCount).toBe(904);
    expect(affFr.denominators.retailScenarioSubset?.validLiquidEurLCount).toBe(172);
    expect(affFr.denominators.retailScenarioSubset?.exactOffBarcodeTotalMatches).toBe(4);
    expect(affFr.denominators.retailScenarioSubset?.exactOffBarcodeMassEurKgMatches).toBe(2);
    expect(affFr.denominators.retailScenarioSubset?.exactOffBarcodeLiquidEurLMatches).toBe(2);
    expect(affFr.rankingStability).toBeNull();
    expect(affFr.rankingBlockedReason).toContain('descriptive_sku_evidence_only');

    const affDe = byId.get('rob_aff_de_subset')!;
    expect(affDe.denominators.retailScenarioSubset?.rawSkuCount).toBe(115);
    expect(affDe.denominators.retailScenarioSubset?.validMassEurKgCount).toBe(94);
    expect(affDe.denominators.retailScenarioSubset?.validLiquidEurLCount).toBe(6);
    expect(affDe.denominators.retailScenarioSubset?.exactOffBarcodeTotalMatches).toBe(0);
    expect(affDe.rankingStability).toBeNull();

    // 5. 13 x 8 Evidence Matrix & Macro isolation
    expect(res.data.evidenceMatrix).toHaveLength(13);
    for (const row of res.data.evidenceMatrix) {
      expect(row.totalLayerCount).toBe(8);
      for (const lid of CATEGORY_EVIDENCE_LAYER_ORDER) {
        expect(row.layers[lid]).toBeDefined();
      }
      expect(row.layers.nutrition_per_serving.evidenceNature).toBe('Missing');
      expect(row.layers.nutrition_per_serving.availabilityStatus).toBe('unsupported_blocked');
      expect(row.layers.nutrition_per_serving.validDenominator).toBe(0);
    }

    const plantMilkRow = res.data.evidenceMatrix.find(
      (r) => r.categoryLabel === 'Plant-Based Milk & Dairy Alternatives'
    )!;
    expect(plantMilkRow.layers.affordability_retail_sku_eur_kg.evidenceNature).toBe('Missing');
    expect(plantMilkRow.layers.affordability_retail_sku_eur_kg.validDenominator).toBe(0);
    expect(plantMilkRow.layers.affordability_retail_sku_eur_kg.mappingOrMatchingStatus).toContain(
      '2 exact EUR/L liquid matches excluded'
    );

    expect(res.data.macroContext.categoryRankingEligibility).toBe('prohibited_macro_context_only');
    expect(res.data.macroContext.countryCode).toBe('FR');

    // 6. CSV export contains all scenarios, matrix, grain flags, and dimension rankings breakdown
    const csv = serializeIntegratedRobustnessCsv({
      countryCode: 'FR',
      workspace: res.data,
    });
    expect(csv).toContain(`v${INTEGRATED_ROBUSTNESS_VERSION}`);
    expect(csv).toContain('# EVIDENCE_MATRIX_CATEGORY');
    expect(csv).toContain('# DIMENSION_RANKINGS_BREAKDOWN');
    expect(csv).toContain('agb_water_aware_m3_per_kg');
    expect(csv).toContain('fiber_per_100g');
    expect(csv).toContain('protein_per_100kcal');
    for (const s of res.data.scenarios) {
      expect(csv).toContain(s.scenarioId);
    }
  });
});
