import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  type ObservedTimeSeriesInput,
  MIN_COVERAGE_EVAL_SAMPLE,
  MIN_SAMPLE_FOR_P10_P90,
  analyzeHorizonResiduals,
  applyPctResidualOffset,
  buildForecastUncertaintySeries,
  computeErrorMetrics,
  computeLinearQuantile,
  computePctResidual,
  evaluateCoverageMatrixAllModels,
  evaluateEmpiricalIntervalCoverage,
  extractOutOfSampleResiduals,
  fitHoltEts,
  fitRidgeTrend,
  generateForwardProjections,
  runExpandingOriginBacktest,
  serializeForecastUncertaintyCsv,
  summarizeForecastSuitePerformance,
} from './forecastingEngine';

const LINEAR_SERIES: ObservedTimeSeriesInput = {
  seriesId: 'SYNTH_LINEAR',
  countryCode: 'XX',
  countryLabel: 'Synthetic Linear (+2/yr)',
  indicatorName: 'Linear Test Index',
  years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
  values: [100, 102, 104, 106, 108, 110, 112, 114, 116],
  dataSource: 'Synthetic Unit Test',
};

const FLAT_PLATEAU_AFTER_STEP: ObservedTimeSeriesInput = {
  seriesId: 'SYNTH_PLATEAU',
  countryCode: 'XX',
  countryLabel: 'Synthetic Step Plateau',
  indicatorName: 'Step Plateau Index',
  years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
  values: [100, 105, 110, 110, 110, 110, 110, 110, 110],
  dataSource: 'Synthetic Unit Test',
};

describe('forecastingEngine (Phase 4A)', () => {
  it('reproduces known numerical analytical forecasts on an exact linear ramp', () => {
    const holt = fitHoltEts([100, 102, 104, 106, 108], 0.55, 0.35, 1.0);
    expect(holt.level).toBeCloseTo(108, 5);
    expect(holt.trend).toBeCloseTo(2, 5);

    const ridge = fitRidgeTrend([100, 102, 104, 106, 108], 0);
    expect(ridge.slope).toBeCloseTo(2, 6);
    expect(ridge.intercept).toBeCloseTo(100, 6);

    const bt = runExpandingOriginBacktest(LINEAR_SERIES, { minTrainLength: 5, maxHorizon: 3 });
    expect(bt.data.overallByModel.holt_ets.mae).toBe(0);
    expect(bt.data.overallByModel.naive_drift.mae).toBe(0);
    expect(bt.data.overallByModel.naive_random_walk.mae).toBeGreaterThan(0);
    expect(bt.data.overallByModel.holt_ets.mase).toBe(0);
  });

  it('guarantees strictly zero future target leakage across all expanding-origin folds', () => {
    const mutatedFuture: ObservedTimeSeriesInput = {
      ...LINEAR_SERIES,
      values: [100, 102, 104, 106, 108, 999, 1200, 1500, 2000],
    };

    const cleanBt = runExpandingOriginBacktest(LINEAR_SERIES, { minTrainLength: 5, maxHorizon: 3 });
    const mutatedBt = runExpandingOriginBacktest(mutatedFuture, { minTrainLength: 5, maxHorizon: 3 });

    const cleanFirstFolds = cleanBt.data.folds.filter((f) => f.originYear === 2019);
    const mutFirstFolds = mutatedBt.data.folds.filter((f) => f.originYear === 2019);

    expect(cleanFirstFolds).toHaveLength(3);
    expect(mutFirstFolds).toHaveLength(3);
    for (let i = 0; i < 3; i += 1) {
      expect(mutFirstFolds[i].predictions).toEqual(cleanFirstFolds[i].predictions);
      expect(mutFirstFolds[i].trainScaleDenominator).toBe(cleanFirstFolds[i].trainScaleDenominator);
    }
  });

  it('selects naive random walk when simpler baseline outperforms trend models', () => {
    const bt = runExpandingOriginBacktest(FLAT_PLATEAU_AFTER_STEP, {
      minTrainLength: 5,
      maxHorizon: 2,
    });
    expect(bt.data.overallByModel.naive_random_walk.mae).toBe(0);
    expect(bt.data.bestModelByCvMae).toBe('naive_random_walk');
    expect(bt.data.complexModelBeatsNaiveRw).toBe(false);
  });

  it('handles insufficient historical observations safely with explicit short-series disclosure', () => {
    const shortSeries: ObservedTimeSeriesInput = {
      ...LINEAR_SERIES,
      years: [2020, 2021, 2022, 2023],
      values: [100, 105, 110, 115],
    };
    const bt = runExpandingOriginBacktest(shortSeries, { minTrainLength: 5, maxHorizon: 3 });
    expect(bt.data.folds).toHaveLength(0);
    expect(bt.data.bestModelByCvMae).toBeNull();
    expect(bt.data.shortSeriesLimitations.join(' ')).toContain('Insufficient history');

    const emptyErr = computeErrorMetrics([]);
    expect(emptyErr.mae).toBeNull();
    expect(emptyErr.mase).toBeNull();
  });

  it('runs expanding-origin validation across all 35 live HICP/CPIH series and reports honest baseline comparisons', () => {
    interface StoredForecastRow {
      series_id: string;
      country_code: string;
      country_label: string;
      indicator_name: string;
      year: number;
      actual_value: number | null;
      damped_ets_p50: number;
      data_source: string;
    }

    const rows = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/statistical_price_forecasts.json'), 'utf-8')
    ) as StoredForecastRow[];

    const grouped = new Map<string, StoredForecastRow[]>();
    for (const r of rows) {
      const k = `${r.country_code}|${r.indicator_name}`;
      const arr = grouped.get(k) ?? [];
      arr.push(r);
      grouped.set(k, arr);
    }
    expect(grouped.size).toBe(35);

    const reports = [];
    for (const [, grp] of grouped) {
      const obs = grp.filter((r) => r.actual_value !== null).sort((a, b) => a.year - b.year);
      const input: ObservedTimeSeriesInput = {
        seriesId: obs[0].series_id,
        countryCode: obs[0].country_code,
        countryLabel: obs[0].country_label,
        indicatorName: obs[0].indicator_name,
        years: obs.map((r) => r.year),
        values: obs.map((r) => r.actual_value as number),
        dataSource: obs[0].data_source,
      };
      const bt = runExpandingOriginBacktest(input, { minTrainLength: 5, maxHorizon: 3 });
      expect(bt.data.folds).toHaveLength(15); // 6 (h=1) + 5 (h=2) + 4 (h=3)
      reports.push(bt.data);

      // Verify TS forward projection matches stored 2026..2030 damped_ets_p50 cleanly
      const fwd = generateForwardProjections(input, 5);
      expect(fwd).toHaveLength(5);
      const stored2030 = grp.find((r) => r.year === 2030)?.damped_ets_p50;
      expect(fwd[4].predictions.damped_ets).toBeCloseTo(stored2030 as number, 2);
    }

    const suite = summarizeForecastSuitePerformance(reports, 3);
    expect(suite.data.seriesCount).toBe(35);
    expect(suite.data.totalFoldsEvaluated).toBe(525);
    expect(suite.data.meanMetricsByHorizon[1].naive_random_walk.mae).toBeGreaterThan(0);
    expect(suite.data.meanMetricsByHorizon[3].damped_ets.mase).toBeGreaterThan(0);
  });
});

describe('forecastingEngine Uncertainty & Horizon Controls (Phase 4B)', () => {
  it('computes exact linear quantiles and handles missing / non-finite values safely', () => {
    // Sorted clean values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] (n=11)
    const vals = [11, Number.NaN, 1, 5, 3, 9, 7, 2, 10, 4, 6, 8, Number.POSITIVE_INFINITY];
    expect(computeLinearQuantile(vals, 0.1)).toBe(2); // pos = 10 * 0.1 = 1 -> sorted[1] = 2
    expect(computeLinearQuantile(vals, 0.5)).toBe(6); // pos = 5 -> 6
    expect(computeLinearQuantile(vals, 0.9)).toBe(10); // pos = 9 -> 10
    expect(computeLinearQuantile([Number.NaN], 0.5)).toBeNull();
    expect(computeLinearQuantile([42], 0.1)).toBe(42);
    expect(() => computeLinearQuantile([1, 2], 1.5)).toThrow();
  });

  it('enforces unnormalized pooling block and suppresses P10/P90 when n < 10', () => {
    const repA = runExpandingOriginBacktest(LINEAR_SERIES, { minTrainLength: 5, maxHorizon: 3 }).data;
    const repB = runExpandingOriginBacktest(FLAT_PLATEAU_AFTER_STEP, {
      minTrainLength: 5,
      maxHorizon: 3,
    }).data;

    const singleResiduals = extractOutOfSampleResiduals([repA], 'damped_ets');
    const singleSummary = analyzeHorizonResiduals(singleResiduals, 'damped_ets', {
      normalizationMode: 'none_single_series',
    });
    // n=9 gives k=5,6,7,8 -> h=1 has 4 folds, h=2 has 3 folds, h=3 has 2 folds (< MIN_SAMPLE_FOR_P10_P90=10)
    expect(singleSummary.data.byHorizon[0].sampleSize).toBe(4);
    expect(singleSummary.data.byHorizon[0].quantileSupported).toBe(false);
    expect(singleSummary.data.byHorizon[0].p10).toBeNull();
    expect(singleSummary.data.byHorizon[0].p90).toBeNull();
    expect(singleSummary.data.byHorizon[0].min).not.toBeNull();

    const multiResiduals = extractOutOfSampleResiduals([repA, repB], 'damped_ets');
    expect(() =>
      analyzeHorizonResiduals(multiResiduals, 'damped_ets', {
        normalizationMode: 'none_single_series',
      })
    ).toThrow(/incompatible series/);

    // Explicit suite percentage normalization succeeds
    const normSummary = analyzeHorizonResiduals(multiResiduals, 'damped_ets', {
      normalizationMode: 'suite_pct_error',
    });
    expect(normSummary.data.distinctSeriesCount).toBe(2);
    expect(normSummary.unit).toContain('% error');
  });

  it('handles missing observations cleanly and distinguishes observed, backtest, and selectable horizons 2026-2030', () => {
    interface StoredForecastRow {
      series_id: string;
      country_code: string;
      country_label: string;
      indicator_name: string;
      year: number;
      actual_value: number | null;
      data_source: string;
    }
    const rows = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/statistical_price_forecasts.json'), 'utf-8')
    ) as StoredForecastRow[];
    const esObs = rows
      .filter(
        (r) =>
          r.country_code === 'ES' &&
          r.indicator_name === 'Healthy Whole-Food CPI Basket (2015=100)' &&
          r.actual_value !== null
      )
      .sort((a, b) => a.year - b.year);

    // Inject one NaN missing year to test missingness tracking safely
    const inputWithNaN: ObservedTimeSeriesInput = {
      seriesId: esObs[0].series_id,
      countryCode: esObs[0].country_code,
      countryLabel: esObs[0].country_label,
      indicatorName: esObs[0].indicator_name,
      years: [...esObs.map((r) => r.year), 2026],
      values: [...esObs.map((r) => r.actual_value as number), Number.NaN],
      dataSource: esObs[0].data_source,
    };

    const rep = runExpandingOriginBacktest(inputWithNaN, { minTrainLength: 5, maxHorizon: 3 });
    expect(rep.missingness.missingOrExcludedRecords).toBe(1);
    expect(rep.data.folds).toHaveLength(15);

    const singleRes = extractOutOfSampleResiduals([rep.data], 'naive_drift');
    const singleSumm = analyzeHorizonResiduals(singleRes, 'naive_drift', {
      normalizationMode: 'none_single_series',
    });
    expect(singleSumm.data.byHorizon[0].sampleSize).toBe(6); // h=1
    expect(singleSumm.data.byHorizon[1].sampleSize).toBe(5); // h=2
    expect(singleSumm.data.byHorizon[2].sampleSize).toBe(4); // h=3

    // Horizon cutoff = 2028 (3 forecast years)
    const series2028 = buildForecastUncertaintySeries({
      input: inputWithNaN,
      selectedModel: 'naive_drift',
      horizonEndYear: 2028,
      uncertaintyMode: 'empirical_single_minmax',
      singleSeriesReport: rep.data,
      singleHorizonSummaries: singleSumm.data.byHorizon,
      suitePctHorizonSummaries: [],
    });
    expect(series2028.data.filter((r) => r.role === 'OBSERVED_HISTORY')).toHaveLength(8); // 2015..2022
    expect(series2028.data.filter((r) => r.role === 'HISTORICAL_BACKTEST')).toHaveLength(3); // 2023..2025
    expect(series2028.data.filter((r) => r.role === 'FUTURE_FORECAST')).toHaveLength(3); // 2026..2028
    expect(series2028.data.every((r) => r.year <= 2028)).toBe(true);

    // Horizon cutoff = 2030 under empirical_single_minmax: h=4 (2029) & h=5 (2030) have NO empirical residuals
    const series2030 = buildForecastUncertaintySeries({
      input: inputWithNaN,
      selectedModel: 'naive_drift',
      horizonEndYear: 2030,
      uncertaintyMode: 'empirical_single_minmax',
      singleSeriesReport: rep.data,
      singleHorizonSummaries: singleSumm.data.byHorizon,
      suitePctHorizonSummaries: [],
    });
    const yr2029 = series2030.data.find((r) => r.year === 2029)!;
    const yr2030 = series2030.data.find((r) => r.year === 2030)!;
    expect(yr2029.bandSupported).toBe(false);
    expect(yr2029.lowerBound).toBeNull();
    expect(yr2030.bandSupported).toBe(false);
    expect(yr2030.residualSampleSize).toBe(0);
  });

  it('evaluates empirical interval coverage and P10/P90 thresholds across live 35 series cleanly', () => {
    interface StoredForecastRow {
      series_id: string;
      country_code: string;
      country_label: string;
      indicator_name: string;
      year: number;
      actual_value: number | null;
      data_source: string;
    }
    const rows = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/statistical_price_forecasts.json'), 'utf-8')
    ) as StoredForecastRow[];
    const grouped = new Map<string, StoredForecastRow[]>();
    for (const r of rows) {
      const k = `${r.country_code}|${r.indicator_name}`;
      const arr = grouped.get(k) ?? [];
      arr.push(r);
      grouped.set(k, arr);
    }

    const reports = Array.from(grouped.values()).map((grp) => {
      const obs = grp.filter((r) => r.actual_value !== null).sort((a, b) => a.year - b.year);
      return runExpandingOriginBacktest(
        {
          seriesId: obs[0].series_id,
          countryCode: obs[0].country_code,
          countryLabel: obs[0].country_label,
          indicatorName: obs[0].indicator_name,
          years: obs.map((r) => r.year),
          values: obs.map((r) => r.actual_value as number),
          dataSource: obs[0].data_source,
        },
        { minTrainLength: 5, maxHorizon: 3 }
      ).data;
    });

    const suiteRes = extractOutOfSampleResiduals(reports, 'naive_drift');
    const suitePct = analyzeHorizonResiduals(suiteRes, 'naive_drift', {
      normalizationMode: 'suite_pct_error',
    });
    expect(suitePct.data.byHorizon[0].sampleSize).toBe(210); // 35 * 6
    expect(suitePct.data.byHorizon[1].sampleSize).toBe(175); // 35 * 5
    expect(suitePct.data.byHorizon[2].sampleSize).toBe(140); // 35 * 4
    expect(suitePct.data.byHorizon[0].quantileSupported).toBe(true);
    expect(suitePct.data.byHorizon[0].sampleSize).toBeGreaterThanOrEqual(MIN_SAMPLE_FOR_P10_P90);

    const covSingle = evaluateEmpiricalIntervalCoverage(reports, 'naive_drift', 'empirical_single_minmax');
    const covSuite = evaluateEmpiricalIntervalCoverage(
      reports,
      'naive_drift',
      'empirical_suite_pct_p10_p90'
    );
    const covHeuristic = evaluateEmpiricalIntervalCoverage(reports, 'naive_drift', 'heuristic_spread');

    expect(covSingle.totalOutOfSampleFolds).toBe(525);
    expect(covSingle.evaluableFolds).toBeGreaterThan(0);
    expect(covSuite.evaluableFolds).toBeGreaterThan(covSingle.evaluableFolds);
    expect(covSuite.empiricalCoveragePct).not.toBeNull();
    expect(covHeuristic.evaluableFolds).toBe(covSingle.evaluableFolds);

    const repEs = reports[0];
    const singleResEs = extractOutOfSampleResiduals([repEs], 'naive_drift');
    const singleSummEs = analyzeHorizonResiduals(singleResEs, 'naive_drift', {
      normalizationMode: 'none_single_series',
    });
    const seriesRows = buildForecastUncertaintySeries({
      input: {
        seriesId: repEs.seriesId,
        countryCode: repEs.countryCode,
        countryLabel: repEs.countryLabel,
        indicatorName: repEs.indicatorName,
        years: Array.from({ length: 11 }, (_, i) => 2015 + i),
        values: Array.from({ length: 11 }, (_, i) => 100 + i * 2),
        dataSource: 'Eurostat',
      },
      selectedModel: 'naive_drift',
      horizonEndYear: 2030,
      uncertaintyMode: 'empirical_suite_pct_p10_p90',
      singleSeriesReport: repEs,
      singleHorizonSummaries: singleSummEs.data.byHorizon,
      suitePctHorizonSummaries: suitePct.data.byHorizon,
    });

    const csv = serializeForecastUncertaintyCsv({
      seriesId: repEs.seriesId,
      countryLabel: repEs.countryLabel,
      indicatorName: repEs.indicatorName,
      modelId: 'naive_drift',
      uncertaintyMode: 'empirical_suite_pct_p10_p90',
      coverage: covSuite,
      rows: seriesRows.data,
    });
    expect(csv).toContain('NOT calibrated 80% prediction intervals');
    expect(csv).toContain('NOT guarantee residual independence');
    expect(csv).toContain('FUTURE_FORECAST');
    expect(csv).toContain('HISTORICAL_BACKTEST');

    // Reconcile exact denominators (210 and 315 out of 525) by horizon and series
    expect(covSingle.evaluableFolds).toBe(210);
    expect(covSingle.skippedInsufficientPrior).toBe(315);
    expect(covSingle.excludedUnavailableHorizon).toBe(210);
    expect(covSingle.byHorizon.map((b) => [b.horizon, b.evaluableFolds, b.totalFolds])).toEqual([
      [1, 140, 210],
      [2, 70, 175],
      [3, 0, 140],
    ]);
    expect(covSingle.bySeries).toHaveLength(35);

    expect(covHeuristic.evaluableFolds).toBe(210);
    expect(covHeuristic.skippedInsufficientPrior).toBe(315);

    expect(covSuite.evaluableFolds).toBe(315);
    expect(covSuite.skippedInsufficientPrior).toBe(210);
    expect(covSuite.excludedUnavailableHorizon).toBe(210);
    expect(covSuite.byHorizon.map((b) => [b.horizon, b.evaluableFolds, b.totalFolds])).toEqual([
      [1, 175, 210],
      [2, 105, 175],
      [3, 35, 140],
    ]);
    expect(covSuite.bySeries).toHaveLength(35);
  });

  it('verifies pctResidual normalization formula, inverse mapping (incl. Italy h=3), and zero/non-finite denominator guards', () => {
    // Positive residual: predicted=120, actual=135 -> +12.5%, inverse on 120 = 135
    const posPct = computePctResidual(135, 120);
    expect(posPct).toBe(12.5);
    expect(applyPctResidualOffset(120, posPct!)).toBe(135);

    // Negative residual: predicted=120, actual=108 -> -10%, inverse on 120 = 108
    const negPct = computePctResidual(108, 120);
    expect(negPct).toBe(-10);
    expect(applyPctResidualOffset(120, negPct!)).toBe(108);

    // Exact Italy 2028 (h=3) example: point=152.65, P10=+5.533%, P90=+24.635%
    expect(applyPctResidualOffset(152.65, 5.533)).toBe(161.1);
    expect(applyPctResidualOffset(152.65, 24.635)).toBe(190.26);

    // Zero or non-finite denominator guards return null explicitly
    expect(computePctResidual(100, 0)).toBeNull();
    expect(computePctResidual(100, -0)).toBeNull();
    expect(computePctResidual(100, 1e-12)).toBeNull();
    expect(computePctResidual(100, Number.NaN)).toBeNull();
    expect(computePctResidual(Number.POSITIVE_INFINITY, 100)).toBeNull();
    expect(applyPctResidualOffset(152.65, Number.NaN)).toBeNull();
  });

  it('computes jurisdiction-level coverage diagnostics across 7 jurisdictions, 5 models, 3 methods, and small-sample flags', () => {
    interface StoredForecastRow {
      series_id: string;
      country_code: string;
      country_label: string;
      indicator_name: string;
      year: number;
      actual_value: number | null;
      data_source: string;
    }
    const rows = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/statistical_price_forecasts.json'), 'utf-8')
    ) as StoredForecastRow[];
    const grouped = new Map<string, StoredForecastRow[]>();
    for (const r of rows) {
      const k = `${r.country_code}|${r.indicator_name}`;
      const arr = grouped.get(k) ?? [];
      arr.push(r);
      grouped.set(k, arr);
    }
    const reports = Array.from(grouped.values()).map((grp) => {
      const obs = grp.filter((r) => r.actual_value !== null).sort((a, b) => a.year - b.year);
      return runExpandingOriginBacktest(
        {
          seriesId: obs[0].series_id,
          countryCode: obs[0].country_code,
          countryLabel: obs[0].country_label,
          indicatorName: obs[0].indicator_name,
          years: obs.map((r) => r.year),
          values: obs.map((r) => r.actual_value as number),
          dataSource: obs[0].data_source,
        },
        { minTrainLength: 5, maxHorizon: 3 }
      ).data;
    });

    const matrix = evaluateCoverageMatrixAllModels(reports);
    expect(Object.keys(matrix)).toHaveLength(5);

    for (const mId of ['damped_ets', 'holt_ets', 'ridge_trend', 'naive_drift', 'naive_random_walk'] as const) {
      for (const mode of ['empirical_single_minmax', 'empirical_suite_pct_p10_p90', 'heuristic_spread'] as const) {
        const res = matrix[mId][mode];
        expect(res.byJurisdiction).toHaveLength(7);
        expect(res.byJurisdiction.map((j) => j.countryCode)).toEqual([
          'DE',
          'ES',
          'EU27_2020',
          'FR',
          'GBR',
          'IT',
          'NL',
        ]);

        // Exact consistency between jurisdiction sums and overall totals
        const sumTotal = res.byJurisdiction.reduce((s, j) => s + j.totalFolds, 0);
        const sumEligible = res.byJurisdiction.reduce((s, j) => s + j.evaluableFolds, 0);
        const sumHits = res.byJurisdiction.reduce((s, j) => s + j.hits, 0);
        const sumExcl = res.byJurisdiction.reduce((s, j) => s + j.excludedInsufficientPrior, 0);
        expect(sumTotal).toBe(res.totalOutOfSampleFolds);
        expect(sumEligible).toBe(res.evaluableFolds);
        expect(sumHits).toBe(res.hits);
        expect(sumExcl).toBe(res.skippedInsufficientPrior);

        // Horizon-specific sum consistency across all 7 jurisdictions
        for (const h of [1, 2, 3]) {
          const sumHEligible = res.byJurisdiction.reduce(
            (s, j) => s + (j.byHorizon.find((hb) => hb.horizon === h)?.evaluableFolds ?? 0),
            0
          );
          const sumHHits = res.byJurisdiction.reduce(
            (s, j) => s + (j.byHorizon.find((hb) => hb.horizon === h)?.hits ?? 0),
            0
          );
          const overallH = res.byHorizon.find((hb) => hb.horizon === h)!;
          expect(sumHEligible).toBe(overallH.evaluableFolds);
          expect(sumHHits).toBe(overallH.hits);
        }

        // Small-sample flag must trigger since h=3 is < MIN_COVERAGE_EVAL_SAMPLE (20) in every jurisdiction
        for (const j of res.byJurisdiction) {
          expect(j.seriesCount).toBe(5);
          expect(j.smallSampleFlag).toBe(true);
          const h3 = j.byHorizon.find((hb) => hb.horizon === 3)!;
          expect(h3.smallSampleFlag).toBe(true);
          expect(h3.evaluableFolds).toBeLessThan(MIN_COVERAGE_EVAL_SAMPLE);
        }
      }
    }

    // Test missing / insufficient jurisdiction-level sample (short n=4 series + 1 full single-series country)
    const insufficientShortRep = runExpandingOriginBacktest(
      {
        seriesId: 'ZZ_SHORT',
        countryCode: 'ZZ',
        countryLabel: 'Short Country',
        indicatorName: 'Short Series',
        years: [2020, 2021, 2022, 2023],
        values: [100, 102, 105, 108],
        dataSource: 'Test',
      },
      { minTrainLength: 5, maxHorizon: 3 }
    ).data;
    const oneSeriesRep = runExpandingOriginBacktest(
      {
        ...LINEAR_SERIES,
        seriesId: 'YY_SINGLE',
        countryCode: 'YY',
        countryLabel: 'Single Series Country',
      },
      { minTrainLength: 5, maxHorizon: 3 }
    ).data;

    const smallCov = evaluateEmpiricalIntervalCoverage([insufficientShortRep, oneSeriesRep], 'naive_drift', 'empirical_single_minmax');
    const zz = smallCov.byJurisdiction.find((j) => j.countryCode === 'ZZ')!;
    const yy = smallCov.byJurisdiction.find((j) => j.countryCode === 'YY')!;
    expect(zz.totalFolds).toBe(0);
    expect(zz.evaluableFolds).toBe(0);
    expect(zz.coveragePct).toBeNull();
    expect(zz.smallSampleFlag).toBe(true);
    expect(yy.evaluableFolds).toBeLessThan(MIN_COVERAGE_EVAL_SAMPLE);
    expect(yy.smallSampleFlag).toBe(true);
    expect(yy.smallSampleNote).toContain('Small jurisdiction sample');

    // CSV includes jurisdiction breakdown lines
    const covEs = matrix.naive_drift.empirical_single_minmax;
    const csvWithJur = serializeForecastUncertaintyCsv({
      seriesId: reports[0].seriesId,
      countryLabel: reports[0].countryLabel,
      indicatorName: reports[0].indicatorName,
      modelId: 'naive_drift',
      uncertaintyMode: 'empirical_single_minmax',
      coverage: covEs,
      rows: [],
    });
    expect(csvWithJur).toContain('# Jurisdiction Coverage (IT,');
    expect(csvWithJur).toContain('# Jurisdiction Coverage (EU27_2020,');
  });
});
