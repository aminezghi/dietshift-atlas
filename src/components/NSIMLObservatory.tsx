import { useEffect, useMemo, useState } from 'react';
import ReactECharts from './ThemedEChart';
import { fetchCachedJson } from '../services/dataProvider';
import { downloadCsvContent, downloadJsonPayload } from '../utils/exportDownload';
import { DataNatureBadge } from './DataNatureBadge';
import { ClassificationInspector } from './ClassificationInspector';
import {
  ALL_FORECAST_MODELS,
  FORECAST_MODEL_LABELS,
  FORECASTING_ENGINE_VERSION,
  type ForecastModelId,
  MIN_COVERAGE_EVAL_SAMPLE,
  MIN_SAMPLE_FOR_P10_P90,
  type ObservedTimeSeriesInput,
  type UncertaintyDisplayMode,
  analyzeHorizonResiduals,
  buildForecastUncertaintySeries,
  evaluateCoverageMatrixAllModels,
  extractOutOfSampleResiduals,
  runExpandingOriginBacktest,
  serializeForecastUncertaintyCsv,
  summarizeForecastSuitePerformance,
} from '../analytics/forecastingEngine';
import {
  AlertTriangle,
  Award,
  Building2,
  Code2,
  Cpu,
  Download,
  ExternalLink,
  GitBranch,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

interface NSIRecord {
  record_id: string;
  country_code: string;
  country_name: string;
  nsi_agency: string;
  nsi_api_url: string;
  region_code: string;
  region_name: string;
  income_quintile: string;
  quintile_num: number;
  food_budget_share_pct: number;
  healthy_cpi_index: number;
  upf_cpi_index: number;
  price_wedge_healthy_minus_upf: number;
  nova4_energy_share_pct: number;
  plant_protein_share_pct: number;
  diet_adherence_score: number;
  obesity_bmi30_pct: number;
  out_of_home_kcal_pct: number;
  daily_carbon_kg: number;
  double_burden_index: number;
  pca1: number;
  pca2: number;
  cluster_label: string;
}

interface StatisticalForecastRecord {
  series_id: string;
  country_code: string;
  country_label: string;
  indicator_name: string;
  year: number;
  split_role: string;
  actual_value: number | null;
  damped_ets_p50: number;
  damped_ets_p10: number;
  damped_ets_p90: number;
  ets_baseline: number;
  ridge_linear_baseline: number;
  naive_drift_baseline: number;
  naive_rw_baseline?: number;
  damped_ets_val_mae: number;
  ets_val_mae: number;
  ridge_val_mae: number;
  naive_val_mae: number;
  damped_ets_val_rmse: number;
  ets_val_rmse: number;
  ridge_val_rmse: number;
  naive_val_rmse: number;
  data_source: string;
}

interface RosettaRow {
  crosswalk_id: string;
  ecoicop_code: string;
  ecoicop_label: string;
  foodex2_code: string;
  foodex2_level1: string;
  foodex2_level2: string;
  agb_code: string;
  agb_lci_name: string;
  nova_group: number;
  allocation_weight: number;
  edible_yield_factor: number;
  mean_co2_kg: number;
  mean_water_m3: number;
  eat_lancet_group: string;
  mapping_type?: string;
  confidence?: number;
  explanation?: string;
  mapping_version?: string;
}

/* Hallmark Almanac restrained palette: magenta accent, slate-ink, deep sea-teal, muted ochre */
const ARCHETYPE_COLORS: Record<string, string> = {
  'Archetype A: Mediterranean Whole-Food & High Guideline Adherence': '#163d4a',
  'Archetype B: Inflation-Squeezed Low-Income (High Food Budget Share)': '#8a1253',
  'Archetype C: Affluent Plant-Shifting & Low Engel Burden': '#3f6f7d',
  'Archetype D: High-NOVA 4 Ultra-Processed & Cardiometabolic Risk': '#6b4c1b',
};

const QUINTILE_COLORS: Record<number, string> = {
  1: '#8a1253',
  2: '#a84478',
  3: '#525e70',
  4: '#3f6f7d',
  5: '#163d4a',
};

const NSI_PROVENANCE_META: Record<
  string,
  {
    agency: string;
    operation: string;
    apiUrl: string;
    tablesUsed: string;
    hicpAnchor: string;
  }
> = {
  ES: {
    agency: 'INE Spain — Instituto Nacional de Estadística (INEbase / WSTempus REST API)',
    operation: 'Operation 314 (Encuesta de Presupuestos Familiares EPF) + Operation 25 (IPC) + Operation 233 (ENSE)',
    apiUrl: 'https://www.ine.es/dyngs/INEbase/en/listaoperaciones.htm',
    tablesUsed:
      'Live WSTempus Table 75413 (Quintile food expenditure Q1=19.61% to Q5=12.34%) & Table 73991 (17 Comunidades Autónomas)',
    hicpAnchor: 'Eurostat prc_hicp_aind (ES CP0111–CP0119, 2015–2025) + Eurostat EHIS hlth_ehis_bm1i / hlth_ehis_fv3i',
  },
  IT: {
    agency: 'ISTAT Italy — Istituto Nazionale di Statistica (I.Stat / EsploraDati SDMX)',
    operation: 'Indagine sulle Spese delle Famiglie + Indagine Multiscopo Aspetti della Vita Quotidiana',
    apiUrl: 'https://www.istat.it/en/data/databases/',
    tablesUsed: 'ISTAT Household Expenditure Quintiles (Nord-Ovest, Nord-Est, Centro, Sud, Isole) + Eurostat HBS',
    hicpAnchor: 'Eurostat prc_hicp_aind (IT CP0111–CP0119, 2015–2025) + Eurostat EHIS hlth_ehis_bm1i / hlth_ehis_fv3i',
  },
  NL: {
    agency: 'CBS Netherlands & RIVM — Centraal Bureau voor de Statistiek (StatLine OData v4)',
    operation: 'CBS Budgetonderzoek + RIVM Voedselconsumptiepeiling (Dutch National Food Consumption Survey VCP)',
    apiUrl: 'https://opendata.cbs.nl/',
    tablesUsed: 'Eurostat HBS hbs_str_t223 (NL Q1=11.8% to Q5=11.4%) + RIVM VCP plant-protein share',
    hicpAnchor: 'Eurostat prc_hicp_aind (NL CP0111–CP0119, 2015–2025) + Eurostat EHIS hlth_ehis_bm1i / hlth_ehis_fv3i',
  },
  FR: {
    agency: 'INSEE France & ANSES — Institut National de la Statistique et des Études Économiques',
    operation: 'Enquête Budget de Famille (BdF) + Étude Individuelle Nationale des Consommations Alimentaires (INCA3)',
    apiUrl: 'https://www.insee.fr/en/statistiques',
    tablesUsed: 'Eurostat HBS hbs_str_t223 (FR Q1=14.7% to Q5=12.8%) + ANSES INCA3 NOVA 4 & Agribalyse 3.1',
    hicpAnchor: 'Eurostat prc_hicp_aind (FR CP0111–CP0119, 2015–2025) + Eurostat EHIS hlth_ehis_bm1i / hlth_ehis_fv3i',
  },
  DE: {
    agency: 'Destatis Germany — Statistisches Bundesamt (GENESIS-Online)',
    operation: 'Einkommens- und Verbrauchsstichprobe (EVS) + Laufende Wirtschaftsrechnungen (LWR) + NVS II',
    apiUrl: 'https://www-genesis.destatis.de/',
    tablesUsed: 'Eurostat HBS hbs_str_t223 (DE Q1=14.0% to Q5=9.8%) + Destatis EVS regional weights',
    hicpAnchor: 'Eurostat prc_hicp_aind (DE CP0111–CP0119, 2015–2025) + Eurostat EHIS hlth_ehis_bm1i / hlth_ehis_fv3i',
  },
  GBR: {
    agency: 'ONS United Kingdom & DEFRA — Office for National Statistics',
    operation: 'Living Costs and Food Survey (LCFS / Family Food) + National Diet and Nutrition Survey (NDNS)',
    apiUrl: 'https://www.ons.gov.uk/economy/inflationandpriceindices',
    tablesUsed: 'ONS Family Food Income Deciles aggregated to Quintiles (Q1=15.4% to Q5=8.1%) + NDNS NOVA 4',
    hicpAnchor: 'ONS Dataset MM23 Consumer Price Inflation (CPIH Food sub-indices CP0111–CP0119, 2015–2025)',
  },
  EU27_2020: {
    agency: 'Eurostat — Statistical Office of the European Union (Dissemination API)',
    operation: 'Harmonised Index of Consumer Prices (HICP) + Household Budget Survey (HBS) + European Health Interview Survey (EHIS)',
    apiUrl: 'https://ec.europa.eu/eurostat/data/database',
    tablesUsed: 'Eurostat hbs_str_t223 (EU-27 Q1=18.3% to Q5=14.4%) + hlth_ehis_bm1i + hlth_ehis_fv3i',
    hicpAnchor: 'Eurostat prc_hicp_aind (EU27_2020 CP0111–CP0119, 2015–2025)',
  },
};

export function NSIMLObservatory({
  selectedCountry,
  onSelectCountry,
}: {
  selectedCountry: string;
  onSelectCountry?: (code: string) => void;
}) {
  const [nsiData, setNsiData] = useState<{
    silhouette_scores: Record<string, number>;
    pca_explained_variance_pct?: number[];
    optimal_k: number;
    rows: NSIRecord[];
  } | null>(null);
  const [forecastData, setForecastData] = useState<StatisticalForecastRecord[]>([]);
  const [rosettaData, setRosettaData] = useState<RosettaRow[]>([]);

  const [activeSubTab, setActiveSubTab] = useState<'forecasts' | 'clustering' | 'nsi_equity' | 'rosetta'>('forecasts');
  const [pcaHueMode, setPcaHueMode] = useState<'cluster' | 'quintile'>('cluster');
  const [selectedIndicator, setSelectedIndicator] = useState<string>('Healthy Whole-Food CPI Basket (2015=100)');
  const [selectedModel, setSelectedModel] = useState<ForecastModelId>('naive_drift');
  const [horizonEndYear, setHorizonEndYear] = useState<number>(2030);
  const [uncertaintyMode, setUncertaintyMode] = useState<UncertaintyDisplayMode>('empirical_single_minmax');
  const [nsiCountryOverride, setNsiCountryOverride] = useState<{ forProp: string; value: string } | null>(null);
  const supportedNsiCountries = ['ES', 'IT', 'NL', 'FR', 'DE', 'GBR', 'EU27_2020'];
  const activeOverride = nsiCountryOverride?.forProp === selectedCountry ? nsiCountryOverride.value : null;
  const isNsiFallback = !activeOverride && !supportedNsiCountries.includes(selectedCountry);
  const nsiCountryFilter =
    activeOverride ?? (supportedNsiCountries.includes(selectedCountry) ? selectedCountry : 'IT');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState<number>(0);
  const [showMethodModal, setShowMethodModal] = useState<boolean>(false);

  const handleCountryFilterChange = (newCode: string) => {
    setNsiCountryOverride({ forProp: selectedCountry, value: newCode });
    if (onSelectCountry && ['ES', 'IT', 'NL', 'FR', 'DE', 'GBR'].includes(newCode)) {
      onSelectCountry(newCode);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const forceRetry = retryTick > 0;
    Promise.all([
      fetchCachedJson<{
        silhouette_scores: Record<string, number>;
        pca_explained_variance_pct?: number[];
        optimal_k: number;
        rows: NSIRecord[];
      }>('data/nsi_subnational_quintiles.json', { forceRetry }),
      fetchCachedJson<StatisticalForecastRecord[]>('data/statistical_price_forecasts.json', { forceRetry }),
      fetchCachedJson<RosettaRow[]>('data/crosswalk_rosetta.json', { forceRetry }),
    ])
      .then(([nsi, fc, ros]) => {
        if (!cancelled) {
          setNsiData(nsi);
          setForecastData(fc);
          setRosettaData(ros);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  const activeForecastSeries = useMemo(() => {
    return forecastData
      .filter((r) => r.country_code === nsiCountryFilter && r.indicator_name === selectedIndicator)
      .sort((a, b) => a.year - b.year);
  }, [forecastData, nsiCountryFilter, selectedIndicator]);

  const activeInput = useMemo<ObservedTimeSeriesInput | null>(() => {
    const obs = activeForecastSeries.filter((r) => r.actual_value !== null);
    if (obs.length === 0) return null;
    return {
      seriesId: obs[0].series_id,
      countryCode: obs[0].country_code,
      countryLabel: obs[0].country_label,
      indicatorName: obs[0].indicator_name,
      years: obs.map((r) => r.year),
      values: obs.map((r) => r.actual_value as number),
      dataSource: obs[0].data_source,
    };
  }, [activeForecastSeries]);

  const activeBacktest = useMemo(() => {
    if (!activeInput) return null;
    return runExpandingOriginBacktest(activeInput, { minTrainLength: 5, maxHorizon: 3 });
  }, [activeInput]);

  const allBacktestReports = useMemo(() => {
    if (forecastData.length === 0) return [];
    const grouped = new Map<string, StatisticalForecastRecord[]>();
    for (const r of forecastData) {
      if (r.actual_value === null) continue;
      const key = `${r.country_code}|${r.indicator_name}`;
      const arr = grouped.get(key) ?? [];
      arr.push(r);
      grouped.set(key, arr);
    }
    return Array.from(grouped.values()).map((grp) => {
      const sorted = [...grp].sort((a, b) => a.year - b.year);
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
  }, [forecastData]);

  const suiteCvSummary = useMemo(() => {
    if (allBacktestReports.length === 0) return null;
    return summarizeForecastSuitePerformance(allBacktestReports, 3);
  }, [allBacktestReports]);

  const singleResidualReport = useMemo(() => {
    if (!activeBacktest) return null;
    const rawRes = extractOutOfSampleResiduals([activeBacktest.data], selectedModel);
    return analyzeHorizonResiduals(rawRes, selectedModel, {
      normalizationMode: 'none_single_series',
      maxHorizon: 3,
    });
  }, [activeBacktest, selectedModel]);

  const suitePctResidualReport = useMemo(() => {
    if (allBacktestReports.length === 0) return null;
    const rawRes = extractOutOfSampleResiduals(allBacktestReports, selectedModel);
    return analyzeHorizonResiduals(rawRes, selectedModel, {
      normalizationMode: 'suite_pct_error',
      maxHorizon: 3,
    });
  }, [allBacktestReports, selectedModel]);

  const fullCoverageMatrix = useMemo(() => {
    if (allBacktestReports.length === 0) return null;
    return evaluateCoverageMatrixAllModels(allBacktestReports);
  }, [allBacktestReports]);

  const coverageEvaluation = useMemo(() => {
    if (!fullCoverageMatrix) return null;
    const activeByModel = fullCoverageMatrix[selectedModel];
    return {
      activeMode: activeByModel[uncertaintyMode],
      singleMinMax: activeByModel.empirical_single_minmax,
      suitePctP10P90: activeByModel.empirical_suite_pct_p10_p90,
      heuristicSpread: activeByModel.heuristic_spread,
    };
  }, [fullCoverageMatrix, selectedModel, uncertaintyMode]);

  const uncertaintySeries = useMemo(() => {
    if (!activeInput || !activeBacktest || !singleResidualReport) return null;
    return buildForecastUncertaintySeries({
      input: activeInput,
      selectedModel,
      horizonEndYear,
      uncertaintyMode,
      singleSeriesReport: activeBacktest.data,
      singleHorizonSummaries: singleResidualReport.data.byHorizon,
      suitePctHorizonSummaries: suitePctResidualReport?.data.byHorizon ?? [],
    });
  }, [
    activeInput,
    activeBacktest,
    selectedModel,
    horizonEndYear,
    uncertaintyMode,
    singleResidualReport,
    suitePctResidualReport,
  ]);

  const handleExportForecastCsv = () => {
    if (!uncertaintySeries || !activeInput || !coverageEvaluation) return;
    const csv = serializeForecastUncertaintyCsv({
      seriesId: activeInput.seriesId,
      countryLabel: activeInput.countryLabel,
      indicatorName: activeInput.indicatorName,
      modelId: selectedModel,
      uncertaintyMode,
      coverage: coverageEvaluation.activeMode,
      rows: uncertaintySeries.data,
    });
    downloadCsvContent(
      csv,
      `dietshift_forecast_uncertainty_${activeInput.countryCode}_${selectedModel}_${horizonEndYear}.csv`
    );
  };

  const handleExportForecastJson = () => {
    if (!uncertaintySeries || !activeInput || !singleResidualReport || !coverageEvaluation) return;
    const payload = {
      engineVersion: FORECASTING_ENGINE_VERSION,
      seriesId: activeInput.seriesId,
      countryCode: activeInput.countryCode,
      countryLabel: activeInput.countryLabel,
      indicatorName: activeInput.indicatorName,
      selectedModel,
      selectedModelLabel: FORECAST_MODEL_LABELS[selectedModel],
      horizonEndYear,
      uncertaintyMode,
      shortSeriesLimitations: activeBacktest?.data.shortSeriesLimitations ?? [],
      empiricalResidualsSingleSeries: singleResidualReport.data.byHorizon,
      empiricalResidualsSuiteNormalizedPct: suitePctResidualReport?.data.byHorizon ?? [],
      causalCoverageEvaluation: coverageEvaluation,
      allModelsJurisdictionCoverage: fullCoverageMatrix,
      trajectory: uncertaintySeries.data,
      provenance: uncertaintySeries.provenance,
    };
    downloadJsonPayload(
      payload,
      `dietshift_uncertainty_dossier_${activeInput.countryCode}_${selectedModel}_${horizonEndYear}.json`
    );
  };

  const forecastChartOption = useMemo(() => {
    if (!uncertaintySeries || uncertaintySeries.data.length === 0) return {};
    const clippedParquet = activeForecastSeries.filter((r) => r.year <= horizonEndYear);
    const years = uncertaintySeries.data.map((r) => String(r.year));

    const bandUpperLabel =
      uncertaintyMode === 'empirical_single_minmax'
        ? 'Residual Envelope upper (Obs. CV max)'
        : uncertaintyMode === 'empirical_suite_pct_p10_p90'
        ? 'Residual Quantile upper (Suite %-norm P90)'
        : 'Heuristic Spread upper (+1.2816·σ·√h)';
    const bandLowerLabel =
      uncertaintyMode === 'empirical_single_minmax'
        ? 'Residual Envelope lower (Obs. CV min)'
        : uncertaintyMode === 'empirical_suite_pct_p10_p90'
        ? 'Residual Quantile lower (Suite %-norm P10)'
        : 'Heuristic Spread lower (-1.2816·σ·√h)';
    const selectedLabel = `Selected: ${FORECAST_MODEL_LABELS[selectedModel]}`;

    const futureAreaEnd = String(horizonEndYear);
    const markAreas: Array<Array<Record<string, unknown>>> = [
      [{ name: 'Backtest (2023–25, 2015–22 fit)', xAxis: '2023' }, { xAxis: '2025' }],
      [
        {
          name: `Future horizon (2026–${horizonEndYear})`,
          xAxis: '2026',
          itemStyle: { color: 'rgba(22, 61, 74, 0.08)' },
        },
        { xAxis: futureAreaEnd },
      ],
    ];

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        borderWidth: 1,
        textStyle: { color: '#111827', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' },
      },
      legend: {
        top: 0,
        itemGap: 12,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { color: '#2d3643', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        data: [
          'Observed (Eurostat / ONS)',
          `${selectedLabel} [Backtest 2023–25]`,
          `${selectedLabel} [Future Forecast]`,
          bandUpperLabel,
          bandLowerLabel,
          'Holt Linear ETS',
          'Damped ETS (φ=0.85)',
          'Ridge linear trend',
          'Drift naive baseline',
          'Random walk naive',
        ],
      },
      grid: { top: 76, right: 28, bottom: 42, left: 64 },
      xAxis: {
        type: 'category',
        data: years,
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, margin: 10 },
        axisLine: { lineStyle: { color: '#2d3643' } },
      },
      yAxis: {
        type: 'value',
        scale: true,
        name: selectedIndicator,
        nameLocation: 'middle',
        nameGap: 46,
        nameTextStyle: { color: '#3d4654', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      series: [
        {
          name: 'Observed (Eurostat / ONS)',
          type: 'line',
          symbolSize: 6,
          itemStyle: { color: '#111827' },
          lineStyle: { width: 2.3, color: '#111827' },
          data: uncertaintySeries.data.map((r) => r.actualValue),
        },
        {
          name: `${selectedLabel} [Backtest 2023–25]`,
          type: 'line',
          symbol: 'diamond',
          symbolSize: 6,
          itemStyle: { color: '#6b4c1b' },
          lineStyle: { width: 2.0, color: '#6b4c1b', type: 'dotted' },
          data: uncertaintySeries.data.map((r) => (r.role === 'HISTORICAL_BACKTEST' ? r.pointPrediction : null)),
        },
        {
          name: `${selectedLabel} [Future Forecast]`,
          type: 'line',
          symbolSize: 6,
          itemStyle: { color: '#8a1253' },
          lineStyle: { width: 2.6, color: '#8a1253', type: 'dashed' },
          data: uncertaintySeries.data.map((r) => (r.role === 'FUTURE_FORECAST' ? r.pointPrediction : null)),
          markArea: {
            itemStyle: { color: 'rgba(107, 76, 27, 0.06)' },
            label: {
              position: 'insideTop',
              distance: 8,
              color: '#2d3643',
              fontSize: 10,
              fontFamily: 'IBM Plex Mono, monospace',
              backgroundColor: 'rgba(234, 237, 242, 0.85)',
              padding: [2, 6],
              borderRadius: 2,
            },
            data: markAreas,
          },
        },
        {
          name: bandUpperLabel,
          type: 'line',
          symbol: 'circle',
          symbolSize: 4,
          itemStyle: { color: '#8a1253' },
          lineStyle: { width: 1.2, color: '#8a1253', type: 'solid' },
          areaStyle: { color: 'rgba(138, 18, 83, 0.09)' },
          data: uncertaintySeries.data.map((r) => (r.bandSupported ? r.upperBound : null)),
        },
        {
          name: bandLowerLabel,
          type: 'line',
          symbol: 'circle',
          symbolSize: 4,
          itemStyle: { color: '#8a1253' },
          lineStyle: { width: 1.2, color: '#8a1253', type: 'solid' },
          data: uncertaintySeries.data.map((r) => (r.bandSupported ? r.lowerBound : null)),
        },
        {
          name: 'Holt Linear ETS',
          type: 'line',
          symbol: 'none',
          itemStyle: { color: '#163d4a' },
          lineStyle: { width: 1.3, color: '#163d4a', opacity: 0.7 },
          data: clippedParquet.map((r) => (r.year >= 2023 ? r.ets_baseline : null)),
        },
        {
          name: 'Damped ETS (φ=0.85)',
          type: 'line',
          symbol: 'none',
          itemStyle: { color: '#a84478' },
          lineStyle: { width: 1.3, color: '#a84478', opacity: 0.7 },
          data: clippedParquet.map((r) => (r.year >= 2023 ? r.damped_ets_p50 : null)),
        },
        {
          name: 'Ridge linear trend',
          type: 'line',
          symbol: 'none',
          itemStyle: { color: '#525e70' },
          lineStyle: { width: 1.3, color: '#525e70', opacity: 0.7 },
          data: clippedParquet.map((r) => (r.year >= 2023 ? r.ridge_linear_baseline : null)),
        },
        {
          name: 'Drift naive baseline',
          type: 'line',
          symbol: 'none',
          itemStyle: { color: '#7b8696' },
          lineStyle: { width: 1.2, color: '#7b8696', type: 'dotted' },
          data: clippedParquet.map((r) => (r.year >= 2023 ? r.naive_drift_baseline : null)),
        },
        {
          name: 'Random walk naive',
          type: 'line',
          symbol: 'none',
          itemStyle: { color: '#3f6f7d' },
          lineStyle: { width: 1.2, color: '#3f6f7d', type: 'dotted' },
          data: clippedParquet.map((r) => (r.year >= 2023 ? r.naive_rw_baseline ?? null : null)),
        },
      ],
    };
  }, [uncertaintySeries, activeForecastSeries, horizonEndYear, uncertaintyMode, selectedModel, selectedIndicator]);

  const pcaScatterOption = useMemo(() => {
    if (!nsiData) return {};
    const rows = nsiData.rows;

    const series =
      pcaHueMode === 'cluster'
        ? Object.keys(ARCHETYPE_COLORS).map((arch) => ({
            name: arch.replace('Archetype ', ''),
            type: 'scatter',
            symbolSize: (val: number[]) => Math.max(8, Math.min(20, val[2] * 0.28)),
            itemStyle: { color: ARCHETYPE_COLORS[arch], opacity: 0.9, borderColor: '#111827', borderWidth: 1 },
            data: rows
              .filter((r) => r.cluster_label === arch)
              .map((r) => ({
                value: [r.pca1, r.pca2, r.double_burden_index],
                record: r,
              })),
          }))
        : [1, 2, 3, 4, 5].map((qNum) => ({
            name: `Quintile Q${qNum} (${qNum === 1 ? 'Lowest 20%' : qNum === 5 ? 'Highest 20%' : 'Middle'})`,
            type: 'scatter',
            symbolSize: 12,
            itemStyle: { color: QUINTILE_COLORS[qNum], opacity: 0.9, borderColor: '#111827', borderWidth: 1 },
            data: rows
              .filter((r) => r.quintile_num === qNum)
              .map((r) => ({
                value: [r.pca1, r.pca2, r.double_burden_index],
                record: r,
              })),
          }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        borderWidth: 1,
        textStyle: { color: '#111827', fontSize: 12, fontFamily: 'Newsreader, Georgia, serif' },
        formatter: (params: { data: { record: NSIRecord } }) => {
          const r = params.data?.record;
          if (!r) return '';
          return `
            <div style="max-width:270px;">
              <div style="font-family:'Hanken Grotesk',sans-serif;font-weight:600;color:#111827;border-bottom:2px solid #2d3643;padding-bottom:3px;margin-bottom:4px;">
                ${r.region_name} (${r.country_name})
              </div>
              <div style="font-size:11px;color:#3d4654;margin-bottom:4px;">${r.income_quintile}</div>
              <div style="font-size:11px;color:#8a1253;margin-bottom:6px;">${r.cluster_label}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;font-family:'IBM Plex Mono',monospace;color:#111827;">
                <span>Food budget: <b>${r.food_budget_share_pct}%</b></span>
                <span>NOVA 4: <b>${r.nova4_energy_share_pct}%</b></span>
                <span>Adherence: <b>${r.diet_adherence_score}</b></span>
                <span>BMI≥30: <b>${r.obesity_bmi30_pct}%</b></span>
              </div>
            </div>
          `;
        },
      },
      legend: {
        top: 0,
        itemGap: 12,
        textStyle: { color: '#2d3643', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
      },
      grid: { top: 64, right: 25, bottom: 46, left: 60 },
      xAxis: {
        name: `Principal Component 1 (${nsiData.pca_explained_variance_pct?.[0] ?? 65.5}% variance: guideline adherence vs. NOVA 4 exposure)`,
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: '#3d4654', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        type: 'value',
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      yAxis: {
        name: `PC2 (${nsiData.pca_explained_variance_pct?.[1] ?? 16.9}% variance: affluence vs. food budget share)`,
        nameLocation: 'middle',
        nameGap: 42,
        nameTextStyle: { color: '#3d4654', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        type: 'value',
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      series,
    };
  }, [nsiData, pcaHueMode]);

  const silhouetteOption = useMemo(() => {
    if (!nsiData) return {};
    const ks = Object.keys(nsiData.silhouette_scores);
    const vals = ks.map((k) => nsiData.silhouette_scores[k]);
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        textStyle: { color: '#111827', fontFamily: 'IBM Plex Mono, monospace' },
      },
      grid: { top: 24, right: 20, bottom: 35, left: 50 },
      xAxis: {
        type: 'category',
        data: ks.map((k) => `k=${k}`),
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        min: 0.2,
        max: 0.36,
        splitNumber: 3,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      series: [
        {
          type: 'line',
          symbolSize: 7,
          itemStyle: { color: '#8a1253' },
          lineStyle: { width: 2, color: '#8a1253' },
          data: vals,
        },
      ],
    };
  }, [nsiData]);

  const filteredNsiRows = useMemo(() => {
    if (!nsiData) return [];
    const target = nsiCountryFilter === 'EU27_2020' ? 'IT' : nsiCountryFilter;
    return nsiData.rows.filter((r) => r.country_code === target);
  }, [nsiData, nsiCountryFilter]);

  /* Hallmark data-viz.md: Bars <= 24px thick, baseline at zero, single-hue ramp + 1 accent */
  const nsiQuintileChartOption = useMemo(() => {
    if (filteredNsiRows.length === 0) return {};
    const qLabels = ['Q1 (Bottom 20%)', 'Q2', 'Q3 (Median)', 'Q4', 'Q5 (Top 20%)'];
    const byQ = [1, 2, 3, 4, 5].map((q) => {
      const items = filteredNsiRows.filter((r) => r.quintile_num === q);
      const avg = (fn: (x: NSIRecord) => number) =>
        +(items.reduce((acc, it) => acc + fn(it), 0) / Math.max(1, items.length)).toFixed(1);
      return {
        budget: avg((x) => x.food_budget_share_pct),
        nova4: avg((x) => x.nova4_energy_share_pct),
        adherence: avg((x) => x.diet_adherence_score),
        bmi30: avg((x) => x.obesity_bmi30_pct),
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        textStyle: { color: '#111827', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 },
      },
      legend: {
        top: 0,
        itemGap: 14,
        textStyle: { color: '#2d3643', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
      },
      grid: { top: 62, right: 25, bottom: 40, left: 60 },
      xAxis: {
        type: 'category',
        data: qLabels,
        axisLabel: { color: '#3d4654', fontFamily: 'Newsreader, Georgia, serif', fontSize: 12, margin: 10 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        name: 'Share (%) or adherence index (0–100)',
        nameLocation: 'middle',
        nameGap: 42,
        nameTextStyle: { color: '#3d4654', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      series: [
        {
          name: 'NOVA 4 ultra-processed share (% kcal)',
          type: 'bar',
          barMaxWidth: 20,
          itemStyle: { color: '#8a1253', borderRadius: [2, 2, 0, 0] },
          data: byQ.map((d) => d.nova4),
        },
        {
          name: 'Food budget share (% income)',
          type: 'bar',
          barMaxWidth: 20,
          itemStyle: { color: '#2d3643', borderRadius: [2, 2, 0, 0] },
          data: byQ.map((d) => d.budget),
        },
        {
          name: 'Adult BMI ≥ 30 prevalence (%)',
          type: 'bar',
          barMaxWidth: 20,
          itemStyle: { color: '#7b8696', borderRadius: [2, 2, 0, 0] },
          data: byQ.map((d) => d.bmi30),
        },
        {
          name: 'Dietary guideline adherence (0–100)',
          type: 'line',
          symbolSize: 7,
          itemStyle: { color: '#163d4a' },
          lineStyle: { width: 2, color: '#163d4a' },
          data: byQ.map((d) => d.adherence),
        },
      ],
    };
  }, [filteredNsiRows]);

  return (
    <div className="space-y-5">
      {loadError && (
        <div
          role="alert"
          className="almanac-sheet p-4 border border-[#8a1253] bg-[#8a1253]/10 text-xs flex flex-wrap items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2 text-[#8a1253] font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Failed to load Section II NSI / HICP forecast datasets: {loadError}
          </span>
          <button
            type="button"
            onClick={() => {
              setLoadError(null);
              setRetryTick((t) => t + 1);
            }}
            className="almanac-btn text-[11px] flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Retry Load
          </button>
        </div>
      )}

      {isNsiFallback && (
        <div className="almanac-sheet px-4 py-2.5 border-l-4 border-[#6b4c1b] bg-[#6b4c1b]/10 text-xs text-[var(--color-ink)]">
          <b>Jurisdiction Fallback Disclosure:</b> Selected country <code>{selectedCountry}</code> does not have
          subnational NSI quintile or Eurostat food-basket HICP series in Section II; displaying <code>[IT] Italy</code>{' '}
          reference series. Select an EU-6 / UK / EU27 jurisdiction above to switch explicitly.
        </div>
      )}

      {/* Almanac Section Header */}
      <div className="almanac-sheet p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 rule-firm">
          <div>
            <h2 className="text-lg font-semibold flex flex-wrap items-center gap-2">
              <Cpu className="w-4 h-4" />
              Section II. National Statistical Institutes &amp; Chronological HICP Forecasting
              <DataNatureBadge nature="Forecast" />
              <DataNatureBadge nature="Model Output" label="NSI Subnational" />
            </h2>
            <p className="almanac-label mt-0.5">
              Harmonized NSI/Eurostat quintile models (INE, ISTAT, CBS, INSEE, Destatis, ONS) and leak-free out-of-sample
              statistical price backtesting on observed HICP series (2015–2030).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'forecasts', label: '1. Statistical HICP forecast', icon: TrendingUp },
              { id: 'clustering', label: '2. PCA & silhouette regimes', icon: Sparkles },
              { id: 'nsi_equity', label: '3. NSI quintiles (INE / ISTAT)', icon: Building2 },
              { id: 'rosetta', label: '4. Classification & Rosetta mapper', icon: GitBranch },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveSubTab(t.id as typeof activeSubTab)}
                  className={`almanac-btn flex items-center gap-1.5 ${
                    activeSubTab === t.id ? 'almanac-btn--primary' : ''
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: LEAK-FREE STATISTICAL FORECASTS */}
      {activeSubTab === 'forecasts' && (
        <div className="space-y-5">
          <div className="almanac-sheet p-5">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-3 pb-3 rule-hair-bottom">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block almanac-label mb-1">Jurisdiction & statistical source</label>
                  <select
                    value={nsiCountryFilter}
                    onChange={(e) => handleCountryFilterChange(e.target.value)}
                    className="almanac-select"
                  >
                    <option value="ES">[ES] Spain — INE Encuesta de Presupuestos Familiares</option>
                    <option value="IT">[IT] Italy — ISTAT Indagine sulle Spese delle Famiglie</option>
                    <option value="NL">[NL] Netherlands — CBS StatLine & RIVM</option>
                    <option value="FR">[FR] France — INSEE Budget de Famille & ANSES</option>
                    <option value="DE">[DE] Germany — Destatis GENESIS EVS</option>
                    <option value="GBR">[GBR] United Kingdom — ONS Living Costs & Food Survey</option>
                    <option value="EU27_2020">[EU27] European Union — Eurostat Aggregate</option>
                  </select>
                </div>

                <div>
                  <label className="block almanac-label mb-1">Observed HICP price series</label>
                  <select
                    value={selectedIndicator}
                    onChange={(e) => setSelectedIndicator(e.target.value)}
                    className="almanac-select"
                  >
                    <option value="Healthy Whole-Food CPI Basket (2015=100)">Healthy Whole-Food CPI Basket (2015=100)</option>
                    <option value="All Food & Non-Alcoholic Beverages HICP (CP01, 2015=100)">All Food & Non-Alcoholic Beverages HICP (CP01, 2015=100)</option>
                    <option value="Meat HICP (CP0112, 2015=100)">Meat HICP (CP0112, 2015=100)</option>
                    <option value="Milk, Cheese & Eggs HICP (CP0114, 2015=100)">Milk, Cheese & Eggs HICP (CP0114, 2015=100)</option>
                    <option value="Vegetables HICP (CP0117, 2015=100)">Vegetables HICP (CP0117, 2015=100)</option>
                  </select>
                </div>

                <div>
                  <label className="block almanac-label mb-1">Primary forecast model</label>
                  <select
                    aria-label="Primary forecast model"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value as ForecastModelId)}
                    className="almanac-select"
                  >
                    {ALL_FORECAST_MODELS.map((mId) => (
                      <option key={mId} value={mId}>
                        {FORECAST_MODEL_LABELS[mId]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block almanac-label mb-1">Forecast horizon</label>
                  <select
                    aria-label="Forecast horizon end year"
                    value={horizonEndYear}
                    onChange={(e) => setHorizonEndYear(Number(e.target.value))}
                    className="almanac-select"
                  >
                    {[2026, 2027, 2028, 2029, 2030].map((yr) => (
                      <option key={yr} value={yr}>
                        Through {yr} (h=1..{yr - 2025})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block almanac-label mb-1">Uncertainty / spread mode</label>
                  <select
                    aria-label="Uncertainty band mode"
                    value={uncertaintyMode}
                    onChange={(e) => setUncertaintyMode(e.target.value as UncertaintyDisplayMode)}
                    className="almanac-select"
                  >
                    <option value="empirical_single_minmax">
                      Historical Empirical Residual Envelope (single-series min–max, h=1..3; P10/P90 suppressed since n&lt;10)
                    </option>
                    <option value="empirical_suite_pct_p10_p90">
                      Historical Empirical Residual Quantile Interval (suite %-norm P10/P90, n=140–210, h=1..3; non-calibrated)
                    </option>
                    <option value="heuristic_spread">
                      Heuristic Parametric Spread (±1.2816·σ·√h; indicative parametric scaling only)
                    </option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportForecastCsv}
                  className="almanac-btn flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
                <button
                  onClick={handleExportForecastJson}
                  className="almanac-btn flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  JSON Dossier
                </button>
                <button
                  onClick={() => setShowMethodModal(!showMethodModal)}
                  className="almanac-btn flex items-center gap-1.5"
                >
                  <Code2 className="w-4 h-4" />
                  {showMethodModal ? 'Hide methodology' : 'Inspect methodology'}
                </button>
              </div>
            </div>

            <div className="mb-3 p-2.5 almanac-well text-xs text-[var(--color-ink-2)] border-l-4 border-[var(--color-accent)]">
              <b>Methodological transparency:</b> Only genuinely observed annual Eurostat <code>prc_hicp_aind</code> / ONS
              MM23 price indices (n=11 observations, 2015–2025) are analyzed here. Historical backtests (dotted, 2023–2025 from
              2015–2022 training fits) and expanding-origin CV residuals (origins 2019–2024 targeting 2020–2025) are visually
              and structurally separated from future forecasts (dashed, 2026–{horizonEndYear}).
            </div>

            {/* Active NSI & Eurostat Empirical Provenance Ledger */}
            {NSI_PROVENANCE_META[nsiCountryFilter] && (
              <div className="mb-4 p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule-strong)] text-xs grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="md:col-span-5">
                  <div className="font-display-head font-semibold text-[var(--color-ink)]">
                    Active source: {NSI_PROVENANCE_META[nsiCountryFilter].agency}
                  </div>
                  <div className="almanac-label text-xs mt-0.5">
                    {NSI_PROVENANCE_META[nsiCountryFilter].operation}
                  </div>
                </div>
                <div className="md:col-span-5 rule-hair-left pl-3">
                  <div className="font-mono-num text-[11px] text-[var(--color-ink)]">
                    Tables: {NSI_PROVENANCE_META[nsiCountryFilter].tablesUsed}
                  </div>
                  <div className="font-mono-num text-[11px] text-[var(--color-muted)] mt-0.5">
                    Series anchor: {NSI_PROVENANCE_META[nsiCountryFilter].hicpAnchor}
                  </div>
                </div>
                <div className="md:col-span-2 text-right">
                  <a
                    href={NSI_PROVENANCE_META[nsiCountryFilter].apiUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-display-head font-semibold text-[var(--color-accent)] hover:underline"
                  >
                    Official portal <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Quick Summary Stat Row for Selected Country, Model & Horizon */}
            {uncertaintySeries && uncertaintySeries.data.length > 0 && (() => {
              const targetRow = uncertaintySeries.data.find((r) => r.year === horizonEndYear);
              const lastEmpiricalRow = [...uncertaintySeries.data]
                .reverse()
                .find((r) => r.role === 'FUTURE_FORECAST' && r.bandSupported);
              return (
                <div className="grid grid-cols-2 md:grid-cols-5 mb-4 border border-[var(--color-rule)] bg-[var(--color-sheet)]">
                  <div className="p-2.5 rule-hair-right">
                    <div className="almanac-label text-xs">2015 Baseline (Observed)</div>
                    <div className="font-mono-num font-semibold text-base text-[var(--color-ink)]">
                      {uncertaintySeries.data.find((r) => r.year === 2015)?.actualValue ?? '—'}
                    </div>
                  </div>
                  <div className="p-2.5 rule-hair-right">
                    <div className="almanac-label text-xs">2025 Observed (HICP/CPIH)</div>
                    <div className="font-mono-num font-semibold text-base text-[var(--color-ink)]">
                      {uncertaintySeries.data.find((r) => r.year === 2025)?.actualValue ?? '—'}
                    </div>
                  </div>
                  <div className="p-2.5 rule-hair-right">
                    <div className="almanac-label text-xs">{horizonEndYear} Point Forecast</div>
                    <div className="font-mono-num font-semibold text-base text-[var(--color-accent)]">
                      {targetRow?.pointPrediction ?? '—'}
                    </div>
                    <div className="text-[10px] font-mono-num text-[var(--color-muted)] truncate">
                      {FORECAST_MODEL_LABELS[selectedModel]}
                    </div>
                  </div>
                  <div className="p-2.5 rule-hair-right">
                    <div className="almanac-label text-xs">
                      {!targetRow?.bandSupported
                        ? `${horizonEndYear} Empirical Interval`
                        : targetRow.bandType === 'empirical_residual_minmax'
                        ? `${horizonEndYear} Empirical Residual Envelope`
                        : targetRow.bandType === 'empirical_suite_pct_p10_p90'
                        ? `${horizonEndYear} Empirical Quantile Interval`
                        : `${horizonEndYear} Heuristic Parametric Spread`}
                    </div>
                    <div className="font-mono-num font-semibold text-sm text-[var(--color-ink-2)]">
                      {targetRow?.bandSupported
                        ? `[${targetRow.lowerBound}, ${targetRow.upperBound}]`
                        : 'Unavailable (h > 3)'}
                    </div>
                    <div className="text-[10px] font-mono-num text-[var(--color-muted)]">
                      {targetRow?.bandSupported
                        ? `n=${targetRow.residualSampleSize} residual obs`
                        : lastEmpiricalRow
                        ? `Last supported h=3 (${lastEmpiricalRow.year}): [${lastEmpiricalRow.lowerBound}, ${lastEmpiricalRow.upperBound}]`
                        : 'No CV residuals'}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <div className="almanac-label text-xs">Observed Historical Coverage</div>
                    <div className="font-mono-num font-semibold text-base text-[var(--color-ink)]">
                      {coverageEvaluation?.activeMode.empiricalCoveragePct != null
                        ? `${coverageEvaluation.activeMode.empiricalCoveragePct}%`
                        : '—'}
                    </div>
                    <div className="text-[10px] font-mono-num text-[var(--color-muted)]">
                      {coverageEvaluation
                        ? `${coverageEvaluation.activeMode.hits}/${coverageEvaluation.activeMode.evaluableFolds} causal folds`
                        : ''}
                    </div>
                  </div>
                </div>
              );
            })()}

            {showMethodModal && (
              <div className="mb-4 p-4 almanac-ink-band text-xs font-mono-num space-y-2">
                <div className="font-sans font-semibold text-[var(--color-sheet)]">
                  Leak-Free Expanding-Origin &amp; Uncertainty Methodology (Engine v{FORECASTING_ENGINE_VERSION}):
                </div>
                <pre className="overflow-x-auto p-3 bg-black/25">
{`# Fold Schedule (n=11 annual obs, 2015..2025; minTrainLength=5, maxHorizon=3):
#   Origin 2019 (train 2015..2019, k=5)  -> Targets 2020, 2021, 2022 (3 obs)
#   Origin 2020 (train 2015..2020, k=6)  -> Targets 2021, 2022, 2023 (3 obs)
#   Origin 2021 (train 2015..2021, k=7)  -> Targets 2022, 2023, 2024 (3 obs)
#   Origin 2022 (train 2015..2022, k=8)  -> Targets 2023, 2024, 2025 (3 obs)
#   Origin 2023 (train 2015..2023, k=9)  -> Targets 2024, 2025       (2 obs)
#   Origin 2024 (train 2015..2024, k=10) -> Target  2025             (1 obs)
# Total: 15 valid observations per series (h=1: 6, h=2: 5, h=3: 4); 525 across 35 series. Zero unobserved targets.
#
# Uncertainty Quantification Rules (Phase 4B):
# - Single-series empirical residuals: n=6 (h=1), n=5 (h=2), n=4 (h=3) -> MIN_SAMPLE_FOR_P10_P90=10 suppresses P10/P90.
# - Suite cross-series pooling: PROHIBITED unnormalized; requires % normalization (n=210, 175, 140), still correlated across countries.
# - Horizons h=4..5 (2029..2030): NO empirical CV residuals exist; only parametric heuristic spread can extend past h=3.`}
                </pre>
              </div>
            )}

            <div className="h-92 w-full">
              <ReactECharts option={forecastChartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
            </div>
          </div>

          {/* Model Validation Ledger */}
          {activeBacktest && (
            <div className="almanac-sheet p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 rule-firm">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Expanding-Origin Out-of-Sample Validation ({activeBacktest.data.folds.length} folds: origins 2019–2024 → targets 2020–2025)
                </h3>
                {activeBacktest.data.bestModelByCvMae && (
                  <span className="px-2 py-0.5 border border-[#163d4a] bg-[#163d4a]/10 text-xs font-mono-num">
                    Lowest CV MAE (Descriptive): <b>{FORECAST_MODEL_LABELS[activeBacktest.data.bestModelByCvMae]}</b> (MAE {activeBacktest.data.bestCvMae}, MASE {activeBacktest.data.bestCvMase})
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="almanac-table">
                  <thead>
                    <tr>
                      <th>Model / Baseline</th>
                      <th className="text-right">CV MAE</th>
                      <th className="text-right">CV RMSE</th>
                      <th className="text-right">sMAPE (%)</th>
                      <th className="text-right">MASE</th>
                      <th className="text-right">h=1 yr MAE</th>
                      <th className="text-right">h=2 yr MAE</th>
                      <th className="text-right">h=3 yr MAE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_FORECAST_MODELS.map((mId) => {
                      const ov = activeBacktest.data.overallByModel[mId];
                      const isWinner = activeBacktest.data.bestModelByCvMae === mId;
                      return (
                        <tr key={mId} className={isWinner ? 'bg-[var(--color-well)] font-medium' : ''}>
                          <td className="text-xs text-[var(--color-ink)]">
                            {FORECAST_MODEL_LABELS[mId]}
                            {isWinner && (
                              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-mono-num border border-[#163d4a] text-[#163d4a]">
                                Empirical CV Winner
                              </span>
                            )}
                          </td>
                          <td className="num text-right text-xs font-semibold text-[var(--color-accent)]">
                            {ov.mae ?? '—'}
                          </td>
                          <td className="num text-right text-xs">{ov.rmse ?? '—'}</td>
                          <td className="num text-right text-xs">{ov.smapePct != null ? `${ov.smapePct}%` : '—'}</td>
                          <td className="num text-right text-xs">{ov.mase ?? '—'}</td>
                          <td className="num text-right text-xs">{activeBacktest.data.byHorizonByModel[1]?.[mId]?.mae ?? '—'}</td>
                          <td className="num text-right text-xs">{activeBacktest.data.byHorizonByModel[2]?.[mId]?.mae ?? '—'}</td>
                          <td className="num text-right text-xs">{activeBacktest.data.byHorizonByModel[3]?.[mId]?.mae ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {suiteCvSummary && (
                <div className="p-3 bg-[var(--color-well)] border border-[var(--color-rule)] text-xs space-y-1">
                  <div className="font-semibold text-[var(--color-ink)]">
                    35-Series Benchmark Summary ({suiteCvSummary.data.seriesCount} series · {suiteCvSummary.data.totalFoldsEvaluated} expanding-origin evaluations):
                  </div>
                  <div className="font-mono-num text-[11px] text-[var(--color-ink-2)]">
                    Descriptive CV winners: Random Walk w/ Drift ({suiteCvSummary.data.winCountsByModel.naive_drift}/35) · Holt Linear ETS ({suiteCvSummary.data.winCountsByModel.holt_ets}/35) · Damped ETS ({suiteCvSummary.data.winCountsByModel.damped_ets}/35) · Ridge ({suiteCvSummary.data.winCountsByModel.ridge_trend}/35) · Random Walk ({suiteCvSummary.data.winCountsByModel.naive_random_walk}/35)
                  </div>
                  <div className="text-[11px] text-[var(--color-muted)] space-y-0.5">
                    <div>
                      <b>Metric &amp; MASE Interpretation:</b> Overall series MAE/sMAPE/MASE average all 15 folds (h=1 has 6 folds, h=2 has 5, h=3 has 4); suite RMSE is pooled RMS across all 525 fold pairs. <b>MASE &gt; 1</b> (e.g., suite drift mean 4.566) indicates errors exceed the in-sample 1-step naïve training scale, reflecting small pre-2021 step differences tested across multi-year horizons potentially impacted by the 2022–2023 food inflation shock.
                    </div>
                    <div>
                      {activeBacktest.data.shortSeriesLimitations.join(' ')} Note: Lowest CV MAE identifies a descriptive winner within this CV sample rather than an independent outer holdout test.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Phase 4B: Empirical Residual Distributions & Causal Coverage Diagnostics */}
          {singleResidualReport && suitePctResidualReport && coverageEvaluation && (
            <div className="almanac-sheet p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 rule-firm">
                <h3 className="text-sm font-semibold">
                  Phase 4B Empirical Residual Analysis &amp; Interval Coverage ({FORECAST_MODEL_LABELS[selectedModel]})
                </h3>
                <span className="text-[11px] font-mono-num text-[var(--color-muted)]">
                  P10/P90 quantile gate: n ≥ {MIN_SAMPLE_FOR_P10_P90} required
                </span>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Left: Single-Series Unpooled Residuals */}
                <div>
                  <div className="text-xs font-semibold text-[var(--color-ink)] mb-1">
                    1. Active Series Unpooled Residuals ({activeInput?.countryCode} · Index Points, actual − predicted)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="almanac-table">
                      <thead>
                        <tr>
                          <th>Horizon</th>
                          <th className="text-right">n</th>
                          <th className="text-right">Min</th>
                          <th className="text-right">Median</th>
                          <th className="text-right">Max</th>
                          <th className="text-right">RMSE</th>
                          <th>P10 / P90 Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {singleResidualReport.data.byHorizon.map((hs) => (
                          <tr key={hs.horizon}>
                            <td className="font-mono-num text-xs">h={hs.horizon} yr ({2025 + hs.horizon})</td>
                            <td className="num text-right text-xs font-semibold">{hs.sampleSize}</td>
                            <td className="num text-right text-xs">{hs.min ?? '—'}</td>
                            <td className="num text-right text-xs">{hs.median ?? '—'}</td>
                            <td className="num text-right text-xs">{hs.max ?? '—'}</td>
                            <td className="num text-right text-xs">{hs.rmse ?? '—'}</td>
                            <td className="text-[11px] text-[var(--color-muted)]">
                              {hs.quantileSupported
                                ? `[${hs.p10}, ${hs.p90}]`
                                : `Suppressed (n=${hs.sampleSize} < ${MIN_SAMPLE_FOR_P10_P90})`}
                            </td>
                          </tr>
                        ))}
                        <tr className="text-[var(--color-muted)] bg-[var(--color-paper-2)]">
                          <td className="font-mono-num text-xs">h=4..5 (2029–30)</td>
                          <td className="num text-right text-xs">0</td>
                          <td className="num text-right text-xs">—</td>
                          <td className="num text-right text-xs">—</td>
                          <td className="num text-right text-xs">—</td>
                          <td className="num text-right text-xs">—</td>
                          <td className="text-[11px]">No observed CV residuals (h &gt; 3)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right: Suite Percentage-Normalized Residuals */}
                <div>
                  <div className="text-xs font-semibold text-[var(--color-ink)] mb-1">
                    2. Suite %-Normalized Residuals (35 Series via 100·(actual−predicted)/predicted; mapped by point·(1+q/100))
                  </div>
                  <div className="overflow-x-auto">
                    <table className="almanac-table">
                      <thead>
                        <tr>
                          <th>Horizon</th>
                          <th className="text-right">n</th>
                          <th className="text-right">Mean %</th>
                          <th className="text-right">P10 %</th>
                          <th className="text-right">P50 %</th>
                          <th className="text-right">P90 %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suitePctResidualReport.data.byHorizon.map((hs) => (
                          <tr key={hs.horizon}>
                            <td className="font-mono-num text-xs">h={hs.horizon} yr</td>
                            <td className="num text-right text-xs font-semibold">{hs.sampleSize}</td>
                            <td className="num text-right text-xs">{hs.mean != null ? `${hs.mean}%` : '—'}</td>
                            <td className="num text-right text-xs">{hs.p10 != null ? `${hs.p10}%` : '—'}</td>
                            <td className="num text-right text-xs">{hs.p50 != null ? `${hs.p50}%` : '—'}</td>
                            <td className="num text-right text-xs">{hs.p90 != null ? `${hs.p90}%` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Dynamic Explanatory Note for Asymmetric / Positive-Shifted Historical Residual Intervals (e.g. Italy 2028 h=3) */}
              {(() => {
                const shiftedFutureRows =
                  uncertaintySeries?.data.filter(
                    (r) =>
                      r.role === 'FUTURE_FORECAST' &&
                      r.bandSupported &&
                      r.lowerBound !== null &&
                      r.pointPrediction !== null &&
                      r.lowerBound > r.pointPrediction
                  ) ?? [];
                const activeMinMax = coverageEvaluation.singleMinMax;
                const activeQuantile = coverageEvaluation.suitePctP10P90;
                const activeHeur = coverageEvaluation.heuristicSpread;
                return (
                  <div className="space-y-3">
                    {shiftedFutureRows.length > 0 && (
                      <div
                        title="Empirical intervals apply historical signed residual offsets (actual - predicted) to the uncentered point forecast."
                        className="p-2.5 bg-[var(--color-well)] border-l-4 border-[#163d4a] text-[11px] text-[var(--color-ink-2)]"
                      >
                        <b>Why the empirical interval lies above the point forecast ({shiftedFutureRows.map((r) => `${r.year} h=${r.horizon}`).join(', ')}):</b>{' '}
                        Because every historical out-of-sample residual at this horizon was positive (models under-predicted post-2021 index levels; e.g., at <code>h=3</code> in <code>{activeInput?.countryCode}</code>, min residual = {singleResidualReport.data.byHorizon[2]?.min ?? '—'}), adding historical residual offsets (<code>point + residual</code> or <code>point·(1+q/100)</code>) shifts the historical residual adjustment entirely above the unadjusted point forecast. This reflects past under-prediction bias, <b>not a guarantee about future price increases</b>.
                      </div>
                    )}

                    {/* Strictly Causal Empirical Coverage Evaluation */}
                    <div className="p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule-strong)] text-xs space-y-1.5">
                      <div className="font-semibold text-[var(--color-ink)]">
                        Observed Historical Interval Coverage (Evaluating prior.targetYear ≤ originYear folds only; never using the fold&apos;s own residual):
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono-num text-[11px]">
                        <div className="p-2 bg-[var(--color-sheet)] border border-[var(--color-rule)] space-y-0.5">
                          <div className="text-[var(--color-muted)]">Historical Empirical Residual Envelope</div>
                          <div className="font-semibold text-[var(--color-ink)]">
                            {activeMinMax.empiricalCoveragePct ?? '—'}% ({activeMinMax.hits}/{activeMinMax.evaluableFolds} folds)
                          </div>
                          <div className="text-[10px] text-[var(--color-muted)]">
                            Excl.: {activeMinMax.skippedInsufficientPrior} (&lt;2 priors; h=1:140, h=2:70, h=3:0 eligible)
                          </div>
                        </div>
                        <div className="p-2 bg-[var(--color-sheet)] border border-[var(--color-rule)] space-y-0.5">
                          <div className="text-[var(--color-muted)]">Historical Empirical Residual Quantile Interval (Suite P10–P90)</div>
                          <div className="font-semibold text-[var(--color-ink)]">
                            {activeQuantile.empiricalCoveragePct ?? '—'}% ({activeQuantile.hits}/{activeQuantile.evaluableFolds} folds)
                          </div>
                          <div className="text-[10px] text-[var(--color-muted)]">
                            Excl.: {activeQuantile.skippedInsufficientPrior} (&lt;10 priors; h=1:175, h=2:105, h=3:35 eligible)
                          </div>
                        </div>
                        <div className="p-2 bg-[var(--color-sheet)] border border-[var(--color-rule)] space-y-0.5">
                          <div className="text-[var(--color-muted)]">Heuristic Parametric Spread (±1.2816·σ)</div>
                          <div className="font-semibold text-[var(--color-ink)]">
                            {activeHeur.empiricalCoveragePct ?? '—'}% ({activeHeur.hits}/{activeHeur.evaluableFolds} folds)
                          </div>
                          <div className="text-[10px] text-[var(--color-muted)]">
                            Excl.: {activeHeur.skippedInsufficientPrior} (&lt;2 priors; h=1:140, h=2:70, h=3:0 eligible)
                          </div>
                        </div>
                      </div>
                      <div className="text-[11px] text-[var(--color-muted)] space-y-0.5">
                        <div>
                          <b>Interval Interpretation &amp; Limitations:</b> Historical empirical residual envelopes, historical empirical residual quantile intervals, heuristic parametric spreads, and observed historical interval coverage measure distinct quantities. Nominal P10–P90 bounds are descriptive summaries and <b>must not be treated as calibrated 80% prediction intervals</b>.
                        </div>
                        <div>
                          Causal backtesting does not guarantee residual independence, exchangeability across jurisdictions or origins, or future calibration under structural breaks. Suite %-normalized quantiles pool correlated European/UK countries under shared macroeconomic shocks.
                        </div>
                      </div>

                      <details className="pt-2 border-t border-[var(--color-rule)]">
                        <summary className="cursor-pointer font-semibold text-[var(--color-accent)] select-none">
                          Expand 7-Jurisdiction Interval Coverage Breakdown ({FORECAST_MODEL_LABELS[selectedModel]} · {uncertaintyMode})
                        </summary>
                        <div className="mt-2 space-y-2">
                          <div className="text-[11px] text-[var(--color-muted)]">
                            Evaluating all 7 jurisdictions (5 food baskets each, causal <code>prior.targetYear ≤ originYear</code>). Horizons or jurisdictions with <code>n &lt; {MIN_COVERAGE_EVAL_SAMPLE}</code> eligible evaluations are explicitly flagged (<b>Small sample</b>); all 5 baskets within a jurisdiction share domestic macroeconomic shocks.
                          </div>
                          <div className="overflow-x-auto">
                            <table className="almanac-table">
                              <thead>
                                <tr>
                                  <th>Jurisdiction</th>
                                  <th className="text-right">Eligible (n)</th>
                                  <th className="text-right">Hits</th>
                                  <th className="text-right">Coverage %</th>
                                  <th className="text-right">h=1 (n)</th>
                                  <th className="text-right">h=2 (n)</th>
                                  <th className="text-right">h=3 (n)</th>
                                  <th>Sample Diagnostics</th>
                                </tr>
                              </thead>
                              <tbody>
                                {coverageEvaluation.activeMode.byJurisdiction.map((j) => {
                                  const h1 = j.byHorizon.find((h) => h.horizon === 1);
                                  const h2 = j.byHorizon.find((h) => h.horizon === 2);
                                  const h3 = j.byHorizon.find((h) => h.horizon === 3);
                                  return (
                                    <tr key={j.countryCode}>
                                      <td className="font-mono-num text-xs font-semibold text-[var(--color-ink)]">
                                        {j.countryCode} <span className="font-normal text-[var(--color-muted)]">({j.seriesCount} series)</span>
                                      </td>
                                      <td className="num text-right text-xs">{j.evaluableFolds}</td>
                                      <td className="num text-right text-xs">{j.hits}</td>
                                      <td className="num text-right text-xs font-semibold text-[var(--color-accent)]">
                                        {j.coveragePct != null ? `${j.coveragePct}%` : '—'}
                                      </td>
                                      <td className="num text-right text-xs">
                                        {h1?.coveragePct != null ? `${h1.coveragePct}%` : '—'} ({h1?.evaluableFolds ?? 0})
                                      </td>
                                      <td className="num text-right text-xs">
                                        {h2?.coveragePct != null ? `${h2.coveragePct}%` : '—'} ({h2?.evaluableFolds ?? 0})
                                        {h2?.smallSampleFlag ? ' ⚠' : ''}
                                      </td>
                                      <td className="num text-right text-xs">
                                        {h3?.coveragePct != null ? `${h3.coveragePct}%` : '—'} ({h3?.evaluableFolds ?? 0})
                                        {h3?.smallSampleFlag ? ' ⚠' : ''}
                                      </td>
                                      <td className="text-[11px] text-[var(--color-muted)]">
                                        {j.smallSampleFlag ? '⚠ Small sample: ' : ''}
                                        {j.smallSampleNote}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: PCA & SILHOUETTE CLUSTERING */}
      {activeSubTab === 'clustering' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-8 almanac-sheet p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 rule-firm">
              <div>
                <h3 className="text-base font-semibold">
                  Principal component projection of 150 NSI regional and quintile cohorts
                </h3>
                <p className="almanac-label">
                  Standardized (z-score) socio-dietary features projected onto PC1 ({nsiData?.pca_explained_variance_pct?.[0] ?? 65.5}% variance) and PC2 ({nsiData?.pca_explained_variance_pct?.[1] ?? 16.9}%
                  variance).
                </p>
              </div>
              <div className="flex items-center border border-[var(--color-ink)]">
                <button
                  onClick={() => setPcaHueMode('cluster')}
                  className={`px-2.5 py-1 text-xs cursor-pointer ${
                    pcaHueMode === 'cluster' ? 'bg-[var(--color-ink)] text-[var(--color-sheet)]' : 'text-[var(--color-ink)]'
                  }`}
                >
                  Color by regime cluster
                </button>
                <button
                  onClick={() => setPcaHueMode('quintile')}
                  className={`px-2.5 py-1 text-xs cursor-pointer ${
                    pcaHueMode === 'quintile'
                      ? 'bg-[var(--color-ink)] text-[var(--color-sheet)]'
                      : 'text-[var(--color-ink)]'
                  }`}
                >
                  Color by income quintile (Q1–Q5)
                </button>
              </div>
            </div>
            <div className="h-96 w-full">
              <ReactECharts option={pcaScatterOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
            </div>
          </div>

          <div className="xl:col-span-4 space-y-4">
            <div className="almanac-sheet p-4">
              <h3 className="text-sm font-semibold pb-2 mb-2 rule-firm">
                Silhouette score evaluation across k = 2 to 6
              </h3>
              <p className="almanac-label mb-2">
                Selecting k = 4 yields a {nsiData?.silhouette_scores?.['4'] ?? 0.26} silhouette coefficient while separating four interpretable dietary
                regimes:
              </p>
              <div className="h-44 w-full">
                <ReactECharts option={silhouetteOption} style={{ height: '100%', width: '100%' }} />
              </div>
            </div>

            <div className="almanac-sheet p-4 space-y-2.5 text-sm">
              <div className="font-display-head font-semibold pb-1.5 rule-firm">
                Classified European behavioral archetypes
              </div>
              <div className="pb-2 rule-hair-bottom">
                <span className="font-semibold text-[var(--color-ink)]">Archetype A (Mediterranean whole-food):</span>{' '}
                High guideline adherence (&gt;72/100) and low NOVA 4 share (&lt;22%), led by Central/Northern Italy
                (ISTAT) and Northern Spain (INE).
              </div>
              <div className="pb-2 rule-hair-bottom">
                <span className="font-semibold text-[var(--color-accent)]">
                  Archetype B (Inflation-squeezed double-burden):
                </span>{' '}
                Bottom income quintiles (Q1–Q2) allocating 18–24% of household budget to food while facing a +15 pt
                healthy-vs-UPF price wedge.
              </div>
              <div className="pb-2 rule-hair-bottom">
                <span className="font-semibold text-[var(--color-ink)]">Archetype C (Affluent urban flexitarian):</span>{' '}
                Top quintiles (Q4–Q5) in Randstad NL, Île-de-France and Madrid with high plant-protein substitution.
              </div>
              <div>
                <span className="font-semibold text-[var(--color-ink)]">
                  Archetype D (High-NOVA 4 cardiometabolic risk):
                </span>{' '}
                Cohorts exceeding 45% daily energy from ultra-processed foods alongside elevated adult BMI ≥ 30.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: NATIONAL STATISTICAL INSTITUTES */}
      {activeSubTab === 'nsi_equity' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7 almanac-sheet p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 rule-firm">
                <div>
                  <h3 className="text-base font-semibold">
                    Socio-economic gradient across household income quintiles (Q1 to Q5)
                  </h3>
                  <p className="almanac-label">
                    Compares Engel food budget share, NOVA 4 caloric share, adult obesity prevalence and diet adherence.
                  </p>
                </div>
                <select
                  value={nsiCountryFilter === 'EU27_2020' ? 'IT' : nsiCountryFilter}
                  onChange={(e) => handleCountryFilterChange(e.target.value)}
                  className="almanac-select"
                >
                  <option value="ES">[ES] INE Spain</option>
                  <option value="IT">[IT] ISTAT Italy</option>
                  <option value="NL">[NL] CBS Netherlands</option>
                  <option value="FR">[FR] INSEE France</option>
                  <option value="DE">[DE] Destatis Germany</option>
                  <option value="GBR">[GBR] ONS United Kingdom</option>
                </select>
              </div>
              <div className="h-80 w-full">
                <ReactECharts option={nsiQuintileChartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
              </div>
            </div>

            <div className="xl:col-span-5 almanac-sheet p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-semibold pb-2.5 mb-3 rule-firm">
                  Primary National Statistical Institute (NSI) data sources
                </h3>
                <div className="divide-y divide-[var(--color-rule)] text-sm">
                  {[
                    {
                      code: 'ES',
                      name: 'INE Spain — INEbase & WSTempus API',
                      desc: 'Encuesta de Presupuestos Familiares (EPF) & National Health Survey (ENSE)',
                      url: 'https://www.ine.es/dyngs/INEbase/en/listaoperaciones.htm',
                    },
                    {
                      code: 'IT',
                      name: 'ISTAT Italy — I.Stat & EsploraDati SDMX',
                      desc: 'Indagine sulle Spese delle Famiglie & Multiscopo Aspetti Vita Quotidiana',
                      url: 'https://www.istat.it/en/data/databases/',
                    },
                    {
                      code: 'NL',
                      name: 'CBS Netherlands — StatLine OData v4',
                      desc: 'Budgetonderzoek & RIVM Dutch National Food Consumption Survey (VCP)',
                      url: 'https://opendata.cbs.nl/',
                    },
                    {
                      code: 'FR',
                      name: 'INSEE France — BDM & ANSES INCA3',
                      desc: 'Enquête Budget de Famille & Individual National Food Consumption',
                      url: 'https://www.insee.fr/en/statistiques',
                    },
                    {
                      code: 'DE',
                      name: 'Destatis Germany — GENESIS-Online',
                      desc: 'Einkommens- und Verbrauchsstichprobe (EVS) & Mikrozensus',
                      url: 'https://www-genesis.destatis.de/',
                    },
                    {
                      code: 'GBR',
                      name: 'ONS UK & DEFRA — Family Food Datasets',
                      desc: 'Living Costs and Food Survey (LCFS) Decile Expenditure & Nutrient Intake',
                      url: 'https://www.ons.gov.uk/economy/inflationandpriceindices',
                    },
                  ].map((agency) => (
                    <a
                      key={agency.name}
                      href={agency.url}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2.5 flex items-center justify-between hover:bg-[var(--color-paper-2)] px-2 transition"
                    >
                      <div>
                        <div className="font-display-head font-semibold text-sm text-[var(--color-ink)]">
                          [{agency.code}] {agency.name}
                        </div>
                        <div className="almanac-label text-xs">{agency.desc}</div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0 ml-2" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="almanac-sheet p-5">
            <div className="flex items-center justify-between pb-2.5 mb-3 rule-firm">
              <h3 className="text-sm font-semibold">
                Sub-national regions (NUTS-2) by household income quintile ({filteredNsiRows.length} cohorts in{' '}
                {nsiCountryFilter})
              </h3>
              <span className="almanac-label">
                Price wedge = Healthy whole-food CPI minus NOVA 4 ultra-processed CPI
              </span>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="almanac-table">
                <thead>
                  <tr>
                    <th>Sub-national region (NUTS-2)</th>
                    <th>Income quintile</th>
                    <th className="text-right">Food budget share</th>
                    <th className="text-right">Healthy−UPF wedge</th>
                    <th className="text-right">NOVA 4 (% kcal)</th>
                    <th className="text-right">Diet adherence</th>
                    <th className="text-right">BMI ≥ 30 (%)</th>
                    <th>Classified regime</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNsiRows.map((r) => (
                    <tr key={r.record_id}>
                      <td className="font-semibold text-[var(--color-ink)]">{r.region_name}</td>
                      <td>{r.income_quintile}</td>
                      <td className="num text-right">{r.food_budget_share_pct}%</td>
                      <td className="num text-right text-[var(--color-accent)]">
                        +{r.price_wedge_healthy_minus_upf} pts
                      </td>
                      <td className="num text-right">{r.nova4_energy_share_pct}%</td>
                      <td className="num text-right">{r.diet_adherence_score}</td>
                      <td className="num text-right">{r.obesity_bmi30_pct}%</td>
                      <td className="text-xs">{r.cluster_label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: CLASSIFICATION & ROSETTA HARMONISATION INSPECTOR */}
      {activeSubTab === 'rosetta' && (
        <ClassificationInspector rosettaData={rosettaData} />
      )}
    </div>
  );
}
