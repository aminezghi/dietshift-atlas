import type { AnalyticalResult } from './types';

export const FORECASTING_ENGINE_VERSION = '4.2.0-phase4b';
export const MIN_SAMPLE_FOR_P10_P90 = 10;
export const MIN_COVERAGE_EVAL_SAMPLE = 20;

export type ForecastModelId =
  | 'damped_ets'
  | 'holt_ets'
  | 'ridge_trend'
  | 'naive_drift'
  | 'naive_random_walk';

export const FORECAST_MODEL_LABELS: Record<ForecastModelId, string> = {
  damped_ets: 'Damped Trend Holt ETS (α=0.55, β=0.35, φ=0.85)',
  holt_ets: 'Holt Linear Trend ETS (α=0.55, β=0.35, φ=1.0)',
  ridge_trend: 'Ridge Linear Trend (λ=1.5)',
  naive_drift: 'Random Walk with Drift (Naive Baseline)',
  naive_random_walk: 'Random Walk (Last-Value Naive Baseline)',
};

export const ALL_FORECAST_MODELS: ForecastModelId[] = [
  'damped_ets',
  'holt_ets',
  'ridge_trend',
  'naive_drift',
  'naive_random_walk',
];

export interface ObservedTimeSeriesInput {
  seriesId: string;
  countryCode: string;
  countryLabel: string;
  indicatorName: string;
  years: number[];
  values: number[];
  dataSource: string;
}

export interface ForecastErrorMetrics {
  count: number;
  mae: number | null;
  rmse: number | null;
  smapePct: number | null;
  mase: number | null;
}

export interface ExpandingOriginFoldRecord {
  originYear: number;
  targetYear: number;
  horizon: number;
  actual: number;
  trainScaleDenominator: number;
  predictions: Record<ForecastModelId, number>;
  errors: Record<ForecastModelId, number>;
}

export interface SeriesBacktestReport {
  seriesId: string;
  countryCode: string;
  countryLabel: string;
  indicatorName: string;
  observationCount: number;
  minTrainLength: number;
  maxHorizon: number;
  folds: ExpandingOriginFoldRecord[];
  overallByModel: Record<ForecastModelId, ForecastErrorMetrics>;
  byHorizonByModel: Record<number, Record<ForecastModelId, ForecastErrorMetrics>>;
  bestModelByCvMae: ForecastModelId | null;
  bestCvMae: number | null;
  bestCvMase: number | null;
  complexModelBeatsNaiveRw: boolean;
  complexModelBeatsNaiveDrift: boolean;
  shortSeriesLimitations: string[];
}

export interface ForwardProjectionPoint {
  year: number;
  horizon: number;
  role: 'FUTURE_PROJECTION';
  predictions: Record<ForecastModelId, number>;
}

function roundTo(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

export function fitHoltEts(
  seriesVals: readonly number[],
  alpha: number = 0.55,
  beta: number = 0.35,
  phi: number = 1.0
): { level: number; trend: number; fitted: number[] } {
  if (seriesVals.length === 0) {
    throw new Error('fitHoltEts requires at least 1 observation.');
  }
  let level = seriesVals[0];
  let trend = seriesVals.length >= 2 ? seriesVals[1] - seriesVals[0] : 0;
  const fitted = [roundTo(level, 2)];
  for (let i = 1; i < seriesVals.length; i += 1) {
    const val = seriesVals[i];
    const prevLevel = level;
    level = alpha * val + (1.0 - alpha) * (level + phi * trend);
    trend = beta * (level - prevLevel) + (1.0 - beta) * phi * trend;
    fitted.push(roundTo(level, 2));
  }
  return { level, trend, fitted };
}

export function forecastHoltEts(
  level: number,
  trend: number,
  horizon: number,
  phi: number = 1.0
): number {
  if (horizon <= 0) return level;
  if (phi === 1.0) return level + horizon * trend;
  let dampedSum = 0;
  for (let j = 1; j <= horizon; j += 1) {
    dampedSum += phi ** j;
  }
  return level + dampedSum * trend;
}

export function fitRidgeTrend(
  seriesVals: readonly number[],
  lambda: number = 1.5
): { intercept: number; slope: number } {
  const n = seriesVals.length;
  if (n === 0) {
    throw new Error('fitRidgeTrend requires at least 1 observation.');
  }
  if (n === 1) {
    return { intercept: seriesVals[0], slope: 0 };
  }
  const meanX = (n - 1) / 2;
  const meanY = seriesVals.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let x = 0; x < n; x += 1) {
    const dx = x - meanX;
    num += dx * (seriesVals[x] - meanY);
    den += dx * dx;
  }
  const slope = num / Math.max(den + lambda, 1e-9);
  const intercept = meanY - slope * meanX;
  return { intercept, slope };
}

export function forecastNaiveRandomWalk(trainVals: readonly number[]): number {
  if (trainVals.length === 0) throw new Error('Naive RW requires >= 1 point');
  return trainVals[trainVals.length - 1];
}

export function forecastNaiveDrift(trainVals: readonly number[], horizon: number): number {
  if (trainVals.length === 0) throw new Error('Naive Drift requires >= 1 point');
  if (trainVals.length === 1) return trainVals[0];
  const drift = (trainVals[trainVals.length - 1] - trainVals[0]) / (trainVals.length - 1);
  return trainVals[trainVals.length - 1] + horizon * drift;
}

export function computeTrainingNaiveScale(trainVals: readonly number[]): number {
  if (trainVals.length < 2) return 1.0;
  let sumAbsDiff = 0;
  for (let i = 1; i < trainVals.length; i += 1) {
    sumAbsDiff += Math.abs(trainVals[i] - trainVals[i - 1]);
  }
  return Math.max(sumAbsDiff / (trainVals.length - 1), 1e-6);
}

export function computeErrorMetrics(
  pairs: ReadonlyArray<{ actual: number; predicted: number; scaleDenom: number }>
): ForecastErrorMetrics {
  const n = pairs.length;
  if (n === 0) {
    return { count: 0, mae: null, rmse: null, smapePct: null, mase: null };
  }
  let absSum = 0;
  let sqSum = 0;
  let smapeSum = 0;
  let scaledAbsSum = 0;

  for (const { actual, predicted, scaleDenom } of pairs) {
    const err = actual - predicted;
    const absErr = Math.abs(err);
    absSum += absErr;
    sqSum += err * err;
    const denom = Math.abs(actual) + Math.abs(predicted);
    smapeSum += denom > 1e-9 ? (200 * absErr) / denom : 0;
    scaledAbsSum += absErr / Math.max(scaleDenom, 1e-6);
  }

  return {
    count: n,
    mae: roundTo(absSum / n, 3),
    rmse: roundTo(Math.sqrt(sqSum / n), 3),
    smapePct: roundTo(smapeSum / n, 2),
    mase: roundTo(scaledAbsSum / n, 3),
  };
}

export function runExpandingOriginBacktest(
  input: ObservedTimeSeriesInput,
  options: { minTrainLength?: number; maxHorizon?: number } = {}
): AnalyticalResult<SeriesBacktestReport> {
  const minTrain = options.minTrainLength ?? 5;
  const maxH = options.maxHorizon ?? 3;

  if (input.years.length !== input.values.length) {
    throw new Error('years and values arrays must have equal length.');
  }

  const ordered = input.years
    .map((year, idx) => ({ year, value: input.values[idx] }))
    .filter((pt) => Number.isFinite(pt.year) && Number.isFinite(pt.value))
    .sort((a, b) => a.year - b.year);

  const years = ordered.map((p) => p.year);
  const vals = ordered.map((p) => p.value);
  const n = vals.length;

  const folds: ExpandingOriginFoldRecord[] = [];

  for (let trainEndLen = minTrain; trainEndLen < n; trainEndLen += 1) {
    // Strictly slice ONLY [0 .. trainEndLen - 1] so zero holdout data touches parameters or scaling
    const trainSlice = vals.slice(0, trainEndLen);
    const originYear = years[trainEndLen - 1];
    const scaleDenom = computeTrainingNaiveScale(trainSlice);

    const dmpFit = fitHoltEts(trainSlice, 0.55, 0.35, 0.85);
    const etsFit = fitHoltEts(trainSlice, 0.55, 0.35, 1.0);
    const ridgeFit = fitRidgeTrend(trainSlice, 1.5);

    const maxStep = Math.min(maxH, n - trainEndLen);
    for (let h = 1; h <= maxStep; h += 1) {
      const targetIdx = trainEndLen - 1 + h;
      const targetYear = years[targetIdx];
      const actual = vals[targetIdx];

      const preds: Record<ForecastModelId, number> = {
        damped_ets: roundTo(forecastHoltEts(dmpFit.level, dmpFit.trend, h, 0.85), 2),
        holt_ets: roundTo(forecastHoltEts(etsFit.level, etsFit.trend, h, 1.0), 2),
        ridge_trend: roundTo(ridgeFit.intercept + ridgeFit.slope * targetIdx, 2),
        naive_drift: roundTo(forecastNaiveDrift(trainSlice, h), 2),
        naive_random_walk: roundTo(forecastNaiveRandomWalk(trainSlice), 2),
      };

      const errs: Record<ForecastModelId, number> = {
        damped_ets: roundTo(actual - preds.damped_ets, 3),
        holt_ets: roundTo(actual - preds.holt_ets, 3),
        ridge_trend: roundTo(actual - preds.ridge_trend, 3),
        naive_drift: roundTo(actual - preds.naive_drift, 3),
        naive_random_walk: roundTo(actual - preds.naive_random_walk, 3),
      };

      folds.push({
        originYear,
        targetYear,
        horizon: h,
        actual,
        trainScaleDenominator: roundTo(scaleDenom, 4),
        predictions: preds,
        errors: errs,
      });
    }
  }

  const overallByModel = {} as Record<ForecastModelId, ForecastErrorMetrics>;
  const byHorizonByModel: Record<number, Record<ForecastModelId, ForecastErrorMetrics>> = {};

  for (const m of ALL_FORECAST_MODELS) {
    overallByModel[m] = computeErrorMetrics(
      folds.map((f) => ({
        actual: f.actual,
        predicted: f.predictions[m],
        scaleDenom: f.trainScaleDenominator,
      }))
    );
  }

  for (let h = 1; h <= maxH; h += 1) {
    const hFolds = folds.filter((f) => f.horizon === h);
    byHorizonByModel[h] = {} as Record<ForecastModelId, ForecastErrorMetrics>;
    for (const m of ALL_FORECAST_MODELS) {
      byHorizonByModel[h][m] = computeErrorMetrics(
        hFolds.map((f) => ({
          actual: f.actual,
          predicted: f.predictions[m],
          scaleDenom: f.trainScaleDenominator,
        }))
      );
    }
  }

  // Empirical winner selection: strictly lowest expanding-CV MAE; prefer simpler baseline on tie
  const tieBreakOrder: ForecastModelId[] = [
    'naive_random_walk',
    'naive_drift',
    'ridge_trend',
    'holt_ets',
    'damped_ets',
  ];
  let bestModel: ForecastModelId | null = null;
  let bestMae = Infinity;
  for (const m of tieBreakOrder) {
    const mae = overallByModel[m].mae;
    if (mae !== null && mae < bestMae - 1e-6) {
      bestMae = mae;
      bestModel = m;
    }
  }

  const rwMae = overallByModel.naive_random_walk.mae ?? Infinity;
  const driftMae = overallByModel.naive_drift.mae ?? Infinity;
  const complexMinMae = Math.min(
    overallByModel.damped_ets.mae ?? Infinity,
    overallByModel.holt_ets.mae ?? Infinity,
    overallByModel.ridge_trend.mae ?? Infinity
  );

  const shortSeriesLimitations = [
    `Short historical sample (n=${n} annual observations, ${years[0] ?? '—'}–${years[n - 1] ?? '—'}): precludes seasonal decomposition, autoregressive lag tuning, or asymptotic distributional guarantees.`,
    `Minimum origin window of ${minTrain} years yields ${folds.length} expanding out-of-sample tests across h=1..${maxH}, spanning the post-2021 food inflation structural break.`,
  ];
  if (n <= minTrain) {
    shortSeriesLimitations.push(
      `Insufficient history (n=${n} <= minTrainLength=${minTrain}): expanding-window backtest produced 0 folds.`
    );
  }

  return {
    data: {
      seriesId: input.seriesId,
      countryCode: input.countryCode,
      countryLabel: input.countryLabel,
      indicatorName: input.indicatorName,
      observationCount: n,
      minTrainLength: minTrain,
      maxHorizon: maxH,
      folds,
      overallByModel,
      byHorizonByModel,
      bestModelByCvMae: bestModel,
      bestCvMae: bestModel ? overallByModel[bestModel].mae : null,
      bestCvMase: bestModel ? overallByModel[bestModel].mase : null,
      complexModelBeatsNaiveRw: complexMinMae < rwMae,
      complexModelBeatsNaiveDrift: complexMinMae < driftMae,
      shortSeriesLimitations,
    },
    unit: 'HICP Index (2015 = 100) / MAE / RMSE / sMAPE% / MASE',
    provenance: {
      module: 'forecastingEngine.runExpandingOriginBacktest',
      version: FORECASTING_ENGINE_VERSION,
      dataNature: 'Forecast',
      sources: [input.dataSource],
      assumptions: [
        'Strictly causal expanding-origin cross-validation: parameters, levels, trends, and MASE denominators are estimated exclusively on [start..originYear].',
        'Simpler baselines (Random Walk / Drift) win model selection whenever they achieve lower expanding-origin MAE than ETS or Ridge.',
      ],
    },
    missingness: {
      totalRecords: n,
      includedRecords: n,
      missingOrExcludedRecords: input.values.length - n,
    },
  };
}

export function generateForwardProjections(
  input: ObservedTimeSeriesInput,
  maxHorizonYears: number = 5
): ForwardProjectionPoint[] {
  const ordered = input.years
    .map((year, idx) => ({ year, value: input.values[idx] }))
    .filter((pt) => Number.isFinite(pt.year) && Number.isFinite(pt.value))
    .sort((a, b) => a.year - b.year);

  const vals = ordered.map((p) => p.value);
  const lastYear = ordered[ordered.length - 1]?.year;
  if (!vals.length || lastYear === undefined || maxHorizonYears <= 0) return [];

  const dmpFit = fitHoltEts(vals, 0.55, 0.35, 0.85);
  const etsFit = fitHoltEts(vals, 0.55, 0.35, 1.0);
  const ridgeFit = fitRidgeTrend(vals, 1.5);

  const out: ForwardProjectionPoint[] = [];
  for (let h = 1; h <= maxHorizonYears; h += 1) {
    out.push({
      year: lastYear + h,
      horizon: h,
      role: 'FUTURE_PROJECTION',
      predictions: {
        damped_ets: roundTo(forecastHoltEts(dmpFit.level, dmpFit.trend, h, 0.85), 2),
        holt_ets: roundTo(forecastHoltEts(etsFit.level, etsFit.trend, h, 1.0), 2),
        ridge_trend: roundTo(ridgeFit.intercept + ridgeFit.slope * (vals.length - 1 + h), 2),
        naive_drift: roundTo(forecastNaiveDrift(vals, h), 2),
        naive_random_walk: roundTo(forecastNaiveRandomWalk(vals), 2),
      },
    });
  }
  return out;
}

export interface SuiteValidationSummary {
  seriesCount: number;
  totalFoldsEvaluated: number;
  winCountsByModel: Record<ForecastModelId, number>;
  meanMetricsByModel: Record<ForecastModelId, ForecastErrorMetrics>;
  meanMetricsByHorizon: Record<number, Record<ForecastModelId, ForecastErrorMetrics>>;
}

export function summarizeForecastSuitePerformance(
  reports: readonly SeriesBacktestReport[],
  maxHorizon: number = 3
): AnalyticalResult<SuiteValidationSummary> {
  const winCountsByModel: Record<ForecastModelId, number> = {
    damped_ets: 0,
    holt_ets: 0,
    ridge_trend: 0,
    naive_drift: 0,
    naive_random_walk: 0,
  };

  for (const r of reports) {
    if (r.bestModelByCvMae) {
      winCountsByModel[r.bestModelByCvMae] += 1;
    }
  }

  const allFolds = reports.flatMap((r) => r.folds);
  const meanMetricsByModel = {} as Record<ForecastModelId, ForecastErrorMetrics>;
  const meanMetricsByHorizon: Record<number, Record<ForecastModelId, ForecastErrorMetrics>> = {};

  for (const m of ALL_FORECAST_MODELS) {
    meanMetricsByModel[m] = computeErrorMetrics(
      allFolds.map((f) => ({
        actual: f.actual,
        predicted: f.predictions[m],
        scaleDenom: f.trainScaleDenominator,
      }))
    );
  }

  for (let h = 1; h <= maxHorizon; h += 1) {
    const hFolds = allFolds.filter((f) => f.horizon === h);
    meanMetricsByHorizon[h] = {} as Record<ForecastModelId, ForecastErrorMetrics>;
    for (const m of ALL_FORECAST_MODELS) {
      meanMetricsByHorizon[h][m] = computeErrorMetrics(
        hFolds.map((f) => ({
          actual: f.actual,
          predicted: f.predictions[m],
          scaleDenom: f.trainScaleDenominator,
        }))
      );
    }
  }

  return {
    data: {
      seriesCount: reports.length,
      totalFoldsEvaluated: allFolds.length,
      winCountsByModel,
      meanMetricsByModel,
      meanMetricsByHorizon,
    },
    unit: 'Pooled expanding-origin errors across HICP series',
    provenance: {
      module: 'forecastingEngine.summarizeForecastSuitePerformance',
      version: FORECASTING_ENGINE_VERSION,
      dataNature: 'Forecast',
      sources: Array.from(new Set(reports.flatMap((r) => [r.indicatorName]))),
      assumptions: [
        'All pooled metrics aggregate strictly out-of-sample expanding-origin test errors across h=1..3.',
        'MASE < 1.0 indicates improvement over in-sample one-step naive random walk.',
      ],
    },
    missingness: {
      totalRecords: reports.length,
      includedRecords: reports.filter((r) => r.folds.length > 0).length,
      missingOrExcludedRecords: reports.filter((r) => r.folds.length === 0).length,
    },
  };
}

// =============================================================================
// Phase 4B: Forecast Uncertainty, Empirical Residuals & Coverage Evaluation
// =============================================================================

export type ResidualNormalizationMode = 'none_single_series' | 'suite_pct_error' | 'suite_mase_scaled';

export type UncertaintyDisplayMode =
  | 'empirical_single_minmax'
  | 'empirical_suite_pct_p10_p90'
  | 'heuristic_spread';

export interface OutOfSampleResidualRecord {
  seriesId: string;
  countryCode: string;
  countryLabel: string;
  indicatorName: string;
  modelId: ForecastModelId;
  originYear: number;
  targetYear: number;
  horizon: number;
  actual: number;
  predicted: number;
  /** actual - predicted in index points */
  residual: number;
  absResidual: number;
  /** 100 * (actual - predicted) / predicted when predicted != 0 */
  pctResidual: number | null;
  /** residual / trainScaleDenominator */
  scaledResidual: number;
}

export interface HorizonResidualSummary {
  horizon: number;
  modelId: ForecastModelId;
  normalizationMode: ResidualNormalizationMode;
  unitLabel: string;
  sampleSize: number;
  distinctSeriesCount: number;
  quantileSupported: boolean;
  quantileStatusReason: string;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  rmse: number | null;
  p10: number | null;
  p50: number | null;
  p90: number | null;
}

export interface ResidualDistributionReport {
  modelId: ForecastModelId;
  normalizationMode: ResidualNormalizationMode;
  unitLabel: string;
  totalSampleSize: number;
  distinctSeriesCount: number;
  byHorizon: HorizonResidualSummary[];
  residuals: OutOfSampleResidualRecord[];
  methodologyNotes: string[];
}

export interface UncertaintySeriesRow {
  year: number;
  horizon: number | null;
  role: 'OBSERVED_HISTORY' | 'HISTORICAL_BACKTEST' | 'FUTURE_FORECAST';
  actualValue: number | null;
  pointPrediction: number | null;
  lowerBound: number | null;
  upperBound: number | null;
  bandType:
    | 'none'
    | 'empirical_residual_minmax'
    | 'empirical_suite_pct_p10_p90'
    | 'heuristic_sigma_spread';
  residualSampleSize: number;
  bandSupported: boolean;
  intervalStatusNote: string;
}

export interface HorizonCoverageBreakdown {
  horizon: number;
  totalFolds: number;
  evaluableFolds: number;
  hits: number;
  coveragePct: number | null;
  excludedInsufficientPrior: number;
  excludedUnavailableHorizon: number;
}

export interface SeriesCoverageSummary {
  seriesId: string;
  countryCode: string;
  indicatorName: string;
  totalFolds: number;
  evaluableFolds: number;
  hits: number;
  coveragePct: number | null;
  excludedInsufficientPrior: number;
}

export interface JurisdictionCoverageSummary {
  countryCode: string;
  countryLabel: string;
  seriesCount: number;
  totalFolds: number;
  evaluableFolds: number;
  hits: number;
  coveragePct: number | null;
  excludedInsufficientPrior: number;
  excludedUnavailableHorizon: number;
  smallSampleFlag: boolean;
  smallSampleNote: string;
  byHorizon: Array<HorizonCoverageBreakdown & { smallSampleFlag: boolean }>;
}

export interface EmpiricalCoverageResult {
  mode: UncertaintyDisplayMode;
  modelId: ForecastModelId;
  totalOutOfSampleFolds: number;
  evaluableFolds: number;
  skippedInsufficientPrior: number;
  excludedUnavailableHorizon: number;
  hits: number;
  empiricalCoveragePct: number | null;
  byHorizon: HorizonCoverageBreakdown[];
  bySeries: SeriesCoverageSummary[];
  byJurisdiction: JurisdictionCoverageSummary[];
  methodologyNote: string;
}

/**
 * Type-7 linear quantile interpolation matching R default & numpy percentile(..., method='linear').
 * Filters non-finite values safely; returns null if clean array is empty.
 */
export function computeLinearQuantile(values: readonly number[], q: number): number | null {
  if (!Number.isFinite(q) || q < 0 || q > 1) {
    throw new Error(`Quantile probability q must be in [0, 1]; received ${q}.`);
  }
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return null;
  if (n === 1) return roundTo(sorted[0], 3);
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return roundTo(sorted[lo], 3);
  const frac = pos - lo;
  return roundTo(sorted[lo] + frac * (sorted[hi] - sorted[lo]), 3);
}

/**
 * Exact percentage residual formula:
 *   pctResidual = ((actual - predicted) / predicted) * 100
 * Denominator: predicted (returns null if non-finite or |predicted| <= 1e-9).
 * Algebraically compatible with the inverse mapping `pointForecast * (1 + q / 100)`.
 */
export function computePctResidual(actual: number, predicted: number): number | null {
  if (!Number.isFinite(actual) || !Number.isFinite(predicted) || Math.abs(predicted) <= 1e-9) {
    return null;
  }
  return roundTo((100 * (actual - predicted)) / predicted, 3);
}

/**
 * Inverse transformation mapping a percentage residual (or quantile) onto a future point forecast:
 *   mappedValue = pointForecast * (1 + pctOffset / 100)
 */
export function applyPctResidualOffset(pointForecast: number, pctOffset: number): number | null {
  if (!Number.isFinite(pointForecast) || !Number.isFinite(pctOffset)) {
    return null;
  }
  return roundTo(pointForecast * (1 + pctOffset / 100), 2);
}

/**
 * Extracts genuine out-of-sample residuals across all expanding-origin folds.
 */
export function extractOutOfSampleResiduals(
  reports: readonly SeriesBacktestReport[],
  modelFilter?: ForecastModelId
): OutOfSampleResidualRecord[] {
  const modelsToExtract = modelFilter ? [modelFilter] : ALL_FORECAST_MODELS;
  const rows: OutOfSampleResidualRecord[] = [];
  for (const rep of reports) {
    for (const fold of rep.folds) {
      for (const mId of modelsToExtract) {
        const predicted = fold.predictions[mId];
        const actual = fold.actual;
        const residual = fold.errors[mId];
        if (!Number.isFinite(predicted) || !Number.isFinite(actual) || !Number.isFinite(residual)) {
          continue;
        }
        const pctResidual = computePctResidual(actual, predicted);
        const scaledResidual = roundTo(residual / Math.max(fold.trainScaleDenominator, 1e-6), 3);
        rows.push({
          seriesId: rep.seriesId,
          countryCode: rep.countryCode,
          countryLabel: rep.countryLabel,
          indicatorName: rep.indicatorName,
          modelId: mId,
          originYear: fold.originYear,
          targetYear: fold.targetYear,
          horizon: fold.horizon,
          actual,
          predicted,
          residual: roundTo(residual, 3),
          absResidual: roundTo(Math.abs(residual), 3),
          pctResidual,
          scaledResidual,
        });
      }
    }
  }
  return rows;
}

/**
 * Analyzes empirical out-of-sample residual distributions grouped by horizon.
 * Refuses unnormalized raw pooling across multiple distinct series to avoid unit/volatility mixing.
 * Refuses computing P10/P50/P90 quantiles when sampleSize < MIN_SAMPLE_FOR_P10_P90 (10).
 */
export function analyzeHorizonResiduals(
  residuals: readonly OutOfSampleResidualRecord[],
  modelId: ForecastModelId,
  options: {
    normalizationMode?: ResidualNormalizationMode;
    maxHorizon?: number;
  } = {}
): AnalyticalResult<ResidualDistributionReport> {
  const normMode = options.normalizationMode ?? 'none_single_series';
  const maxH = options.maxHorizon ?? 3;

  const modelRows = residuals.filter((r) => r.modelId === modelId);
  const distinctSeries = new Set(modelRows.map((r) => r.seriesId));

  if (normMode === 'none_single_series' && distinctSeries.size > 1) {
    throw new Error(
      `Cannot pool unnormalized residuals across ${distinctSeries.size} incompatible series without an explicit normalizationMode ('suite_pct_error' or 'suite_mase_scaled').`
    );
  }

  const metricValue = (r: OutOfSampleResidualRecord): number | null => {
    if (normMode === 'none_single_series') return r.residual;
    if (normMode === 'suite_pct_error') return r.pctResidual;
    return r.scaledResidual;
  };

  const unitLabel =
    normMode === 'none_single_series'
      ? 'Index points (actual − predicted)'
      : normMode === 'suite_pct_error'
      ? '% error (100 × (actual − predicted) / predicted)'
      : 'MASE-scaled error (residual / training naive scale)';

  const byHorizon: HorizonResidualSummary[] = [];
  for (let h = 1; h <= maxH; h += 1) {
    const hRows = modelRows.filter((r) => r.horizon === h);
    const vals = hRows.map(metricValue).filter((v): v is number => v !== null && Number.isFinite(v));
    const n = vals.length;
    const seriesCnt = new Set(hRows.map((r) => r.seriesId)).size;
    const sorted = [...vals].sort((a, b) => a - b);
    const quantileSupported = n >= MIN_SAMPLE_FOR_P10_P90;

    byHorizon.push({
      horizon: h,
      modelId,
      normalizationMode: normMode,
      unitLabel,
      sampleSize: n,
      distinctSeriesCount: seriesCnt,
      quantileSupported,
      quantileStatusReason: quantileSupported
        ? `n=${n} >= ${MIN_SAMPLE_FOR_P10_P90}: empirical P10/P50/P90 supported (finite-sample descriptive quantiles only — NOT guaranteed 80% future coverage).`
        : `n=${n} < ${MIN_SAMPLE_FOR_P10_P90}: insufficient residual count for stable P10/P90 tail quantiles; displaying observed min/median/max only.`,
      min: n > 0 ? roundTo(sorted[0], 3) : null,
      max: n > 0 ? roundTo(sorted[n - 1], 3) : null,
      mean: n > 0 ? roundTo(vals.reduce((s, v) => s + v, 0) / n, 3) : null,
      median: computeLinearQuantile(sorted, 0.5),
      rmse: n > 0 ? roundTo(Math.sqrt(vals.reduce((s, v) => s + v * v, 0) / n), 3) : null,
      p10: quantileSupported ? computeLinearQuantile(sorted, 0.1) : null,
      p50: quantileSupported ? computeLinearQuantile(sorted, 0.5) : null,
      p90: quantileSupported ? computeLinearQuantile(sorted, 0.9) : null,
    });
  }

  return {
    data: {
      modelId,
      normalizationMode: normMode,
      unitLabel,
      totalSampleSize: modelRows.length,
      distinctSeriesCount: distinctSeries.size,
      byHorizon,
      residuals: modelRows,
      methodologyNotes: [
        `Residuals derive strictly from expanding-origin out-of-sample CV predictions (origins 2019–2024 targeting 2020–2025).`,
        normMode === 'none_single_series'
          ? 'Single-series unpooled index-point residuals; no cross-jurisdiction pooling applied.'
          : `Cross-series pooled residuals explicitly normalized via '${normMode}' (${unitLabel}); jurisdictions remain correlated during common shocks.`,
        `Minimum residual threshold n=${MIN_SAMPLE_FOR_P10_P90} enforced before computing P10/P50/P90 quantiles.`,
      ],
    },
    unit: unitLabel,
    provenance: {
      module: 'forecastingEngine.analyzeHorizonResiduals',
      version: FORECASTING_ENGINE_VERSION,
      dataNature: 'Forecast',
      sources: Array.from(new Set(modelRows.map((r) => r.indicatorName))),
      assumptions: [
        'Residual distributions summarize historical 2020–2025 forecast errors for h=1..3; no out-of-sample residuals exist for h=4..5.',
        'P10/P90 percentiles do not imply calibrated 80% coverage under small samples (n=11) or structural breaks.',
      ],
    },
    missingness: {
      totalRecords: modelRows.length,
      includedRecords: modelRows.filter((r) => metricValue(r) !== null).length,
      missingOrExcludedRecords: modelRows.filter((r) => metricValue(r) === null).length,
    },
  };
}

/**
 * Evaluates observed historical interval coverage using strictly causal prior residuals:
 * fold i at origin O uses ONLY prior folds whose targetYear <= O (and never its own residual).
 * Note: causal backtesting does NOT guarantee residual independence, exchangeability,
 * or future calibration under structural breaks.
 */
export function evaluateEmpiricalIntervalCoverage(
  reports: readonly SeriesBacktestReport[],
  modelId: ForecastModelId,
  mode: UncertaintyDisplayMode
): EmpiricalCoverageResult {
  const allResiduals = extractOutOfSampleResiduals(reports, modelId);

  const horizonMap = new Map<
    number,
    { total: number; evaluable: number; hits: number; zeroPrior: number; insufficientPrior: number }
  >();
  for (const h of [1, 2, 3]) {
    horizonMap.set(h, { total: 0, evaluable: 0, hits: 0, zeroPrior: 0, insufficientPrior: 0 });
  }

  const seriesMap = new Map<string, SeriesCoverageSummary>();
  const jurisdictionMap = new Map<
    string,
    {
      countryCode: string;
      countryLabel: string;
      seriesIds: Set<string>;
      totalFolds: number;
      evaluableFolds: number;
      hits: number;
      excludedInsufficientPrior: number;
      excludedUnavailableHorizon: number;
      horizons: Map<
        number,
        { total: number; evaluable: number; hits: number; zeroPrior: number; insufficientPrior: number }
      >;
    }
  >();

  for (const rep of reports) {
    seriesMap.set(rep.seriesId, {
      seriesId: rep.seriesId,
      countryCode: rep.countryCode,
      indicatorName: rep.indicatorName,
      totalFolds: 0,
      evaluableFolds: 0,
      hits: 0,
      coveragePct: null,
      excludedInsufficientPrior: 0,
    });
    if (!jurisdictionMap.has(rep.countryCode)) {
      const hInit = new Map<
        number,
        { total: number; evaluable: number; hits: number; zeroPrior: number; insufficientPrior: number }
      >();
      for (const h of [1, 2, 3]) {
        hInit.set(h, { total: 0, evaluable: 0, hits: 0, zeroPrior: 0, insufficientPrior: 0 });
      }
      jurisdictionMap.set(rep.countryCode, {
        countryCode: rep.countryCode,
        countryLabel: rep.countryLabel,
        seriesIds: new Set<string>(),
        totalFolds: 0,
        evaluableFolds: 0,
        hits: 0,
        excludedInsufficientPrior: 0,
        excludedUnavailableHorizon: 0,
        horizons: hInit,
      });
    }
    jurisdictionMap.get(rep.countryCode)!.seriesIds.add(rep.seriesId);
  }

  let evaluable = 0;
  let skippedTotal = 0;
  let zeroPriorTotal = 0;
  let hits = 0;

  for (const r of allResiduals) {
    if (!horizonMap.has(r.horizon)) {
      horizonMap.set(r.horizon, { total: 0, evaluable: 0, hits: 0, zeroPrior: 0, insufficientPrior: 0 });
    }
    const hBucket = horizonMap.get(r.horizon)!;
    hBucket.total += 1;

    const sBucket = seriesMap.get(r.seriesId);
    if (sBucket) sBucket.totalFolds += 1;

    const jBucket = jurisdictionMap.get(r.countryCode);
    let jHBucket:
      | { total: number; evaluable: number; hits: number; zeroPrior: number; insufficientPrior: number }
      | undefined;
    if (jBucket) {
      jBucket.totalFolds += 1;
      if (!jBucket.horizons.has(r.horizon)) {
        jBucket.horizons.set(r.horizon, { total: 0, evaluable: 0, hits: 0, zeroPrior: 0, insufficientPrior: 0 });
      }
      jHBucket = jBucket.horizons.get(r.horizon)!;
      jHBucket.total += 1;
    }

    // Strictly causal prior selection: p.targetYear <= r.originYear implies p.targetYear < r.targetYear
    const priorPool =
      mode === 'empirical_suite_pct_p10_p90'
        ? allResiduals.filter(
            (p) => p.horizon === r.horizon && p.targetYear <= r.originYear && p.pctResidual !== null
          )
        : allResiduals.filter(
            (p) =>
              p.seriesId === r.seriesId &&
              p.horizon === r.horizon &&
              p.targetYear <= r.originYear
          );

    const minRequired = mode === 'empirical_suite_pct_p10_p90' ? MIN_SAMPLE_FOR_P10_P90 : 2;

    if (priorPool.length < minRequired) {
      skippedTotal += 1;
      hBucket.insufficientPrior += 1;
      if (jBucket) jBucket.excludedInsufficientPrior += 1;
      if (jHBucket) jHBucket.insufficientPrior += 1;
      if (priorPool.length === 0) {
        zeroPriorTotal += 1;
        hBucket.zeroPrior += 1;
        if (jBucket) jBucket.excludedUnavailableHorizon += 1;
        if (jHBucket) jHBucket.zeroPrior += 1;
      }
      if (sBucket) sBucket.excludedInsufficientPrior += 1;
      continue;
    }

    let lo: number;
    let hi: number;
    if (mode === 'heuristic_spread') {
      const priorRmse = Math.sqrt(
        priorPool.reduce((s, p) => s + p.residual * p.residual, 0) / priorPool.length
      );
      const halfWidth = 1.2816 * Math.max(priorRmse, 0.5);
      lo = r.predicted - halfWidth;
      hi = r.predicted + halfWidth;
    } else if (mode === 'empirical_single_minmax') {
      const vals = priorPool.map((p) => p.residual);
      lo = r.predicted + Math.min(...vals);
      hi = r.predicted + Math.max(...vals);
    } else {
      const priorPct = priorPool.map((p) => p.pctResidual as number);
      const p10 = computeLinearQuantile(priorPct, 0.1)!;
      const p90 = computeLinearQuantile(priorPct, 0.9)!;
      lo = r.predicted * (1 + p10 / 100);
      hi = r.predicted * (1 + p90 / 100);
    }

    evaluable += 1;
    hBucket.evaluable += 1;
    if (sBucket) sBucket.evaluableFolds += 1;
    if (jBucket) jBucket.evaluableFolds += 1;
    if (jHBucket) jHBucket.evaluable += 1;

    if (r.actual >= lo && r.actual <= hi) {
      hits += 1;
      hBucket.hits += 1;
      if (sBucket) sBucket.hits += 1;
      if (jBucket) jBucket.hits += 1;
      if (jHBucket) jHBucket.hits += 1;
    }
  }

  const byHorizon: HorizonCoverageBreakdown[] = Array.from(horizonMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([horizon, b]) => ({
      horizon,
      totalFolds: b.total,
      evaluableFolds: b.evaluable,
      hits: b.hits,
      coveragePct: b.evaluable > 0 ? roundTo((100 * b.hits) / b.evaluable, 1) : null,
      excludedInsufficientPrior: b.insufficientPrior,
      excludedUnavailableHorizon: b.zeroPrior,
    }));

  const bySeries: SeriesCoverageSummary[] = Array.from(seriesMap.values()).map((s) => ({
    ...s,
    coveragePct: s.evaluableFolds > 0 ? roundTo((100 * s.hits) / s.evaluableFolds, 1) : null,
  }));

  const byJurisdiction: JurisdictionCoverageSummary[] = Array.from(jurisdictionMap.values())
    .sort((a, b) => a.countryCode.localeCompare(b.countryCode))
    .map((j) => {
      const jHorizons = Array.from(j.horizons.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([horizon, hb]) => ({
          horizon,
          totalFolds: hb.total,
          evaluableFolds: hb.evaluable,
          hits: hb.hits,
          coveragePct: hb.evaluable > 0 ? roundTo((100 * hb.hits) / hb.evaluable, 1) : null,
          excludedInsufficientPrior: hb.insufficientPrior,
          excludedUnavailableHorizon: hb.zeroPrior,
          smallSampleFlag: hb.evaluable < MIN_COVERAGE_EVAL_SAMPLE,
        }));
      const smallHorizons = jHorizons.filter((hb) => hb.smallSampleFlag).map((hb) => `h=${hb.horizon}(n=${hb.evaluableFolds})`);
      const overallSmall = j.evaluableFolds < MIN_COVERAGE_EVAL_SAMPLE;
      const smallSampleFlag = overallSmall || smallHorizons.length > 0;
      const smallSampleNote = overallSmall
        ? `Small jurisdiction sample (n=${j.evaluableFolds} < ${MIN_COVERAGE_EVAL_SAMPLE}); avoid strong empirical coverage claims.`
        : smallHorizons.length > 0
        ? `Horizon small-sample flag (${smallHorizons.join(', ')} < ${MIN_COVERAGE_EVAL_SAMPLE}); ${j.seriesIds.size} food baskets per jurisdiction are correlated under common price shocks.`
        : `All horizons n >= ${MIN_COVERAGE_EVAL_SAMPLE}; note ${j.seriesIds.size} correlated baskets within ${j.countryCode}.`;

      return {
        countryCode: j.countryCode,
        countryLabel: j.countryLabel,
        seriesCount: j.seriesIds.size,
        totalFolds: j.totalFolds,
        evaluableFolds: j.evaluableFolds,
        hits: j.hits,
        coveragePct: j.evaluableFolds > 0 ? roundTo((100 * j.hits) / j.evaluableFolds, 1) : null,
        excludedInsufficientPrior: j.excludedInsufficientPrior,
        excludedUnavailableHorizon: j.excludedUnavailableHorizon,
        smallSampleFlag,
        smallSampleNote,
        byHorizon: jHorizons,
      };
    });

  const methodologyNote =
    mode === 'heuristic_spread'
      ? `Observed historical coverage of heuristic parametric spread (±1.2816 × causal RMSE): ${hits}/${evaluable} eligible folds (${allResiduals.length} total; ${skippedTotal} excluded with <2 prior horizon residuals, incl. ${zeroPriorTotal} with 0 prior targets <= originYear).`
      : mode === 'empirical_single_minmax'
      ? `Observed historical coverage of empirical residual min–max envelope: ${hits}/${evaluable} eligible folds (${allResiduals.length} total; ${skippedTotal} excluded with <2 prior same-series horizon residuals, incl. ${zeroPriorTotal} with 0 prior targets <= originYear).`
      : `Observed historical coverage of empirical residual quantile interval (suite %-normalized P10–P90): ${hits}/${evaluable} eligible folds (${allResiduals.length} total; ${skippedTotal} excluded with <${MIN_SAMPLE_FOR_P10_P90} prior horizon residuals). Not a calibrated 80% prediction interval; causal backtesting does not guarantee independence, exchangeability, or future calibration.`;

  return {
    mode,
    modelId,
    totalOutOfSampleFolds: allResiduals.length,
    evaluableFolds: evaluable,
    skippedInsufficientPrior: skippedTotal,
    excludedUnavailableHorizon: zeroPriorTotal,
    hits,
    empiricalCoveragePct: evaluable > 0 ? roundTo((100 * hits) / evaluable, 1) : null,
    byHorizon,
    bySeries,
    byJurisdiction,
    methodologyNote,
  };
}

export function evaluateCoverageMatrixAllModels(
  reports: readonly SeriesBacktestReport[]
): Record<ForecastModelId, Record<UncertaintyDisplayMode, EmpiricalCoverageResult>> {
  const modes: UncertaintyDisplayMode[] = [
    'empirical_single_minmax',
    'empirical_suite_pct_p10_p90',
    'heuristic_spread',
  ];
  const out = {} as Record<ForecastModelId, Record<UncertaintyDisplayMode, EmpiricalCoverageResult>>;
  for (const mId of ALL_FORECAST_MODELS) {
    out[mId] = {} as Record<UncertaintyDisplayMode, EmpiricalCoverageResult>;
    for (const mode of modes) {
      out[mId][mode] = evaluateEmpiricalIntervalCoverage(reports, mId, mode);
    }
  }
  return out;
}

/**
 * Builds the combined historical, leak-free backtest, and selectable-horizon forecast series
 * with honest uncertainty bands tailored to sample size and horizon limits.
 */
export function buildForecastUncertaintySeries(params: {
  input: ObservedTimeSeriesInput;
  selectedModel: ForecastModelId;
  horizonEndYear: number;
  uncertaintyMode: UncertaintyDisplayMode;
  singleSeriesReport: SeriesBacktestReport;
  singleHorizonSummaries: readonly HorizonResidualSummary[];
  suitePctHorizonSummaries: readonly HorizonResidualSummary[];
}): AnalyticalResult<UncertaintySeriesRow[]> {
  const {
    input,
    selectedModel,
    horizonEndYear,
    uncertaintyMode,
    singleSeriesReport,
    singleHorizonSummaries,
    suitePctHorizonSummaries,
  } = params;

  const clampedEndYear = Math.max(2026, Math.min(2030, Math.round(horizonEndYear)));
  const ordered = input.years
    .map((year, idx) => ({ year, value: input.values[idx] }))
    .filter((pt) => Number.isFinite(pt.year) && Number.isFinite(pt.value))
    .sort((a, b) => a.year - b.year);

  const lastObsYear = ordered[ordered.length - 1]?.year ?? 2025;
  const maxFutureHorizon = Math.max(1, clampedEndYear - lastObsYear);
  const futurePoints = generateForwardProjections(input, maxFutureHorizon);

  // Leak-free 2015–2022 training cutoff for fixed 2023–2025 historical backtest visualization
  const cutoffIdx = ordered.findIndex((p) => p.year === 2022);
  const trainVals =
    cutoffIdx >= 4 ? ordered.slice(0, cutoffIdx + 1).map((p) => p.value) : ordered.slice(0, 8).map((p) => p.value);
  const dmpTr = fitHoltEts(trainVals, 0.55, 0.35, 0.85);
  const etsTr = fitHoltEts(trainVals, 0.55, 0.35, 1.0);
  const ridgeTr = fitRidgeTrend(trainVals, 1.5);

  const predictFromTrain = (h: number, targetIdx: number): number => {
    switch (selectedModel) {
      case 'damped_ets':
        return roundTo(forecastHoltEts(dmpTr.level, dmpTr.trend, h, 0.85), 2);
      case 'holt_ets':
        return roundTo(forecastHoltEts(etsTr.level, etsTr.trend, h, 1.0), 2);
      case 'ridge_trend':
        return roundTo(ridgeTr.intercept + ridgeTr.slope * targetIdx, 2);
      case 'naive_drift':
        return roundTo(forecastNaiveDrift(trainVals, h), 2);
      case 'naive_random_walk':
        return roundTo(forecastNaiveRandomWalk(trainVals), 2);
    }
  };

  // Compute in-sample naive diff scale + empirical h=1..3 RMSE for heuristic spread
  const obsVals = ordered.map((p) => p.value);
  const absDiffs: number[] = [];
  for (let i = 1; i < obsVals.length; i += 1) {
    absDiffs.push(Math.abs(obsVals[i] - obsVals[i - 1]));
  }
  const meanStep = absDiffs.length > 0 ? absDiffs.reduce((s, d) => s + d, 0) / absDiffs.length : 0.5;
  const cvRmse = singleSeriesReport.overallByModel[selectedModel].rmse ?? meanStep;
  const heuristicSigma = Math.max(meanStep, cvRmse * 0.55, 0.5);

  const rows: UncertaintySeriesRow[] = [];

  for (let i = 0; i < ordered.length; i += 1) {
    const { year, value } = ordered[i];
    if (year <= 2022) {
      rows.push({
        year,
        horizon: null,
        role: 'OBSERVED_HISTORY',
        actualValue: value,
        pointPrediction: null,
        lowerBound: null,
        upperBound: null,
        bandType: 'none',
        residualSampleSize: 0,
        bandSupported: false,
        intervalStatusNote: 'Observed training history (2015–2022).',
      });
    } else {
      const h = year - 2022;
      const pointPrediction = predictFromTrain(h, i);
      rows.push({
        year,
        horizon: h,
        role: 'HISTORICAL_BACKTEST',
        actualValue: value,
        pointPrediction,
        lowerBound: null,
        upperBound: null,
        bandType: 'none',
        residualSampleSize: 0,
        bandSupported: false,
        intervalStatusNote: `Out-of-sample 2015–2022 fixed-origin test at h=${h}; no future leakage.`,
      });
    }
  }

  for (const fp of futurePoints) {
    const point = fp.predictions[selectedModel];
    const h = fp.horizon;
    const singleH = singleHorizonSummaries.find((s) => s.horizon === h);
    const suiteH = suitePctHorizonSummaries.find((s) => s.horizon === h);

    if (uncertaintyMode === 'empirical_single_minmax') {
      if (singleH && singleH.sampleSize > 0 && singleH.min !== null && singleH.max !== null) {
        rows.push({
          year: fp.year,
          horizon: h,
          role: 'FUTURE_FORECAST',
          actualValue: null,
          pointPrediction: point,
          lowerBound: roundTo(point + singleH.min, 2),
          upperBound: roundTo(point + singleH.max, 2),
          bandType: 'empirical_residual_minmax',
          residualSampleSize: singleH.sampleSize,
          bandSupported: true,
          intervalStatusNote: `Observed CV residual min–max envelope (n=${singleH.sampleSize} at h=${h}); P10/P90 suppressed (n < ${MIN_SAMPLE_FOR_P10_P90}).`,
        });
      } else {
        rows.push({
          year: fp.year,
          horizon: h,
          role: 'FUTURE_FORECAST',
          actualValue: null,
          pointPrediction: point,
          lowerBound: null,
          upperBound: null,
          bandType: 'none',
          residualSampleSize: 0,
          bandSupported: false,
          intervalStatusNote: `No empirical out-of-sample residuals available at horizon h=${h} (max tested CV horizon is 3).`,
        });
      }
    } else if (uncertaintyMode === 'empirical_suite_pct_p10_p90') {
      if (suiteH && suiteH.quantileSupported && suiteH.p10 !== null && suiteH.p90 !== null) {
        rows.push({
          year: fp.year,
          horizon: h,
          role: 'FUTURE_FORECAST',
          actualValue: null,
          pointPrediction: point,
          lowerBound: applyPctResidualOffset(point, suiteH.p10),
          upperBound: applyPctResidualOffset(point, suiteH.p90),
          bandType: 'empirical_suite_pct_p10_p90',
          residualSampleSize: suiteH.sampleSize,
          bandSupported: true,
          intervalStatusNote: `Historical empirical residual quantile interval (suite %-norm P10/P90 via point*(1+q/100), n=${suiteH.sampleSize} at h=${h}); NOT a calibrated 80% prediction interval.`,
        });
      } else {
        rows.push({
          year: fp.year,
          horizon: h,
          role: 'FUTURE_FORECAST',
          actualValue: null,
          pointPrediction: point,
          lowerBound: null,
          upperBound: null,
          bandType: 'none',
          residualSampleSize: suiteH?.sampleSize ?? 0,
          bandSupported: false,
          intervalStatusNote: `Historical empirical residual quantile interval unavailable at h=${h} (max evaluated CV horizon = 3; no observed h=${h} residuals exist).`,
        });
      }
    } else {
      const half = 1.2816 * heuristicSigma * Math.sqrt(h);
      rows.push({
        year: fp.year,
        horizon: h,
        role: 'FUTURE_FORECAST',
        actualValue: null,
        pointPrediction: point,
        lowerBound: roundTo(point - half, 2),
        upperBound: roundTo(point + half, 2),
        bandType: 'heuristic_sigma_spread',
        residualSampleSize: singleSeriesReport.folds.length,
        bandSupported: true,
        intervalStatusNote: `Heuristic parametric spread (±1.2816 × σ × √h, σ=${roundTo(heuristicSigma, 2)}) — indicative parametric scaling only, NOT an empirical residual interval or calibrated probability bound.`,
      });
    }
  }

  return {
    data: rows,
    unit: 'HICP Index (2015 = 100)',
    provenance: {
      module: 'forecastingEngine.buildForecastUncertaintySeries',
      version: FORECASTING_ENGINE_VERSION,
      dataNature: 'Forecast',
      sources: [input.dataSource],
      assumptions: [
        `Horizon capped at 2026–${clampedEndYear}; uncertainty mode='${uncertaintyMode}'.`,
        'Empirical CV residuals exist strictly for h=1..3 (origins 2019–2024); horizons h=4..5 carry no observed empirical residual envelope.',
        'Historical residual offsets (point + residual or point*(1+pct/100)) represent empirical error adjustments and may sit above point forecasts when prior residuals are uniformly positive.',
      ],
    },
    missingness: {
      totalRecords: rows.length,
      includedRecords: rows.length,
      missingOrExcludedRecords: input.values.length - ordered.length,
    },
  };
}

export function serializeForecastUncertaintyCsv(params: {
  seriesId: string;
  countryLabel: string;
  indicatorName: string;
  modelId: ForecastModelId;
  uncertaintyMode: UncertaintyDisplayMode;
  coverage: EmpiricalCoverageResult;
  rows: readonly UncertaintySeriesRow[];
}): string {
  const esc = (v: string | number | boolean | null | undefined): string => {
    const s = v === null || v === undefined ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const jurisdictionLines = params.coverage.byJurisdiction.map((j) => {
    const hSummary = j.byHorizon
      .map((hb) => `h=${hb.horizon}: ${hb.hits}/${hb.evaluableFolds} (${hb.coveragePct ?? 'N/A'}%)`)
      .join(', ');
    return `# Jurisdiction Coverage (${j.countryCode}, series=${j.seriesCount}, n=${j.evaluableFolds}): ${j.hits}/${j.evaluableFolds} (${j.coveragePct ?? 'N/A'}%) | ${hSummary} | Flag=${j.smallSampleFlag}: ${j.smallSampleNote}`;
  });
  const lines: string[] = [
    `# DietShift Atlas — Forecast & Uncertainty Export (Engine v${FORECASTING_ENGINE_VERSION})`,
    `# Series: ${params.seriesId} | Jurisdiction: ${params.countryLabel} | Indicator: ${params.indicatorName}`,
    `# Selected Model: ${FORECAST_MODEL_LABELS[params.modelId]} | Uncertainty Mode: ${params.uncertaintyMode}`,
    `# pctResidual Definition: 100*(actual-predicted)/predicted (denominator=predicted); inverse mapping: point*(1+quantile/100)`,
    `# Observed Historical Interval Coverage: ${params.coverage.hits}/${params.coverage.evaluableFolds} (${params.coverage.empiricalCoveragePct ?? 'N/A'}%) | Excluded insufficient prior: ${params.coverage.skippedInsufficientPrior} (incl. ${params.coverage.excludedUnavailableHorizon} zero-prior horizon folds) | Note: ${params.coverage.methodologyNote}`,
    ...jurisdictionLines,
    `# Caveat: Short annual history (n=11, 2015-2025); MASE > 1 indicates errors exceed in-sample 1-step naive scale. Nominal P10-P90 residual quantile intervals are NOT calibrated 80% prediction intervals; causal backtesting does NOT guarantee residual independence, exchangeability, or future calibration under structural breaks.`,
    [
      'year',
      'horizon',
      'role',
      'actual_value',
      'point_prediction',
      'lower_bound',
      'upper_bound',
      'band_type',
      'residual_sample_size',
      'band_supported',
      'interval_status_note',
    ].join(','),
  ];
  for (const r of params.rows) {
    lines.push(
      [
        r.year,
        r.horizon ?? '',
        r.role,
        r.actualValue ?? '',
        r.pointPrediction ?? '',
        r.lowerBound ?? '',
        r.upperBound ?? '',
        r.bandType,
        r.residualSampleSize,
        r.bandSupported,
        r.intervalStatusNote,
      ]
        .map(esc)
        .join(',')
    );
  }
  return lines.join('\n');
}

