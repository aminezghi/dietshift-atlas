import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import {
  type OpenPricesSkuInput,
  aggregateRetailPricesByCategory,
  analyzeHicpInflation,
  fromCoHDRecord,
  fromEurostatHicpSeries,
  fromEurostatPppCalibration,
  fromOpenPricesSku,
  refuseSkuPppConversion,
} from './affordabilityEngine';
import {
  type ClassificationMappingRecord,
  filterMappings,
  serializeMappingsToCsv,
  serializeMappingsToJson,
  summarizeMappings,
} from './classificationEngine';
import {
  type GITerroirInput,
  type PooreLcaInput,
  aggregateEnvironmentByCategory,
  compareEnvironmentRecords,
  fromAgribalyseItem,
  fromGITerroirItem,
  fromPooreNemecekItem,
} from './environmentEngine';
import {
  ALL_FORECAST_MODELS,
  type ObservedTimeSeriesInput,
  analyzeHorizonResiduals,
  buildForecastUncertaintySeries,
  evaluateCoverageMatrixAllModels,
  evaluateEmpiricalIntervalCoverage,
  extractOutOfSampleResiduals,
  runExpandingOriginBacktest,
  serializeForecastUncertaintyCsv,
} from './forecastingEngine';
import { buildIntegratedCategoryProfiles } from './integratedComparator';
import {
  CATEGORY_EVIDENCE_LAYER_ORDER,
  evaluateIntegratedRobustnessSuite,
  serializeIntegratedRobustnessCsv,
} from './integratedRobustness';
import {
  aggregateNutritionByCategory,
  filterProductsWithNovaAudit,
  fromOFFProduct,
  summarizeNutrientMetric,
  summarizeNutritionDataset,
} from './nutritionEngine';
import {
  runAllSensitivityScenarios,
  serializeSensitivityScenariosCsv,
} from './sensitivityEngine';
import {
  resolveDatasetNature,
  type DatasetsRegistry,
} from '../types/dataRegistry';
import {
  type AgribalyseItem,
  type EurostatCountryData,
  type LiveResearchBundle,
  type OFFProduct,
} from '../types/research';

interface CalibrationRecord {
  eurostat_food_ppp_index_eu27_100?: number | null;
  [key: string]: unknown;
}

const DATA_DIR = path.resolve(process.cwd(), 'public', 'data');

function readJson<T>(relativeFile: string): T {
  const fullPath = path.join(DATA_DIR, relativeFile);
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as T;
}

function parseCsvWithComments(csv: string): Record<string, string>[] {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    comments: '#',
    skipEmptyLines: true,
  });
  expect(parsed.errors).toEqual([]);
  return parsed.data;
}

describe('Phase 5C Source-to-Engine-to-Export Parity Gate', () => {
  const registry = readJson<DatasetsRegistry>('datasets_registry.json');
  const mappings = readJson<ClassificationMappingRecord[]>('classification_mappings.json');
  const liveBundle = readJson<LiveResearchBundle>('live_research_bundle.json');
  const offExpanded = readJson<OFFProduct[]>('off_expanded_rows.json');
  const agribalyseFull = readJson<AgribalyseItem[]>('agribalyse_full.json');
  const globalBenchmarks = readJson<{
    poore_nemecek_lca: PooreLcaInput[];
    cohd_latest_by_country: Array<{
      iso3: string;
      country_name: string;
      geojson_name: string;
      year: number;
      cost_healthy_diet_ppp_usd: number;
      unaffordable_pct: number | null;
      unaffordable_millions: number | null;
    }>;
  }>('global_benchmarks.json');
  const giBundle = readJson<{ gi_terroir_records: GITerroirInput[] }>('gi_terroir_bundle.json');
  const scraplingSkus = readJson<OpenPricesSkuInput[]>('scrapling_retail_claims.json');
  const calibration = readJson<Record<string, CalibrationRecord>>('econometric_calibration.json');
  const forecastsRaw = readJson<
    Array<{
      series_id: string;
      country_code: string;
      country_label: string;
      indicator_name: string;
      year: number;
      actual_value: number | null;
      data_source: string;
    }>
  >('statistical_price_forecasts.json');

  it('verifies registry provenance and authoritative dataset classifications across engines', () => {
    expect(registry.total_datasets).toBe(19);
    expect(resolveDatasetNature(registry, 'agribalyse_31', 'Estimated')).toBe('Model Output');
    expect(resolveDatasetNature(registry, 'global_poore_nemecek_lca', 'Observed')).toBe('Estimated');
    expect(resolveDatasetNature(registry, 'clinical_biomarker_grounding', 'Observed')).toBe('Estimated');
    expect(resolveDatasetNature(registry, 'openfoodfacts_eu', 'Estimated')).toBe('Observed');
    expect(resolveDatasetNature(registry, 'statistical_price_forecasts', 'Observed')).toBe('Forecast');
  });

  it('Classification: verifies rule counts, mapping type separation, and CSV/JSON export parity', () => {
    expect(mappings.length).toBe(161);
    const summary = summarizeMappings(mappings);
    expect(summary.provenance.dataNature).toBe('Manually Compiled');

    const exact = filterMappings(mappings, { mappingTypes: ['exact'] });
    const hierarchical = filterMappings(mappings, { mappingTypes: ['hierarchical'] });
    const approximate = filterMappings(mappings, { mappingTypes: ['approximate'] });
    const ambiguous = filterMappings(mappings, { onlyAmbiguous: true });
    const unmatched = filterMappings(mappings, { onlyUnmatched: true });

    expect(exact.length).toBe(summary.data.byMappingType.exact);
    expect(hierarchical.length).toBe(summary.data.byMappingType.hierarchical);
    expect(approximate.length).toBe(summary.data.byMappingType.approximate);
    expect(ambiguous.length).toBe(summary.data.ambiguousCount);
    expect(unmatched.length).toBe(summary.data.unmatchedCount);
    expect(
      exact.length +
        hierarchical.length +
        approximate.length +
        summary.data.byMappingType.ambiguous +
        summary.data.byMappingType.unmatched
    ).toBe(mappings.length);
    for (const u of unmatched) {
      expect(u.target_code).toBeNull();
      expect(u.confidence_tier).toBe('unmatched');
    }

    const csvRows = parseCsvWithComments(serializeMappingsToCsv(mappings));
    expect(csvRows.length).toBe(mappings.length);
    const jsonParsed = JSON.parse(serializeMappingsToJson(mappings)) as {
      summary: { totalRules: number; byMappingType: Record<string, number> };
      records: ClassificationMappingRecord[];
    };
    expect(jsonParsed.summary.totalRules).toBe(summary.data.totalRules);
    expect(jsonParsed.records.length).toBe(mappings.length);
    expect(csvRows[0].mapping_id).toBe(jsonParsed.records[0].mapping_id);
  });

  it('Nutrition: verifies per-100g vs per-100kcal denominators, per_serving unavailability, and NOVA NULL audit', () => {
    expect(liveBundle.openfoodfacts.length).toBe(3197);
    expect(offExpanded.length).toBe(3197);

    const nutritionInputs = offExpanded.map(fromOFFProduct);
    const cov100g = summarizeNutritionDataset(nutritionInputs, 'per_100g');
    const cov100kcal = summarizeNutritionDataset(nutritionInputs, 'per_100kcal');
    const covServing = summarizeNutritionDataset(nutritionInputs, 'per_serving');

    expect(cov100g.data.totalRecords).toBe(3197);
    expect(cov100g.data.computableForBasisRecords).toBe(3197);
    expect(cov100kcal.data.computableForBasisRecords).toBe(3097);
    expect(cov100kcal.data.exclusionReasons.non_positive_energy + (cov100kcal.data.exclusionReasons.missing_energy ?? 0)).toBe(100);
    expect(covServing.data.computableForBasisRecords).toBe(0);
    expect(covServing.data.exclusionReasons.missing_serving_quantity).toBe(3197);

    // Distinct missingness vs genuine zero values for fiber and sugars
    const protein100g = summarizeNutrientMetric(nutritionInputs, 'proteins_g', 'per_100g');
    const protein100kcal = summarizeNutrientMetric(nutritionInputs, 'proteins_g', 'per_100kcal');
    const fiber100g = summarizeNutrientMetric(nutritionInputs, 'fiber_g', 'per_100g');
    expect(fiber100g.data.validDenominator).toBeLessThan(protein100g.data.validDenominator);
    expect(protein100kcal.data.validDenominator).toBeLessThanOrEqual(3097);

    const cat100g = aggregateNutritionByCategory(nutritionInputs, 'per_100g', ['proteins_g', 'fiber_g']);
    expect(cat100g.data.length).toBeGreaterThanOrEqual(8);

    // Phase 5A NOVA NULL audit parity
    const novaIncludeAudit = filterProductsWithNovaAudit(liveBundle.openfoodfacts, {
      selectedCategory: 'ALL',
      selectedNova: [1, 2, 3, 4],
      includeMissingNova: true,
      searchQuery: '',
    });
    const novaExcludeAudit = filterProductsWithNovaAudit(liveBundle.openfoodfacts, {
      selectedCategory: 'ALL',
      selectedNova: [1, 2, 3, 4],
      includeMissingNova: false,
      searchQuery: '',
    });
    expect(novaIncludeAudit.filtered.length).toBe(3197);
    expect(novaIncludeAudit.excludedMissingNovaCount).toBe(0);
    expect(
      novaExcludeAudit.filtered.length + novaExcludeAudit.excludedMissingNovaCount
    ).toBe(3197);
    expect(novaExcludeAudit.excludedMissingNovaCount).toBeGreaterThan(0);
  });

  it('Environment: verifies Agribalyse Model Output, Poore Estimated, FOOD-only GI filtering, and unit refusal', () => {
    expect(agribalyseFull.length).toBe(2451);
    const agbRecords = agribalyseFull.map(fromAgribalyseItem);
    const pooreRecords = globalBenchmarks.poore_nemecek_lca.map(fromPooreNemecekItem);
    const giRecords = giBundle.gi_terroir_records.map(fromGITerroirItem);

    const agbWater = aggregateEnvironmentByCategory(agbRecords, 'water_aware_m3');
    expect(agbWater.provenance.dataNature).toBe('Model Output');
    expect(agbWater.unit).toBe('m³ world eq / kg');
    expect(agbWater.data.reduce((s, r) => s + r.validDenominator, 0)).toBe(2451);

    const pooreGhg = aggregateEnvironmentByCategory(pooreRecords, 'ghg_per_kg');
    expect(pooreGhg.provenance.dataNature).toBe('Estimated');
    expect(pooreGhg.data.reduce((s, r) => s + r.validDenominator, 0)).toBe(45);

    const giFoodOnly = aggregateEnvironmentByCategory(giRecords, 'gi_proxy_co2_kg');
    expect(giFoodOnly.data.reduce((s, r) => s + r.validDenominator, 0)).toBe(3037);

    const giWithNonFood = aggregateEnvironmentByCategory(giRecords, 'gi_proxy_co2_kg', {
      includeNonFoodGiSectors: true,
    });
    expect(giWithNonFood.data.reduce((s, r) => s + r.validDenominator, 0)).toBe(6845);

    // Cross-boundary incompatible unit refusal: Agribalyse AWARE m3 vs Poore withdrawal L
    const blocked = compareEnvironmentRecords(
      agbRecords[0],
      'water_aware_m3',
      pooreRecords[0],
      'freshwater_withdrawals_l'
    );
    expect(blocked.data.compatibility.comparabilityLevel).toBe('incompatible');
    expect(blocked.data.compatibility.compatibleForDirectComparison).toBe(false);
    expect(blocked.data.numericDifference).toBeNull();
    expect(blocked.data.differenceBlockedReason).toBeTruthy();
  });

  it('Affordability: verifies EUR/kg vs EUR/L separation, HICP non-absolute analysis, and macro PPP blocking', () => {
    expect(scraplingSkus.length).toBe(1355);
    const retailRecords = scraplingSkus.map(fromOpenPricesSku);
    const perKg = aggregateRetailPricesByCategory(retailRecords, 'per_kg');
    const perLitre = aggregateRetailPricesByCategory(retailRecords, 'per_litre');

    expect(perKg.missingness.includedRecords).toBe(1036);
    expect(perLitre.missingness.includedRecords).toBe(187);

    const itHicp = fromEurostatHicpSeries(
      'IT',
      'CP01',
      liveBundle.eurostat.IT.categories.CP01.label,
      liveBundle.eurostat.IT.categories.CP01.series,
      false
    );
    expect(itHicp.isAbsolutePrice).toBe(false);
    const hicpCheck = analyzeHicpInflation(itHicp, 2015, 2025);
    expect(hicpCheck.data.cumulativeChangePct).not.toBeNull();

    const calIt = calibration.IT;
    const pppIt = fromEurostatPppCalibration('IT', calIt.eurostat_food_ppp_index_eu27_100 ?? 100, 2024);
    const refusal = refuseSkuPppConversion(retailRecords[0], pppIt);
    expect(refusal.allowed).toBe(false);
    expect(refusal.reason).toContain('PLI=');
  });

  it('Forecasting: verifies expanding-origin CV, causal intervals, horizon separation, and CSV export parity', () => {
    const grouped = new Map<string, typeof forecastsRaw>();
    for (const row of forecastsRaw) {
      if (row.actual_value === null) continue;
      const arr = grouped.get(row.series_id) ?? [];
      arr.push(row);
      grouped.set(row.series_id, arr);
    }

    const reports = Array.from(grouped.values()).map((rows) => {
      const sorted = [...rows].sort((a, b) => a.year - b.year);
      return runExpandingOriginBacktest(
        {
          seriesId: sorted[0].series_id,
          countryCode: sorted[0].country_code,
          countryLabel: sorted[0].country_label,
          indicatorName: sorted[0].indicator_name,
          years: sorted.map((r) => r.year),
          values: sorted.map((r) => r.actual_value as number),
          dataSource: sorted[0].data_source,
        },
        { minTrainLength: 5, maxHorizon: 3 }
      ).data;
    });
    expect(reports.length).toBe(35);

    const itRep = reports.find((r) => r.countryCode === 'IT' && r.indicatorName.includes('Healthy Whole-Food'))!;
    expect(itRep.folds.length).toBe(15);

    const covMatrix = evaluateCoverageMatrixAllModels(reports);
    for (const mId of ALL_FORECAST_MODELS) {
      expect(covMatrix[mId].empirical_suite_pct_p10_p90.byJurisdiction).toHaveLength(7);
      expect(covMatrix[mId].empirical_single_minmax.evaluableFolds).toBe(210);
      expect(covMatrix[mId].empirical_suite_pct_p10_p90.evaluableFolds).toBe(315);
    }

    const singleRes = extractOutOfSampleResiduals([itRep], 'naive_drift');
    const singleSumm = analyzeHorizonResiduals(singleRes, 'naive_drift', { normalizationMode: 'none_single_series' });
    const suiteRes = extractOutOfSampleResiduals(reports, 'naive_drift');
    const suiteSumm = analyzeHorizonResiduals(suiteRes, 'naive_drift', { normalizationMode: 'suite_pct_error' });

    const itRows = forecastsRaw
      .filter((r) => r.series_id === itRep.seriesId && r.actual_value !== null)
      .sort((a, b) => a.year - b.year);
    const input: ObservedTimeSeriesInput = {
      seriesId: itRep.seriesId,
      countryCode: itRep.countryCode,
      countryLabel: itRep.countryLabel,
      indicatorName: itRep.indicatorName,
      years: itRows.map((r) => r.year),
      values: itRows.map((r) => r.actual_value as number),
      dataSource: itRows[0].data_source,
    };

    const covSingle = evaluateEmpiricalIntervalCoverage([itRep], 'naive_drift', 'empirical_single_minmax');
    const seriesOut = buildForecastUncertaintySeries({
      input,
      selectedModel: 'naive_drift',
      horizonEndYear: 2030,
      uncertaintyMode: 'empirical_single_minmax',
      singleSeriesReport: itRep,
      singleHorizonSummaries: singleSumm.data.byHorizon,
      suitePctHorizonSummaries: suiteSumm.data.byHorizon,
    });

    const csv = serializeForecastUncertaintyCsv({
      seriesId: input.seriesId,
      countryLabel: input.countryLabel,
      indicatorName: input.indicatorName,
      modelId: 'naive_drift',
      uncertaintyMode: 'empirical_single_minmax',
      coverage: covSingle,
      rows: seriesOut.data,
    });
    const csvRows = parseCsvWithComments(csv);
    expect(csvRows.length).toBe(seriesOut.data.length);

    for (let i = 0; i < seriesOut.data.length; i += 1) {
      const srcRow = seriesOut.data[i];
      const csvRow = csvRows[i];
      expect(Number(csvRow.year)).toBe(srcRow.year);
      if (srcRow.year >= 2029) {
        expect(srcRow.bandSupported).toBe(false);
        expect(csvRow.band_supported).toBe('false');
      }
      if (srcRow.pointPrediction !== null && csvRow.point_prediction !== '') {
        expect(Math.abs(Number(csvRow.point_prediction) - srcRow.pointPrediction)).toBeLessThanOrEqual(0.01);
      }
    }
  });

  it('Sensitivity (4C) & Integrated Robustness (4D): verifies 20+12 scenarios, Agribalyse grains, and CSV export parity', () => {
    const nutritionInputs = offExpanded.map(fromOFFProduct);
    const nutritionCountryMap = new Map<string, string | null>(
      offExpanded.map((p) => [p.code, p.primary_country ?? null])
    );
    const retailRecords = scraplingSkus.map(fromOpenPricesSku);
    const itHicp: EurostatCountryData = liveBundle.eurostat.IT;

    // 1. Phase 4C: All 20 scenarios (19 valid + 1 diagnostic stress test)
    const suite4c = runAllSensitivityScenarios({
      mappings,
      nutritionInputs,
      nutritionCountryMap,
      agribalyseItems: agribalyseFull,
      pooreItems: globalBenchmarks.poore_nemecek_lca,
      giItems: giBundle.gi_terroir_records,
      retailPriceRecords: retailRecords,
      hicpCountryCode: 'IT',
      hicpData: itHicp,
      isHicpEuFallback: false,
    });

    expect(suite4c.data).toHaveLength(20);
    const valid4c = suite4c.data.filter((s) => !s.isDiagnosticOnly);
    const diag4c = suite4c.data.filter((s) => s.isDiagnosticOnly);
    expect(valid4c).toHaveLength(19);
    expect(diag4c).toHaveLength(1);
    expect(diag4c[0].scenarioId).toBe('env_gi_unfiltered_alcohol_leak');

    const csv4c = serializeSensitivityScenariosCsv({
      countryCode: 'IT',
      scenarios: suite4c.data,
    });
    const parsed4c = parseCsvWithComments(csv4c);
    expect(parsed4c).toHaveLength(20);
    for (const s of suite4c.data) {
      const row = parsed4c.find((r) => r.scenario_id === s.scenarioId);
      expect(row).toBeDefined();
      expect(row!.is_diagnostic_only).toBe(String(s.isDiagnosticOnly));
      expect(Number(row!.baseline_valid_denom)).toBe(s.baselineSummary.validDenominator);
      expect(Number(row!.scenario_valid_denom)).toBe(s.scenarioSummary.validDenominator);
    }

    // 2. Phase 4D: All 12 robustness scenarios, 13x8 matrix, weighting grains, deterministic repeat
    const cohdItRaw = globalBenchmarks.cohd_latest_by_country.find((c) => c.iso3 === 'ITA')!;
    const robInput = {
      mappings,
      nutritionInputs,
      agribalyseItems: agribalyseFull,
      pooreItems: globalBenchmarks.poore_nemecek_lca,
      giItems: giBundle.gi_terroir_records,
      retailPriceRecords: retailRecords,
      hicpCountryCode: 'IT',
      hicpData: itHicp,
      isHicpEuFallback: false,
      pppBenchmark: fromEurostatPppCalibration('IT', calibration.IT.eurostat_food_ppp_index_eu27_100 ?? 100, 2024),
      cohdLatest: fromCoHDRecord(cohdItRaw),
    };
    const rob1 = evaluateIntegratedRobustnessSuite(robInput);
    const rob2 = evaluateIntegratedRobustnessSuite(robInput);

    expect(JSON.stringify(rob1.data)).toBe(JSON.stringify(rob2.data));
    expect(rob1.data.scenarios).toHaveLength(12);
    expect(rob1.data.evidenceMatrix).toHaveLength(13);
    expect(rob1.data.evidenceMatrix[0].totalLayerCount).toBe(CATEGORY_EVIDENCE_LAYER_ORDER.length);

    const agbWeighting = rob1.data.scenarios.find((s) => s.scenarioId === 'rob_env_agb_lci_count_vs_equal_subgroup')!;
    expect(agbWeighting.denominators.denominatorGrainComparable).toBe(false);
    expect(agbWeighting.denominators.denominatorDelta).toBeNull();
    expect(agbWeighting.denominators.environmentalWeightingGrain?.totalAgribalyseLciCatalogCount).toBe(2451);
    expect(agbWeighting.denominators.environmentalWeightingGrain?.validLciRecordCount).toBe(2161);
    expect(agbWeighting.denominators.environmentalWeightingGrain?.categoryLciRecordPairCount).toBe(3114);
    expect(agbWeighting.denominators.environmentalWeightingGrain?.uniqueLciSubgroupCount).toBe(55);
    expect(agbWeighting.denominators.environmentalWeightingGrain?.categorySubgroupPairCount).toBe(83);
    expect(agbWeighting.denominators.environmentalWeightingGrain?.eligibleCategoryCount).toBe(11);

    const integrated = buildIntegratedCategoryProfiles(robInput);
    expect(integrated.data.profiles).toHaveLength(13);
    expect(rob1.data.macroContext.categoryRankingEligibility).toBe('prohibited_macro_context_only');

    // CSV export parity for Phase 4D scenarios block
    const csv4d = serializeIntegratedRobustnessCsv({ countryCode: 'IT', workspace: rob1.data });
    const scenarioSectionCsv = csv4d.split('# EVIDENCE_MATRIX_CATEGORY')[0];
    const parsed4d = parseCsvWithComments(scenarioSectionCsv);
    expect(parsed4d).toHaveLength(12);
    for (const s of rob1.data.scenarios) {
      const row = parsed4d.find((r) => r.scenario_id === s.scenarioId);
      expect(row).toBeDefined();
      const rho = s.rankingStability?.spearmanRho ?? null;
      if (rho !== null) {
        expect(Math.abs(Number(row!.spearman_rho) - rho)).toBeLessThanOrEqual(1e-4);
      }
    }
  });
});
