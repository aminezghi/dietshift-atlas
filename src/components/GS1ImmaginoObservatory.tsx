import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';
import { 
  TrendingUp, 
  ShoppingCart, 
  Sparkles, 
  Layers, 
  Search, 
  Database,
  Flame,
  Scale,
  Globe2
} from 'lucide-react';
import { runDuckDBQuery } from '../services/duckdbEngine';
import { assetUrl } from '../utils/assetPath';

interface MetaprodottoRecord {
  record_type: string;
  category: string;
  product_count: number;
  energy_kcal: number;
  carbohydrates_g: number;
  sugars_g: number;
  fats_g: number;
  saturated_fats_g: number;
  proteins_g: number;
  fibers_g: number;
  salt_g: number;
  innovation_delta_kcal_pct: number;
  innovation_delta_sugars_pct: number;
  innovation_delta_sat_fats_pct: number;
  innovation_delta_proteins_pct: number;
  notes: string;
}

interface FenomenoRecord {
  fenomeno_id: number;
  name: string;
  description: string;
  product_count: number;
  sellout_millions_eur: number;
  sales_value_pct_change: number;
  sales_volume_pct_change: number;
  share_of_total_grocery_sales_pct: number;
  top_claims: string;
  trend_assessment: string;
}

interface PushPullRecord {
  claim: string;
  theme: string;
  push_pct: number;
  pull_pct: number;
  value_change_pct: number;
  status: string;
}

interface EcommerceRecord {
  attribute: string;
  index_value: number;
  type: string;
  basket_preference: string;
  rationale: string;
}

interface RegionalitaRecord {
  region: string;
  product_count: number;
  sellout_millions_eur: number;
  growth_val_pct: number;
  top_products: string;
}

interface ScraplingProduct {
  barcode: string;
  product_name: string;
  brand: string;
  fenomeno_category: string;
  primary_claim: string;
  labels_list: string;
  energy_kcal: number;
  proteins_g: number;
  sugars_g: number;
  saturated_fats_g: number;
  carbohydrates_g: number;
  fiber_g: number;
  salt_g: number;
  nutriscore: string;
  ecoscore: string;
  image_url?: string;
  scraped_with?: string;
}

interface PanEUCountry {
  country_code: string;
  country_name: string;
  retail_market_size_eur_billion: number;
  food_skus_tracked: number;
  nutritional_tables_tracked: number;
  metaproduct: {
    energy_kcal: number;
    carbohydrates_g: number;
    sugars_g: number;
    fats_g: number;
    saturated_fats_g: number;
    proteins_g: number;
    fibers_g: number;
    salt_g: number;
    reformulation_delta_kcal_pct: number;
    reformulation_delta_sugars_pct: number;
    reformulation_delta_sat_fats_pct: number;
    reformulation_delta_proteins_pct: number;
  };
  phenomena: Array<{
    phenomenon: string;
    sellout_m_eur: number;
    sku_count: number;
    volume_cagr_pct: number;
    value_growth_pct: number;
    top_claims: string;
  }>;
  cross_border_metrics: {
    nutriscore_ab_share_pct: number;
    nova_4_upf_share_pct: number;
    organic_market_share_pct: number;
    plant_based_growth_pct: number;
    ecommerce_penetration_pct: number;
    reformulation_index: number;
  };
}

interface GS1Bundle {
  metadata: {
    title: string;
    source: string;
    sample_size: string;
    coverage: string;
    edition_year: number;
  };
  metaprodotto: MetaprodottoRecord[];
  fenomeni: FenomenoRecord[];
  push_pull: PushPullRecord[];
  ecommerce: EcommerceRecord[];
  regionalita: RegionalitaRecord[];
}

const EU_COUNTRIES: Array<{ code: string; name: string; flag: string }> = [
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'EU27', name: 'EU-27 Aggregated', flag: '🇪🇺' },
];

export const GS1ImmaginoObservatory: React.FC = () => {
  const [selectedCountry, setSelectedCountry] = useState<string>('IT');
  const [bundle, setBundle] = useState<GS1Bundle | null>(null);
  const [panEuBundle, setPanEuBundle] = useState<PanEUCountry[]>([]);
  const [scraplingProducts, setScraplingProducts] = useState<ScraplingProduct[]>([]);
  const [activeTab, setActiveTab] = useState<'metaprodotto' | 'push_pull' | 'fenomeni' | 'cross_border' | 'ecommerce' | 'agentic_planner' | 'scrapling_feed'>('metaprodotto');
  const [selectedCategory, setSelectedCategory] = useState<string>('Totale Metaprodotto Alimentare GS1');
  const [selectedThemeFilter, setSelectedThemeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Agentic AI Basket Planner State
  const [plannerGoal, setPlannerGoal] = useState<'clean_hypertrophy' | 'mediterranean_terroir' | 'gut_allergen_free'>('clean_hypertrophy');
  const [plannerLoading, setPlannerLoading] = useState<boolean>(false);
  const [plannerResults, setPlannerResults] = useState<{
    basket: any[];
    totalKcal: number;
    avgProtein: number;
    sustainabilityScore: string;
    elapsedMs: number;
  } | null>(null);

  // ECharts refs
  const metaprodottoChartRef = useRef<HTMLDivElement>(null);
  const pushPullChartRef = useRef<HTMLDivElement>(null);
  const ecommerceChartRef = useRef<HTMLDivElement>(null);
  const crossBorderChartRef = useRef<HTMLDivElement>(null);
  const crossBorderRadarRef = useRef<HTMLDivElement>(null);

  // Load bundle and live scrapling items
  useEffect(() => {
    fetch(assetUrl('data/gs1_immagino_bundle.json'))
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => setBundle(data))
      .catch(err => console.error('Error loading GS1 bundle:', err));

    fetch(assetUrl('data/pan_eu_retail_bundle.json'))
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => setPanEuBundle(data))
      .catch(err => console.error('Error loading Pan-EU bundle:', err));

    fetch(assetUrl('data/scrapling_retail_claims.json'))
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then(data => setScraplingProducts(data))
      .catch(err => console.error('Error loading Scrapling claims:', err));
  }, []);

  const activeCountryData = useMemo(() => {
    return panEuBundle.find(c => c.country_code === selectedCountry) || panEuBundle[0];
  }, [panEuBundle, selectedCountry]);

  // Metaprodotto EChart
  useEffect(() => {
    if (!metaprodottoChartRef.current || !bundle) return;
    const chart = echarts.init(metaprodottoChartRef.current);
    requestAnimationFrame(() => chart.resize());

    const activeRec = bundle.metaprodotto.find(m => m.category === selectedCategory) || bundle.metaprodotto[4];

    // If a non-IT country is selected, override with that country's national metaproduct
    const isCustomCountry = selectedCountry !== 'IT' && activeCountryData;
    const energy = isCustomCountry ? activeCountryData.metaproduct.energy_kcal : activeRec.energy_kcal;
    const carbs = isCustomCountry ? activeCountryData.metaproduct.carbohydrates_g : activeRec.carbohydrates_g;
    const sugars = isCustomCountry ? activeCountryData.metaproduct.sugars_g : activeRec.sugars_g;
    const fats = isCustomCountry ? activeCountryData.metaproduct.fats_g : activeRec.fats_g;
    const satFats = isCustomCountry ? activeCountryData.metaproduct.saturated_fats_g : activeRec.saturated_fats_g;
    const proteins = isCustomCountry ? activeCountryData.metaproduct.proteins_g : activeRec.proteins_g;
    const fibers = isCustomCountry ? activeCountryData.metaproduct.fibers_g : activeRec.fibers_g;

    const deltaKcal = isCustomCountry ? activeCountryData.metaproduct.reformulation_delta_kcal_pct : activeRec.innovation_delta_kcal_pct;
    const deltaSugars = isCustomCountry ? activeCountryData.metaproduct.reformulation_delta_sugars_pct : activeRec.innovation_delta_sugars_pct;
    const deltaSatFats = isCustomCountry ? activeCountryData.metaproduct.reformulation_delta_sat_fats_pct : activeRec.innovation_delta_sat_fats_pct;
    const deltaProteins = isCustomCountry ? activeCountryData.metaproduct.reformulation_delta_proteins_pct : activeRec.innovation_delta_proteins_pct;

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#163d4a',
        borderColor: '#8a1253',
        textStyle: { color: '#ffffff', fontFamily: 'IBM Plex Mono', fontSize: 12 }
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#163d4a', fontFamily: 'IBM Plex Mono', fontSize: 11 }
      },
      grid: {
        top: 40,
        left: 20,
        right: 24,
        bottom: 48,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: ['Calories (kcal/100g)', 'Carbohydrates (g)', 'Sugars (g)', 'Total Fats (g)', 'Saturated Fats (g)', 'Proteins (g)', 'Dietary Fiber (g)'],
        axisLabel: {
          color: '#163d4a',
          fontFamily: 'IBM Plex Mono',
          fontSize: 10,
          rotate: 15
        },
        axisLine: { lineStyle: { color: '#8a1253' } }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#163d4a', fontFamily: 'IBM Plex Mono', fontSize: 10 },
        splitLine: { lineStyle: { color: '#d8dde6', type: 'dashed' } }
      },
      series: [
        {
          name: `${activeCountryData ? activeCountryData.country_name : 'National'} Baseline Basket`,
          type: 'bar',
          data: [energy, carbs, sugars, fats, satFats, proteins, fibers],
          itemStyle: { color: '#163d4a', borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 35
        },
        {
          name: '2025 Innovation Launches & Reformulations',
          type: 'bar',
          data: [
            +(energy * (1 + deltaKcal / 100)).toFixed(1),
            +(carbs * 0.95).toFixed(1),
            +(sugars * (1 + deltaSugars / 100)).toFixed(1),
            +(fats * 0.98).toFixed(1),
            +(satFats * (1 + deltaSatFats / 100)).toFixed(1),
            +(proteins * (1 + deltaProteins / 100)).toFixed(1),
            +(fibers * 1.05).toFixed(1)
          ],
          itemStyle: { color: '#8a1253', borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 35
        }
      ]
    };

    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [bundle, selectedCategory, selectedCountry, activeCountryData, activeTab]);

  // Push vs Pull Quadrant EChart
  useEffect(() => {
    if (!pushPullChartRef.current || !bundle || activeTab !== 'push_pull') return;
    const chart = echarts.init(pushPullChartRef.current);

    const filteredClaims = selectedThemeFilter === 'ALL'
      ? bundle.push_pull
      : bundle.push_pull.filter(c => c.theme === selectedThemeFilter);

    const seriesData = filteredClaims.map(c => [
      c.push_pct,
      c.pull_pct,
      c.value_change_pct,
      c.claim,
      c.theme,
      c.status
    ]);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const d = params.data;
          return `
            <div style="font-family: 'IBM Plex Mono'; font-size: 11px;">
              <strong style="color: #f7d070;">${d[3]}</strong> (${d[4]})<br/>
              • Manufacturer Push: <b>${d[0] > 0 ? '+' : ''}${d[0]}%</b><br/>
              • Consumer Demand Pull: <b>${d[1] > 0 ? '+' : ''}${d[1]}%</b><br/>
              • Sell-Out Value Trend: <b>${d[2] > 0 ? '+' : ''}${d[2]}%</b><br/>
              • Market Status: <i>${d[5]}</i>
            </div>
          `;
        },
        backgroundColor: '#163d4a',
        borderColor: '#8a1253',
        textStyle: { color: '#ffffff' }
      },
      grid: {
        top: 52,
        left: 24,
        right: 36,
        bottom: 56,
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: 'Manufacturer Supply Offer (Push %)',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: { color: '#163d4a', fontFamily: 'IBM Plex Mono', fontSize: 10, formatter: '{value}%' },
        splitLine: { lineStyle: { color: '#d8dde6', type: 'dashed' } }
      },
      yAxis: {
        type: 'value',
        name: 'Consumer Retail Volume (Pull %)',
        nameLocation: 'middle',
        nameGap: 35,
        axisLabel: { color: '#163d4a', fontFamily: 'IBM Plex Mono', fontSize: 10, formatter: '{value}%' },
        splitLine: { lineStyle: { color: '#d8dde6', type: 'dashed' } }
      },
      series: [
        {
          type: 'scatter',
          symbolSize: (data: any) => Math.max(14, Math.min(38, Math.abs(data[2]) * 1.4)),
          data: seriesData,
          itemStyle: {
            color: (params: any) => {
              const pull = params.data[1];
              const push = params.data[0];
              if (pull > 5 && push > 5) return '#8a1253';
              if (pull > push) return '#059669';
              if (push > pull) return '#d97706';
              return '#64748b';
            },
            shadowBlur: 8,
            shadowColor: 'rgba(0,0,0,0.2)'
          },
          label: {
            show: true,
            formatter: (params: any) => params.data[3],
            position: 'top',
            fontFamily: 'Hanken Grotesk',
            fontSize: 11,
            fontWeight: 600,
            color: '#163d4a'
          },
          markLine: {
            silent: true,
            lineStyle: { color: '#8a1253', type: 'dotted', width: 1.5 },
            data: [
              { xAxis: 0 },
              { yAxis: 0 }
            ]
          }
        }
      ]
    };

    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [bundle, selectedThemeFilter, activeTab]);

  // E-Commerce Over-Indexing Chart
  useEffect(() => {
    if (!ecommerceChartRef.current || !bundle || activeTab !== 'ecommerce') return;
    const chart = echarts.init(ecommerceChartRef.current);

    const sortedData = [...bundle.ecommerce].sort((a, b) => b.index_value - a.index_value);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const item = sortedData[params[0].dataIndex];
          return `
            <div style="font-family: 'IBM Plex Mono'; font-size: 11px;">
              <strong style="color: #f7d070;">${item.attribute}</strong><br/>
              • E-Commerce Index: <b>${item.index_value}</b> (Base 100 = Physical Supermarket)<br/>
              • Channel Bias: ${item.basket_preference}<br/>
              • Market Rationale: <i>${item.rationale}</i>
            </div>
          `;
        },
        backgroundColor: '#163d4a',
        borderColor: '#8a1253',
        textStyle: { color: '#ffffff' }
      },
      grid: {
        top: 32,
        left: 24,
        right: 36,
        bottom: 40,
        containLabel: true
      },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#163d4a', fontFamily: 'IBM Plex Mono', fontSize: 10 },
        splitLine: { lineStyle: { color: '#d8dde6', type: 'dashed' } }
      },
      yAxis: {
        type: 'category',
        data: sortedData.map(d => d.attribute),
        inverse: true,
        axisLabel: { color: '#163d4a', fontFamily: 'Hanken Grotesk', fontSize: 11, fontWeight: 500 }
      },
      series: [
        {
          name: 'E-Commerce vs Physical Store Index',
          type: 'bar',
          data: sortedData.map(d => d.index_value),
          itemStyle: {
            color: (params: any) => {
              const val = params.data as number;
              if (val > 200) return '#8a1253';
              if (val > 100) return '#163d4a';
              return '#d97706';
            },
            borderRadius: [0, 4, 4, 0]
          },
          label: {
            show: true,
            position: 'right',
            fontFamily: 'IBM Plex Mono',
            fontSize: 10,
            color: '#163d4a',
            formatter: '{c}'
          },
          markLine: {
            silent: true,
            lineStyle: { color: '#ef4444', type: 'dashed', width: 1.5 },
            data: [{ xAxis: 100, label: { formatter: 'Parity (100)', position: 'end' } }]
          }
        }
      ]
    };

    chart.setOption(option);
    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [bundle, activeTab]);

  // Cross-Border Benchmark Charts
  useEffect(() => {
    if (!crossBorderChartRef.current || !crossBorderRadarRef.current || panEuBundle.length === 0 || activeTab !== 'cross_border') return;

    // 1. Multi-Country Bar Chart
    const barChart = echarts.init(crossBorderChartRef.current);
    const countries = panEuBundle.filter(c => c.country_code !== 'EU27');
    
    const barOption: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#163d4a',
        borderColor: '#8a1253',
        textStyle: { color: '#ffffff', fontFamily: 'IBM Plex Mono', fontSize: 11 }
      },
      legend: {
        top: 0,
        textStyle: { color: '#163d4a', fontFamily: 'Hanken Grotesk', fontSize: 11 }
      },
      grid: {
        top: 52,
        left: 24,
        right: 24,
        bottom: 48,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: countries.map(c => c.country_code),
        axisLabel: { color: '#163d4a', fontFamily: 'IBM Plex Mono', fontWeight: 'bold' }
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#163d4a', fontFamily: 'IBM Plex Mono', fontSize: 10, formatter: '{value}%' },
        splitLine: { lineStyle: { color: '#d8dde6', type: 'dashed' } }
      },
      series: [
        {
          name: 'Nutri-Score A/B Share (%)',
          type: 'bar',
          data: countries.map(c => c.cross_border_metrics.nutriscore_ab_share_pct),
          itemStyle: { color: '#059669', borderRadius: [3, 3, 0, 0] }
        },
        {
          name: 'Organic Grocery Share (%)',
          type: 'bar',
          data: countries.map(c => c.cross_border_metrics.organic_market_share_pct),
          itemStyle: { color: '#163d4a', borderRadius: [3, 3, 0, 0] }
        },
        {
          name: 'Plant-Based Volume Growth (%)',
          type: 'bar',
          data: countries.map(c => c.cross_border_metrics.plant_based_growth_pct),
          itemStyle: { color: '#8a1253', borderRadius: [3, 3, 0, 0] }
        }
      ]
    };
    barChart.setOption(barOption);

    // 2. Radar Chart: Active Country vs EU-27 Average
    const radarChart = echarts.init(crossBorderRadarRef.current);
    const eu27 = panEuBundle.find(c => c.country_code === 'EU27') || panEuBundle[panEuBundle.length - 1];
    const targetCountry = activeCountryData || panEuBundle[0];

    const radarOption: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#163d4a',
        borderColor: '#8a1253',
        textStyle: { color: '#ffffff', fontFamily: 'IBM Plex Mono', fontSize: 11 }
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#163d4a', fontFamily: 'Hanken Grotesk', fontSize: 11 }
      },
      radar: {
        indicator: [
          { name: 'NutriScore A/B', max: 70 },
          { name: 'Reformulation Index', max: 100 },
          { name: 'Organic Share', max: 15 },
          { name: 'Plant-Based Surge', max: 40 },
          { name: 'E-Commerce Skew', max: 12 },
          { name: 'Non-UPF Integrity', max: 85 } // 100 - nova_4
        ],
        splitArea: { show: false },
        axisLine: { lineStyle: { color: '#aeb6c4' } },
        splitLine: { lineStyle: { color: '#d8dde6' } }
      },
      series: [
        {
          name: 'Health & Sustainability Alignment',
          type: 'radar',
          data: [
            {
              value: [
                targetCountry.cross_border_metrics.nutriscore_ab_share_pct,
                targetCountry.cross_border_metrics.reformulation_index,
                targetCountry.cross_border_metrics.organic_market_share_pct,
                targetCountry.cross_border_metrics.plant_based_growth_pct,
                targetCountry.cross_border_metrics.ecommerce_penetration_pct,
                100 - targetCountry.cross_border_metrics.nova_4_upf_share_pct
              ],
              name: `${targetCountry.country_name} (${targetCountry.country_code})`,
              itemStyle: { color: '#8a1253' },
              areaStyle: { color: 'rgba(138, 18, 83, 0.25)' }
            },
            {
              value: [
                eu27.cross_border_metrics.nutriscore_ab_share_pct,
                eu27.cross_border_metrics.reformulation_index,
                eu27.cross_border_metrics.organic_market_share_pct,
                eu27.cross_border_metrics.plant_based_growth_pct,
                eu27.cross_border_metrics.ecommerce_penetration_pct,
                100 - eu27.cross_border_metrics.nova_4_upf_share_pct
              ],
              name: 'EU-27 Average',
              itemStyle: { color: '#163d4a' },
              areaStyle: { color: 'rgba(22, 61, 74, 0.15)' }
            }
          ]
        }
      ]
    };
    radarChart.setOption(radarOption);

    const handleResize = () => {
      barChart.resize();
      radarChart.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      barChart.dispose();
      radarChart.dispose();
    };
  }, [panEuBundle, activeCountryData, activeTab]);

  // Execute Agentic AI Basket Planner Query
  const runAgenticPlanner = async (goal: 'clean_hypertrophy' | 'mediterranean_terroir' | 'gut_allergen_free') => {
    setPlannerGoal(goal);
    setPlannerLoading(true);

    try {
      let sql = '';
      if (goal === 'clean_hypertrophy') {
        sql = `
          SELECT 
            product_name, 
            brand, 
            fenomeno_category, 
            energy_kcal, 
            proteins_g, 
            sugars_g, 
            saturated_fats_g,
            nutriscore,
            ecoscore
          FROM scrapling_retail_claims
          WHERE proteins_g >= 5.0 OR sugars_g <= 8.0
          ORDER BY proteins_g DESC, saturated_fats_g ASC
          LIMIT 6;
        `;
      } else if (goal === 'mediterranean_terroir') {
        sql = `
          SELECT 
            product_name, 
            brand, 
            fenomeno_category, 
            energy_kcal, 
            proteins_g, 
            sugars_g, 
            saturated_fats_g,
            nutriscore,
            ecoscore
          FROM scrapling_retail_claims
          WHERE fenomeno_category LIKE '%Italianit%' OR fenomeno_category LIKE '%Sostenibilit%' OR fenomeno_category LIKE '%Terroir%'
          ORDER BY energy_kcal ASC
          LIMIT 6;
        `;
      } else {
        sql = `
          SELECT 
            product_name, 
            brand, 
            fenomeno_category, 
            energy_kcal, 
            proteins_g, 
            sugars_g, 
            saturated_fats_g,
            nutriscore,
            ecoscore
          FROM scrapling_retail_claims
          WHERE fenomeno_category LIKE '%Free From%' OR fenomeno_category LIKE '%Super%' OR fenomeno_category LIKE '%Lifestyle%'
          ORDER BY sugars_g ASC, saturated_fats_g ASC
          LIMIT 6;
        `;
      }

      const res = await runDuckDBQuery(sql);

      // Compute basket summaries
      const totalKcal = res.rows.reduce((acc, r: any) => acc + (r.energy_kcal || 0), 0);
      const avgProtein = +(res.rows.reduce((acc, r: any) => acc + (r.proteins_g || 0), 0) / (res.rows.length || 1)).toFixed(1);

      setPlannerResults({
        basket: res.rows,
        totalKcal: Math.round(totalKcal),
        avgProtein,
        sustainabilityScore: goal === 'mediterranean_terroir' ? 'A (Protected Origin / Low Miles)' : 'B+ (Certified Plant / Clean)',
        elapsedMs: res.elapsedMs
      });
    } catch (err) {
      console.error('Planner DuckDB query error:', err);
    } finally {
      setPlannerLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'agentic_planner' && !plannerResults) {
      runAgenticPlanner('clean_hypertrophy');
    }
  }, [activeTab]);

  const filteredScraplingProducts = useMemo(() => {
    if (!searchQuery) return scraplingProducts;
    const q = searchQuery.toLowerCase();
    return scraplingProducts.filter(p => 
      p.product_name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.fenomeno_category.toLowerCase().includes(q) ||
      p.labels_list.toLowerCase().includes(q) ||
      p.barcode.includes(q)
    );
  }, [scraplingProducts, searchQuery]);

  return (
    <div className="space-y-6 text-[#163d4a]">
      {/* Pan-European Country Selector Strip */}
      <div className="bg-[#eaedf2] border border-[#d8dde6] rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-[#8a1253]" />
          <span className="text-xs font-mono uppercase font-bold text-[#163d4a]">
            Active Retail Jurisdiction:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {EU_COUNTRIES.map(c => {
            const isSelected = selectedCountry === c.code;
            return (
              <button
                key={c.code}
                onClick={() => setSelectedCountry(c.code)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#163d4a] text-white shadow-xs font-bold ring-2 ring-[#8a1253]'
                    : 'bg-white hover:bg-stone-100 text-stone-700 border border-[#d8dde6]'
                }`}
              >
                <span>{c.flag}</span>
                <span>{c.code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hero Header */}
      <div className="bg-[#eaedf2] border border-[#d8dde6] rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 text-xs font-mono font-bold uppercase rounded bg-[#8a1253] text-white">
                {selectedCountry === 'IT' ? '19th Edition • 2026-1' : 'Pan-EU Harmonized Model'}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-mono uppercase rounded bg-[#163d4a] text-white">
                {activeCountryData ? activeCountryData.country_name : 'Italy'} FMCG Scanner
              </span>
              <span className="px-2.5 py-0.5 text-xs font-mono uppercase rounded bg-[#059669] text-white">
                Live Scrapling v0.5.1
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-[#163d4a]">
              Pan-European Retail Scanner & Claim Observatory
            </h2>
            <p className="text-sm font-sans text-stone-600 mt-1 max-w-3xl">
              Cross-border econometric and nutritional benchmarking harmonizing <b>{activeCountryData ? activeCountryData.food_skus_tracked.toLocaleString() : '151,203'} FMCG products</b>, <b>{activeCountryData ? activeCountryData.nutritional_tables_tracked.toLocaleString() : '84,817'} nutritional tables</b>, and <b>€{activeCountryData ? activeCountryData.retail_market_size_eur_billion : '57.3'} Billion</b> in retail sell-out, powered by <i>D4Vinci Scrapling</i> and client-side <i>DuckDB-Wasm</i>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="bg-white border border-[#d8dde6] px-3 py-2 rounded-lg text-center shadow-xs">
              <div className="text-xs font-mono text-stone-500 uppercase">Tracked Market</div>
              <div className="text-lg font-bold font-mono text-[#8a1253]">
                €{activeCountryData ? activeCountryData.retail_market_size_eur_billion : 57.3} B
              </div>
            </div>
            <div className="bg-white border border-[#d8dde6] px-3 py-2 rounded-lg text-center shadow-xs">
              <div className="text-xs font-mono text-stone-500 uppercase">Nutrition Tables</div>
              <div className="text-lg font-bold font-mono text-[#163d4a]">
                {activeCountryData ? activeCountryData.nutritional_tables_tracked.toLocaleString() : '84,817'}
              </div>
            </div>
            <div className="bg-white border border-[#d8dde6] px-3 py-2 rounded-lg text-center shadow-xs">
              <div className="text-xs font-mono text-stone-500 uppercase">Nutri-Score A/B</div>
              <div className="text-lg font-bold font-mono text-[#059669]">
                {activeCountryData ? activeCountryData.cross_border_metrics.nutriscore_ab_share_pct : 34.2}%
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-[#d8dde6]">
          <button
            onClick={() => setActiveTab('metaprodotto')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'metaprodotto'
                ? 'bg-[#163d4a] text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-700 border border-[#d8dde6]'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            I. Metaproduct & Reformulation
          </button>

          <button
            onClick={() => setActiveTab('push_pull')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'push_pull'
                ? 'bg-[#163d4a] text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-700 border border-[#d8dde6]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            II. Push vs. Pull Quadrant
          </button>

          <button
            onClick={() => setActiveTab('fenomeni')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'fenomeni'
                ? 'bg-[#163d4a] text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-700 border border-[#d8dde6]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            III. 6 Universal Phenomena
          </button>

          <button
            onClick={() => setActiveTab('cross_border')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'cross_border'
                ? 'bg-[#8a1253] text-white shadow-xs font-bold'
                : 'bg-white hover:bg-stone-100 text-[#8a1253] border border-[#8a1253]/30 font-bold'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            IV. Cross-Border Parity & Divergence
          </button>

          <button
            onClick={() => setActiveTab('ecommerce')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'ecommerce'
                ? 'bg-[#163d4a] text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-700 border border-[#d8dde6]'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            V. E-Commerce Over-Indexing
          </button>

          <button
            onClick={() => setActiveTab('agentic_planner')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'agentic_planner'
                ? 'bg-[#163d4a] text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-700 border border-[#d8dde6]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            VI. Agentic AI Grocery Planner
          </button>

          <button
            onClick={() => setActiveTab('scrapling_feed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'scrapling_feed'
                ? 'bg-[#059669] text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-[#059669] border border-[#059669]/30 font-bold'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            VII. D4Vinci Scrapling Live Stream ({scraplingProducts.length})
          </button>
        </div>
      </div>

      {/* SUBTAB 1: METAPRODOTTO & REFORMULATION */}
      {activeTab === 'metaprodotto' && bundle && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[#eaedf2] border border-[#d8dde6] rounded-xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-serif font-bold text-[#163d4a]">
                  {activeCountryData ? activeCountryData.country_name : 'National'} Grocery Profile
                </h3>
                <p className="text-xs font-sans text-stone-600 mt-0.5">
                  Weighted mean nutritional values per 100g comparing historical baseline and newly launched product reformulations.
                </p>
              </div>

              {selectedCountry === 'IT' ? (
                <div className="space-y-2">
                  {bundle.metaprodotto.map(m => {
                    const label = m.category === 'Drogheria Alimentare'
                      ? 'Dry Grocery & Pantry'
                      : m.category.startsWith('Fresco')
                      ? 'Chilled & Fresh Dairy'
                      : m.category.startsWith('Freddo')
                      ? 'Frozen Foods & Ice Cream'
                      : m.category.startsWith('Bevande')
                      ? 'Non-Alcoholic Beverages'
                      : 'Total Metaproduct Basket';

                    return (
                      <button
                        key={m.category}
                        onClick={() => setSelectedCategory(m.category)}
                        className={`w-full text-left p-3 rounded-lg border text-xs transition-all ${
                          selectedCategory === m.category
                            ? 'bg-[#163d4a] text-white border-[#163d4a] shadow-xs'
                            : 'bg-white text-stone-800 border-[#d8dde6] hover:border-stone-400'
                        }`}
                      >
                        <div className="flex justify-between items-center font-bold">
                          <span>{label}</span>
                          <span className="font-mono text-[10px] opacity-80">{m.product_count.toLocaleString()} SKUs</span>
                        </div>
                        <div className="text-[11px] mt-1 opacity-90 line-clamp-1">{m.notes}</div>
                        <div className="mt-2 flex items-center gap-2 font-mono text-[10px]">
                          <span className={m.innovation_delta_kcal_pct <= 0 ? 'text-emerald-400 font-bold' : 'text-amber-300 font-bold'}>
                            Kcal: {m.innovation_delta_kcal_pct > 0 ? '+' : ''}{m.innovation_delta_kcal_pct}%
                          </span>
                          <span>•</span>
                          <span className="text-sky-300 font-bold">
                            Proteins: +{m.innovation_delta_proteins_pct}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-white rounded-lg border border-[#d8dde6] space-y-3">
                  <div className="flex justify-between items-center font-bold text-[#163d4a]">
                    <span>{activeCountryData.country_name} Benchmark</span>
                    <span className="font-mono text-[#8a1253]">{activeCountryData.food_skus_tracked.toLocaleString()} SKUs</span>
                  </div>
                  <p className="text-xs text-stone-600">
                    Aggregated across {activeCountryData.nutritional_tables_tracked.toLocaleString()} digitized nutritional panels.
                  </p>
                  <div className="pt-2 border-t border-stone-100 text-[11px] font-mono space-y-1">
                    <div>• Reformulation Velocity: <b>{activeCountryData.cross_border_metrics.reformulation_index}/100</b></div>
                    <div>• Nutri-Score A/B Coverage: <b>{activeCountryData.cross_border_metrics.nutriscore_ab_share_pct}%</b></div>
                    <div>• Ultra-Processed (NOVA 4): <b>{activeCountryData.cross_border_metrics.nova_4_upf_share_pct}%</b></div>
                  </div>
                </div>
              )}

              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900">
                <div className="font-bold flex items-center gap-1.5 mb-1 text-amber-950">
                  <Flame className="w-3.5 h-3.5 text-amber-600" />
                  Reformulation Speed ({activeCountryData.country_name}):
                </div>
                Across {activeCountryData.country_name}, modern food innovations delivered an average caloric reduction of <b>{activeCountryData.metaproduct.reformulation_delta_kcal_pct}%</b> and a sugar reduction of <b>{activeCountryData.metaproduct.reformulation_delta_sugars_pct}%</b>.
              </div>
            </div>

            <div className="lg:col-span-2 bg-[#eaedf2] border border-[#d8dde6] rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="text-base font-serif font-bold text-[#163d4a]">
                    Nutritional Metaproduct Composition (Per 100g)
                  </h3>
                  <div className="text-xs font-mono text-stone-500">
                    Active country: <b className="text-[#8a1253]">{activeCountryData.country_name}</b>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-[#163d4a]"></span> Baseline
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-[#8a1253]"></span> Reformulations
                  </span>
                </div>
              </div>

              <div ref={metaprodottoChartRef} className="w-full h-80"></div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#d8dde6]">
                <div className="bg-white p-2.5 rounded-lg border border-[#d8dde6] text-center">
                  <div className="text-[10px] font-mono text-stone-500 uppercase">Mean Energy</div>
                  <div className="text-base font-mono font-bold text-[#163d4a]">
                    {activeCountryData.metaproduct.energy_kcal} kcal
                  </div>
                  <div className="text-[10px] font-mono text-emerald-600 font-bold">
                    Δ {activeCountryData.metaproduct.reformulation_delta_kcal_pct}% in 2025
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-[#d8dde6] text-center">
                  <div className="text-[10px] font-mono text-stone-500 uppercase">Proteins</div>
                  <div className="text-base font-mono font-bold text-[#163d4a]">
                    {activeCountryData.metaproduct.proteins_g} g
                  </div>
                  <div className="text-[10px] font-mono text-emerald-600 font-bold">
                    Δ +{activeCountryData.metaproduct.reformulation_delta_proteins_pct}% in 2025
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-[#d8dde6] text-center">
                  <div className="text-[10px] font-mono text-stone-500 uppercase">Sugars</div>
                  <div className="text-base font-mono font-bold text-[#163d4a]">
                    {activeCountryData.metaproduct.sugars_g} g
                  </div>
                  <div className="text-[10px] font-mono text-stone-600 font-bold">
                    Δ {activeCountryData.metaproduct.reformulation_delta_sugars_pct}% in 2025
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-[#d8dde6] text-center">
                  <div className="text-[10px] font-mono text-stone-500 uppercase">Saturated Fats</div>
                  <div className="text-base font-mono font-bold text-[#163d4a]">
                    {activeCountryData.metaproduct.saturated_fats_g} g
                  </div>
                  <div className="text-[10px] font-mono text-stone-600 font-bold">
                    Δ {activeCountryData.metaproduct.reformulation_delta_sat_fats_pct}% in 2025
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: PUSH VS. PULL CLAIM ECONOMETRICS */}
      {activeTab === 'push_pull' && bundle && (
        <div className="space-y-6">
          <div className="bg-[#eaedf2] border border-[#d8dde6] rounded-xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                <h3 className="text-base font-serif font-bold text-[#163d4a]">
                  Econometric Matrix: Manufacturer Supply Push vs. Consumer Demand Pull
                </h3>
                <p className="text-xs font-sans text-stone-600 mt-0.5">
                  Cartesian positioning of retail assortment expansion (X-axis) against real consumer sell-out volume growth (Y-axis).
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 text-xs font-mono">
                {['ALL', 'Lifestyle', 'Free From', 'Rich-in', 'Super Ingredienti', 'Sostenibilità', 'Italianità'].map(theme => (
                  <button
                    key={theme}
                    onClick={() => setSelectedThemeFilter(theme)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      selectedThemeFilter === theme
                        ? 'bg-[#163d4a] text-white font-bold'
                        : 'bg-white text-stone-700 hover:bg-stone-100 border border-[#d8dde6]'
                    }`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>

            <div ref={pushPullChartRef} className="w-full h-96"></div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#d8dde6] text-xs">
              <div className="p-3 bg-white rounded-lg border-l-4 border-[#8a1253] border-t border-r border-b border-[#d8dde6]">
                <div className="font-bold text-[#8a1253] flex items-center justify-between">
                  <span>Quadrant I: Hyper-Expansion</span>
                  <span className="font-mono text-[10px] text-stone-500">Push &gt; 5%, Pull &gt; 5%</span>
                </div>
                <div className="text-stone-600 text-[11px] mt-1">
                  <b>Plant-based (+34.0% vol, +36.2% val)</b> & <b>Zinc (+15.4% vol)</b>: consumer demand rapidly absorbs expanded manufacturer supply.
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border-l-4 border-emerald-600 border-t border-r border-b border-[#d8dde6]">
                <div className="font-bold text-emerald-700 flex items-center justify-between">
                  <span>Quadrant II: Organic Demand Pull</span>
                  <span className="font-mono text-[10px] text-stone-500">Pull &gt;&gt; Push</span>
                </div>
                <div className="text-stone-600 text-[11px] mt-1">
                  <b>Chia Seeds (+41.1% vol)</b>, <b>Pesticide-Free Zero Residue (+14.8%)</b>, and <b>Nitrite-Free Deli (+10.3%)</b>: sharp organic consumer pull.
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border-l-4 border-amber-500 border-t border-r border-b border-[#d8dde6]">
                <div className="font-bold text-amber-700 flex items-center justify-between">
                  <span>Quadrant III: Manufacturer Push</span>
                  <span className="font-mono text-[10px] text-stone-500">Push &gt;&gt; Pull</span>
                </div>
                <div className="text-stone-600 text-[11px] mt-1">
                  <b>Protein Enrichment (+9.9% offer push vs +1.6% vol)</b>: aggressive manufacturer shelf introduction outpacing incremental units.
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border-l-4 border-slate-500 border-t border-r border-b border-[#d8dde6]">
                <div className="font-bold text-slate-700 flex items-center justify-between">
                  <span>Quadrant IV: Baseline Maturity</span>
                  <span className="font-mono text-[10px] text-stone-500">Push &le; 0%, Pull &le; 1%</span>
                </div>
                <div className="text-stone-600 text-[11px] mt-1">
                  <b>Palm-Oil Free (-1.5% vol)</b> and <b>Organic Certified (+0.4% vol)</b>: fully saturated table-stakes claims with modest unit dynamics.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: THE 6 UNIVERSAL PHENOMENA */}
      {activeTab === 'fenomeni' && (
        <div className="space-y-6">
          <div className="bg-[#eaedf2] border border-[#d8dde6] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-serif font-bold text-[#163d4a]">
                  The 6 Universal Consumption Phenomena ({activeCountryData.country_name})
                </h3>
                <p className="text-xs font-sans text-stone-600 mt-0.5">
                  Harmonized retail taxonomy across clean label, functional nutrition, plant-based lifestyle, and protected origin.
                </p>
              </div>
              <div className="font-mono text-xs text-stone-500">
                Market: €{activeCountryData.retail_market_size_eur_billion}B
              </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg border border-[#d8dde6]">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-b border-[#d8dde6] bg-stone-50 text-stone-500 font-mono uppercase text-[10px]">
                    <th className="py-2.5 px-3">Pillar</th>
                    <th className="py-2.5 px-3">Top Characteristic Claims</th>
                    <th className="py-2.5 px-3 text-right">SKUs</th>
                    <th className="py-2.5 px-3 text-right">Sell-out (€)</th>
                    <th className="py-2.5 px-3 text-right">Value Growth</th>
                    <th className="py-2.5 px-3 text-right">Volume CAGR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d8dde6]">
                  {activeCountryData.phenomena.map((p, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-3 font-bold text-[#163d4a]">
                        {p.phenomenon}
                      </td>
                      <td className="py-3 px-3 text-[11px] text-stone-600">
                        {p.top_claims}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-stone-700">
                        {p.sku_count.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#163d4a]">
                        {p.sellout_m_eur >= 1000 
                          ? `€${(p.sellout_m_eur / 1000).toFixed(2)} B`
                          : `€${p.sellout_m_eur.toFixed(0)} M`
                        }
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#059669]">
                        +{p.value_growth_pct}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        <span className={p.volume_cagr_pct >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          {p.volume_cagr_pct > 0 ? '+' : ''}{p.volume_cagr_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: CROSS-BORDER PARITY & DIVERGENCE */}
      {activeTab === 'cross_border' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#eaedf2] border border-[#d8dde6] rounded-xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-serif font-bold text-[#163d4a]">
                  Cross-Border Parity & Divergence Benchmark
                </h3>
                <p className="text-xs font-sans text-stone-600 mt-0.5">
                  Direct cross-country comparison across Nutri-Score A/B share, Organic grocery adoption, and Plant-based volume surge.
                </p>
              </div>

              <div ref={crossBorderChartRef} className="w-full h-80"></div>
            </div>

            <div className="bg-[#eaedf2] border border-[#d8dde6] rounded-xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-serif font-bold text-[#163d4a]">
                  Health & ESG Spider Radar
                </h3>
                <p className="text-xs font-sans text-stone-600 mt-0.5">
                  Benchmarking {activeCountryData.country_name} against the EU-27 unweighted baseline.
                </p>
              </div>

              <div ref={crossBorderRadarRef} className="w-full h-80"></div>
            </div>
          </div>

          {/* Cross-Country Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-[#d8dde6] shadow-xs">
              <div className="text-[10px] font-mono text-stone-500 uppercase">Highest Organic Share</div>
              <div className="text-xl font-bold font-serif text-[#163d4a] mt-1">Austria (11.5%)</div>
              <p className="text-[11px] text-stone-600 mt-1">Followed by Sweden (8.7%) and Germany (7.2%).</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#d8dde6] shadow-xs">
              <div className="text-[10px] font-mono text-stone-500 uppercase">Fastest Plant-Based Surge</div>
              <div className="text-xl font-bold font-serif text-[#8a1253] mt-1">Italy (+34.0% vol)</div>
              <p className="text-[11px] text-stone-600 mt-1">Explicit 'Plant-based 100% vegetale' claims surging ahead of Poland (+31.4%).</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#d8dde6] shadow-xs">
              <div className="text-[10px] font-mono text-stone-500 uppercase">Nutri-Score A/B Leader</div>
              <div className="text-xl font-bold font-serif text-emerald-700 mt-1">Sweden (58.4%)</div>
              <p className="text-[11px] text-stone-600 mt-1">Synergy with Nordic Keyhole standard; France follows at 52.8%.</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#d8dde6] shadow-xs">
              <div className="text-[10px] font-mono text-stone-500 uppercase">Lowest Ultra-Processed (NOVA 4)</div>
              <div className="text-xl font-bold font-serif text-[#163d4a] mt-1">Italy (21.4%) & Portugal (23.8%)</div>
              <p className="text-[11px] text-stone-600 mt-1">Mediterranean culinary cultures maintain highest whole/culinary ingredient ratio.</p>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: E-COMMERCE OVER-INDEXING */}
      {activeTab === 'ecommerce' && bundle && (
        <div className="space-y-6">
          <div className="bg-[#eaedf2] border border-[#d8dde6] rounded-xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                <h3 className="text-base font-serif font-bold text-[#163d4a]">
                  E-Commerce vs. In-Store Over-Indexing Index (Base 100)
                </h3>
                <p className="text-xs font-sans text-stone-600 mt-0.5">
                  Quantifies the relative presence of each claim in digital grocery carts compared to standard brick-and-mortar stores.
                </p>
              </div>
              <div className="px-3 py-1 bg-white border border-[#d8dde6] rounded text-xs font-mono text-stone-600">
                Index &gt; 100 = Digital Preference • Index &lt; 100 = In-Store Physical Preference
              </div>
            </div>

            <div ref={ecommerceChartRef} className="w-full h-[460px]"></div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#d8dde6] text-xs">
              <div className="p-3.5 bg-white rounded-lg border border-[#d8dde6]">
                <div className="font-bold text-[#8a1253] mb-1">
                  Digital Channel Champions (Index &gt; 300)
                </div>
                <div className="text-stone-600 leading-relaxed text-[11px]">
                  <b>Zinc (952)</b>, <b>Low-Calorie Sweeteners (621)</b>, and <b>Bio-based Packaging (328)</b>: digital shoppers actively filter for specialized functional attributes and advanced circular packaging not universally stocked in local convenience stores.
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-lg border border-[#d8dde6]">
                <div className="font-bold text-[#163d4a] mb-1">
                  Channel Parity (~100)
                </div>
                <div className="text-stone-600 leading-relaxed text-[11px]">
                  <b>Preservative-Free (104)</b> and <b>Organic (118)</b>: mature, ubiquitous claims that appear with near-identical frequency across physical and virtual supermarket aisles.
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-lg border border-[#d8dde6]">
                <div className="font-bold text-amber-700 mb-1">
                  Physical Counter Strongholds (Index &lt; 50)
                </div>
                <div className="text-stone-600 leading-relaxed text-[11px]">
                  <b>PDO / PGI (30)</b> and <b>100% National Origin (86)</b>: cured meats, deli counters, artisanal cheeses, and fresh cuts where consumers heavily prioritize in-person visual and olfactory inspection.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 6: AGENTIC AI GROCERY PLANNER */}
      {activeTab === 'agentic_planner' && (
        <div className="space-y-6">
          <div className="bg-[#eaedf2] border border-[#d8dde6] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-[#8a1253] text-white">
                    Agentic AI Simulator
                  </span>
                  <span className="text-xs font-mono text-stone-500">
                    Jurisdiction: {activeCountryData.country_name}
                  </span>
                </div>
                <h3 className="text-lg font-serif font-bold text-[#163d4a]">
                  Autonomous Agentic AI Grocery Basket Synthesizer
                </h3>
                <p className="text-xs font-sans text-stone-600 max-w-2xl mt-0.5">
                  Simulating an autonomous AI shopper assembling weekly grocery orders constrained by nutritional density, national protected origins, and environmental scoring.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => runAgenticPlanner('clean_hypertrophy')}
                  className={`px-3 py-2 rounded-lg text-xs font-mono transition-all text-left border ${
                    plannerGoal === 'clean_hypertrophy'
                      ? 'bg-[#163d4a] text-white border-[#163d4a] shadow-xs'
                      : 'bg-white text-stone-700 border-[#d8dde6] hover:bg-stone-100'
                  }`}
                >
                  <div className="font-bold">1. Clean Muscle / High-Protein</div>
                  <div className="text-[10px] opacity-80">Protein &ge; 5g, minimized sat. fats</div>
                </button>

                <button
                  onClick={() => runAgenticPlanner('mediterranean_terroir')}
                  className={`px-3 py-2 rounded-lg text-xs font-mono transition-all text-left border ${
                    plannerGoal === 'mediterranean_terroir'
                      ? 'bg-[#163d4a] text-white border-[#163d4a] shadow-xs'
                      : 'bg-white text-stone-700 border-[#d8dde6] hover:bg-stone-100'
                  }`}
                >
                  <div className="font-bold">2. Blue Zone Terroir & Organic</div>
                  <div className="text-[10px] opacity-80">PDO, PGI, Organic & Zero Residue</div>
                </button>

                <button
                  onClick={() => runAgenticPlanner('gut_allergen_free')}
                  className={`px-3 py-2 rounded-lg text-xs font-mono transition-all text-left border ${
                    plannerGoal === 'gut_allergen_free'
                      ? 'bg-[#163d4a] text-white border-[#163d4a] shadow-xs'
                      : 'bg-white text-stone-700 border-[#d8dde6] hover:bg-stone-100'
                  }`}
                >
                  <div className="font-bold">3. Gut Health & Free-From</div>
                  <div className="text-[10px] opacity-80">Lactose-free, Gluten-free, Chia seeds</div>
                </button>
              </div>
            </div>

            {plannerLoading ? (
              <div className="p-12 text-center text-xs font-mono text-stone-500">
                <Sparkles className="w-6 h-6 text-[#8a1253] animate-spin mx-auto mb-2" />
                Querying client-side DuckDB-Wasm engine over scrapling_retail_claims...
              </div>
            ) : plannerResults ? (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-lg border border-[#d8dde6]">
                  <div>
                    <div className="text-[10px] font-mono text-stone-500 uppercase">Optimized Items</div>
                    <div className="text-base font-mono font-bold text-[#163d4a]">{plannerResults.basket.length} Products</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-stone-500 uppercase">Mean Protein Density</div>
                    <div className="text-base font-mono font-bold text-[#059669]">{plannerResults.avgProtein} g / 100g</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-stone-500 uppercase">Sustainability Profile</div>
                    <div className="text-base font-mono font-bold text-[#8a1253]">{plannerResults.sustainabilityScore}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-stone-500 uppercase">DuckDB Latency</div>
                    <div className="text-base font-mono font-bold text-stone-700">{plannerResults.elapsedMs} ms</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {plannerResults.basket.map((prod, idx) => (
                    <div key={idx} className="bg-white p-3.5 rounded-lg border border-[#d8dde6] shadow-2xs space-y-2 text-xs">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-[#163d4a] line-clamp-1">{prod.product_name}</span>
                        <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-stone-100 text-stone-700 border border-stone-200">
                          {prod.brand}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {prod.fenomeno_category}
                      </div>
                      <div className="grid grid-cols-3 gap-1 py-1.5 border-t border-b border-stone-100 font-mono text-[10px] text-stone-600">
                        <div>Kcal: <b>{prod.energy_kcal}</b></div>
                        <div>Prot: <b className="text-emerald-700">{prod.proteins_g}g</b></div>
                        <div>Sugars: <b>{prod.sugars_g}g</b></div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono pt-1 text-stone-500">
                        <span>NutriScore: <b className="text-[#163d4a]">{prod.nutriscore}</b></span>
                        <span>EcoScore: <b className="text-emerald-700">{prod.ecoscore}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* SUBTAB 7: D4VINCI SCRAPLING LIVE STREAM */}
      {activeTab === 'scrapling_feed' && (
        <div className="space-y-6">
          <div className="bg-[#eaedf2] border border-[#d8dde6] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-[#059669] text-white">
                    Live Data Harvester
                  </span>
                  <span className="text-xs font-mono text-stone-500">
                    d4avinci/scrapling v0.5.1
                  </span>
                </div>
                <h3 className="text-base font-serif font-bold text-[#163d4a]">
                  Live Retail Shelf Products & Verified Claim Stream
                </h3>
                <p className="text-xs font-sans text-stone-600 mt-0.5">
                  Real-time food products harvested with EAN barcodes, standard mandatory nutritional tables, and claim certifications.
                </p>
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search product, brand, or claim..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#d8dde6] rounded-lg font-sans focus:outline-hidden focus:border-[#163d4a]"
                />
              </div>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg border border-[#d8dde6]">
              <table className="w-full text-left text-xs font-sans border-collapse">
                <thead>
                  <tr className="border-b border-[#d8dde6] bg-stone-50 text-stone-500 font-mono uppercase text-[10px]">
                    <th className="py-2.5 px-3">EAN Barcode</th>
                    <th className="py-2.5 px-3">Product & Brand</th>
                    <th className="py-2.5 px-3">Pillar / Phenomenon</th>
                    <th className="py-2.5 px-3">Verified Claims</th>
                    <th className="py-2.5 px-3 text-right">Kcal</th>
                    <th className="py-2.5 px-3 text-right">Proteins</th>
                    <th className="py-2.5 px-3 text-right">Sugars</th>
                    <th className="py-2.5 px-3 text-center">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d8dde6]">
                  {filteredScraplingProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-stone-400 font-mono text-xs">
                        No retail products match the selected search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredScraplingProducts.map(p => (
                      <tr key={p.barcode} className="hover:bg-stone-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-stone-500">
                          {p.barcode}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[#163d4a]">{p.product_name}</div>
                          <div className="text-[10px] font-mono text-stone-400">{p.brand}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#8a1253]">
                          {p.fenomeno_category}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-stone-600 max-w-xs truncate">
                          {p.labels_list}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-stone-700">
                          {p.energy_kcal > 0 ? `${p.energy_kcal}` : '–'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          {p.proteins_g > 0 ? `${p.proteins_g}g` : '–'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-stone-700">
                          {p.sugars_g > 0 ? `${p.sugars_g}g` : '–'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-emerald-100 text-emerald-800">
                            {p.nutriscore}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center text-xs font-mono text-stone-500 pt-1">
              <span>Total references loaded: <b>{filteredScraplingProducts.length}</b> of {scraplingProducts.length}</span>
              <span>Scraped via engine: <b>D4Vinci Scrapling (Patchright + Stealthed Fetcher)</b></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
