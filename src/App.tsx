import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import ReactECharts from './components/ThemedEChart';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Compass,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Filter,
  Globe2,
  Info,
  Layers,
  Maximize2,
  Moon,
  Network,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
  ShoppingBasket,
  Sliders,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
} from 'lucide-react';
import { InteractiveChoroplethMap } from './components/InteractiveChoroplethMap';
import { DietShiftLogo } from './components/DietShiftLogo';
import { DataNatureBadge } from './components/DataNatureBadge';
import { DataCatalogModal } from './components/DataCatalogModal';
import { fetchCachedJson, fetchFullAgribalyse, fetchLiveResearchBundle } from './services/dataProvider';
import { APP_VERSION } from './version';
import { downloadCsvContent, serializeCsvTable } from './utils/exportDownload';
import { classifyResourceError } from './utils/resourceAvailability';

const DuckDBParquetWorkbench = lazy(() =>
  import('./components/DuckDBParquetWorkbench').then((m) => ({ default: m.DuckDBParquetWorkbench }))
);
const ResearcherSandbox = lazy(() =>
  import('./components/ResearcherSandbox').then((m) => ({ default: m.ResearcherSandbox }))
);
const NSIMLObservatory = lazy(() =>
  import('./components/NSIMLObservatory').then((m) => ({ default: m.NSIMLObservatory }))
);
const ConsumerBehaviorPulse = lazy(() =>
  import('./components/ConsumerBehaviorPulse').then((m) => ({ default: m.ConsumerBehaviorPulse }))
);
const GS1ImmaginoObservatory = lazy(() =>
  import('./components/GS1ImmaginoObservatory').then((m) => ({ default: m.GS1ImmaginoObservatory }))
);
const NutritionComparisonPanel = lazy(() =>
  import('./components/NutritionComparisonPanel').then((m) => ({ default: m.NutritionComparisonPanel }))
);
const EnvironmentComparisonPanel = lazy(() =>
  import('./components/EnvironmentComparisonPanel').then((m) => ({ default: m.EnvironmentComparisonPanel }))
);
const AffordabilityAndIntegratedPanel = lazy(() =>
  import('./components/AffordabilityAndIntegratedPanel').then((m) => ({ default: m.AffordabilityAndIntegratedPanel }))
);
const SensitivityPanel = lazy(() =>
  import('./components/SensitivityPanel').then((m) => ({ default: m.SensitivityPanel }))
);

function ModuleLoadingState({ label }: { label: string }) {
  return (
    <div className="almanac-sheet p-6 text-xs text-[var(--color-muted)] font-mono-num flex items-center gap-2.5">
      <RefreshCw className="w-4 h-4 text-[var(--color-accent)] animate-spin shrink-0" />
      <span>Loading {label}...</span>
    </div>
  );
}
import {
  type ComparisonBasis,
  evaluateProductNutrition,
  filterProductsWithNovaAudit,
  fromOFFProduct,
} from './analytics/nutritionEngine';
import {
  type EnvironmentIndicatorKey,
  ENVIRONMENT_INDICATOR_SPECS,
  aggregateEnvironmentByCategory,
  fromAgribalyseItem,
} from './analytics/environmentEngine';
import { evaluatePolicyScenario } from './analytics/policyScenarioModel';
import { assetUrl } from './utils/assetPath';
import { toggleTheme, useDarkMode } from './utils/chartTheme';
import { type DatasetsRegistry, resolveDatasetNature } from './types/dataRegistry';
import {
  COUNTRY_PROFILES,
  type AgribalyseItem,
  type LiveResearchBundle,
  type OFFProduct,
} from './types/research';

type ActiveModule =
  | 'overview'
  | 'nsi_ml'
  | 'consumer_pulse'
  | 'map'
  | 'duckdb'
  | 'sandbox'
  | 'trilemma'
  | 'lca'
  | 'inflation'
  | 'simulator'
  | 'floorplan'
  | 'gs1_immagino'
  | 'sensitivity';

function GithubIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function LinkedinIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.84a1.59 1.59 0 0 0-1.61 1.6 1.6 1.6 0 0 0 1.61 1.6 1.6 1.6 0 0 0 1.6-1.6 1.59 1.59 0 0 0-1.6-1.6Z" />
    </svg>
  );
}

/* Hallmark Almanac restrained palette: sea-teal, slate, muted ochre, chart magenta for NOVA 4 */
const NOVA_COLORS: Record<number, string> = {
  1: '#163d4a',
  2: '#3f6f7d',
  3: '#6b4c1b',
  4: '#8a1253',
};

const NOVA_LABELS: Record<number, string> = {
  1: 'NOVA 1: Unprocessed whole foods',
  2: 'NOVA 2: Culinary ingredients',
  3: 'NOVA 3: Processed foods',
  4: 'NOVA 4: Ultra-processed products',
};

interface EconometricCalibration {
  country_code: string;
  hbs_q1_food_share_pct: number;
  hbs_q5_food_share_pct: number;
  hbs_q1_meat_share_pm: number;
  hbs_q5_meat_share_pm: number;
  ehis_q1_5plus_veg_pct: number;
  ehis_q5_5plus_veg_pct: number;
  ehis_q1_zero_veg_pct: number;
  empirical_own_price_elasticity: number;
  hicp_meat_inflation_21_24_pct: number;
  hicp_backtest_22_24_mape_pct: number;
  empirical_ci95_rel_halfwidth: number;
  eurostat_food_ppp_index_eu27_100: number;
}

interface PooreLcaItem {
  food_item: string;
  stage_land_use: number;
  stage_farm: number;
  stage_animal_feed: number;
  stage_processing: number;
  stage_transport: number;
  stage_retail: number;
  stage_packaging: number;
  stage_losses: number;
  ghg_kg_co2eq_per_kg: number;
  land_use_m2_per_kg: number;
  freshwater_withdrawals_l_per_kg: number;
  transport_share_pct: number;
}

interface GlobalCohdItem {
  iso3: string;
  country_name: string;
  geojson_name: string;
  year: number;
  cost_healthy_diet_ppp_usd: number;
  unaffordable_pct: number | null;
  unaffordable_millions: number | null;
  cost_to_food_exp_ratio: number | null;
}

interface GlobalBenchmarksBundle {
  poore_nemecek_lca: PooreLcaItem[];
  cohd_latest_by_country: GlobalCohdItem[];
}

export function App() {
  const isDark = useDarkMode();
  const [bundle, setBundle] = useState<LiveResearchBundle | null>(null);
  const [fullAgribalyse, setFullAgribalyse] = useState<AgribalyseItem[]>([]);
  const [calibration, setCalibration] = useState<Record<string, EconometricCalibration>>({});
  const [globalBenchmarks, setGlobalBenchmarks] = useState<GlobalBenchmarksBundle | null>(null);
  const [datasetsRegistry, setDatasetsRegistry] = useState<DatasetsRegistry | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [plate4Mode, setPlate4Mode] = useState<'agribalyse' | 'poore'>('agribalyse');
  const [loading, setLoading] = useState(true);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
  const [bootRetryTick, setBootRetryTick] = useState(0);
  const initialHash = useMemo(() => {
    const raw = window.location.hash.replace(/^#/, '');
    return new URLSearchParams(raw);
  }, []);

  const [activeModule, setActiveModule] = useState<ActiveModule>(
    (initialHash.get('module') as ActiveModule) || 'overview'
  );

  const [selectedCountry, setSelectedCountry] = useState<string>(
    initialHash.get('country') || 'IT'
  );
  const [comparisonCountry, setComparisonCountry] = useState<string>('FR');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedNova, setSelectedNova] = useState<number[]>([1, 2, 3, 4]);
  const [includeMissingNova, setIncludeMissingNova] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [simPlantShift, setSimPlantShift] = useState<number>(
    Number(initialHash.get('plant')) || 35
  );
  const [simUpfReduction, setSimUpfReduction] = useState<number>(
    Number(initialHash.get('upf')) || 25
  );
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [exportDatasetKey, setExportDatasetKey] = useState<string>('off');
  const [nutritionBasis, setNutritionBasis] = useState<ComparisonBasis>('per_100g');
  const [agbChartIndicator, setAgbChartIndicator] = useState<EnvironmentIndicatorKey>('climate_co2eq');

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('module', activeModule);
    params.set('country', selectedCountry);
    params.set('plant', String(simPlantShift));
    params.set('upf', String(simUpfReduction));
    window.history.replaceState(null, '', `#${params.toString()}`);
  }, [activeModule, selectedCountry, simPlantShift, simUpfReduction]);
  const [simCarbonTax, setSimCarbonTax] = useState<number>(50);
  const [simWasteCut, setSimWasteCut] = useState<number>(20);
  const [architectureView, setArchitectureView] = useState<'blueprint' | 'floorplan'>('blueprint');

  useEffect(() => {
    let cancelled = false;
    const forceRetry = bootRetryTick > 0;
    const warnings: string[] = [];

    Promise.all([
      fetchLiveResearchBundle({ forceRetry }),
      fetchFullAgribalyse({ forceRetry }).catch((err: unknown) => {
        warnings.push(`agribalyse_full.json: ${err instanceof Error ? err.message : String(err)}`);
        return [] as AgribalyseItem[];
      }),
      fetchCachedJson<Record<string, EconometricCalibration>>('data/econometric_calibration.json', { forceRetry }).catch(
        (err: unknown) => {
          warnings.push(`econometric_calibration.json: ${err instanceof Error ? err.message : String(err)}`);
          return {} as Record<string, EconometricCalibration>;
        }
      ),
      fetchCachedJson<GlobalBenchmarksBundle>('data/global_benchmarks.json', { forceRetry }).catch((err: unknown) => {
        warnings.push(`global_benchmarks.json: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }),
      fetchCachedJson<DatasetsRegistry>('data/datasets_registry.json', { forceRetry }).catch((err: unknown) => {
        warnings.push(`datasets_registry.json: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }),
    ])
      .then(([bundleData, agbFull, calData, globData, regData]) => {
        if (cancelled) return;
        setBundle(bundleData);
        // Never fall back silently to the deprecated 500-item preview slice inside live_research_bundle (H-06)
        setFullAgribalyse(agbFull);
        setCalibration(calData || {});
        setGlobalBenchmarks(globData);
        setDatasetsRegistry(regData);
        setLoadWarnings(warnings);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setLoadWarnings([`Core live_research_bundle.json failed: ${msg}`]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bootRetryTick]);

  const currentProfile = COUNTRY_PROFILES[selectedCountry] || COUNTRY_PROFILES.IT;
  const compareProfile = COUNTRY_PROFILES[comparisonCountry] || COUNTRY_PROFILES.FR;
  const currentCalibration = calibration[currentProfile.code] || calibration.EU27 || null;

  const offCategories = useMemo(() => {
    if (!bundle) return [];
    const set = new Set(bundle.openfoodfacts.map((p) => p.category));
    return Array.from(set);
  }, [bundle]);

  const novaAudit = useMemo(() => {
    if (!bundle) {
      return filterProductsWithNovaAudit([], {
        selectedCategory,
        selectedNova,
        includeMissingNova,
        searchQuery,
      });
    }
    return filterProductsWithNovaAudit(bundle.openfoodfacts, {
      selectedCategory,
      selectedNova,
      includeMissingNova,
      searchQuery,
    });
  }, [bundle, selectedCategory, selectedNova, includeMissingNova, searchQuery]);

  const filteredProducts = novaAudit.filtered;

  const plottableTrilemmaProducts = useMemo(
    () =>
      filteredProducts.filter(
        (p) => p.nutriscore_score != null && p.ecoscore_score != null && p.nova_group != null
      ),
    [filteredProducts]
  );

  const filteredNutritionInputs = useMemo(
    () => filteredProducts.map(fromOFFProduct),
    [filteredProducts]
  );

  const filteredAgribalyse = useMemo(() => {
    return fullAgribalyse.filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const frName = item.Nom_du_Produit_en_Francais || item.Nom_du_Produit_en_Français || '';
      const grp = item.Groupe_aliment || item["Groupe_d'aliment"] || '';
      return (
        (item.LCI_Name || '').toLowerCase().includes(q) ||
        frName.toLowerCase().includes(q) ||
        grp.toLowerCase().includes(q)
      );
    });
  }, [fullAgribalyse, searchQuery]);

  const policyScenarioResult = useMemo(
    () =>
      evaluatePolicyScenario(currentProfile, currentCalibration, {
        simPlantShiftPct: simPlantShift,
        simUpfReductionPct: simUpfReduction,
        simCarbonTaxEurT: simCarbonTax,
        simWasteCutPct: simWasteCut,
      }),
    [currentProfile, currentCalibration, simPlantShift, simUpfReduction, simCarbonTax, simWasteCut]
  );
  const simulatedMetrics = policyScenarioResult.data;

  const radarOption = useMemo(() => {
    const c = currentProfile.eatLancetIndex;
    const comp = compareProfile.eatLancetIndex;
    const sim = simulatedMetrics.eatLancetSimulated;

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        textStyle: { color: '#111827', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 },
      },
      legend: {
        bottom: 0,
        itemGap: 12,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { color: '#2d3643', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        data: [
          `${currentProfile.name} (base)`,
          `${compareProfile.name} (ref)`,
          'Simulated policy',
          'EAT-Lancet (100%)',
        ],
      },
      radar: {
        radius: '54%',
        center: ['50%', '43%'],
        nameGap: 10,
        indicator: [
          { name: 'Red meat\n(% max)', max: 400 },
          { name: 'Dairy\n(% target)', max: 300 },
          { name: 'Legumes & nuts\n(% target)', max: 150 },
          { name: 'Whole grains\n(% target)', max: 150 },
          { name: 'Veg & fruits\n(% target)', max: 150 },
          { name: 'NOVA 4 UPF\n(% kcal)', max: 70 },
        ],
        axisName: { color: '#2d3643', fontSize: 11, lineHeight: 14, fontFamily: 'Newsreader, Georgia, serif' },
        splitArea: { areaStyle: { color: ['rgba(207,213,223,0.4)', 'rgba(234,237,242,0.4)'] } },
        axisLine: { lineStyle: { color: '#aeb6c4' } },
        splitLine: { lineStyle: { color: '#aeb6c4' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: [c.redMeat, c.dairy, c.legumesNuts, c.wholeGrains, c.vegetablesFruits, c.ultraProcessedShare],
              name: `${currentProfile.name} (base)`,
              itemStyle: { color: '#111827' },
              areaStyle: { color: 'rgba(17, 24, 39, 0.08)' },
              lineStyle: { width: 2 },
            },
            {
              value: [
                comp.redMeat,
                comp.dairy,
                comp.legumesNuts,
                comp.wholeGrains,
                comp.vegetablesFruits,
                comp.ultraProcessedShare,
              ],
              name: `${compareProfile.name} (ref)`,
              itemStyle: { color: '#3f6f7d' },
              areaStyle: { color: 'rgba(63, 111, 125, 0.08)' },
              lineStyle: { width: 1.5, type: 'dashed' },
            },
            {
              value: [
                sim.redMeat,
                sim.dairy,
                sim.legumesNuts,
                sim.wholeGrains,
                sim.vegetablesFruits,
                sim.ultraProcessedShare,
              ],
              name: 'Simulated policy',
              itemStyle: { color: '#8a1253' },
              areaStyle: { color: 'rgba(138, 18, 83, 0.16)' },
              lineStyle: { width: 2.5 },
            },
            {
              value: [100, 100, 100, 100, 100, 15],
              name: 'EAT-Lancet (100%)',
              itemStyle: { color: '#163d4a' },
              lineStyle: { width: 1.5, type: 'dotted' },
            },
          ],
        },
      ],
    };
  }, [currentProfile, compareProfile, simulatedMetrics]);

  const trilemmaScatterOption = useMemo(() => {
    const conciseNovaLabels: Record<number, string> = {
      1: 'NOVA 1 Unprocessed',
      2: 'NOVA 2 Culinary ingredients',
      3: 'NOVA 3 Processed',
      4: 'NOVA 4 Ultra-processed',
    };
    const seriesByNova = [1, 2, 3, 4].map((nova) => {
      const items = plottableTrilemmaProducts.filter((p) => p.nova_group === nova);
      return {
        name: conciseNovaLabels[nova] || NOVA_LABELS[nova],
        type: 'scatter',
        symbolSize: (val: number[]) => Math.max(7, Math.min(24, (val[2] ?? 5) * 1.0)),
        itemStyle: {
          color: NOVA_COLORS[nova],
          opacity: 0.85,
          borderColor: '#111827',
          borderWidth: 1,
        },
        data: items.map((p) => ({
          value: [p.nutriscore_score, p.ecoscore_score, p.proteins_100g ?? 5],
          product: p,
        })),
      };
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        textStyle: { color: '#111827', fontSize: 12, fontFamily: 'Newsreader, Georgia, serif' },
        formatter: (params: { data: { product: OFFProduct } }) => {
          const p = params.data?.product;
          if (!p) return '';
          return `
            <div style="max-width:260px;">
              <div style="font-family:'Hanken Grotesk',sans-serif;font-weight:600;color:#111827;border-bottom:2px solid #2d3643;padding-bottom:3px;margin-bottom:4px;">${p.name}</div>
              <div style="font-size:11px;color:#3d4654;margin-bottom:5px;">${p.brand} | ${p.category}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;font-family:'IBM Plex Mono',monospace;color:#111827;">
                <span>Nutri-Score: <b>${p.nutriscore_grade} (${p.nutriscore_score ?? 'N/A'})</b></span>
                <span>Eco-Score: <b>${p.ecoscore_grade ?? 'N/A'} (${p.ecoscore_score ?? 'N/A'})</b></span>
                <span>Processing: <b style="color:#8a1253;">NOVA ${p.nova_group ?? 'N/A'}</b></span>
                <span>Protein: <b>${p.proteins_100g != null ? `${p.proteins_100g}g` : 'N/A'}</b></span>
              </div>
            </div>
          `;
        },
      },
      legend: {
        top: 0,
        itemGap: 12,
        itemWidth: 12,
        itemHeight: 8,
        textStyle: { color: '#2d3643', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
      },
      grid: { top: 64, right: 24, bottom: 48, left: 60 },
      xAxis: {
        name: 'Nutri-Score FSA points (lower is more nutrient-dense)',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: '#3d4654', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        type: 'value',
        min: -15,
        max: 30,
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      yAxis: {
        name: 'Eco-Score sustainability index (0–100)',
        nameLocation: 'middle',
        nameGap: 42,
        nameTextStyle: { color: '#3d4654', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        type: 'value',
        min: 0,
        max: 100,
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      series: seriesByNova,
    };
  }, [plottableTrilemmaProducts]);

  const hicpSeriesInfo = useMemo(() => {
    if (!bundle) return { targetCode: 'EU27_2020', isFallback: false, data: null };
    const exact = bundle.eurostat[selectedCountry];
    if (exact) {
      return { targetCode: selectedCountry, isFallback: false, data: exact };
    }
    const fallbackCode = bundle.eurostat.EU27_2020 ? 'EU27_2020' : Object.keys(bundle.eurostat)[0];
    return {
      targetCode: fallbackCode,
      isFallback: true,
      data: bundle.eurostat[fallbackCode] || null,
    };
  }, [bundle, selectedCountry]);

  const eurostatOption = useMemo(() => {
    const countryData = hicpSeriesInfo.data;
    if (!countryData) return {};

    const years = ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
    const palette = ['#8a1253', '#111827', '#163d4a', '#3f6f7d', '#525e70', '#6b4c1b', '#7b8696'];
    const isFallback = hicpSeriesInfo.isFallback;

    const series = Object.entries(countryData.categories).map(([code, cat], idx) => ({
      name: isFallback ? `[${hicpSeriesInfo.targetCode} FALLBACK] ${cat.label}` : cat.label,
      type: 'line',
      smooth: false,
      symbolSize: 5,
      lineStyle: { width: code === 'CP01' ? 2.5 : 1.75 },
      itemStyle: { color: palette[idx % palette.length] },
      data: years.map((y) => cat.series[y] ?? null),
    }));

    return {
      backgroundColor: 'transparent',
      title: isFallback
        ? {
            text: `Eurostat HICP [${hicpSeriesInfo.targetCode} FALLBACK]`,
            subtext: `No prc_hicp_aind series for [${currentProfile.code}] — showing EU-27 aggregate`,
            left: 0,
            top: 0,
            textStyle: { color: '#8a1253', fontSize: 12, fontWeight: 700, fontFamily: 'Newsreader, Georgia, serif' },
            subtextStyle: { color: '#3d4654', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' },
          }
        : undefined,
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        textStyle: { color: '#111827', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' },
      },
      legend: {
        top: isFallback ? 42 : 0,
        itemGap: 10,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { color: '#2d3643', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
      },
      grid: { top: isFallback ? 104 : 68, right: 20, bottom: 38, left: 60 },
      xAxis: {
        type: 'category',
        data: years,
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
        axisLine: { lineStyle: { color: '#2d3643' } },
      },
      yAxis: {
        type: 'value',
        name: 'HICP index (2015 = 100)',
        nameLocation: 'middle',
        nameGap: 44,
        nameTextStyle: { color: '#3d4654', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        min: 95,
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      series,
    };
  }, [hicpSeriesInfo, currentProfile.code]);

  const radarDataTable = useMemo(() => {
    const base = currentProfile.eatLancetIndex;
    const comp = compareProfile.eatLancetIndex;
    const sim = simulatedMetrics.eatLancetSimulated;
    return {
      caption: `Planetary Health Diet alignment (% of EAT-Lancet boundary) — [${currentProfile.code}] vs [${compareProfile.code}]`,
      headers: ['Dimension', `${currentProfile.code} Baseline (%)`, `${compareProfile.code} Reference (%)`, 'Simulated (%)', 'EAT-Lancet Target (%)'],
      rows: [
        ['Whole grains', base.wholeGrains, comp.wholeGrains, sim.wholeGrains, 100],
        ['Legumes & nuts', base.legumesNuts, comp.legumesNuts, sim.legumesNuts, 100],
        ['Vegetables & fruit', base.vegetablesFruits, comp.vegetablesFruits, sim.vegetablesFruits, 100],
        ['Dairy', base.dairy, comp.dairy, sim.dairy, 100],
        ['Red meat', base.redMeat, comp.redMeat, sim.redMeat, 100],
        ['NOVA 4 share (% kcal)', base.ultraProcessedShare, comp.ultraProcessedShare, sim.ultraProcessedShare, 15],
      ],
    };
  }, [currentProfile, compareProfile, simulatedMetrics]);

  const eurostatDataTable = useMemo(() => {
    const countryData = hicpSeriesInfo.data;
    if (!countryData) return undefined;
    const years = ['2015', '2018', '2021', '2023', '2025'];
    return {
      caption: hicpSeriesInfo.isFallback
        ? `Eurostat HICP [${hicpSeriesInfo.targetCode} FALLBACK — no prc_hicp_aind series for ${currentProfile.code}] (2015 = 100)`
        : `[${currentProfile.code}] ${currentProfile.name} Eurostat HICP (prc_hicp_aind, 2015 = 100)`,
      headers: ['COICOP Category', ...years],
      rows: Object.values(countryData.categories).map((cat) => [
        hicpSeriesInfo.isFallback ? `[${hicpSeriesInfo.targetCode} FALLBACK] ${cat.label}` : cat.label,
        ...years.map((y) => cat.series[y] ?? null),
      ]),
    };
  }, [hicpSeriesInfo, currentProfile.code, currentProfile.name]);

  const openalexOption = useMemo(() => {
    if (!bundle) return {};
    const years = Array.from({ length: 16 }, (_, i) => 2010 + i);
    const colors = ['#8a1253', '#163d4a', '#3f6f7d', '#6b4c1b'];

    const series = Object.entries(bundle.openalex).map(([topic, yearMap], idx) => ({
      name: topic,
      type: 'bar',
      barMaxWidth: 18,
      stack: 'research',
      itemStyle: { color: colors[idx % colors.length], borderRadius: idx === 3 ? [2, 2, 0, 0] : [0, 0, 0, 0] },
      data: years.map((y) => yearMap[String(y)] || 0),
    }));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        textStyle: { color: '#111827', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' },
      },
      legend: {
        top: 0,
        itemGap: 10,
        itemWidth: 12,
        itemHeight: 8,
        textStyle: { color: '#2d3643', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
      },
      grid: { top: 64, right: 20, bottom: 38, left: 60 },
      xAxis: {
        type: 'category',
        data: years.map(String),
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, interval: 1 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        name: 'Publications / year',
        nameLocation: 'middle',
        nameGap: 44,
        nameTextStyle: { color: '#3d4654', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      series,
    };
  }, [bundle]);

  const agribalyseGroupOption = useMemo(() => {
    const cleanGroupLabel = (raw: string) => {
      const lower = raw.toLowerCase();
      if (lower.includes('viandes') || lower.includes('oeufs') || lower.includes('poissons'))
        return 'Meats, Eggs & Fish';
      if (lower.includes('matières grasses')) return 'Fats & Culinary Oils';
      if (lower.includes('produits laitiers') || lower.includes('lait')) return 'Milk & Dairy Products';
      if (lower.includes('produits céréaliers')) return 'Cereals, Grains & Pulses';
      if (lower.includes('aides culinaires')) return 'Culinary Aids & Condiments';
      if (lower.includes('produits sucrés')) return 'Sweet & Confectionery';
      if (lower.includes('entrées et plats')) return 'Prepared Meals & Dishes';
      if (lower.includes('fruits, légumes')) return 'Fruits, Veg, Legumes & Nuts';
      if (lower.includes('glaces et sorbets')) return 'Ice Cream & Sorbets';
      if (lower.includes('boissons')) return 'Beverages & Drinks';
      if (lower.includes('aliments infantiles')) return 'Infant Formula & Foods';
      return raw.slice(0, 26);
    };

    const agg = aggregateEnvironmentByCategory(filteredAgribalyse.map(fromAgribalyseItem), agbChartIndicator);
    const spec = ENVIRONMENT_INDICATOR_SPECS[agbChartIndicator];
    const entries = agg.data
      .filter((row) => row.mean !== null)
      .map((row) => ({
        group: `${cleanGroupLabel(row.category)} (n=${row.validDenominator})`,
        meanVal: +(row.mean as number).toFixed(2),
      }))
      .sort((a, b) => b.meanVal - a.meanVal)
      .slice(0, 10);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        textStyle: { color: '#111827', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' },
      },
      legend: {
        top: 0,
        itemGap: 14,
        textStyle: { color: '#2d3643', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
      },
      grid: { top: 44, right: 24, bottom: 48, left: 190 },
      xAxis: {
        type: 'value',
        min: 0,
        name: `Mean ${spec.label} (${spec.unit}) · FR LCI Cradle-to-Consumer`,
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: '#3d4654', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: entries.map((e) => e.group),
        axisLabel: {
          color: '#111827',
          fontSize: 11,
          fontFamily: 'Newsreader, Georgia, serif',
        },
      },
      series: [
        {
          name: `${spec.label} (${spec.unit})`,
          type: 'bar',
          barMaxWidth: 16,
          itemStyle: {
            color: agbChartIndicator === 'water_aware_m3' ? '#163d4a' : '#8a1253',
            borderRadius: [0, 2, 2, 0],
          },
          data: entries.map((e) => e.meanVal),
        },
      ],
    };
  }, [filteredAgribalyse, agbChartIndicator]);

  const pooreLcaOption = useMemo(() => {
    const items = globalBenchmarks?.poore_nemecek_lca || [];
    const targetOrder = [
      'Beef (beef herd)',
      'Lamb & Mutton',
      'Cheese',
      'Beef (dairy herd)',
      'Pig Meat',
      'Poultry Meat',
      'Eggs',
      'Rice',
      'Tofu',
      'Peas',
    ];
    const selected = targetOrder
      .map((name) => items.find((r) => r.food_item === name))
      .filter((x): x is PooreLcaItem => Boolean(x));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        textStyle: { color: '#111827', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' },
      },
      legend: {
        top: 0,
        itemGap: 12,
        textStyle: { color: '#2d3643', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
      },
      grid: { top: 44, right: 24, bottom: 48, left: 152 },
      xAxis: {
        type: 'value',
        min: 0,
        name: 'Poore & Nemecek (2018) Global Supply-Chain GHG (kg CO₂eq / kg)',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: '#3d4654', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: selected.map((s) => s.food_item),
        axisLabel: { color: '#111827', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
      },
      series: [
        {
          name: 'Farm + Land Use + Feed',
          type: 'bar',
          stack: 'ghg',
          barMaxWidth: 16,
          itemStyle: { color: '#8a1253' },
          data: selected.map((s) => +(s.stage_farm + s.stage_land_use + s.stage_animal_feed).toFixed(2)),
        },
        {
          name: 'Processing + Packaging + Losses',
          type: 'bar',
          stack: 'ghg',
          barMaxWidth: 16,
          itemStyle: { color: '#6b4c1b' },
          data: selected.map((s) => +(s.stage_processing + s.stage_packaging + s.stage_losses).toFixed(2)),
        },
        {
          name: 'Transport + Retail',
          type: 'bar',
          stack: 'ghg',
          barMaxWidth: 16,
          itemStyle: { color: '#163d4a' },
          data: selected.map((s) => +(s.stage_transport + s.stage_retail).toFixed(2)),
        },
      ],
    };
  }, [globalBenchmarks]);

  const toggleNova = (nova: number) => {
    setSelectedNova((prev) =>
      prev.includes(nova) ? (prev.length > 1 ? prev.filter((n) => n !== nova) : prev) : [...prev, nova]
    );
  };

  const handleExportDataset = async () => {
    if (exportDatasetKey === 'off') {
      exportFilteredCsv();
      return;
    }
    if (exportDatasetKey === 'country_profile') {
      const headers = [
        'Country_Code',
        'Country_Name',
        'Baseline_Data_Nature',
        'Baseline_CO2_kg_d',
        'Simulated_CO2_kg_d',
        'CO2_Delta_Pct',
        'Policy_CI95_Available',
        'Baseline_Cost_EUR_d',
        'Simulated_Cost_EUR_d',
        'Cost_Delta_Pct_Unadjusted_Nominal',
        'PPP_Normalized',
        'Plant_Shift_Pct',
        'UPF_Reduction_Pct',
        'Carbon_Tax_EUR_t',
      ];
      const row = [
        currentProfile.code,
        currentProfile.name,
        simulatedMetrics.baselineNature,
        currentProfile.dailyCarbonKg,
        simulatedMetrics.newCarbon,
        simulatedMetrics.carbonDeltaPct,
        simulatedMetrics.uncertaintyStatus.available,
        currentProfile.dailyBasketCostEur,
        simulatedMetrics.newCost,
        simulatedMetrics.costDeltaPct,
        simulatedMetrics.pppStatus.pppNormalized,
        simPlantShift,
        simUpfReduction,
        simCarbonTax,
      ];
      downloadCsvContent(
        serializeCsvTable(headers, [row]),
        `dietshift_${currentProfile.code}_simulation.csv`
      );
      return;
    }
    if (exportDatasetKey === 'agribalyse') {
      const headers = ['Code_AGB', 'Code_CIQUAL', 'Name_EN', 'Group', 'CO2_kg_per_kg', 'Water_m3_per_kg', 'Land_Pt_per_kg', 'EF_Score'];
      const rows = fullAgribalyse.map((a) => [
        a.Code_AGB,
        a.Code_CIQUAL ?? '',
        a.LCI_Name || '',
        a.Groupe_aliment || a["Groupe_d'aliment"] || '',
        a.Changement_climatique_kg_CO2eq ?? a.Changement_climatique ?? '',
        a.Eau_m3 ?? a['Épuisement_des_ressources_eau'] ?? '',
        a.Sol_Pt ?? a.Utilisation_du_sol ?? '',
        a.Score_unique_EF ?? '',
      ]);
      downloadCsvContent(
        serializeCsvTable(headers, rows),
        'dietshift_agribalyse_31.csv'
      );
      return;
    }
    // Empirical microdata JSON -> CSV (cached via dataProvider)
    const fileMap: Record<string, string> = {
      time_use: 'data/time_use_cooking_friction.json',
      biomarkers: 'data/clinical_biomarker_grounding.json',
      school_meals: 'data/school_meals_procurement.json',
      cultural_inertia: 'data/cultural_climate_inertia.json',
    };
    const path = fileMap[exportDatasetKey];
    if (!path) return;
    try {
      const json = await fetchCachedJson<Record<string, unknown>[]>(path);
      if (!json.length) return;
      const keys = Object.keys(json[0]);
      const rows = json.map((row) => keys.map((k) => row[k] as string | number | boolean | null | undefined));
      downloadCsvContent(
        serializeCsvTable(keys, rows),
        `dietshift_${exportDatasetKey}.csv`
      );
    } catch (err: unknown) {
      const disclosure = classifyResourceError(err, { resourcePath: path });
      const msg = disclosure.isExcludedTrackB
        ? `${disclosure.resourceLabel}: ${disclosure.headline}. ${disclosure.detail}`
        : `Export ${path}: ${disclosure.detail}`;
      setLoadWarnings((prev) => (prev.includes(msg) ? prev : [...prev, msg]));
    }
  };

  const exportFilteredCsv = () => {
    const headers = ['Code', 'Product_Name', 'Brand', 'Category', 'NutriScore', 'EcoScore', 'NOVA', 'Proteins_100g', 'Energy_kcal_100g', 'Primary_Country'];
    const rows = filteredProducts.map((p) => [
      p.code,
      p.name || '',
      p.brand || '',
      p.category,
      p.nutriscore_grade,
      p.ecoscore_score ?? '',
      p.nova_group ?? '',
      p.proteins_100g ?? '',
      p.energy_kcal_100g ?? '',
      p.primary_country ?? '',
    ]);
    downloadCsvContent(
      serializeCsvTable(headers, rows),
      `dietshift_openfoodfacts_${selectedCountry}.csv`
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <RefreshCw className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
        <div className="text-lg font-display-head">
          Loading DietShift Atlas Almanac (Eurostat, INE, ISTAT, Agribalyse 3.1 & DuckDB Parquet)...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
      {/* Top Almanac Masthead (Hallmark Floor: no tracked caps, no decorative dots, no emoji icons) */}
      <header className="almanac-sheet px-5 py-4 mb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-4 pb-3 rule-firm">
          <div className="flex items-center gap-3.5">
            <DietShiftLogo className="w-11 h-11 shrink-0" size={44} />
            <div>
              <div className="flex flex-wrap items-baseline gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight">
                  DietShift Atlas
                </h1>
                <span className="almanac-label">
                  European & Global Food Systems Almanac — Edition 2026 (v4.0)
                </span>
                <a
                  href="https://www.linkedin.com/in/zouaghi-amine/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="almanac-pill inline-flex items-center gap-1.5 text-xs text-[var(--color-ink)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                  title="Author: Amine Zouaghi on LinkedIn"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"></span>
                  Made by <span className="font-semibold">Amine</span>
                </a>
              </div>
              <p className="almanac-label text-xs">
                Multi-source observatory harmonizing EFSA FoodEx2 dietary surveys, ADEME Agribalyse 3.1 LCA (2,451
                items), Open Food Facts ({bundle?.openfoodfacts.length.toLocaleString()} products), National Statistical
                Institutes, and Digital Infodemiology.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCatalogOpen(true)}
              className="almanac-btn flex items-center gap-1.5"
              title="Inspect dataset registry, data nature, schemas, and automated quality checks"
            >
              <Database className="w-3.5 h-3.5 text-[var(--color-accent)]" />
              <span>Data Catalog ({datasetsRegistry?.total_datasets ?? 19})</span>
            </button>
            <a
              href={assetUrl('public_guide.html')}
              target="_blank"
              rel="noopener noreferrer"
              className="almanac-btn flex items-center gap-1.5"
              title="A friendly guide to DietShift Atlas for the general public"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#8a1253]" />
              <span>Public Guide</span>
            </a>
            <button
              onClick={() => setActiveModule('floorplan')}
              className={`almanac-btn flex items-center gap-1.5 ${
                activeModule === 'floorplan' ? 'almanac-btn--primary' : ''
              }`}
              title="Inspect interactive codebase floorplan"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Code Floorplan</span>
            </button>
            <a
              href="https://www.linkedin.com/in/zouaghi-amine/"
              target="_blank"
              rel="noopener noreferrer"
              className="almanac-btn flex items-center gap-1.5"
              title="Connect with Amine Zouaghi on LinkedIn"
            >
              <LinkedinIcon className="w-3.5 h-3.5 text-[#0a66c2]" />
              <span>LinkedIn</span>
            </a>
            <div className="flex items-center gap-1">
              <select
                value={exportDatasetKey}
                onChange={(e) => setExportDatasetKey(e.target.value)}
                className="almanac-input text-xs py-1 px-2"
                title="Select dataset to export as CSV"
              >
                <option value="off">Open Food Facts EU ({filteredProducts.length.toLocaleString()})</option>
                <option value="agribalyse">Agribalyse 3.1.1 LCA ({fullAgribalyse.length.toLocaleString()})</option>
                <option value="country_profile">Country Simulation ({currentProfile.code})</option>
                <option value="time_use">Time Use &amp; Cooking Friction (MTUS, 60)</option>
                <option value="biomarkers">Clinical Biomarkers (NHANES, 5)</option>
                <option value="school_meals">School Meals Procurement (GCNF, 7)</option>
                <option value="cultural_inertia">Cultural &amp; Climate Inertia (ESS, 11)</option>
              </select>
              <button
                onClick={handleExportDataset}
                className="almanac-btn flex items-center gap-1.5"
                title="Export selected dataset to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopiedNotice('Permalink copied');
                setTimeout(() => setCopiedNotice(null), 2500);
              }}
              className="almanac-btn flex items-center gap-1.5"
              title="Copy shareable analytical permalink with active country & intervention state"
            >
              <span>{copiedNotice === 'Permalink copied' ? '✓ Permalink Copied' : 'Copy Permalink'}</span>
            </button>
            <button
              onClick={() => {
                const tableCount = datasetsRegistry?.total_datasets ?? 19;
                const rowCount = (datasetsRegistry?.total_records ?? 17627).toLocaleString();
                const bibtex = `@software{zouaghi2026dietshift,\n  author = {Zouaghi, Amine},\n  title = {DietShift Atlas: European \\& Global Food Systems Computational Almanac},\n  year = {2026},\n  version = {${APP_VERSION}},\n  url = {https://aminezghi.github.io/dietshift-atlas/},\n  note = {${tableCount} DuckDB-Wasm Parquet tables (${rowCount} rows); FutureData4EU Fellowship}\n}`;
                navigator.clipboard.writeText(bibtex);
                setCopiedNotice('BibTeX copied');
                setTimeout(() => setCopiedNotice(null), 2500);
              }}
              className="almanac-btn flex items-center gap-1.5"
              title="Copy BibTeX citation (CITATION.cff)"
            >
              <span>{copiedNotice === 'BibTeX copied' ? '✓ BibTeX Copied' : 'Cite (BibTeX)'}</span>
            </button>
            <button
              onClick={() => toggleTheme()}
              className="almanac-btn flex items-center gap-1.5"
              title="Toggle Evening Obsidian Dark Mode / Cool Slate Light Mode"
              aria-label="Toggle color theme"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-[#f0c36b]" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{isDark ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Strip */}
        <nav className="flex flex-wrap items-center gap-1.5 pt-3">
          {[
            { id: 'overview', label: 'I. Almanac overview & plate', icon: Compass },
            { id: 'nsi_ml', label: 'II. NSI & statistical forecasts', icon: Cpu },
            { id: 'consumer_pulse', label: 'III. Consumer behavior & infodemiology', icon: Users },
            { id: 'map', label: 'IV. Full cartography', icon: Globe2 },
            { id: 'duckdb', label: 'V. DuckDB Parquet SQL', icon: Database },
            { id: 'sandbox', label: 'VI. Researcher survey ledger', icon: ShoppingBasket },
            { id: 'trilemma', label: 'VII. Retail product trilemma', icon: ShoppingBag },
            { id: 'lca', label: 'VIII. Agribalyse 3.1 (2,451)', icon: Layers },
            { id: 'inflation', label: 'IX. Affordability & integrated comparator', icon: TrendingUp },
            { id: 'simulator', label: 'X. Policy intervention model', icon: Sliders },
            { id: 'floorplan', label: 'XI. Code floorplan & architecture', icon: Network },
            { id: 'gs1_immagino', label: 'XII. Pan-EU Retail Scanner & Claims', icon: ShoppingBag },
            { id: 'sensitivity', label: 'XIII. Empirical sensitivity', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeModule === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveModule(tab.id as ActiveModule)}
                className={`almanac-btn flex items-center gap-1.5 ${active ? 'almanac-btn--primary' : ''}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Split: Left CHEFS Control Deck + Right Almanac Sheet Canvas */}
      <div className="flex-1 flex flex-col lg:flex-row gap-5">
        {/* LEFT CONTROL DECK (Almanac Ruled Sheet) */}
        <aside className="w-full lg:w-80 xl:w-84 shrink-0 space-y-4">
          {/* 1. Geographic Scope */}
          <div className="almanac-sheet p-4">
            <div className="flex items-center justify-between pb-2 mb-2.5 rule-firm">
              <span className="font-display-head font-semibold text-sm flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5" />
                1. Jurisdiction selection
              </span>
              <span className="num text-xs text-[var(--color-muted)]">25 editions</span>
            </div>

            <label className="block almanac-label mb-1">Primary jurisdiction (or click map)</label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full almanac-select mb-3"
            >
              {Object.values(COUNTRY_PROFILES).map((c) => (
                <option key={c.code} value={c.code}>
                  [{c.code}] {c.name} ({c.region})
                </option>
              ))}
            </select>

            <label className="block almanac-label mb-1">Reference comparison</label>
            <select
              value={comparisonCountry}
              onChange={(e) => setComparisonCountry(e.target.value)}
              className="w-full almanac-select"
            >
              {Object.values(COUNTRY_PROFILES).map((c) => (
                <option key={c.code} value={c.code}>
                  [{c.code}] {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Product & NOVA Filter */}
          <div className="almanac-sheet p-4">
            <div className="flex items-center justify-between pb-2 mb-2.5 rule-firm">
              <span className="font-display-head font-semibold text-sm flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                2. Assortment & NOVA filter
              </span>
              <span className="num text-xs text-[var(--color-muted)]">{bundle?.openfoodfacts.length} records</span>
            </div>

            <div className="relative mb-2.5">
              <Search className="w-3.5 h-3.5 text-[var(--color-muted)] absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter food, brand, or LCA item..."
                className="w-full almanac-input pl-8"
              />
            </div>

            <label className="block almanac-label mb-1">Retail food category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full almanac-select mb-3"
            >
              <option value="ALL">All harmonized categories ({bundle?.openfoodfacts.length || 0})</option>
              {offCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <label className="block almanac-label mb-1.5">NOVA processing classification</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[1, 2, 3, 4].map((nova) => {
                const active = selectedNova.includes(nova);
                return (
                  <button
                    key={nova}
                    onClick={() => toggleNova(nova)}
                    className={`almanac-btn flex items-center gap-1.5 justify-start ${
                      active ? 'bg-[var(--color-paper-2)] font-semibold' : 'opacity-50'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 shrink-0"
                      style={{ backgroundColor: NOVA_COLORS[nova] }}
                    />
                    <span>NOVA {nova}</span>
                  </button>
                );
              })}
            </div>
            <label className="mt-2 flex items-center justify-between gap-2 text-[11px] font-mono-num text-[var(--color-ink-2)] cursor-pointer select-none border border-[var(--color-rule)] px-2 py-1 bg-[var(--color-paper-2)]">
              <span className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={includeMissingNova}
                  onChange={(e) => setIncludeMissingNova(e.target.checked)}
                  data-testid="toggle-missing-nova"
                />
                <span>Include Unknown NOVA (NULL)</span>
              </span>
              <span className="font-semibold text-[var(--color-muted)]">
                {novaAudit.missingNovaMatchedCount}
              </span>
            </label>
            {novaAudit.missingNovaMatchedCount > 0 && (
              <div className="mt-1 text-[10px] font-mono-num text-[var(--color-muted)]">
                {includeMissingNova
                  ? `${novaAudit.missingNovaMatchedCount} NULL-NOVA items included · ${novaAudit.excludedNonMatchingNovaCount} excluded by NOVA group`
                  : `${novaAudit.excludedMissingNovaCount} NULL-NOVA items excluded · ${novaAudit.excludedNonMatchingNovaCount} non-matching`}
              </div>
            )}
          </div>

          {/* 3. Policy & Behavioral Levers */}
          <div className="almanac-sheet p-4">
            <div className="flex items-center justify-between pb-2 mb-2.5 rule-firm">
              <span className="font-display-head font-semibold text-sm flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                3. Policy & behavioral levers
              </span>
              <button
                onClick={() => {
                  setSimPlantShift(35);
                  setSimUpfReduction(25);
                  setSimCarbonTax(50);
                  setSimWasteCut(20);
                }}
                className="almanac-label text-xs hover:text-[var(--color-accent)] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span>Plant-protein substitution</span>
                <span className="num font-semibold text-[var(--color-accent)]">{simPlantShift}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                value={simPlantShift}
                onChange={(e) => setSimPlantShift(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span>NOVA 4 ultra-processed reduction</span>
                <span className="num font-semibold text-[var(--color-accent)]">{simUpfReduction}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={75}
                value={simUpfReduction}
                onChange={(e) => setSimUpfReduction(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span>Carbon levy + produce subsidy</span>
                <span className="num font-semibold text-[var(--color-accent)]">€{simCarbonTax}/t</span>
              </div>
              <input
                type="range"
                min={0}
                max={150}
                step={5}
                value={simCarbonTax}
                onChange={(e) => setSimCarbonTax(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Household food waste reduction</span>
                <span className="num font-semibold text-[var(--color-accent)]">{simWasteCut}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                value={simWasteCut}
                onChange={(e) => setSimWasteCut(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>
          </div>

          {/* 4. Parquet & API Provenance */}
          <div className="almanac-sheet p-4 text-xs space-y-1.5">
            <div className="font-display-head font-semibold pb-1.5 mb-1.5 rule-firm flex items-center justify-between">
              <button
                onClick={() => setCatalogOpen(true)}
                className="flex items-center gap-1.5 hover:text-[var(--color-accent)] cursor-pointer text-left"
                title="Open full dataset registry and validation report"
              >
                <Database className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                Registered Parquet tables ({datasetsRegistry?.total_datasets ?? 19})
              </button>
              <span className="font-mono-num text-[11px] text-[var(--color-accent)] font-semibold">
                {(datasetsRegistry?.total_records ?? 17627).toLocaleString()} rows
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1 font-mono-num text-[11px] divide-y divide-[var(--color-parchment-deep)]">
              {(datasetsRegistry?.datasets ?? []).map((ds) => (
                <div key={ds.id} className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={() => setCatalogOpen(true)}
                    className="truncate text-left hover:text-[var(--color-accent)] cursor-pointer"
                    title={`${ds.name} (${ds.data_nature}, ${ds.validation_status.toUpperCase()})`}
                  >
                    {ds.file_path.replace('data/parquet/', '')}
                  </button>
                  <span className="font-semibold text-[var(--color-ink)] shrink-0">
                    {ds.record_count.toLocaleString()} rows
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* RIGHT MAIN CANVAS */}
        <main className="flex-1 min-w-0 space-y-5">
          {loadWarnings.length > 0 && (
            <div
              role="alert"
              className="almanac-sheet p-3.5 border border-[#8a1253] bg-[#8a1253]/10 text-xs flex flex-wrap items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2 text-[#8a1253] font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Partial data load warning (non-blocking): {loadWarnings.join(' · ')}
              </span>
              <button
                type="button"
                onClick={() => {
                  setLoadWarnings([]);
                  setBootRetryTick((t) => t + 1);
                }}
                className="almanac-btn text-[11px] flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Retry Failed Streams
              </button>
            </div>
          )}

          {/* Hallmark Almanac Stat Row (1 sheet with hairline column dividers instead of floating cards) */}
          <section className="almanac-sheet p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-3 rule-firm">
              <span className="font-display-head font-semibold text-sm flex flex-wrap items-center gap-2">
                National dietary and planetary boundary ledger — [{currentProfile.code}] {currentProfile.name}
                <DataNatureBadge nature="Manually Compiled" label="Baseline" />
                <DataNatureBadge nature="Simulated" label="Analyst Levers" />
              </span>
              <span className="almanac-label text-xs">
                Illustrative deterministic perturbation ({simPlantShift}% plant shift, {simUpfReduction}% NOVA 4 cut · uncertainty N/A)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-rule)]">
              <div className="px-3 first:pl-0 py-1">
                <div className="almanac-label">Dietary carbon footprint</div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-semibold num text-[var(--color-accent)]">
                    {simulatedMetrics.newCarbon}
                  </span>
                  <span className="text-xs num text-[var(--color-muted)]">
                    kg CO₂eq/d (base {currentProfile.dailyCarbonKg} · Policy CI N/A)
                  </span>
                </div>
                <div className="almanac-label text-xs mt-1">
                  Delta: <span className="num font-semibold">{simulatedMetrics.carbonDeltaPct}%</span> | Target: 1.95 kg | ε={currentCalibration?.empirical_own_price_elasticity ?? -0.65}
                </div>
              </div>

              <div className="px-3 py-1">
                <div className="almanac-label">Land &amp; water footprint (heuristic)</div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-semibold num text-[var(--color-ink)]">
                    {simulatedMetrics.newLand}
                  </span>
                  <span className="text-xs num text-[var(--color-muted)]">
                    m²/d | {simulatedMetrics.newWater} L/d
                  </span>
                </div>
                <div className="almanac-label text-xs mt-1">
                  Compiled base: <span className="num">{currentProfile.dailyLandM2} m² &amp; {currentProfile.dailyWaterLiters} L</span>
                </div>
              </div>

              <div className="px-3 py-1">
                <div className="almanac-label">Daily consumer basket cost</div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-semibold num text-[var(--color-ink)]">
                    €{simulatedMetrics.newCost}
                  </span>
                  <span className="text-xs num text-[var(--color-muted)]">
                    /d (base €{currentProfile.dailyBasketCostEur})
                  </span>
                </div>
                <div className="almanac-label text-xs mt-1">
                  Unadjusted nominal Δ: <span className="num font-semibold">{simulatedMetrics.costDeltaPct}%</span> (not PPP)
                </div>
              </div>

              <div className="px-3 py-1">
                <div className="almanac-label">Attitude–behavior gap</div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-semibold num text-[var(--color-ink)]">
                    {currentProfile.sayDoGapScore}
                  </span>
                  <span className="text-xs num text-[var(--color-muted)]">/ 100 index</span>
                </div>
                <div className="almanac-label text-xs mt-1">
                  Plant protein share: <span className="num font-semibold">{currentProfile.plantProteinSharePct}%</span>
                </div>
              </div>

              <div className="px-3 py-1">
                <div className="almanac-label">Cardiometabolic co-benefit</div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-semibold num text-[var(--color-accent)]">
                    +{simulatedMetrics.healthGainPct}%
                  </span>
                  <span className="text-xs text-[var(--color-muted)]">DALY risk reduction</span>
                </div>
                <div className="almanac-label text-xs mt-1">
                  NOVA 4 share: <span className="num">{currentProfile.eatLancetIndex.ultraProcessedShare}% → {simulatedMetrics.eatLancetSimulated.ultraProcessedShare}%</span>
                </div>
              </div>
            </div>
          </section>

          {/* MODULE I: OVERVIEW & PLATE */}
          {activeModule === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <InteractiveChoroplethMap
                selectedCountry={selectedCountry}
                onSelectCountry={setSelectedCountry}
                compact={true}
              />

              <div className="almanac-sheet p-4 flex flex-col">
                <div className="pb-2.5 mb-2 rule-firm">
                  <h2 className="text-base font-semibold flex flex-wrap items-center gap-2">
                    <Compass className="w-4 h-4" />
                    Plate II. Planetary health diet alignment ([{currentProfile.code}] {currentProfile.name} vs. [
                    {compareProfile.code}] {compareProfile.name})
                    <DataNatureBadge nature="Estimated" />
                    <DataNatureBadge nature="Simulated" />
                  </h2>
                  <p className="almanac-label">
                    National dietary intake relative to EAT-Lancet reference boundaries (100%).
                  </p>
                </div>
                <div className="h-80 w-full">
                  <ReactECharts
                    option={radarOption}
                    style={{ height: '100%', width: '100%' }}
                    notMerge={true}
                    ariaLabel={`Planetary health diet radar comparing ${currentProfile.name} and ${compareProfile.name}`}
                    accessibleSummary={`Planetary health radar across Whole grains, Legumes and nuts, Vegetables and fruit, Dairy, Red meat, and NOVA 4 share relative to EAT-Lancet 100% boundaries for ${currentProfile.name}.`}
                    dataTableFallback={radarDataTable}
                  />
                </div>
              </div>

              <div className="almanac-sheet p-4 flex flex-col">
                <div className="flex items-start justify-between pb-2.5 mb-2 rule-firm">
                  <div>
                    <h2 className="text-base font-semibold flex flex-wrap items-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      Plate III. Retail product trilemma ({plottableTrilemmaProducts.length} / {filteredProducts.length} Open Food Facts items)
                      <DataNatureBadge nature="Observed" />
                    </h2>
                    <p className="almanac-label">
                      Nutri-Score points vs. Eco-Score sustainability colored by NOVA group ({filteredProducts.length - plottableTrilemmaProducts.length} items with missing Eco-Score/NOVA excluded).
                    </p>
                  </div>
                  <button onClick={() => setActiveModule('trilemma')} className="almanac-btn">
                    Open ledger
                  </button>
                </div>
                <div className="h-80 w-full">
                  <ReactECharts option={trilemmaScatterOption} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>

              <div className="almanac-sheet p-4 flex flex-col">
                <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 mb-2 rule-firm">
                  <div>
                    <h2 className="text-base font-semibold flex flex-wrap items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      {plate4Mode === 'poore'
                        ? 'Plate IV. Global Farm LCA by Supply-Chain Stage (Poore & Nemecek 2018)'
                        : `Plate IV. ADEME Agribalyse 3.1 LCA synthesis (${filteredAgribalyse.length.toLocaleString()} items)`}
                      <DataNatureBadge
                        nature={resolveDatasetNature(
                          datasetsRegistry,
                          plate4Mode === 'poore' ? 'global_poore_nemecek_lca' : 'agribalyse_31',
                          plate4Mode === 'poore' ? 'Estimated' : 'Model Output'
                        )}
                      />
                    </h2>
                    <p className="almanac-label">
                      {plate4Mode === 'poore'
                        ? 'Harmonized meta-analysis across 38,700 farms in 119 countries: land use & farm stages dominate over transport (<2%).'
                        : `Mean ${ENVIRONMENT_INDICATOR_SPECS[agbChartIndicator].label} (${ENVIRONMENT_INDICATOR_SPECS[agbChartIndicator].unit}) across ADEME Agribalyse 3.1.1 food groups.`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPlate4Mode('agribalyse')}
                      className={`almanac-btn ${plate4Mode === 'agribalyse' ? 'almanac-btn--primary' : ''}`}
                    >
                      EU Agribalyse
                    </button>
                    <button
                      onClick={() => setPlate4Mode('poore')}
                      className={`almanac-btn ${plate4Mode === 'poore' ? 'almanac-btn--primary' : ''}`}
                    >
                      Global (119 countries)
                    </button>
                    <button onClick={() => setActiveModule('duckdb')} className="almanac-btn">
                      Query SQL
                    </button>
                  </div>
                </div>
                <div className="h-80 w-full">
                  <ReactECharts
                    option={plate4Mode === 'poore' ? pooreLcaOption : agribalyseGroupOption}
                    notMerge={true}
                    style={{ height: '100%', width: '100%' }}
                    ariaLabel={
                      plate4Mode === 'poore'
                        ? 'Plate IV Global Farm LCA by Supply-Chain Stage'
                        : 'Plate IV ADEME Agribalyse 3.1 LCA synthesis'
                    }
                    accessibleSummary={
                      plate4Mode === 'poore'
                        ? 'Horizontal stacked bar chart comparing Land use, Farm stage, Processing and packaging, and Transport and retail GHG emissions per kg across global commodities.'
                        : `Horizontal bar chart of mean ${ENVIRONMENT_INDICATOR_SPECS[agbChartIndicator].label} in ${ENVIRONMENT_INDICATOR_SPECS[agbChartIndicator].unit} across top 10 Agribalyse food groups.`
                    }
                  />
                </div>
              </div>
              </div>

              {/* Distributional Equity (Q1 vs. Q5) & Global Sensitivity Analysis */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <div className="almanac-sheet p-4 space-y-3">
                  <div className="pb-2 rule-firm flex items-center justify-between">
                    <span className="font-display-head font-semibold text-sm">
                      Distributional Equity & Regressive Incidence (Q1 vs. Q5)
                    </span>
                    <span className="almanac-label text-[11px] font-mono-num">
                      Eurostat HBS × EHIS × WB CoHD
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">
                    Calibrated to [{currentProfile.code}] live Eurostat HBS quintile food shares (Q1:{' '}
                    <b>{currentCalibration?.hbs_q1_food_share_pct ?? '—'}%</b> vs Q5:{' '}
                    <b>{currentCalibration?.hbs_q5_food_share_pct ?? '—'}%</b> of household spend, food PLI{' '}
                    <b>{currentCalibration?.eurostat_food_ppp_index_eu27_100 ?? 100}</b> vs EU27=100) and out-of-sample
                    2022–24 HICP backtest MAPE (<b>{currentCalibration?.hicp_backtest_22_24_mape_pct ?? '—'}%</b>).
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="almanac-well p-3">
                      <div className="almanac-label text-[11px]">Q1 (Lowest Income) Budget Impact</div>
                      <div className="text-lg font-semibold font-mono-num text-[var(--color-accent)] mt-0.5">
                        {simulatedMetrics.q1BudgetImpactPct >= 0 ? '+' : ''}
                        {simulatedMetrics.q1BudgetImpactPct}%
                      </div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                        5+ fruit/veg (EHIS):{' '}
                        <span className="font-semibold">
                          {currentCalibration?.ehis_q1_5plus_veg_pct ?? '—'}%
                        </span>{' '}
                        | 0 veg: {currentCalibration?.ehis_q1_zero_veg_pct ?? '—'}%
                      </div>
                    </div>
                    <div className="almanac-well p-3">
                      <div className="almanac-label text-[11px]">Q5 (Highest Income) Budget Impact</div>
                      <div className="text-lg font-semibold font-mono-num text-[var(--color-primary)] mt-0.5">
                        {simulatedMetrics.q5BudgetImpactPct >= 0 ? '+' : ''}
                        {simulatedMetrics.q5BudgetImpactPct}%
                      </div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                        5+ fruit/veg (EHIS):{' '}
                        <span className="font-semibold">
                          {currentCalibration?.ehis_q5_5plus_veg_pct ?? '—'}%
                        </span>{' '}
                        | HICP meat +21–24: +{currentCalibration?.hicp_meat_inflation_21_24_pct ?? '—'}%
                      </div>
                    </div>
                  </div>
                  {globalBenchmarks && (
                    <div className="text-[11px] font-mono-num text-[var(--color-ink)] bg-[var(--color-paper-2)] p-2 border border-[var(--color-rule)] flex flex-wrap gap-x-3 gap-y-1">
                      <span className="font-semibold text-[var(--color-primary)]">WB/FAO CoHD (2024):</span>
                      {(['ITA', 'USA', 'BRA', 'IND', 'NGA'] as const).map((iso) => {
                        const rec = globalBenchmarks.cohd_latest_by_country.find((c) => c.iso3 === iso);
                        if (!rec) return null;
                        return (
                          <span key={iso}>
                            <b>{iso}</b> ${rec.cost_healthy_diet_ppp_usd} PPP/d ({rec.unaffordable_pct ?? '—'}% unafford.)
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="text-[11px] font-mono-num text-[var(--color-ink)] bg-[var(--color-parchment)] p-2 border border-[var(--color-parchment-deep)]">
                    Policy Prescription ({simulatedMetrics.q1TaxExposureRatio}× Q1/Q5 food-budget exposure):{' '}
                    {simCarbonTax > 60
                      ? 'Regressive without rebate — pair carbon pricing with Q1 legume/produce vouchers & school canteen mandates.'
                      : 'Moderately progressive — NOVA-4 reduction offsets carbon price incidence.'}
                  </div>
                </div>

                <div className="almanac-sheet p-4 space-y-3">
                  <div className="pb-2 rule-firm flex items-center justify-between gap-2">
                    <span className="font-display-head font-semibold text-sm flex items-center gap-2">
                      Policy Lever One-at-a-Time Response
                      <DataNatureBadge nature="Simulated" label="OAT Levers" />
                    </span>
                    <button
                      onClick={() => setActiveModule('sensitivity')}
                      className="almanac-btn text-[11px]"
                    >
                      Open Sensitivity Lab
                    </button>
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">
                    Active policy slider perturbations on [{currentProfile.code}] {currentProfile.name} (baseline {currentProfile.dailyCarbonKg} → simulated {simulatedMetrics.newCarbon} kg CO₂/d, {simulatedMetrics.carbonDeltaPct}%). For empirical data, mapping, proxy &amp; missingness sensitivity across real datasets, open <b>Section XIII</b>.
                  </p>
                  <div className="space-y-2 pt-1 font-mono-num text-xs">
                    {[
                      { label: '1. Plant Protein Shift Lever', pct: Math.min(100, Math.round((simPlantShift / 60) * 100)), raw: `${simPlantShift}%`, color: 'bg-[var(--color-primary)]' },
                      { label: '2. NOVA-4 UPF Reduction Lever', pct: Math.min(100, Math.round((simUpfReduction / 75) * 100)), raw: `${simUpfReduction}%`, color: 'bg-[var(--color-accent)]' },
                      { label: '3. Carbon Price Alignment', pct: Math.min(100, Math.round((simCarbonTax / 150) * 100)), raw: `€${simCarbonTax}/t`, color: 'bg-[#2d6a4f]' },
                      { label: '4. Household Food Waste Cut', pct: Math.min(100, Math.round((simWasteCut / 50) * 100)), raw: `${simWasteCut}%`, color: 'bg-[#6c757d]' },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span>{item.label}</span>
                          <span className="font-semibold">{item.raw}</span>
                        </div>
                        <div className="w-full h-2 bg-[var(--color-parchment-deep)] overflow-hidden">
                          <div className={`h-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE II: NSI & STATISTICAL FORECASTING LAB */}
          {activeModule === 'nsi_ml' && (
            <Suspense fallback={<ModuleLoadingState label="Section II NSI & Statistical Forecasts" />}>
              <NSIMLObservatory selectedCountry={selectedCountry} onSelectCountry={setSelectedCountry} />
            </Suspense>
          )}

          {/* MODULE III: CONSUMER BEHAVIOR, INTENTION-TO-PLATE CASCADE & INFODEMIOLOGY */}
          {activeModule === 'consumer_pulse' && (
            <Suspense fallback={<ModuleLoadingState label="Section III Consumer Behavior & Infodemiology" />}>
              <ConsumerBehaviorPulse selectedCountry={selectedCountry} onSelectCountry={setSelectedCountry} />
            </Suspense>
          )}

          {/* MODULE IV: FULL CARTOGRAPHY */}
          {activeModule === 'map' && (
            <div className="space-y-5">
              <InteractiveChoroplethMap
                selectedCountry={selectedCountry}
                onSelectCountry={setSelectedCountry}
                compact={false}
              />

              <div className="almanac-sheet p-5">
                <div className="flex items-center justify-between pb-2.5 mb-3 rule-firm">
                  <h3 className="text-base font-semibold">
                    European and global reference edition matrix (click any row to synchronize)
                  </h3>
                  <span className="almanac-label">25 national profiles</span>
                </div>
                <div className="overflow-x-auto max-h-80">
                  <table className="almanac-table">
                    <thead>
                      <tr>
                        <th>Jurisdiction</th>
                        <th className="text-right">Carbon (kg CO₂/d)</th>
                        <th className="text-right">Water (L/d)</th>
                        <th className="text-right">Basket cost (€/d)</th>
                        <th className="text-right">NOVA 4 (% kcal)</th>
                        <th className="text-right">Plant protein (%)</th>
                        <th className="text-right">Red meat (% bound)</th>
                        <th className="text-right">Say–Do gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(COUNTRY_PROFILES).map((c) => (
                        <tr
                          key={c.code}
                          onClick={() => setSelectedCountry(c.code)}
                          className={`cursor-pointer ${
                            c.code === selectedCountry ? 'bg-[var(--color-paper-2)] font-semibold' : ''
                          }`}
                        >
                          <td className="font-semibold text-[var(--color-ink)]">
                            [{c.code}] {c.name}
                          </td>
                          <td className="num text-right text-[var(--color-accent)]">{c.dailyCarbonKg}</td>
                          <td className="num text-right">{c.dailyWaterLiters}</td>
                          <td className="num text-right">€{c.dailyBasketCostEur}</td>
                          <td className="num text-right">{c.eatLancetIndex.ultraProcessedShare}%</td>
                          <td className="num text-right">{c.plantProteinSharePct}%</td>
                          <td className="num text-right">{c.eatLancetIndex.redMeat}%</td>
                          <td className="num text-right">{c.sayDoGapScore}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODULE IV: DUCKDB PARQUET SQL */}
          {activeModule === 'duckdb' && (
            <Suspense fallback={<ModuleLoadingState label="Section V DuckDB Parquet SQL Workbench" />}>
              <DuckDBParquetWorkbench selectedCountry={selectedCountry} />
            </Suspense>
          )}

          {/* MODULE V: RESEARCHER BASKET SANDBOX */}
          {activeModule === 'sandbox' && (
            <Suspense fallback={<ModuleLoadingState label="Section VI Researcher Survey Ledger" />}>
              <ResearcherSandbox selectedCountry={selectedCountry} agribalyseCatalog={fullAgribalyse} />
            </Suspense>
          )}

          {/* MODULE VI: PRODUCT TRILEMMA */}
          {activeModule === 'trilemma' && (
            <div className="space-y-5">
              <div className="almanac-sheet p-5">
                <div className="pb-2.5 mb-3 rule-firm">
                  <h2 className="text-lg font-semibold flex flex-wrap items-center gap-2">
                    Section VII. Retail Assortment and NOVA Reformulation Ledger ({plottableTrilemmaProducts.length} plotted / {filteredProducts.length} matching)
                    <DataNatureBadge nature="Observed" />
                  </h2>
                  <p className="almanac-label">
                    Examines the relationship between environmental Eco-Score, nutritional Nutri-Score, and NOVA
                    industrial processing ({filteredProducts.length - plottableTrilemmaProducts.length} rows with missing Eco-Score or NOVA excluded from scatter).
                  </p>
                </div>
                <div className="h-96 w-full">
                  <ReactECharts option={trilemmaScatterOption} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>

              <Suspense fallback={<ModuleLoadingState label="Nutrition Comparability Engine" />}>
                <NutritionComparisonPanel
                  inputs={filteredNutritionInputs}
                  basis={nutritionBasis}
                  onBasisChange={setNutritionBasis}
                  title="Open Food Facts EU — Nutrition Comparability & Missingness Engine"
                />
              </Suspense>

              <div className="almanac-sheet p-5">
                <div className="flex items-center justify-between pb-2.5 mb-3 rule-firm">
                  <h3 className="text-sm font-semibold">
                    Harmonized Open Food Facts product records (first 100 matching filter · basis: {nutritionBasis})
                  </h3>
                  <span className="almanac-label">Missing/excluded preserved explicitly as N/A</span>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="almanac-table">
                    <thead>
                      <tr>
                        <th>Product name</th>
                        <th>Brand</th>
                        <th>Category</th>
                        <th>Nutri-Score</th>
                        <th className="text-right">Eco-Score</th>
                        <th className="text-right">NOVA</th>
                        <th className="text-right">
                          Energy ({nutritionBasis === 'per_100g' ? 'kcal/100g' : nutritionBasis === 'per_100kcal' ? 'kcal/100kcal' : 'kcal/serving'})
                        </th>
                        <th className="text-right">
                          Protein ({nutritionBasis === 'per_100g' ? 'g/100g' : nutritionBasis === 'per_100kcal' ? 'g/100kcal' : 'g/serving'})
                        </th>
                        <th className="text-right">
                          Salt ({nutritionBasis === 'per_100g' ? 'g/100g' : nutritionBasis === 'per_100kcal' ? 'g/100kcal' : 'g/serving'})
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.slice(0, 100).map((p, idx) => {
                        const evalProd = evaluateProductNutrition(fromOFFProduct(p), nutritionBasis);
                        const eCell = evalProd.values.energy_kcal;
                        const pCell = evalProd.values.proteins_g;
                        const sCell = evalProd.values.salt_g;
                        return (
                          <tr key={`${p.code}-${idx}`}>
                            <td className="font-semibold text-[var(--color-ink)]">{p.name}</td>
                            <td>{p.brand}</td>
                            <td>{p.category}</td>
                            <td className="num">
                              {p.nutriscore_grade} ({p.nutriscore_score ?? 'N/A'})
                            </td>
                            <td className="num text-right">
                              {p.ecoscore_grade ?? 'N/A'} ({p.ecoscore_score ?? 'N/A'})
                            </td>
                            <td className="num text-right text-[var(--color-accent)] font-semibold">
                              {p.nova_group != null ? `NOVA ${p.nova_group}` : 'N/A'}
                            </td>
                            <td className="num text-right" title={eCell.transformation}>
                              {eCell.value != null ? eCell.value.toFixed(1) : 'N/A'}
                            </td>
                            <td className="num text-right" title={pCell.transformation}>
                              {pCell.value != null ? pCell.value.toFixed(2) : 'N/A'}
                            </td>
                            <td className="num text-right" title={sCell.transformation}>
                              {sCell.value != null ? sCell.value.toFixed(2) : 'N/A'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODULE VII: FULL AGRIBALYSE 3.1 */}
          {activeModule === 'lca' && (
            <div className="space-y-5">
              <div className="almanac-sheet p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-2.5 mb-3 rule-firm">
                  <div>
                    <h2 className="text-lg font-semibold flex flex-wrap items-center gap-2">
                      Section VIII. ADEME Agribalyse 3.1.1 &amp; Environmental Analytical Engine (
                      {filteredAgribalyse.length.toLocaleString()} / 2,451 items)
                      <DataNatureBadge nature="Model Output" />
                    </h2>
                    <p className="almanac-label">
                      Unit-consistent Product Environmental Footprint (PEF 3.1) synthesis per 1 kg product at French cradle-to-consumer gate (separate scale per indicator—never mixed).
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Agribalyse single indicator">
                    {(
                      [
                        { k: 'climate_co2eq', lbl: 'CO₂ (kg/kg)' },
                        { k: 'water_aware_m3', lbl: 'Water (m³/kg)' },
                        { k: 'land_ef_pt', lbl: 'Land (Pt/kg)' },
                        { k: 'ef_single_score', lbl: 'PEF Score (mPt/kg)' },
                      ] as { k: EnvironmentIndicatorKey; lbl: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.k}
                        onClick={() => setAgbChartIndicator(opt.k)}
                        className={`almanac-btn text-xs ${agbChartIndicator === opt.k ? 'almanac-btn--primary' : ''}`}
                      >
                        {opt.lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-88 w-full">
                  <ReactECharts option={agribalyseGroupOption} notMerge={true} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>

              <Suspense fallback={<ModuleLoadingState label="Boundary-Aware Environmental Engine" />}>
                <EnvironmentComparisonPanel
                  agribalyseItems={filteredAgribalyse}
                  pooreItems={globalBenchmarks?.poore_nemecek_lca || []}
                  selectedAgbIndicator={agbChartIndicator}
                  onAgbIndicatorChange={setAgbChartIndicator}
                />
              </Suspense>

              <div className="almanac-sheet p-5">
                <div className="flex items-center justify-between pb-2.5 mb-3 rule-firm">
                  <h3 className="text-sm font-semibold">
                    Agribalyse 3.1 item-level ledger (showing 150 of {filteredAgribalyse.length.toLocaleString()} items)
                  </h3>
                  <span className="almanac-label">Use the left filter or DuckDB SQL tab to query all 2,451 rows</span>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="almanac-table">
                    <thead>
                      <tr>
                        <th>AGB code</th>
                        <th>Food product (English LCI name)</th>
                        <th>Food group (FR)</th>
                        <th className="text-right">Climate (kg CO₂eq/kg)</th>
                        <th className="text-right">Water (m³/kg)</th>
                        <th className="text-right">Land use (Pt/kg)</th>
                        <th className="text-right">Single EF score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAgribalyse.slice(0, 150).map((item: AgribalyseItem) => (
                        <tr key={item.Code_AGB}>
                          <td className="num font-semibold text-[var(--color-ink)]">{item.Code_AGB}</td>
                          <td className="font-semibold text-[var(--color-ink)]">{item.LCI_Name}</td>
                          <td>{item.Groupe_aliment || item["Groupe_d'aliment"]}</td>
                          <td className="num text-right font-semibold text-[var(--color-accent)]">
                            {Number(item.Changement_climatique_kg_CO2eq ?? item.Changement_climatique ?? 0).toFixed(2)}
                          </td>
                          <td className="num text-right">
                            {Number(item.Eau_m3 ?? item['Épuisement_des_ressources_eau'] ?? 0).toFixed(2)}
                          </td>
                          <td className="num text-right">
                            {Number(item.Sol_Pt ?? item.Utilisation_du_sol ?? 0).toFixed(1)}
                          </td>
                          <td className="num text-right">{Number(item.Score_unique_EF || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODULE VIII: PRICE, AFFORDABILITY, INTEGRATED COMPARATOR & LITERATURE */}
          {activeModule === 'inflation' && (
            <div className="space-y-5">
              <Suspense fallback={<ModuleLoadingState label="Section IX Affordability & Integrated Comparator" />}>
                <AffordabilityAndIntegratedPanel
                  selectedCountry={currentProfile.code}
                  countryName={currentProfile.name}
                  countryGeoName={currentProfile.geoJsonName}
                  hicpTargetCode={hicpSeriesInfo.targetCode}
                  isHicpFallback={hicpSeriesInfo.isFallback}
                  hicpData={hicpSeriesInfo.data}
                  pppIndexEu27={currentCalibration?.eurostat_food_ppp_index_eu27_100 ?? null}
                  cohdRecords={globalBenchmarks?.cohd_latest_by_country || []}
                  offProducts={filteredProducts}
                  agribalyseItems={filteredAgribalyse}
                />
              </Suspense>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="almanac-sheet p-5">
                <div className="pb-2.5 mb-3 rule-firm">
                  <h2 className="text-base font-semibold flex flex-wrap items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Eurostat HICP food price indices (
                    {hicpSeriesInfo.isFallback
                      ? `[${hicpSeriesInfo.targetCode}] EU-27 aggregate — no Eurostat series for [${currentProfile.code}]`
                      : `[${currentProfile.code}] ${currentProfile.name}`}
                    , 2015–2025)
                    <DataNatureBadge nature="Observed" />
                  </h2>
                  <p className="almanac-label">
                    Annual Harmonised Index of Consumer Prices (prc_hicp_aind, 2015 = 100, axis starts at 95).
                    {hicpSeriesInfo.isFallback && (
                      <span className="text-[var(--color-accent)] font-semibold ml-1">
                        Displaying EU-27 aggregate because Eurostat prc_hicp_aind does not include [{currentProfile.code}].
                      </span>
                    )}
                  </p>
                </div>
                <div className="h-92 w-full">
                  <ReactECharts
                    option={eurostatOption}
                    style={{ height: '100%', width: '100%' }}
                    ariaLabel={
                      hicpSeriesInfo.isFallback
                        ? `Eurostat HICP food price indices using ${hicpSeriesInfo.targetCode} fallback for ${currentProfile.code}`
                        : `Eurostat HICP food price indices for ${currentProfile.name}`
                    }
                    accessibleSummary={
                      hicpSeriesInfo.isFallback
                        ? `Showing EU-27 aggregate HICP food price indices (2015 equals 100) because Eurostat prc_hicp_aind has no country series for ${currentProfile.code}.`
                        : `Observed Eurostat HICP food price indices (2015 equals 100) for ${currentProfile.name} from 2015 to 2025.`
                    }
                    dataTableFallback={eurostatDataTable}
                  />
                </div>
              </div>

              <div className="almanac-sheet p-5">
                <div className="pb-2.5 mb-3 rule-firm">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    OpenAlex peer-reviewed publication velocity (2010–2025)
                  </h2>
                  <p className="almanac-label">
                    Annual scientific output across planetary health, NOVA ultra-processing, plant-based substitutes and
                    eco-labeling.
                  </p>
                </div>
                <div className="h-92 w-full">
                  <ReactECharts option={openalexOption} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>
              </div>
            </div>
          )}

          {/* MODULE IX: POLICY SIMULATOR */}
          {activeModule === 'simulator' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              <div className="xl:col-span-7 almanac-sheet p-5">
                <div className="pb-2.5 mb-3 rule-firm">
                  <h2 className="text-base font-semibold flex flex-wrap items-center gap-2">
                    <Sliders className="w-4 h-4" />
                    Section X. Planetary Boundary and Consumer Basket Policy Model
                    <DataNatureBadge nature="Simulated" />
                  </h2>
                  <p className="almanac-label">
                    Adjust the four behavioral and fiscal levers in the left column to test shifts in [
                    {currentProfile.code}] {currentProfile.name}.
                  </p>
                </div>
                <div className="h-96 w-full">
                  <ReactECharts option={radarOption} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>

              <div className="xl:col-span-5 almanac-sheet p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-semibold pb-2.5 mb-3 rule-firm flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Multi-objective trade-off ledger ([{currentProfile.code}] {currentProfile.name})
                  </h3>
                  <table className="almanac-table">
                    <thead>
                      <tr>
                        <th>Indicator</th>
                        <th className="text-right">Baseline</th>
                        <th className="text-right">Simulated</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Ruminant meat (% of max bound)</td>
                        <td className="num text-right">{currentProfile.eatLancetIndex.redMeat}%</td>
                        <td className="num text-right font-semibold text-[var(--color-accent)]">
                          {simulatedMetrics.eatLancetSimulated.redMeat}%
                        </td>
                      </tr>
                      <tr>
                        <td>Legumes, pulses & nuts (% of target)</td>
                        <td className="num text-right">{currentProfile.eatLancetIndex.legumesNuts}%</td>
                        <td className="num text-right font-semibold text-[var(--color-accent)]">
                          {simulatedMetrics.eatLancetSimulated.legumesNuts}%
                        </td>
                      </tr>
                      <tr>
                        <td>NOVA 4 ultra-processed (% kcal)</td>
                        <td className="num text-right">{currentProfile.eatLancetIndex.ultraProcessedShare}%</td>
                        <td className="num text-right font-semibold text-[var(--color-accent)]">
                          {simulatedMetrics.eatLancetSimulated.ultraProcessedShare}%
                        </td>
                      </tr>
                      <tr>
                        <td>Net daily household basket (€/d)</td>
                        <td className="num text-right">€{currentProfile.dailyBasketCostEur}</td>
                        <td className="num text-right font-semibold">€{simulatedMetrics.newCost}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 p-4 almanac-well text-sm leading-relaxed space-y-2">
                  <div>
                    <span className="font-display-head font-semibold text-[var(--color-ink)]">Methodological &amp; Evidential Disclosure:</span>{' '}
                    Pairing an analyst-assumed <span className="num font-semibold">{simPlantShift}%</span> plant-protein shift with a{' '}
                    <span className="num font-semibold">{simUpfReduction}%</span> NOVA 4 reduction produces an illustrative{' '}
                    <span className="num font-semibold text-[var(--color-accent)]">
                      {Math.abs(simulatedMetrics.carbonDeltaPct)}%
                    </span>{' '}
                    CO₂ change and <span className="num font-semibold text-[var(--color-accent)]">+{simulatedMetrics.healthGainPct}%</span> index change over manually compiled baseline estimates.
                  </div>
                  <div className="text-xs font-mono-num text-[var(--color-muted)]">
                    • {simulatedMetrics.uncertaintyStatus.reason} {simulatedMetrics.pppStatus.note}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE XI: CODE ARCHITECTURE & FLOORPLAN */}
          {activeModule === 'floorplan' && (
            <div className="space-y-5">
              <div className="almanac-sheet p-5">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-3 rule-firm">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Network className="w-4 h-4" />
                      Section XI. Codebase Floorplan, Subsystems & Architectural Blueprint
                    </h2>
                    <p className="almanac-label mt-0.5">
                      Dual-engine architectural exploration: publication-grade editorial schematic via{' '}
                      <span className="font-semibold text-[var(--color-ink)]">cathrynlavery/diagram-design</span> and interactive codebase blueprint via{' '}
                      <span className="font-semibold text-[var(--color-ink)]">haydenschmitty/floorplan</span> (33 files, 100% mapped).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* View Switcher Toggle */}
                    <div className="flex items-center bg-[var(--color-paper-card)] border border-[var(--color-rule)] rounded p-0.5">
                      <button
                        onClick={() => setArchitectureView('blueprint')}
                        className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                          architectureView === 'blueprint'
                            ? 'bg-[#8a1253] text-white font-bold'
                            : 'text-[var(--color-ink)] hover:bg-stone-200/60'
                        }`}
                      >
                        1. Editorial Blueprint (SVG)
                      </button>
                      <button
                        onClick={() => setArchitectureView('floorplan')}
                        className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                          architectureView === 'floorplan'
                            ? 'bg-[#163d4a] text-white font-bold'
                            : 'text-[var(--color-ink)] hover:bg-stone-200/60'
                        }`}
                      >
                        2. Codebase Graph (33 Files)
                      </button>
                    </div>

                    <a
                      href={architectureView === 'blueprint' ? assetUrl('architecture_blueprint.html') : assetUrl('floorplan.html')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="almanac-btn almanac-btn--primary flex items-center gap-1.5"
                      title="Open full-screen view in a dedicated browser tab"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Open Fullscreen</span>
                    </a>
                  </div>
                </div>

                {/* Quick Architecture Metadata Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-3 text-xs font-mono-num text-[var(--color-muted)]">
                  <span className="almanac-well px-2.5 py-1">4 System Tiers (Ingestion, DuckDB, Analytics, UI Deck)</span>
                  <span className="almanac-well px-2.5 py-1">{datasetsRegistry?.total_datasets ?? 18} In-Memory Parquet Tables ({(datasetsRegistry?.total_records ?? 17466).toLocaleString()} rows)</span>
                  <span className="almanac-well px-2.5 py-1">Dual Schematics (Editorial SVG + Floorplan)</span>
                  <span className="almanac-well px-2.5 py-1 text-[var(--color-accent)] font-semibold">
                    D4Vinci Scrapling 0.5.1 + DuckDB-Wasm
                  </span>
                </div>
              </div>

              {/* Embedded Interactive Canvas */}
              <div className="almanac-sheet p-3 overflow-hidden">
                <div className="relative w-full h-[760px] rounded border border-[var(--color-rule)] bg-[#0d1117] overflow-hidden shadow-sm">
                  <iframe
                    src={architectureView === 'blueprint' ? assetUrl('architecture_blueprint.html') : assetUrl('floorplan.html')}
                    title={architectureView === 'blueprint' ? 'DietShift Atlas Editorial Architecture Blueprint' : 'DietShift Atlas Codebase Interactive Floorplan'}
                    className="w-full h-full border-0"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Architectural Layer Dossier Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="almanac-sheet p-5 space-y-2">
                  <h3 className="font-display-head font-semibold text-sm text-[var(--color-ink)] flex items-center gap-2 pb-2 rule-firm">
                    <Compass className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    1. Frontend UI & Reactive Deck
                  </h3>
                  <p className="text-xs text-[var(--color-muted)] leading-relaxed font-serif-label">
                    Modular Vite + React + TypeScript interface orchestrating 10 analytical observatories, 14 ECharts
                    visualizations, and policy simulation models using the Hallmark Almanac design language.
                  </p>
                  <div className="pt-2 text-[11px] font-mono-num text-[var(--color-ink)] space-y-1">
                    <div>• <b>App.tsx:</b> Root state &amp; scenario explorer</div>
                    <div>• <b>InteractiveChoroplethMap.tsx:</b> 6,845 GI pins</div>
                    <div>• <b>NSIMLObservatory.tsx:</b> Expanding-origin CV &amp; PCA</div>
                  </div>
                </div>

                <div className="almanac-sheet p-5 space-y-2">
                  <h3 className="font-display-head font-semibold text-sm text-[var(--color-ink)] flex items-center gap-2 pb-2 rule-firm">
                    <Database className="w-3.5 h-3.5 text-[#163d4a]" />
                    2. Columnar In-Memory SQL
                  </h3>
                  <p className="text-xs text-[var(--color-muted)] leading-relaxed font-serif-label">
                    DuckDB-Wasm running inside the browser worker thread, executing SQL queries in client memory across 19
                    registered ZSTD Parquet tables without requiring any backend server.
                  </p>
                  <div className="pt-2 text-[11px] font-mono-num text-[var(--color-ink)] space-y-1">
                    <div>• <b>duckdbEngine.ts:</b> Wasm singleton worker</div>
                    <div>• <b>DuckDBParquetWorkbench.tsx:</b> SQL console</div>
                    <div>• <b>research.ts:</b> Strict domain typing</div>
                  </div>
                </div>

                <div className="almanac-sheet p-5 space-y-2">
                  <h3 className="font-display-head font-semibold text-sm text-[var(--color-ink)] flex items-center gap-2 pb-2 rule-firm">
                    <Cpu className="w-3.5 h-3.5 text-[#6b4c1b]" />
                    3. Scrapling &amp; Statistical Pipelines
                  </h3>
                  <p className="text-xs text-[var(--color-muted)] leading-relaxed font-serif-label">
                    Python harvesting pipelines leveraging Scrapling for regulatory extraction (EUIPO,
                    Qualigeo, Open Prices EU) and causal expanding-origin statistical baselines (ETS, Ridge, Drift).
                  </p>
                  <div className="pt-2 text-[11px] font-mono-num text-[var(--color-ink)] space-y-1">
                    <div>• <b>build_gi_terroir_...py:</b> Scrapling crawler</div>
                    <div>• <b>enrich_gi_coordinates.py:</b> NUTS-2 geocoder</div>
                    <div>• <b>build_nsi_and_ml_...py:</b> Statistical CV &amp; PCA</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE XII: GS1 IMMAGINO & NIELSENIQ LAB */}
          {activeModule === 'gs1_immagino' && (
            <Suspense fallback={<ModuleLoadingState label="Section XII Pan-EU Retail Scanner & Claims" />}>
              <GS1ImmaginoObservatory
                selectedCountry={selectedCountry}
                onSelectCountry={setSelectedCountry}
              />
            </Suspense>
          )}

          {/* MODULE XIII: EMPIRICAL SENSITIVITY & ROBUSTNESS ANALYSIS */}
          {activeModule === 'sensitivity' && (
            <Suspense fallback={<ModuleLoadingState label="Section XIII Empirical Sensitivity" />}>
              <SensitivityPanel
                selectedCountry={currentProfile.code}
                countryName={currentProfile.name}
                hicpTargetCode={hicpSeriesInfo.targetCode}
                isHicpFallback={hicpSeriesInfo.isFallback}
                hicpData={hicpSeriesInfo.data}
                offProducts={filteredProducts}
                agribalyseItems={filteredAgribalyse}
              />
            </Suspense>
          )}
        </main>
      </div>

      {/* Hallmark Almanac Colophon & Institutional Acknowledgment Ledger */}
      <footer className="almanac-sheet p-6 mt-8 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 rule-firm">
          <div className="flex items-center gap-3">
            <DietShiftLogo className="w-9 h-9 shrink-0" size={36} />
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-display-head text-base font-semibold text-[var(--color-ink)]">
                  DietShift Atlas — Colophon & Acknowledgments
                </span>
                <span className="almanac-pill text-[10px] tracking-wide uppercase">Open Science Edition</span>
              </div>
            <p className="almanac-label text-xs mt-1">
              Conceptualized, architected, and authored by{' '}
              <a
                href="https://www.linkedin.com/in/zouaghi-amine/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--color-ink)] underline decoration-[var(--color-rule)] hover:decoration-[var(--color-accent)]"
              >
                Amine Zouaghi
              </a>{' '}
              (MSCA Doctoral Researcher, University of Parma ·{' '}
              <a
                href="https://www.linkedin.com/in/zouaghi-amine/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--color-ink)] underline decoration-[var(--color-rule)] hover:decoration-[var(--color-accent)]"
              >
                LinkedIn
              </a>{' '}
              ·{' '}
              <a
                href="https://github.com/aminezghi"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-[var(--color-rule)] hover:decoration-[var(--color-accent)]"
              >
                GitHub @aminezghi
              </a>
              ), creator of{' '}
              <a
                href="https://github.com/aminezghi/vellum"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--color-accent)] underline decoration-[var(--color-rule)] hover:decoration-[var(--color-accent)]"
              >
                Vellum
              </a>{' '}
              (100% Local-First Academic Literature & Systematic Review Studio).
            </p>
          </div>
        </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={assetUrl('public_guide.html')}
              target="_blank"
              rel="noopener noreferrer"
              className="almanac-btn flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#8a1253]" />
              <span>Public Citizen Guide</span>
            </a>
            <a
              href="https://www.linkedin.com/in/zouaghi-amine/"
              target="_blank"
              rel="noopener noreferrer"
              className="almanac-btn almanac-btn--primary flex items-center gap-1.5"
            >
              <LinkedinIcon className="w-3.5 h-3.5 text-white" />
              <span>LinkedIn Profile</span>
            </a>
            <a
              href="https://github.com/aminezghi"
              target="_blank"
              rel="noopener noreferrer"
              className="almanac-btn flex items-center gap-1.5"
            >
              <GithubIcon className="w-3.5 h-3.5" />
              <span>github.com/aminezghi</span>
            </a>
            <a
              href="https://github.com/aminezghi/vellum"
              target="_blank"
              rel="noopener noreferrer"
              className="almanac-btn flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Vellum Studio</span>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-xs text-[var(--color-muted)] font-serif-label">
          <div>
            <h4 className="font-display-head font-semibold text-[var(--color-ink)] uppercase tracking-wider text-[11px] mb-2">
              Primary Dietary & LCA Sources
            </h4>
            <ul className="space-y-1.5 leading-relaxed">
              <li>
                <b>EFSA:</b> Comprehensive European Food Consumption Database (FoodEx2 Level 6 taxonomy, 1,080 survey strata).
              </li>
              <li>
                <b>ADEME & INRAE:</b> Agribalyse 3.1 Life Cycle Assessment database (all 2,451 food products harmonized).
              </li>
              <li>
                <b>Open Food Facts:</b> Barcode-verified EU retail catalog (3,197 cleaned products preserving genuine NULLs).
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display-head font-semibold text-[var(--color-ink)] uppercase tracking-wider text-[11px] mb-2">
              Statistical Institutes & Econometrics
            </h4>
            <ul className="space-y-1.5 leading-relaxed">
              <li>
                <b>ISTAT Italy:</b> Indagine sulle Spese delle Famiglie (HICP food price index & quintile expenditure profiles).
              </li>
              <li>
                <b>INE Spain:</b> Encuesta de Presupuestos Familiares (sub-national food expenditure microdata).
              </li>
              <li>
                <b>Eurostat, INSEE, Destatis, CBS & ONS:</b> Harmonized EU-27 HICP (prc_hicp_aind) and budget surveys.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display-head font-semibold text-[var(--color-ink)] uppercase tracking-wider text-[11px] mb-2">
              Geographical Indications & Terroir
            </h4>
            <ul className="space-y-1.5 leading-relaxed">
              <li>
                <b>EUIPO GIview:</b> Union Register of Protected Designations of Origin (PDO), PGIs & TSGs (6,029 entries).
              </li>
              <li>
                <b>Qualigeo / Fondazione Qualivita:</b> Italian & European Terroir Product Database (3,692 products).
              </li>
              <li>
                <b>Scrapling (D4Vinci):</b> High-throughput pipeline harvesting official agro-food regulatory datasets.
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display-head font-semibold text-[var(--color-ink)] uppercase tracking-wider text-[11px] mb-2">
              Econometrics &amp; Empirical Uncertainty
            </h4>
            <ul className="space-y-1.5 leading-relaxed">
              <li>
                <b>Statistical Backtesting Engine:</b> Causal expanding-origin CV across Damped ETS, Holt ETS, Ridge, Drift &amp; RW baselines (`560` rows).
              </li>
              <li>
                <b>Wikimedia Foundation:</b> Wikipedia Pageview API across 6 European languages for topic infodemiology.
              </li>
              <li>
                <b>EAT-Lancet Commission:</b> Planetary Health Diet 2050 reference targets and boundary thresholds.
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-3 rule-soft flex flex-wrap items-center justify-between gap-3 text-[11px] text-[var(--color-muted)] font-mono-num">
          <span>DietShift Atlas © 2026 · v{APP_VERSION} · Made by Amine · Default Jurisdiction: [IT] Italy</span>
          <span>Powered by DuckDB-Wasm &amp; Apache Parquet</span>
        </div>
      </footer>
      <DataCatalogModal
        registry={datasetsRegistry}
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
      />
    </div>
  );
}

export default App;
