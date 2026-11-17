import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  fromOpenPricesSku,
  type OpenPricesSkuInput,
} from './affordabilityEngine';
import type { ClassificationMappingRecord } from './classificationEngine';
import {
  type GITerroirInput,
  type PooreLcaInput,
  aggregateEnvironmentByCategory,
  filterFoodEligibleEnvironmentRecords,
  fromGITerroirItem,
} from './environmentEngine';
import { fromOFFProduct } from './nutritionEngine';
import {
  SENSITIVITY_ENGINE_VERSION,
  SMALL_RANK_CORRELATION_THRESHOLD,
  UNCERTAINTY_ASSUMPTION_REGISTRY,
  UNSUPPORTED_SENSITIVITY_EXPERIMENTS,
  computeSpearmanRankCorrelation,
  runAllSensitivityScenarios,
  serializeSensitivityScenariosCsv,
  validateSensitivityScenarioRequest,
} from './sensitivityEngine';
import type { AgribalyseItem, EurostatCountryData, OFFProduct } from '../types/research';
import { FIXTURE_GI_ITEMS } from '../test/fixtures/atlasFixtures';

describe('sensitivityEngine (Phase 4C)', () => {
  it('verifies uncertainty registry completeness, scenario validation, and unsupported-experiment blocks', () => {
    expect(UNCERTAINTY_ASSUMPTION_REGISTRY).toHaveLength(6);
    const dims = new Set(UNCERTAINTY_ASSUMPTION_REGISTRY.map((a) => a.dimension));
    expect(Array.from(dims).sort()).toEqual([
      'aggregation',
      'classification',
      'environmental_proxy',
      'geographic_coverage',
      'nutrition_missingness',
      'package_quantity',
    ]);

    for (const u of UNSUPPORTED_SENSITIVITY_EXPERIMENTS) {
      const check = validateSensitivityScenarioRequest(u.experimentId);
      expect(check.valid).toBe(false);
      if (!check.valid) {
        expect(check.reason).toContain('Blocked');
      }
    }
    expect(validateSensitivityScenarioRequest('nonexistent_fabricated_scenario').valid).toBe(false);
    expect(validateSensitivityScenarioRequest('cls_exclude_ambiguous').valid).toBe(true);
    expect(validateSensitivityScenarioRequest('nut_full8_complete_case').valid).toBe(true);
  });

  it('computes exact Spearman rank correlation on tied, monotonic, reversed, and short inputs', () => {
    const identical = computeSpearmanRankCorrelation([
      { key: 'a', valA: 10, valB: 100 },
      { key: 'b', valA: 20, valB: 200 },
      { key: 'c', valA: 30, valB: 300 },
      { key: 'd', valA: 40, valB: 400 },
    ]);
    expect(identical.rho).toBe(1);

    const reversed = computeSpearmanRankCorrelation([
      { key: 'a', valA: 10, valB: 40 },
      { key: 'b', valA: 20, valB: 30 },
      { key: 'c', valA: 30, valB: 20 },
      { key: 'd', valA: 40, valB: 10 },
    ]);
    expect(reversed.rho).toBe(-1);

    const shortPairs = computeSpearmanRankCorrelation([
      { key: 'a', valA: 1, valB: 2 },
      { key: 'b', valA: 2, valB: 1 },
    ]);
    expect(shortPairs.rho).toBeNull();
    expect(shortPairs.pairwiseSampleSize).toBe(2);

    const tiedPairs = computeSpearmanRankCorrelation([
      { key: 'a', valA: 10, valB: 5 },
      { key: 'b', valA: 10, valB: 5 },
      { key: 'c', valA: 20, valB: 15 },
      { key: 'd', valA: 30, valB: 25 },
    ]);
    expect(tiedPairs.pairwiseSampleSize).toBe(4);
    expect(tiedPairs.tiedRankGroupsBaseline).toBe(1);
    expect(tiedPairs.tiedRankGroupsScenario).toBe(1);
    expect(tiedPairs.tiedRankGroupsCount).toBe(2);
    expect(tiedPairs.rho).toBe(1);
  });

  it('executes all 6 empirical sensitivity dimensions cleanly without mutating sources or fabricating cross-unit diffs', () => {
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
    ) as { poore_nemecek_lca: PooreLcaInput[] };
    const giPath = path.join(baseDir, 'gi_terroir_bundle.json');
    const hasGiBundle = fs.existsSync(giPath);
    const giBundle = hasGiBundle
      ? (JSON.parse(fs.readFileSync(giPath, 'utf-8')) as { gi_terroir_records: GITerroirInput[] })
      : { gi_terroir_records: FIXTURE_GI_ITEMS };
    const scraplingRaw = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'scrapling_retail_claims.json'), 'utf-8')
    ) as OpenPricesSkuInput[];
    const liveBundle = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'live_research_bundle.json'), 'utf-8')
    ) as { eurostat: Record<string, EurostatCountryData> };

    const nutritionInputs = offRaw.map(fromOFFProduct);
    const nutritionCountryMap = new Map<string, string | null>(
      offRaw.map((p) => [p.code, p.primary_country ?? null])
    );
    const retailPriceRecords = scraplingRaw.map(fromOpenPricesSku);

    const mappingsLenBefore = mappings.length;
    const offLenBefore = offRaw.length;
    const giLenBefore = giBundle.gi_terroir_records.length;

    const run1 = runAllSensitivityScenarios({
      mappings,
      nutritionInputs,
      nutritionCountryMap,
      agribalyseItems: agribalyse,
      pooreItems: globalBench.poore_nemecek_lca,
      giItems: giBundle.gi_terroir_records,
      retailPriceRecords,
      hicpCountryCode: 'EU27_2020',
      hicpData: liveBundle.eurostat.EU27_2020 ?? null,
      isHicpEuFallback: false,
    });

    // Deterministic reproducibility check & zero source mutation
    const run2 = runAllSensitivityScenarios({
      mappings,
      nutritionInputs,
      nutritionCountryMap,
      agribalyseItems: agribalyse,
      pooreItems: globalBench.poore_nemecek_lca,
      giItems: giBundle.gi_terroir_records,
      retailPriceRecords,
      hicpCountryCode: 'EU27_2020',
      hicpData: liveBundle.eurostat.EU27_2020 ?? null,
      isHicpEuFallback: false,
    });

    expect(run1.data).toEqual(run2.data);
    expect(mappings).toHaveLength(mappingsLenBefore);
    expect(offRaw).toHaveLength(offLenBefore);
    expect(giBundle.gi_terroir_records).toHaveLength(giLenBefore);
    expect(run1.provenance.version).toBe(SENSITIVITY_ENGINE_VERSION);

    const byId = new Map(run1.data.map((s) => [s.scenarioId, s]));

    // Every alternative treatment registered in UNCERTAINTY_ASSUMPTION_REGISTRY must execute cleanly
    for (const spec of UNCERTAINTY_ASSUMPTION_REGISTRY) {
      for (const alt of spec.alternativeTreatments) {
        expect(byId.has(alt.scenarioId)).toBe(true);
      }
    }

    // A. Classification: excluding ambiguous shrinks rules; strict exact leaves < 3 COICOP categories
    const clsAmb = byId.get('cls_exclude_ambiguous')!;
    expect(clsAmb.affectedRecords.count).toBe(34);
    expect(clsAmb.scenarioSummary.validDenominator).toBeLessThanOrEqual(
      clsAmb.baselineSummary.validDenominator
    );
    const clsExact = byId.get('cls_strict_exact_only')!;
    expect(clsExact.rankingMetrics.conclusionStability).toBe('insufficient_overlap');

    // B. Nutrition missingness: complete-case including fiber reduces denominator cleanly & cross-basis forbids value diff
    const nutFull8 = byId.get('nut_full8_complete_case')!;
    expect(nutFull8.scenarioSummary.validDenominator).toBeLessThan(nutFull8.baselineSummary.validDenominator);
    const nut100kcal = byId.get('nut_basis_per_100kcal')!;
    expect(nut100kcal.deltaMetrics.comparableAcrossUnits).toBe(false);
    expect(nut100kcal.deltaMetrics.absoluteDiff).toBeNull();
    expect(nut100kcal.rankingMetrics.spearmanRho).not.toBeNull();

    // C. Environmental proxy: Poore protein blocks cross-unit math; GI unfiltered surfaces 3,808 non-food records
    const pooreProt = byId.get('env_poore_protein_unit_rank')!;
    expect(pooreProt.deltaMetrics.comparableAcrossUnits).toBe(false);
    expect(pooreProt.deltaMetrics.absoluteDiff).toBeNull();
    expect(pooreProt.rankingMetrics.spearmanRho).not.toBeNull();

    const giLeak = byId.get('env_gi_unfiltered_alcohol_leak')!;
    if (hasGiBundle) {
      expect(giLeak.baselineSummary.validDenominator).toBe(3037);
      expect(giLeak.scenarioSummary.validDenominator).toBe(6845);
      expect(giLeak.affectedRecords.count).toBe(3808);
    } else {
      expect(giLeak.scenarioId).toBe('env_gi_unfiltered_alcohol_leak');
      expect(giLeak.scenarioType).toBe('diagnostic_stress_test');
    }

    // D. Package quantity: EUR/package vs EUR/kg forbids arithmetic diff, shows +319 SKUs
    const pkgUnnorm = byId.get('pkg_unnormalized_per_package')!;
    expect(pkgUnnorm.deltaMetrics.comparableAcrossUnits).toBe(false);
    expect(pkgUnnorm.deltaMetrics.absoluteDiff).toBeNull();
    expect(pkgUnnorm.affectedRecords.denominatorDelta).toBe(319);

    // E. Geography: OFF Europe-only removes non-EU (301 US + other non-EU) rows cleanly
    const geoEu = byId.get('geo_off_europe_only')!;
    expect(geoEu.scenarioSummary.validDenominator).toBeGreaterThan(2000);
    expect(geoEu.scenarioSummary.recordTotal).toBeLessThan(geoEu.baselineSummary.recordTotal);
    expect(geoEu.affectedRecords.count).toBeGreaterThanOrEqual(301);
    expect(geoEu.affectedRecords.count).toBeLessThan(1000);

    const geoFr = byId.get('geo_off_france_only')!;
    expect(geoFr.scenarioSummary.recordTotal).toBe(1394);
    expect(geoFr.scenarioSummary.validDenominator).toBeGreaterThan(1000);

    // F. Aggregation: Equal-subgroup weighting preserves categories without inventing market shares
    const aggSub = byId.get('agg_coicop_equal_subgroup_weight')!;
    expect(aggSub.deltaMetrics.comparableAcrossUnits).toBe(true);
    expect(aggSub.deltaMetrics.absoluteDiff).not.toBeNull();
    expect(aggSub.scenarioType).toBe('methodological_sensitivity');
    expect(aggSub.label).toContain('LCI-Record-Count Weighting');

    // Scenario classification, mechanism, small-sample rank flags, and GI diagnostic isolation
    const pkgMicro = byId.get('pkg_exclude_micropacks_100g')!;
    expect(pkgMicro.scenarioOrigin).toBe('analyst_defined');
    expect(pkgMicro.scenarioType).toBe('data_subset_sensitivity');
    expect(pkgMicro.effectMechanism).toBe('sample_population_change');

    expect(geoEu.scenarioType).toBe('data_subset_sensitivity');
    expect(geoEu.effectMechanism).toBe('sample_population_change');

    const geoDe = byId.get('geo_retail_germany_only')!;
    expect(geoDe.rankingMetrics.pairwiseSampleSize).toBe(5);
    expect(geoDe.rankingMetrics.smallRankSampleWarning).toBe(true);
    expect(geoDe.rankingMetrics.excludedCategoriesCount).toBeGreaterThanOrEqual(1);

    const pooreTrans = byId.get('env_poore_exclude_transport')!;
    expect(pooreTrans.rankingMetrics.pairwiseSampleSize).toBe(45);
    expect(pooreTrans.rankingMetrics.smallRankSampleWarning).toBe(false);
    expect(pooreTrans.scenarioType).toBe('boundary_or_functional_unit_sensitivity');

    expect(giLeak.scenarioType).toBe('diagnostic_stress_test');
    expect(giLeak.isDiagnosticOnly).toBe(true);
    expect(giLeak.label).toContain('Diagnostic stress test — invalid sector inclusion');

    // Verify default environmentEngine GI aggregation remains strictly FOOD-only (isolated from diagnostic test)
    const defaultGiFoodOnly = aggregateEnvironmentByCategory(
      giBundle.gi_terroir_records.map(fromGITerroirItem),
      'gi_proxy_co2_kg'
    );
    const defaultFoodDenom = defaultGiFoodOnly.data.reduce((s, r) => s + r.validDenominator, 0);
    if (hasGiBundle) {
      expect(defaultFoodDenom).toBe(3037);
    } else {
      expect(defaultFoodDenom).toBeGreaterThan(0);
    }

    // Export CSV serialization includes full metadata columns and safeguards
    const csv = serializeSensitivityScenariosCsv({
      countryCode: 'EU27_2020',
      scenarios: run1.data,
    });
    expect(csv).toContain('NOT Sobol variance');
    expect(csv).toContain('market-share/consumption weighting is unavailable');
    expect(csv).toContain('scenario_type,scenario_origin,effect_mechanism,is_diagnostic_only');
    expect(csv).toContain('pairwise_sample_size,tied_rank_groups,excluded_categories_count');
    expect(csv).toContain('cls_exclude_ambiguous');
    expect(csv).toContain('env_gi_unfiltered_alcohol_leak');
  });

  it('enforces suite-level structural, origin, rank-metadata, denominator, and FOOD-filter invariants across all 20 scenarios', () => {
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
    ) as { poore_nemecek_lca: PooreLcaInput[] };
    const giPath = path.join(baseDir, 'gi_terroir_bundle.json');
    const hasGiBundle = fs.existsSync(giPath);
    const giBundle = hasGiBundle
      ? (JSON.parse(fs.readFileSync(giPath, 'utf-8')) as { gi_terroir_records: GITerroirInput[] })
      : { gi_terroir_records: FIXTURE_GI_ITEMS };
    const scraplingRaw = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'scrapling_retail_claims.json'), 'utf-8')
    ) as OpenPricesSkuInput[];
    const liveBundle = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'live_research_bundle.json'), 'utf-8')
    ) as { eurostat: Record<string, EurostatCountryData> };

    const suite = runAllSensitivityScenarios({
      mappings,
      nutritionInputs: offRaw.map(fromOFFProduct),
      nutritionCountryMap: new Map(offRaw.map((p) => [p.code, p.primary_country ?? null])),
      agribalyseItems: agribalyse,
      pooreItems: globalBench.poore_nemecek_lca,
      giItems: giBundle.gi_terroir_records,
      retailPriceRecords: scraplingRaw.map(fromOpenPricesSku),
      hicpCountryCode: 'EU27_2020',
      hicpData: liveBundle.eurostat.EU27_2020 ?? null,
      isHicpEuFallback: false,
    });

    // 1. All 20 registered scenarios execute
    expect(suite.data).toHaveLength(20);
    const validScenarios = suite.data.filter((s) => !s.isDiagnosticOnly);
    const diagnosticScenarios = suite.data.filter((s) => s.isDiagnosticOnly);
    expect(validScenarios).toHaveLength(19);
    expect(diagnosticScenarios).toHaveLength(1);
    expect(diagnosticScenarios[0].scenarioId).toBe('env_gi_unfiltered_alcohol_leak');

    const assumptionIds = new Set(UNCERTAINTY_ASSUMPTION_REGISTRY.map((a) => a.assumptionId));
    const validScenarioTypes = new Set([
      'data_subset_sensitivity',
      'missingness_sensitivity',
      'methodological_sensitivity',
      'boundary_or_functional_unit_sensitivity',
      'diagnostic_stress_test',
    ]);
    const validMechanisms = new Set([
      'analytical_method_change',
      'sample_population_change',
      'functional_unit_or_boundary_change',
      'inclusion_exclusion_rule',
    ]);

    for (const s of suite.data) {
      // 2. Coherent scenarioType, scenarioOrigin, effectMechanism, assumptionId, baselineId, source/engine provenance
      expect(validScenarioTypes.has(s.scenarioType)).toBe(true);
      expect(['empirical_alternative', 'analyst_defined']).toContain(s.scenarioOrigin);
      expect(validMechanisms.has(s.effectMechanism)).toBe(true);
      expect(s.effectMechanismLabel.length).toBeGreaterThan(5);
      expect(assumptionIds.has(s.assumptionId)).toBe(true);
      expect(s.baselineId.length).toBeGreaterThan(3);
      expect(s.reusedEngineAndVersion).toMatch(/\S+\s+\d+\.\d+\.\d+/);

      // 3. Every Spearman result has pairwise sample size, comparison scope, tie metadata, and accurate small-sample flag
      const rm = s.rankingMetrics;
      expect(rm.pairwiseSampleSize).toBe(rm.comparableCategoriesCount);
      expect(rm.comparisonScope.length).toBeGreaterThan(5);
      expect(rm.tiedRankGroupsCount).toBe(rm.tiedRankGroupsBaseline + rm.tiedRankGroupsScenario);
      expect(rm.tiedRankGroupsBaseline).toBeGreaterThanOrEqual(0);
      expect(rm.tiedRankGroupsScenario).toBeGreaterThanOrEqual(0);
      expect(rm.excludedCategoriesCount).toBeGreaterThanOrEqual(0);
      expect(rm.smallRankSampleWarning).toBe(
        rm.pairwiseSampleSize < SMALL_RANK_CORRELATION_THRESHOLD
      );

      // 4. Denominator and affected-record consistency
      expect(s.baselineSummary.excludedCount).toBe(
        Math.max(0, s.baselineSummary.recordTotal - s.baselineSummary.validDenominator)
      );
      expect(s.scenarioSummary.excludedCount).toBe(
        Math.max(0, s.scenarioSummary.recordTotal - s.scenarioSummary.validDenominator)
      );
      expect(s.affectedRecords.denominatorDelta).toBe(
        s.scenarioSummary.validDenominator - s.baselineSummary.validDenominator
      );
      expect(s.affectedRecords.excludedOrReclassifiedDelta).toBe(
        s.scenarioSummary.excludedCount - s.baselineSummary.excludedCount
      );
      expect(s.affectedRecords.count).toBeGreaterThanOrEqual(0);
    }

    // 5. Explicit origin & mechanism verification for GI diagnostic & missing-nutrient complete-case scenarios
    const byId = new Map(suite.data.map((s) => [s.scenarioId, s]));
    const giDiag = byId.get('env_gi_unfiltered_alcohol_leak')!;
    expect(giDiag.scenarioOrigin).toBe('analyst_defined');
    expect(giDiag.scenarioType).toBe('diagnostic_stress_test');
    expect(giDiag.effectMechanism).toBe('inclusion_exclusion_rule');
    expect(giDiag.isDiagnosticOnly).toBe(true);

    for (const nutId of ['nut_core5_complete_case', 'nut_full8_complete_case'] as const) {
      const nutScen = byId.get(nutId)!;
      expect(nutScen.scenarioOrigin).toBe('empirical_alternative');
      expect(nutScen.scenarioType).toBe('missingness_sensitivity');
      expect(nutScen.effectMechanism).toBe('sample_population_change');
    }

    // 6. Default environmental FOOD eligibility filter remains unchanged (3,037 FOOD included; 3,808 non-food excluded)
    const giStd = giBundle.gi_terroir_records.map(fromGITerroirItem);
    const defaultFilter = filterFoodEligibleEnvironmentRecords(giStd);
    if (hasGiBundle) {
      expect(defaultFilter.eligibleRecords).toHaveLength(3037);
      expect(defaultFilter.excludedNonFoodRecords).toHaveLength(3808);
      expect(
        aggregateEnvironmentByCategory(giStd, 'gi_proxy_co2_kg').data.reduce(
          (sum, c) => sum + c.validDenominator,
          0
        )
      ).toBe(3037);
    } else {
      expect(defaultFilter.eligibleRecords.length).toBeGreaterThan(0);
    }
  });
});
