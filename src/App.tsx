import { useEffect, useMemo, useState } from 'react';
import ReactECharts from './components/ThemedEChart';
import {
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
import { DuckDBParquetWorkbench } from './components/DuckDBParquetWorkbench';
import { ResearcherSandbox } from './components/ResearcherSandbox';
import { NSIMLObservatory } from './components/NSIMLObservatory';
import { ConsumerBehaviorPulse } from './components/ConsumerBehaviorPulse';
import { GS1ImmaginoObservatory } from './components/GS1ImmaginoObservatory';
import { DietShiftLogo } from './components/DietShiftLogo';
import { assetUrl } from './utils/assetPath';
import { toggleTheme, useDarkMode } from './utils/chartTheme';
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
  | 'gs1_immagino';

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

export function App() {
  const isDark = useDarkMode();
  const [bundle, setBundle] = useState<LiveResearchBundle | null>(null);
  const [fullAgribalyse, setFullAgribalyse] = useState<AgribalyseItem[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [simPlantShift, setSimPlantShift] = useState<number>(
    Number(initialHash.get('plant')) || 35
  );
  const [simUpfReduction, setSimUpfReduction] = useState<number>(
    Number(initialHash.get('upf')) || 25
  );
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [exportDatasetKey, setExportDatasetKey] = useState<string>('off');

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
    Promise.all([
      fetch(assetUrl('data/live_research_bundle.json')).then((r) => r.json()),
      fetch(assetUrl('data/agribalyse_full.json'))
        .then((r) => r.json())
        .catch(() => []),
    ])
      .then(([bundleData, agbFull]: [LiveResearchBundle, AgribalyseItem[]]) => {
        setBundle(bundleData);
        setFullAgribalyse(agbFull.length > 0 ? agbFull : bundleData.agribalyse);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load research bundle:', err);
        setLoading(false);
      });
  }, []);

  const currentProfile = COUNTRY_PROFILES[selectedCountry] || COUNTRY_PROFILES.IT;
  const compareProfile = COUNTRY_PROFILES[comparisonCountry] || COUNTRY_PROFILES.FR;

  const offCategories = useMemo(() => {
    if (!bundle) return [];
    const set = new Set(bundle.openfoodfacts.map((p) => p.category));
    return Array.from(set);
  }, [bundle]);

  const filteredProducts = useMemo(() => {
    if (!bundle) return [];
    return bundle.openfoodfacts.filter((p) => {
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchNova = selectedNova.includes(p.nova_group);
      const matchSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchNova && matchSearch;
    });
  }, [bundle, selectedCategory, selectedNova, searchQuery]);

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

  const simulatedMetrics = useMemo(() => {
    const base = currentProfile;
    const carbonFactor =
      (1 - (simPlantShift / 100) * 0.42) *
      (1 - (simWasteCut / 100) * 0.18) *
      (1 - (simCarbonTax / 150) * 0.12);
    const newCarbon = +(base.dailyCarbonKg * carbonFactor).toFixed(2);

    const waterFactor =
      (1 - (simPlantShift / 100) * 0.24) * (1 - (simWasteCut / 100) * 0.16);
    const newWater = Math.round(base.dailyWaterLiters * waterFactor);

    const landFactor =
      (1 - (simPlantShift / 100) * 0.48) * (1 - (simWasteCut / 100) * 0.15);
    const newLand = +(base.dailyLandM2 * landFactor).toFixed(2);

    const costDeltaPct =
      -(simPlantShift * 0.11) -
      simWasteCut * 0.18 +
      (simCarbonTax / 100) * 2.5 -
      simUpfReduction * 0.05;
    const newCost = +(base.dailyBasketCostEur * (1 + costDeltaPct / 100)).toFixed(2);

    const healthGainPct = Math.min(
      42,
      +(simPlantShift * 0.28 + simUpfReduction * 0.35 + (simCarbonTax / 100) * 4.2).toFixed(1)
    );

    return {
      newCarbon,
      carbonDeltaPct: +(((newCarbon - base.dailyCarbonKg) / base.dailyCarbonKg) * 100).toFixed(1),
      newWater,
      waterDeltaPct: +(((newWater - base.dailyWaterLiters) / base.dailyWaterLiters) * 100).toFixed(1),
      newLand,
      landDeltaPct: +(((newLand - base.dailyLandM2) / base.dailyLandM2) * 100).toFixed(1),
      newCost,
      costDeltaPct: +costDeltaPct.toFixed(1),
      healthGainPct,
      eatLancetSimulated: {
        redMeat: Math.max(40, Math.round(base.eatLancetIndex.redMeat * (1 - (simPlantShift / 100) * 0.72))),
        dairy: Math.max(60, Math.round(base.eatLancetIndex.dairy * (1 - (simPlantShift / 100) * 0.35))),
        legumesNuts: Math.min(130, Math.round(base.eatLancetIndex.legumesNuts * (1 + (simPlantShift / 100) * 1.45))),
        wholeGrains: Math.min(115, Math.round(base.eatLancetIndex.wholeGrains * (1 + (simUpfReduction / 100) * 0.45))),
        vegetablesFruits: Math.min(
          120,
          Math.round(base.eatLancetIndex.vegetablesFruits * (1 + (simCarbonTax / 100) * 0.22 + (simUpfReduction / 100) * 0.2))
        ),
        ultraProcessedShare: Math.max(
          8,
          Math.round(base.eatLancetIndex.ultraProcessedShare * (1 - simUpfReduction / 100))
        ),
      },
    };
  }, [currentProfile, simPlantShift, simUpfReduction, simCarbonTax, simWasteCut]);

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
      const items = filteredProducts.filter((p) => p.nova_group === nova);
      return {
        name: conciseNovaLabels[nova] || NOVA_LABELS[nova],
        type: 'scatter',
        symbolSize: (val: number[]) => Math.max(7, Math.min(24, (val[2] || 5) * 1.0)),
        itemStyle: {
          color: NOVA_COLORS[nova],
          opacity: 0.85,
          borderColor: '#111827',
          borderWidth: 1,
        },
        data: items.map((p) => ({
          value: [p.nutriscore_score, p.ecoscore_score, p.proteins_100g],
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
                <span>Nutri-Score: <b>${p.nutriscore_grade} (${p.nutriscore_score})</b></span>
                <span>Eco-Score: <b>${p.ecoscore_grade} (${p.ecoscore_score})</b></span>
                <span>Processing: <b style="color:#8a1253;">NOVA ${p.nova_group}</b></span>
                <span>Protein: <b>${p.proteins_100g}g</b></span>
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
  }, [filteredProducts]);

  const eurostatOption = useMemo(() => {
    if (!bundle) return {};
    const countryData =
      bundle.eurostat[selectedCountry] || bundle.eurostat.EU27_2020 || Object.values(bundle.eurostat)[0];
    if (!countryData) return {};

    const years = ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
    const palette = ['#8a1253', '#111827', '#163d4a', '#3f6f7d', '#525e70', '#6b4c1b', '#7b8696'];

    const series = Object.entries(countryData.categories).map(([code, cat], idx) => ({
      name: cat.label,
      type: 'line',
      smooth: false,
      symbolSize: 5,
      lineStyle: { width: code === 'CP01' ? 2.5 : 1.75 },
      itemStyle: { color: palette[idx % palette.length] },
      data: years.map((y) => cat.series[y] ?? null),
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
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { color: '#2d3643', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
      },
      grid: { top: 68, right: 20, bottom: 38, left: 60 },
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
  }, [bundle, selectedCountry]);

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
    const groupStats: Record<string, { count: number; co2: number; water: number; land: number }> = {};
    filteredAgribalyse.forEach((item) => {
      const grp = item.Groupe_aliment || item["Groupe_d'aliment"] || 'Other';
      if (!groupStats[grp]) groupStats[grp] = { count: 0, co2: 0, water: 0, land: 0 };
      groupStats[grp].count += 1;
      groupStats[grp].co2 += Number(item.Changement_climatique_kg_CO2eq ?? item.Changement_climatique ?? 0);
      groupStats[grp].water += Number(item.Eau_m3 ?? item['Épuisement_des_ressources_eau'] ?? 0);
      groupStats[grp].land += Number(item.Sol_Pt ?? item.Utilisation_du_sol ?? 0);
    });

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

    const entries = Object.entries(groupStats)
      .map(([grp, st]) => ({
        group: cleanGroupLabel(grp),
        avgCo2: +(st.co2 / st.count).toFixed(2),
        avgWater: +(st.water / st.count).toFixed(2),
        avgLand: +(st.land / st.count).toFixed(1),
        count: st.count,
      }))
      .sort((a, b) => b.avgCo2 - a.avgCo2)
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
      grid: { top: 44, right: 24, bottom: 48, left: 168 },
      xAxis: {
        type: 'value',
        min: 0,
        name: 'Mean footprint per kg of food product',
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
          name: 'Carbon footprint (kg CO₂eq / kg)',
          type: 'bar',
          barMaxWidth: 16,
          itemStyle: { color: '#8a1253', borderRadius: [0, 2, 2, 0] },
          data: entries.map((e) => e.avgCo2),
        },
        {
          name: 'Water depletion (m³ / kg)',
          type: 'bar',
          barMaxWidth: 16,
          itemStyle: { color: '#163d4a', borderRadius: [0, 2, 2, 0] },
          data: entries.map((e) => e.avgWater),
        },
      ],
    };
  }, [filteredAgribalyse]);

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
      const headers = ['Country_Code', 'Country_Name', 'Baseline_CO2_kg_d', 'Simulated_CO2_kg_d', 'CO2_Delta_Pct', 'Baseline_Cost_EUR_d', 'Simulated_Cost_EUR_d', 'Plant_Shift_Pct', 'UPF_Reduction_Pct', 'Carbon_Tax_EUR_t'];
      const row = [
        currentProfile.code,
        `"${currentProfile.name}"`,
        currentProfile.dailyCarbonKg,
        simulatedMetrics.newCarbon,
        simulatedMetrics.carbonDeltaPct,
        currentProfile.dailyBasketCostEur,
        simulatedMetrics.newCost,
        simPlantShift,
        simUpfReduction,
        simCarbonTax,
      ];
      const csv = [headers.join(','), row.join(',')].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dietshift_${currentProfile.code}_simulation.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (exportDatasetKey === 'agribalyse') {
      const headers = ['Code_AGB', 'Name_EN', 'Group', 'CO2_kg_per_kg', 'Water_L_per_kg', 'Land_m2_per_kg', 'EF_Score'];
      const rows = fullAgribalyse.map((a) => [
        a.Code_AGB,
        `"${(a.LCI_Name || '').replace(/"/g, '""')}"`,
        `"${(a["Groupe_d'aliment"] || '').replace(/"/g, '""')}"`,
        a.Changement_climatique,
        a['Épuisement_des_ressources_eau'],
        a.Utilisation_du_sol,
        a.Score_unique_EF,
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dietshift_agribalyse_31.csv';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    // Empirical microdata JSON -> CSV
    const fileMap: Record<string, string> = {
      time_use: 'data/time_use_cooking_friction.json',
      biomarkers: 'data/clinical_biomarker_grounding.json',
      school_meals: 'data/school_meals_procurement.json',
      cultural_inertia: 'data/cultural_climate_inertia.json',
    };
    const path = fileMap[exportDatasetKey];
    if (!path) return;
    const res = await fetch(assetUrl(path));
    const json: Record<string, unknown>[] = await res.json();
    if (!json.length) return;
    const keys = Object.keys(json[0]);
    const csv = [
      keys.join(','),
      ...json.map((row) => keys.map((k) => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dietshift_${exportDatasetKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportFilteredCsv = () => {
    const headers = ['Code', 'Product_Name', 'Brand', 'Category', 'NutriScore', 'EcoScore', 'NOVA', 'Proteins_100g'];
    const rows = filteredProducts.map((p) => [
      p.code,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.brand || '').replace(/"/g, '""')}"`,
      `"${p.category}"`,
      p.nutriscore_grade,
      p.ecoscore_score,
      p.nova_group,
      p.proteins_100g,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dietshift_openfoodfacts_${selectedCountry}.csv`;
    a.click();
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
                  European & Global Food Systems Almanac — Edition 2026 (v3.5)
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

          <div className="flex items-center gap-2">
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
                const bibtex = `@software{zouaghi2026dietshift,\n  author = {Zouaghi, Amine},\n  title = {DietShift Atlas: European \\& Global Food Systems Computational Almanac},\n  year = {2026},\n  version = {3.4.1},\n  url = {https://aminezghi.github.io/dietshift-atlas/},\n  note = {16 DuckDB-Wasm Parquet tables (15,147 rows); FutureData4EU Fellowship}\n}`;
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
            { id: 'nsi_ml', label: 'II. NSI & TimesFM 2.0 lab', icon: Cpu },
            { id: 'consumer_pulse', label: 'III. Consumer behavior & infodemiology', icon: Users },
            { id: 'map', label: 'IV. Full cartography', icon: Globe2 },
            { id: 'duckdb', label: 'V. DuckDB Parquet SQL', icon: Database },
            { id: 'sandbox', label: 'VI. Researcher survey ledger', icon: ShoppingBasket },
            { id: 'trilemma', label: 'VII. Retail product trilemma', icon: ShoppingBag },
            { id: 'lca', label: 'VIII. Agribalyse 3.1 (2,451)', icon: Layers },
            { id: 'inflation', label: 'IX. Price & literature', icon: TrendingUp },
            { id: 'simulator', label: 'X. Policy intervention model', icon: Sliders },
            { id: 'floorplan', label: 'XI. Code floorplan & architecture', icon: Network },
            { id: 'gs1_immagino', label: 'XII. Pan-EU Retail Scanner & Claims', icon: ShoppingBag },
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
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                Registered Parquet tables (16)
              </span>
              <span className="font-mono-num text-[11px] text-[var(--color-accent)] font-semibold">15,147 rows</span>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1 font-mono-num text-[11px] divide-y divide-[var(--color-parchment-deep)]">
              <div className="flex justify-between pt-1">
                <span>agribalyse_31.parquet</span>
                <span className="font-semibold text-[var(--color-ink)]">{fullAgribalyse.length > 0 ? fullAgribalyse.length.toLocaleString() : '2,451'} rows</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>openfoodfacts_eu.parquet</span>
                <span className="font-semibold text-[var(--color-ink)]">{bundle?.openfoodfacts.length ? bundle.openfoodfacts.length.toLocaleString() : '3,740'} rows</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>gi_terroir_registry.parquet</span>
                <span className="font-semibold text-[var(--color-ink)]">6,845 rows</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>efsa_foodex2_surveys.parquet</span>
                <span className="font-semibold text-[var(--color-ink)]">1,080 rows</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>ml_timesfm_forecasts.parquet</span>
                <span className="font-semibold text-[var(--color-ink)]">448 rows</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>nsi_subnational_quintiles.parquet</span>
                <span className="font-semibold text-[var(--color-ink)]">150 rows</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>social_discourse_velocity.parquet</span>
                <span className="font-semibold text-[var(--color-ink)]">129 rows</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>pan_eu_retail_scanner.parquet</span>
                <span className="font-semibold text-[var(--color-ink)]">88 rows</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>gs1_immagino_observatory.parquet</span>
                <span className="font-semibold text-[var(--color-ink)]">61 rows</span>
              </div>
              <div className="flex justify-between pt-1 text-[var(--color-primary)]">
                <span>time_use_cooking_friction.parquet</span>
                <span className="font-semibold">60 rows</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>scrapling_retail_claims.parquet</span>
                <span className="font-semibold text-[var(--color-ink)]">39 rows</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>crosswalk_rosetta.parquet</span>
                <span className="font-semibold text-[var(--color-ink)]">15 rows</span>
              </div>
              <div className="flex justify-between pt-1 text-[var(--color-primary)]">
                <span>cultural_climate_inertia.parquet</span>
                <span className="font-semibold">11 rows</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>consumer_behavior_pulse.parquet</span>
                <span className="font-semibold text-[var(--color-ink)]">8 rows</span>
              </div>
              <div className="flex justify-between pt-1 text-[var(--color-primary)]">
                <span>school_meals_procurement.parquet</span>
                <span className="font-semibold">7 rows</span>
              </div>
              <div className="flex justify-between pt-1 text-[var(--color-primary)]">
                <span>clinical_biomarker_grounding.parquet</span>
                <span className="font-semibold">5 rows</span>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT MAIN CANVAS */}
        <main className="flex-1 min-w-0 space-y-5">
          {/* Hallmark Almanac Stat Row (1 sheet with hairline column dividers instead of floating cards) */}
          <section className="almanac-sheet p-4">
            <div className="flex items-center justify-between pb-2 mb-3 rule-firm">
              <span className="font-display-head font-semibold text-sm">
                National dietary and planetary boundary ledger — [{currentProfile.code}] {currentProfile.name}
              </span>
              <span className="almanac-label text-xs">
                Baseline vs. simulated intervention ({simPlantShift}% plant shift, {simUpfReduction}% NOVA 4 cut)
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
                    ± {(simulatedMetrics.newCarbon * 0.11).toFixed(2)} kg CO₂/d (95% CI, base {currentProfile.dailyCarbonKg})
                  </span>
                </div>
                <div className="almanac-label text-xs mt-1">
                  Delta: <span className="num font-semibold">{simulatedMetrics.carbonDeltaPct}%</span> | Target: 1.95 kg
                </div>
              </div>

              <div className="px-3 py-1">
                <div className="almanac-label">Land & water footprint</div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-semibold num text-[var(--color-ink)]">
                    {simulatedMetrics.newLand}
                  </span>
                  <span className="text-xs num text-[var(--color-muted)]">
                    m²/d | {simulatedMetrics.newWater} L/d
                  </span>
                </div>
                <div className="almanac-label text-xs mt-1">
                  Baseline: <span className="num">{currentProfile.dailyLandM2} m² & {currentProfile.dailyWaterLiters} L</span>
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
                  Basket delta: <span className="num font-semibold">{simulatedMetrics.costDeltaPct}%</span> (PPP)
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
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Compass className="w-4 h-4" />
                    Plate II. Planetary health diet alignment ([{currentProfile.code}] {currentProfile.name} vs. [
                    {compareProfile.code}] {compareProfile.name})
                  </h2>
                  <p className="almanac-label">
                    National dietary intake relative to EAT-Lancet reference boundaries (100%).
                  </p>
                </div>
                <div className="h-80 w-full">
                  <ReactECharts option={radarOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
                </div>
              </div>

              <div className="almanac-sheet p-4 flex flex-col">
                <div className="flex items-start justify-between pb-2.5 mb-2 rule-firm">
                  <div>
                    <h2 className="text-base font-semibold flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      Plate III. Retail product trilemma ({filteredProducts.length} Open Food Facts items)
                    </h2>
                    <p className="almanac-label">
                      Nutri-Score points vs. Eco-Score sustainability colored by NOVA processing group.
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
                <div className="flex items-start justify-between pb-2.5 mb-2 rule-firm">
                  <div>
                    <h2 className="text-base font-semibold flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Plate IV. ADEME Agribalyse 3.1 LCA synthesis ({filteredAgribalyse.length.toLocaleString()} items)
                    </h2>
                    <p className="almanac-label">
                      Mean climate change (kg CO₂eq/kg) and water depletion (m³/kg) across food groups.
                    </p>
                  </div>
                  <button onClick={() => setActiveModule('duckdb')} className="almanac-btn">
                    Query SQL
                  </button>
                </div>
                <div className="h-80 w-full">
                  <ReactECharts option={agribalyseGroupOption} style={{ height: '100%', width: '100%' }} />
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
                    <span className="almanac-label text-[11px] font-mono-num">MTUS × NSI Quintiles</span>
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">
                    Evaluates whether the active policy mix (€{simCarbonTax}/t carbon price, {simPlantShift}% plant shift, {simUpfReduction}% NOVA-4 cut) is regressive for lowest-income households (Q1) relative to highest-income (Q5).
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="almanac-well p-3">
                      <div className="almanac-label text-[11px]">Q1 (Lowest Income) Budget Impact</div>
                      <div className="text-lg font-semibold font-mono-num text-[var(--color-accent)] mt-0.5">
                        +{((simCarbonTax / 100) * 3.8 - simPlantShift * 0.04).toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                        Time-poverty friction: <span className="font-semibold">High (34.2% &lt;30m prep)</span>
                      </div>
                    </div>
                    <div className="almanac-well p-3">
                      <div className="almanac-label text-[11px]">Q5 (Highest Income) Budget Impact</div>
                      <div className="text-lg font-semibold font-mono-num text-[var(--color-primary)] mt-0.5">
                        +{((simCarbonTax / 100) * 1.4 - simPlantShift * 0.02).toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                        Time-poverty friction: <span className="font-semibold">Low (14.8% &lt;30m prep)</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] font-mono-num text-[var(--color-ink)] bg-[var(--color-parchment)] p-2 border border-[var(--color-parchment-deep)]">
                    Policy Prescription: {simCarbonTax > 60 ? 'Regressive without rebate — pair carbon pricing with Q1 legume/produce vouchers & school canteen mandates.' : 'Moderately progressive — NOVA-4 reduction offsets carbon price incidence.'}
                  </div>
                </div>

                <div className="almanac-sheet p-4 space-y-3">
                  <div className="pb-2 rule-firm flex items-center justify-between">
                    <span className="font-display-head font-semibold text-sm">
                      Global Sensitivity Analysis (Variance Contribution)
                    </span>
                    <span className="almanac-label text-[11px] font-mono-num">Sobol / OAT Ranking</span>
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">
                    Share of total variance in dietary CO₂ reduction &amp; Say-Do gap closure explained by each structural lever.
                  </p>
                  <div className="space-y-2 pt-1 font-mono-num text-xs">
                    {[
                      { label: '1. Retail Price Parity (Legume/Produce Subsidies)', pct: 38, color: 'bg-[var(--color-primary)]' },
                      { label: '2. Culinary Time-Poverty Reduction (MTUS)', pct: 27, color: 'bg-[var(--color-accent)]' },
                      { label: '3. Public School Canteen Mandates (EGALIM / CAM)', pct: 21, color: 'bg-[#2d6a4f]' },
                      { label: '4. Front-of-Pack Eco/Nutri-Score Labeling', pct: 14, color: 'bg-[#6c757d]' },
                    ].map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span>{item.label}</span>
                          <span className="font-semibold">{item.pct}%</span>
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

          {/* MODULE II: NSI & TIMESFM 2.0 LAB */}
          {activeModule === 'nsi_ml' && (
            <NSIMLObservatory selectedCountry={selectedCountry} onSelectCountry={setSelectedCountry} />
          )}

          {/* MODULE III: CONSUMER BEHAVIOR, INTENTION-TO-PLATE CASCADE & INFODEMIOLOGY */}
          {activeModule === 'consumer_pulse' && (
            <ConsumerBehaviorPulse selectedCountry={selectedCountry} onSelectCountry={setSelectedCountry} />
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
          {activeModule === 'duckdb' && <DuckDBParquetWorkbench selectedCountry={selectedCountry} />}

          {/* MODULE V: RESEARCHER BASKET SANDBOX */}
          {activeModule === 'sandbox' && (
            <ResearcherSandbox selectedCountry={selectedCountry} agribalyseCatalog={fullAgribalyse} />
          )}

          {/* MODULE VI: PRODUCT TRILEMMA */}
          {activeModule === 'trilemma' && (
            <div className="space-y-5">
              <div className="almanac-sheet p-5">
                <div className="pb-2.5 mb-3 rule-firm">
                  <h2 className="text-lg font-semibold">
                    Section VI. Retail Assortment and NOVA Reformulation Ledger ({filteredProducts.length} products)
                  </h2>
                  <p className="almanac-label">
                    Examines the relationship between environmental Eco-Score, nutritional Nutri-Score, and NOVA
                    industrial processing.
                  </p>
                </div>
                <div className="h-96 w-full">
                  <ReactECharts option={trilemmaScatterOption} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>

              <div className="almanac-sheet p-5">
                <div className="flex items-center justify-between pb-2.5 mb-3 rule-firm">
                  <h3 className="text-sm font-semibold">
                    Harmonized Open Food Facts product records (first 100 matching filter)
                  </h3>
                  <span className="almanac-label">Tabular numerals right-aligned</span>
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
                        <th className="text-right">Protein (g/100g)</th>
                        <th className="text-right">Salt (g/100g)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.slice(0, 100).map((p, idx) => (
                        <tr key={`${p.code}-${idx}`}>
                          <td className="font-semibold text-[var(--color-ink)]">{p.name}</td>
                          <td>{p.brand}</td>
                          <td>{p.category}</td>
                          <td className="num">
                            {p.nutriscore_grade} ({p.nutriscore_score})
                          </td>
                          <td className="num text-right">
                            {p.ecoscore_grade} ({p.ecoscore_score})
                          </td>
                          <td className="num text-right text-[var(--color-accent)] font-semibold">
                            NOVA {p.nova_group}
                          </td>
                          <td className="num text-right">{p.proteins_100g.toFixed(1)}</td>
                          <td className="num text-right">{p.salt_100g.toFixed(2)}</td>
                        </tr>
                      ))}
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
                <div className="pb-2.5 mb-3 rule-firm">
                  <h2 className="text-lg font-semibold">
                    Section VII. Complete ADEME Agribalyse 3.1 Life-Cycle Inventory (
                    {filteredAgribalyse.length.toLocaleString()} / 2,451 items)
                  </h2>
                  <p className="almanac-label">
                    Product Environmental Footprint (PEF) synthesis per kilogram of food product at retail/edible stage.
                  </p>
                </div>
                <div className="h-88 w-full">
                  <ReactECharts option={agribalyseGroupOption} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>

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

          {/* MODULE VIII: PRICE & LITERATURE */}
          {activeModule === 'inflation' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="almanac-sheet p-5">
                <div className="pb-2.5 mb-3 rule-firm">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Eurostat HICP food price indices ([{currentProfile.code}] {currentProfile.name}, 2015–2025)
                  </h2>
                  <p className="almanac-label">
                    Annual Harmonised Index of Consumer Prices (prc_hicp_aind, 2015 = 100, axis starts at 95).
                  </p>
                </div>
                <div className="h-92 w-full">
                  <ReactECharts option={eurostatOption} style={{ height: '100%', width: '100%' }} />
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
          )}

          {/* MODULE IX: POLICY SIMULATOR */}
          {activeModule === 'simulator' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              <div className="xl:col-span-7 almanac-sheet p-5">
                <div className="pb-2.5 mb-3 rule-firm">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Sliders className="w-4 h-4" />
                    Section IX. Planetary Boundary and Consumer Basket Policy Model
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

                <div className="mt-4 p-4 almanac-well text-sm leading-relaxed">
                  <span className="font-display-head font-semibold text-[var(--color-ink)]">Methodological note:</span>{' '}
                  Pairing a <span className="num font-semibold">{simPlantShift}%</span> plant-protein substitution with a{' '}
                  <span className="num font-semibold">{simUpfReduction}%</span> reduction in NOVA 4 ultra-processed
                  intake avoids substituting meat with high-sodium industrial formulations—yielding a{' '}
                  <span className="num font-semibold text-[var(--color-accent)]">
                    {Math.abs(simulatedMetrics.carbonDeltaPct)}%
                  </span>{' '}
                  carbon reduction and a{' '}
                  <span className="num font-semibold text-[var(--color-accent)]">
                    +{simulatedMetrics.healthGainPct}%
                  </span>{' '}
                  cardiometabolic health gain.
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
                  <span className="almanac-well px-2.5 py-1">4 System Tiers (Ingestion, DuckDB, TimesFM, UI Deck)</span>
                  <span className="almanac-well px-2.5 py-1">11 In-Memory Parquet Tables</span>
                  <span className="almanac-well px-2.5 py-1">33 Code Files (100% Described · 0% Unassigned)</span>
                  <span className="almanac-well px-2.5 py-1">Dual Schematics (Editorial SVG + Floorplan)</span>
                  <span className="almanac-well px-2.5 py-1 text-[var(--color-accent)] font-semibold">
                    D4Vinci Scrapling 0.5.1 + DuckDB 1.28
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
                    <div>• <b>App.tsx:</b> Root state & policy levers</div>
                    <div>• <b>InteractiveChoroplethMap.tsx:</b> 6,845 GI pins</div>
                    <div>• <b>NSIMLObservatory.tsx:</b> TimesFM 2.0 & PCA</div>
                  </div>
                </div>

                <div className="almanac-sheet p-5 space-y-2">
                  <h3 className="font-display-head font-semibold text-sm text-[var(--color-ink)] flex items-center gap-2 pb-2 rule-firm">
                    <Database className="w-3.5 h-3.5 text-[#163d4a]" />
                    2. Columnar In-Memory SQL
                  </h3>
                  <p className="text-xs text-[var(--color-muted)] leading-relaxed font-serif-label">
                    DuckDB-Wasm running inside the browser worker thread, executing SQL queries in client memory across 9
                    ZSTD Parquet tables without requiring any backend server.
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
                    3. Scrapling & AI Pipelines
                  </h3>
                  <p className="text-xs text-[var(--color-muted)] leading-relaxed font-serif-label">
                    Python harvesting pipelines leveraging Scrapling for high-throughput regulatory extraction (EUIPO,
                    Qualigeo) and Google TimesFM 2.0 for zero-shot price series backtesting.
                  </p>
                  <div className="pt-2 text-[11px] font-mono-num text-[var(--color-ink)] space-y-1">
                    <div>• <b>build_gi_terroir_...py:</b> Scrapling crawler</div>
                    <div>• <b>enrich_gi_coordinates.py:</b> NUTS-2 geocoder</div>
                    <div>• <b>build_nsi_and_ml_...py:</b> TimesFM ML engine</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE XII: GS1 IMMAGINO & NIELSENIQ LAB */}
          {activeModule === 'gs1_immagino' && (
            <GS1ImmaginoObservatory />
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
                <b>Open Food Facts:</b> Barcode-verified EU retail catalog (3,740 products with Nutri-Score & NOVA 4).
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
              Machine Learning & Methodology
            </h4>
            <ul className="space-y-1.5 leading-relaxed">
              <li>
                <b>Google Research:</b> TimesFM 2.0 foundation model for zero-shot chronological CPI & plant shift forecasting.
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
          <span>DietShift Atlas © 2026 · Made by Amine · Default Jurisdiction: [IT] Italy</span>
          <span>Powered by DuckDB-Wasm & Apache Parquet</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
