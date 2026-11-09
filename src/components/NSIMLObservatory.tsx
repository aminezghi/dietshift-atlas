import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { assetUrl } from '../utils/assetPath';
import {
  Award,
  Building2,
  Code2,
  Cpu,
  ExternalLink,
  GitBranch,
  Layers,
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

interface TimesFMRecord {
  series_id: string;
  country_code: string;
  country_label: string;
  indicator_name: string;
  year: number;
  split_role: string;
  actual_value: number | null;
  timesfm_p50: number;
  timesfm_p10: number;
  timesfm_p90: number;
  ets_baseline: number;
  ridge_linear_baseline: number;
  timesfm_val_mae: number;
  ets_val_mae: number;
  ridge_val_mae: number;
  timesfm_val_rmse: number;
  ets_val_rmse: number;
  ridge_val_rmse: number;
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
    optimal_k: number;
    rows: NSIRecord[];
  } | null>(null);
  const [timesfmData, setTimesfmData] = useState<TimesFMRecord[]>([]);
  const [rosettaData, setRosettaData] = useState<RosettaRow[]>([]);

  const [activeSubTab, setActiveSubTab] = useState<'timesfm' | 'clustering' | 'nsi_equity' | 'rosetta'>('timesfm');
  const [pcaHueMode, setPcaHueMode] = useState<'cluster' | 'quintile'>('cluster');
  const [selectedIndicator, setSelectedIndicator] = useState<string>('Healthy Whole-Food CPI (2015=100)');
  const [nsiCountryFilter, setNsiCountryFilter] = useState<string>(
    ['ES', 'IT', 'NL', 'FR', 'DE', 'GBR', 'EU27_2020'].includes(selectedCountry) ? selectedCountry : 'IT'
  );
  const [showCodeModal, setShowCodeModal] = useState<boolean>(false);

  useEffect(() => {
    if (['ES', 'IT', 'NL', 'FR', 'DE', 'GBR', 'EU27_2020'].includes(selectedCountry)) {
      setNsiCountryFilter(selectedCountry);
    }
  }, [selectedCountry]);

  const handleCountryFilterChange = (newCode: string) => {
    setNsiCountryFilter(newCode);
    if (onSelectCountry && ['ES', 'IT', 'NL', 'FR', 'DE', 'GBR'].includes(newCode)) {
      onSelectCountry(newCode);
    }
  };

  useEffect(() => {
    Promise.all([
      fetch(assetUrl('data/nsi_subnational_quintiles.json')).then((r) => r.json()),
      fetch(assetUrl('data/ml_timesfm_forecasts.json')).then((r) => r.json()),
      fetch(assetUrl('data/crosswalk_rosetta.json')).then((r) => r.json()),
    ]).then(([nsi, tfm, ros]) => {
      setNsiData(nsi);
      setTimesfmData(tfm);
      setRosettaData(ros);
    });
  }, []);

  const activeTimesFMSeries = useMemo(() => {
    return timesfmData
      .filter((r) => r.country_code === nsiCountryFilter && r.indicator_name === selectedIndicator)
      .sort((a, b) => a.year - b.year);
  }, [timesfmData, nsiCountryFilter, selectedIndicator]);

  const timesfmChartOption = useMemo(() => {
    if (activeTimesFMSeries.length === 0) return {};
    const years = activeTimesFMSeries.map((r) => String(r.year));

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
        itemGap: 14,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { color: '#2d3643', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        data: [
          'Observed (NSI / Eurostat)',
          'TimesFM 2.0 forecast (P50)',
          'TimesFM P90 upper',
          'TimesFM P10 lower',
          'Holt-Winters ETS',
          'Ridge AR baseline',
        ],
      },
      grid: { top: 68, right: 28, bottom: 42, left: 64 },
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
          name: 'Observed (NSI / Eurostat)',
          type: 'line',
          symbolSize: 6,
          itemStyle: { color: '#111827' },
          lineStyle: { width: 2, color: '#111827' },
          data: activeTimesFMSeries.map((r) => r.actual_value),
        },
        {
          name: 'TimesFM 2.0 forecast (P50)',
          type: 'line',
          smooth: false,
          symbolSize: 6,
          itemStyle: { color: '#8a1253' },
          lineStyle: { width: 2.5, color: '#8a1253' },
          data: activeTimesFMSeries.map((r) => r.timesfm_p50),
          markArea: {
            itemStyle: { color: 'rgba(138, 18, 83, 0.06)' },
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
            data: [
              [
                { name: 'Backtest (2023–25)', xAxis: '2023' },
                { xAxis: '2025' },
              ],
              [
                {
                  name: 'TimesFM 2.0 horizon (2026–30)',
                  xAxis: '2026',
                  itemStyle: { color: 'rgba(22, 61, 74, 0.08)' },
                },
                { xAxis: '2030' },
              ],
            ],
          },
        },
        {
          name: 'TimesFM P90 upper',
          type: 'line',
          symbol: 'none',
          lineStyle: { width: 1, color: '#8a1253' },
          areaStyle: { color: 'rgba(138, 18, 83, 0.10)' },
          data: activeTimesFMSeries.map((r) => (r.year >= 2023 ? r.timesfm_p90 : null)),
        },
        {
          name: 'TimesFM P10 lower',
          type: 'line',
          symbol: 'none',
          lineStyle: { width: 1, color: '#8a1253' },
          data: activeTimesFMSeries.map((r) => (r.year >= 2023 ? r.timesfm_p10 : null)),
        },
        {
          name: 'Holt-Winters ETS',
          type: 'line',
          symbol: 'none',
          itemStyle: { color: '#525e70' },
          lineStyle: { width: 1.5, color: '#525e70' },
          data: activeTimesFMSeries.map((r) => (r.year >= 2022 ? r.ets_baseline : null)),
        },
        {
          name: 'Ridge AR baseline',
          type: 'line',
          symbol: 'none',
          itemStyle: { color: '#7b8696' },
          lineStyle: { width: 1.5, color: '#7b8696' },
          data: activeTimesFMSeries.map((r) => (r.year >= 2022 ? r.ridge_linear_baseline : null)),
        },
      ],
    };
  }, [activeTimesFMSeries, selectedIndicator]);

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
        name: 'Principal Component 1 (54.2% variance: guideline adherence vs. NOVA 4 exposure)',
        nameLocation: 'middle',
        nameGap: 28,
        nameTextStyle: { color: '#3d4654', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        type: 'value',
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      yAxis: {
        name: 'PC2 (26.8% variance: affluence vs. food budget share)',
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

  const currentMetricSample = activeTimesFMSeries[activeTimesFMSeries.length - 1];

  return (
    <div className="space-y-5">
      {/* Almanac Section Header */}
      <div className="almanac-sheet p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 rule-firm">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              Section II. National Statistical Institutes and Google TimesFM 2.0 Forecasts
            </h2>
            <p className="almanac-label mt-0.5">
              Harmonized sub-national and quintile records (INE Spain, ISTAT Italy, CBS Netherlands, INSEE France,
              Destatis Germany, ONS UK) with chronological foundation-model backtesting.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'timesfm', label: '1. TimesFM 2.0 forecast', icon: TrendingUp },
              { id: 'clustering', label: '2. PCA & silhouette regimes', icon: Sparkles },
              { id: 'nsi_equity', label: '3. NSI quintiles (INE / ISTAT)', icon: Building2 },
              { id: 'rosetta', label: '4. Rosetta schema crosswalk', icon: GitBranch },
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

      {/* SUB-TAB 1: GOOGLE TIMESFM 2.0 */}
      {activeSubTab === 'timesfm' && (
        <div className="space-y-5">
          <div className="almanac-sheet p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-3 pb-3 rule-hair-bottom">
              <div className="flex flex-wrap items-center gap-3">
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
                  <label className="block almanac-label mb-1">Forecast series (2015–2030)</label>
                  <select
                    value={selectedIndicator}
                    onChange={(e) => setSelectedIndicator(e.target.value)}
                    className="almanac-select"
                  >
                    <option value="Healthy Whole-Food CPI (2015=100)">Healthy Whole-Food CPI (2015=100)</option>
                    <option value="Plant-Protein Dietary Share (%)">Plant-Protein Dietary Share (%)</option>
                    <option value="NOVA 4 Ultra-Processed Share (% kcal)">NOVA 4 Ultra-Processed Share (% kcal)</option>
                    <option value="Dietary Carbon Footprint (kg CO2eq/d)">Dietary Carbon Footprint (kg CO2eq/d)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => setShowCodeModal(!showCodeModal)}
                className="almanac-btn flex items-center gap-1.5"
              >
                <Code2 className="w-4 h-4" />
                {showCodeModal ? 'Hide TimesFM 2.0 specification' : 'Inspect BigQuery AI.FORECAST & Python script'}
              </button>
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

            {/* Quick Summary Stat Row for Selected Country & Series */}
            {activeTimesFMSeries.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 mb-4 border border-[var(--color-rule)] bg-[var(--color-sheet)]">
                <div className="p-2.5 rule-hair-right">
                  <div className="almanac-label text-xs">2015 Baseline</div>
                  <div className="font-mono-num font-semibold text-base text-[var(--color-ink)]">
                    {activeTimesFMSeries.find((r) => r.year === 2015)?.actual_value}
                  </div>
                </div>
                <div className="p-2.5 rule-hair-right">
                  <div className="almanac-label text-xs">2022 Train Cutoff</div>
                  <div className="font-mono-num font-semibold text-base text-[var(--color-ink)]">
                    {activeTimesFMSeries.find((r) => r.year === 2022)?.actual_value}
                  </div>
                </div>
                <div className="p-2.5 rule-hair-right">
                  <div className="almanac-label text-xs">2025 Observed (NSI/HICP)</div>
                  <div className="font-mono-num font-semibold text-base text-[var(--color-ink)]">
                    {activeTimesFMSeries.find((r) => r.year === 2025)?.actual_value}
                  </div>
                </div>
                <div className="p-2.5 rule-hair-right">
                  <div className="almanac-label text-xs">2030 TimesFM P50</div>
                  <div className="font-mono-num font-semibold text-base text-[var(--color-accent)]">
                    {activeTimesFMSeries.find((r) => r.year === 2030)?.timesfm_p50}
                  </div>
                </div>
                <div className="p-2.5">
                  <div className="almanac-label text-xs">2030 80% Interval [P10, P90]</div>
                  <div className="font-mono-num font-semibold text-sm text-[var(--color-ink-2)]">
                    [{activeTimesFMSeries.find((r) => r.year === 2030)?.timesfm_p10},{' '}
                    {activeTimesFMSeries.find((r) => r.year === 2030)?.timesfm_p90}]
                  </div>
                </div>
              </div>
            )}

            {showCodeModal && (
              <div className="mb-4 p-4 almanac-ink-band text-xs font-mono-num space-y-2">
                <div className="font-sans font-semibold text-[var(--color-sheet)]">
                  Reproducible Google TimesFM 2.0 execution (BigQuery ML AI.FORECAST and PyTorch checkpoint):
                </div>
                <pre className="overflow-x-auto p-3 bg-black/25">
{`-- 1. Google Cloud BigQuery ML (TimesFM 2.0 Zero-Shot Foundation Model)
SELECT *
FROM AI.FORECAST(
  TABLE \`dietshift_observatory.nsi_historical_series\`,
  data_col => 'actual_value',
  timestamp_col => 'year_date',
  id_cols => ['country_code', 'indicator_name'],
  horizon => 5,
  confidence_level => 0.80
);

# 2. Local Python Open-Weights Inference (google/timesfm-2.0-500m-pytorch)
import timesfm
tfm = timesfm.TimesFm(
    hparams=timesfm.TimesFmHparams(backend="gpu", per_core_batch_size=32, horizon_len=5),
    checkpoint=timesfm.TimesFmCheckpoint(huggingface_repo_id="google/timesfm-2.0-500m-pytorch"),
)
point_forecast, quantile_forecast = tfm.forecast(inputs=historical_series, freq=[0] * len(historical_series))`}
                </pre>
              </div>
            )}

            <div className="h-92 w-full">
              <ReactECharts option={timesfmChartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
            </div>
          </div>

          {/* Model Validation Ledger */}
          {currentMetricSample && (
            <div className="almanac-sheet p-5">
              <h3 className="text-sm font-semibold pb-2 mb-3 rule-firm flex items-center gap-2">
                <Award className="w-4 h-4" />
                Chronological validation error comparison (held-out split: 2023–2025)
              </h3>
              <table className="almanac-table">
                <thead>
                  <tr>
                    <th>Forecasting architecture</th>
                    <th>Training window</th>
                    <th>Validation window</th>
                    <th className="text-right">Validation MAE</th>
                    <th className="text-right">Validation RMSE</th>
                    <th>Notes on structural regime shifts</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-semibold text-[var(--color-ink)]">
                      Google TimesFM 2.0 (zero-shot foundation model)
                    </td>
                    <td className="num">2015–2022</td>
                    <td className="num">2023–2025</td>
                    <td className="num text-right font-semibold text-[var(--color-accent)]">
                      {currentMetricSample.timesfm_val_mae}
                    </td>
                    <td className="num text-right font-semibold text-[var(--color-accent)]">
                      {currentMetricSample.timesfm_val_rmse}
                    </td>
                    <td>Adapts to post-2022 inflation and substitution inflections with P10–P90 bounds.</td>
                  </tr>
                  <tr>
                    <td>Holt-Winters exponential smoothing (ETS baseline)</td>
                    <td className="num">2015–2022</td>
                    <td className="num">2023–2025</td>
                    <td className="num text-right">{currentMetricSample.ets_val_mae}</td>
                    <td className="num text-right">{currentMetricSample.ets_val_rmse}</td>
                    <td>Classical smoothing lags rapid price-elasticity shifts.</td>
                  </tr>
                  <tr>
                    <td>Chronological Ridge autoregression (linear ML baseline)</td>
                    <td className="num">2015–2022</td>
                    <td className="num">2023–2025</td>
                    <td className="num text-right">{currentMetricSample.ridge_val_mae}</td>
                    <td className="num text-right">{currentMetricSample.ridge_val_rmse}</td>
                    <td>Linear trend underfits non-linear food inflation shocks.</td>
                  </tr>
                </tbody>
              </table>
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
                  Standardized (z-score) socio-dietary features projected onto PC1 (54.2% variance) and PC2 (26.8%
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
                Selecting k = 4 yields a 0.307 silhouette coefficient while separating four interpretable dietary
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

      {/* SUB-TAB 4: ROSETTA SCHEMA CROSSWALK */}
      {activeSubTab === 'rosetta' && (
        <div className="almanac-sheet p-5">
          <div className="pb-3 mb-3 rule-firm">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Canonical Rosetta Stone schema crosswalk (crosswalk_rosetta.parquet)
            </h3>
            <p className="almanac-label mt-0.5">
              Concordance linking National Statistical Institute household expenditure codes (ECOICOP 5-digit) to EFSA
              FoodEx2 dietary intake and ADEME Agribalyse 3.1 life-cycle inventory codes.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="almanac-table">
              <thead>
                <tr>
                  <th>ECOICOP 5-digit</th>
                  <th>NSI household expenditure & CPI category</th>
                  <th>EFSA FoodEx2</th>
                  <th>FoodEx2 subgroup</th>
                  <th>Agribalyse AGB</th>
                  <th className="text-right">NOVA</th>
                  <th className="text-right">Allocation weight</th>
                  <th className="text-right">Edible yield</th>
                  <th className="text-right">Climate (kg CO₂/kg)</th>
                </tr>
              </thead>
              <tbody>
                {rosettaData.map((row) => (
                  <tr key={row.crosswalk_id}>
                    <td className="num font-semibold text-[var(--color-ink)]">{row.ecoicop_code}</td>
                    <td>{row.ecoicop_label}</td>
                    <td className="num text-[var(--color-accent)]">{row.foodex2_code}</td>
                    <td>{row.foodex2_level2}</td>
                    <td className="num">
                      #{row.agb_code} ({row.agb_lci_name.slice(0, 22)})
                    </td>
                    <td className="num text-right">{row.nova_group}</td>
                    <td className="num text-right">{row.allocation_weight.toFixed(2)}</td>
                    <td className="num text-right">{row.edible_yield_factor.toFixed(2)}</td>
                    <td className="num text-right font-semibold text-[var(--color-accent)]">
                      {row.mean_co2_kg.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
