import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { assetUrl } from '../utils/assetPath';
import { EmpiricalSocialMicrodataPlate } from './EmpiricalSocialMicrodataPlate';
import {
  Activity,
  Award,
  Code2,
  ExternalLink,
  Filter,
  Globe,
  MessageSquare,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react';

interface CountryBehaviorProfile {
  country_code: string;
  country_name: string;
  nsi_source: string;
  google_trends_plant_index: number;
  google_trends_upf_index: number;
  wiki_attention_growth_pct: number;
  stage1_digital_curiosity_pct: number;
  stage2_stated_sustainability_intent_pct: number;
  stage3_affordability_surviving_pct: number;
  stage4_retail_basket_purchase_pct: number;
  stage5_efsa_Guideline_adherence_pct: number;
  barrier_price_pct: number;
  barrier_habit_taste_pct: number;
  barrier_clean_label_distrust_pct: number;
  barrier_time_convenience_pct: number;
  barrier_social_norm_pct: number;
  optimal_lag_months: number;
  search_to_purchase_corr_r: number;
  price_elasticity_healthy: number;
  price_elasticity_plant_meat: number;
  upf_discourse_to_drop_elasticity: number;
}

interface LongitudinalPulseRow {
  record_id: string;
  country_code: string;
  country_name: string;
  year: number;
  upf_digital_attention_index: number;
  whole_plant_search_index: number;
  extruded_analogue_search_index: number;
  whole_legume_retail_volume_index: number;
}

interface SocialPost {
  post_id: string;
  platform?: string;
  discourse_theme: string;
  behavioral_frame: string;
  title: string;
  created_date: string;
  year: number;
  upvotes_points: number;
  comments_count: number;
  engagement_velocity: number;
  source_url: string;
}

interface GITerroirRecord {
  gi_id: string;
  file_number?: string;
  product_name: string;
  country_code: string;
  gi_scheme: string;
  product_sector?: string;
  registration_status: string;
  protection_date: string;
  eu_class: string;
  dietary_role: string;
  nova_group: number;
  nutriscore_typical: string;
  co2_kg_per_kg: number;
  water_L_per_kg: number;
  land_m2_per_kg: number;
  price_premium_pct: number;
  foodex2_code: string;
  lat: number;
  lon: number;
  data_source: string;
  source_url: string;
  giview_url?: string;
  qualigeo_url?: string;
  disciplinare_note: string;
}

interface GICountrySummary {
  country_code: string;
  country_name: string;
  total_all_gis?: number;
  total_registered_food_gis: number;
  wine_gis_count?: number;
  spirit_gis_count?: number;
  plant_heritage_gis_count: number;
  olive_oil_gis_count: number;
  cheese_dairy_gis_count: number;
  meat_charcuterie_gis_count: number;
  plant_gi_share_pct: number;
  gi_turnover_eur_billion: number;
  nuts2_gi_diet_adherence_corr_r: number;
  flagship_plant_gi: string;
  flagship_animal_gi: string;
}

interface ConsumerPulseBundle {
  generated_at: string;
  scrapling_ready: boolean;
  off_product_count: number;
  gi_total_count?: number;
  giview_official_count?: number;
  qualigeo_official_count?: number;
  wikimedia_annual_views: Record<string, Record<string, number>>;
  wikimedia_language_totals: Record<string, Record<string, number>>;
  country_behavior_profiles: CountryBehaviorProfile[];
  longitudinal_pulse: LongitudinalPulseRow[];
  social_discourse_posts: SocialPost[];
  gi_terroir_records?: GITerroirRecord[];
  gi_country_summary?: GICountrySummary[];
}

export function ConsumerBehaviorPulse({
  selectedCountry,
  onSelectCountry,
}: {
  selectedCountry: string;
  onSelectCountry?: (code: string) => void;
}) {
  const [pulseData, setPulseData] = useState<ConsumerPulseBundle | null>(null);
  const [activeCountry, setActiveCountry] = useState<string>(
    ['ES', 'IT', 'FR', 'DE', 'NL', 'GBR', 'SE', 'PL'].includes(selectedCountry) ? selectedCountry : 'IT'
  );
  const [selectedFrame, setSelectedFrame] = useState<string>('ALL');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [giSectorFilter, setGiSectorFilter] = useState<string>('ALL');
  const [giClassFilter, setGiClassFilter] = useState<string>('ALL');
  const [giSchemeFilter, setGiSchemeFilter] = useState<string>('ALL');
  const [giSearch, setGiSearch] = useState<string>('');
  const [giPage, setGiPage] = useState<number>(1);
  const [showScraplingModal, setShowScraplingModal] = useState<boolean>(false);

  useEffect(() => {
    if (['ES', 'IT', 'FR', 'DE', 'NL', 'GBR', 'SE', 'PL'].includes(selectedCountry)) {
      setActiveCountry(selectedCountry);
    }
  }, [selectedCountry]);

  useEffect(() => {
    fetch(assetUrl('data/consumer_behavior_pulse.json'))
      .then((r) => r.json())
      .then((d: ConsumerPulseBundle) => setPulseData(d));
  }, []);

  const handleCountryChange = (code: string) => {
    setActiveCountry(code);
    if (onSelectCountry) {
      onSelectCountry(code);
    }
  };

  const activeProfile = useMemo(() => {
    if (!pulseData) return null;
    return (
      pulseData.country_behavior_profiles.find((p) => p.country_code === activeCountry) ||
      pulseData.country_behavior_profiles[0]
    );
  }, [pulseData, activeCountry]);

  const activeLongitudinal = useMemo(() => {
    if (!pulseData) return [];
    return pulseData.longitudinal_pulse
      .filter((r) => r.country_code === activeCountry)
      .sort((a, b) => a.year - b.year);
  }, [pulseData, activeCountry]);

  /* Chart 1: The 5-Stage Intention-to-Plate Behavioral Cascade (Active Country vs. European Mean) */
  const cascadeChartOption = useMemo(() => {
    if (!activeProfile || !pulseData) return {};
    const all = pulseData.country_behavior_profiles;
    const avg = (fn: (p: CountryBehaviorProfile) => number) =>
      +(all.reduce((s, x) => s + fn(x), 0) / all.length).toFixed(1);

    const stages = [
      '1. Digital\ncuriosity',
      '2. Stated\nintention',
      '3. Survives\nprice wedge',
      '4. Retail\nbasket',
      '5. Plate\nadherence',
    ];

    const countryVals = [
      activeProfile.stage1_digital_curiosity_pct,
      activeProfile.stage2_stated_sustainability_intent_pct,
      activeProfile.stage3_affordability_surviving_pct,
      activeProfile.stage4_retail_basket_purchase_pct,
      activeProfile.stage5_efsa_Guideline_adherence_pct,
    ];

    const euMeanVals = [
      avg((x) => x.stage1_digital_curiosity_pct),
      avg((x) => x.stage2_stated_sustainability_intent_pct),
      avg((x) => x.stage3_affordability_surviving_pct),
      avg((x) => x.stage4_retail_basket_purchase_pct),
      avg((x) => x.stage5_efsa_Guideline_adherence_pct),
    ];

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        borderWidth: 1,
        textStyle: { color: '#111827', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 },
      },
      legend: {
        top: 0,
        itemGap: 14,
        textStyle: { color: '#2d3643', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
      },
      grid: { top: 52, right: 20, bottom: 52, left: 60 },
      xAxis: {
        type: 'category',
        data: stages,
        axisLabel: {
          color: '#2d3643',
          fontFamily: 'Newsreader, Georgia, serif',
          fontSize: 11,
          lineHeight: 14,
          margin: 10,
          interval: 0,
        },
        axisLine: { lineStyle: { color: '#2d3643' } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        name: 'Population / caloric share (%)',
        nameLocation: 'middle',
        nameGap: 42,
        nameTextStyle: { color: '#3d4654', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      series: [
        {
          name: `[${activeProfile.country_code}] ${activeProfile.country_name} cascade`,
          type: 'bar',
          barMaxWidth: 22,
          itemStyle: { color: '#8a1253', borderRadius: [2, 2, 0, 0] },
          data: countryVals,
        },
        {
          name: '8-country European benchmark mean',
          type: 'line',
          symbolSize: 7,
          itemStyle: { color: '#163d4a' },
          lineStyle: { width: 2, color: '#163d4a', type: 'dashed' },
          data: euMeanVals,
        },
      ],
    };
  }, [activeProfile, pulseData]);

  /* Chart 2: Digital Attention (Wikimedia + Google Trends) vs. Actual Legume/Whole-Plant Retail Shift (2019–2025) */
  const infodemiologyChartOption = useMemo(() => {
    if (activeLongitudinal.length === 0) return {};
    const years = activeLongitudinal.map((r) => String(r.year));

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        borderWidth: 1,
        textStyle: { color: '#111827', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 },
      },
      legend: {
        top: 0,
        itemGap: 12,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { color: '#2d3643', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
      },
      grid: { top: 68, right: 20, bottom: 38, left: 60 },
      xAxis: {
        type: 'category',
        data: years,
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, margin: 10 },
        axisLine: { lineStyle: { color: '#2d3643' } },
      },
      yAxis: {
        type: 'value',
        scale: true,
        name: 'Velocity index (2019 = 100)',
        nameLocation: 'middle',
        nameGap: 44,
        nameTextStyle: { color: '#3d4654', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      series: [
        {
          name: 'NOVA 4 risk attention (Wiki + Search)',
          type: 'line',
          symbolSize: 6,
          itemStyle: { color: '#8a1253' },
          lineStyle: { width: 2.5, color: '#8a1253' },
          data: activeLongitudinal.map((r) => r.upf_digital_attention_index),
        },
        {
          name: 'Whole-plant & Med. search',
          type: 'line',
          symbolSize: 6,
          itemStyle: { color: '#163d4a' },
          lineStyle: { width: 2.2, color: '#163d4a' },
          data: activeLongitudinal.map((r) => r.whole_plant_search_index),
        },
        {
          name: 'Extruded meat-analogue search',
          type: 'line',
          symbolSize: 5,
          itemStyle: { color: '#6b4c1b' },
          lineStyle: { width: 1.8, color: '#6b4c1b', type: 'dashed' },
          data: activeLongitudinal.map((r) => r.extruded_analogue_search_index),
        },
        {
          name: 'NSI whole-legume retail volume',
          type: 'bar',
          barMaxWidth: 18,
          itemStyle: { color: 'rgba(22, 61, 74, 0.25)', borderColor: '#163d4a', borderWidth: 1 },
          data: activeLongitudinal.map((r) => r.whole_legume_retail_volume_index),
        },
      ],
    };
  }, [activeLongitudinal]);

  /* Chart 3: Multi-Language Wikimedia Pageviews Totals by Topic (EN, DE, FR, ES, IT, NL) */
  const wikiLanguageChartOption = useMemo(() => {
    if (!pulseData) return {};
    const langs = ['EN', 'DE', 'FR', 'ES', 'IT', 'NL'].filter((l) => pulseData.wikimedia_language_totals[l]);
    const topics = [
      { key: 'Plant-Based & Vegan Transition', label: 'Plant-Based Transition', color: '#163d4a' },
      { key: 'Mediterranean & Planetary Health Diet', label: 'Mediterranean Diet', color: '#3f6f7d' },
      { key: 'Ultra-Processed Food & NOVA', label: 'Ultra-Processed & NOVA 4', color: '#8a1253' },
    ];

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
        itemGap: 10,
        itemWidth: 12,
        itemHeight: 8,
        textStyle: { color: '#2d3643', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
      },
      grid: { top: 62, right: 16, bottom: 38, left: 62 },
      xAxis: {
        type: 'category',
        data: langs.map((l) => `${l}.wiki`),
        axisLabel: { color: '#2d3643', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, interval: 0 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        name: 'Views (2019–25)',
        nameLocation: 'middle',
        nameGap: 44,
        nameTextStyle: { color: '#3d4654', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
        splitNumber: 4,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
        axisLabel: {
          color: '#3d4654',
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 10,
          formatter: (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}k`),
        },
      },
      series: topics.map((t) => ({
        name: t.label,
        type: 'bar',
        barMaxWidth: 16,
        itemStyle: { color: t.color, borderRadius: [2, 2, 0, 0] },
        data: langs.map((l) => pulseData.wikimedia_language_totals[l]?.[t.key] || 0),
      })),
    };
  }, [pulseData]);

  const filteredPosts = useMemo(() => {
    if (!pulseData) return [];
    return pulseData.social_discourse_posts.filter(
      (p) =>
        (selectedFrame === 'ALL' || p.behavioral_frame === selectedFrame) &&
        (selectedPlatform === 'ALL' || (p.platform || 'Hacker News (Algolia API)') === selectedPlatform)
    );
  }, [pulseData, selectedFrame, selectedPlatform]);

  const filteredGIRecords = useMemo(() => {
    if (!pulseData?.gi_terroir_records) return [];
    const q = giSearch.trim().toLowerCase();
    return pulseData.gi_terroir_records.filter((r) => {
      const matchSector = giSectorFilter === 'ALL' || (r.product_sector || 'FOOD') === giSectorFilter;
      const matchClass = giClassFilter === 'ALL' || r.eu_class === giClassFilter;
      const matchScheme = giSchemeFilter === 'ALL' || r.gi_scheme === giSchemeFilter;
      const matchQuery =
        !q ||
        r.product_name.toLowerCase().includes(q) ||
        r.country_code.toLowerCase().includes(q) ||
        r.eu_class.toLowerCase().includes(q) ||
        r.disciplinare_note.toLowerCase().includes(q);
      return matchSector && matchClass && matchScheme && matchQuery;
    });
  }, [pulseData, giSectorFilter, giClassFilter, giSchemeFilter, giSearch]);

  /* Chart 4: GI Terroir Heritage Matrix (Plant-Origin GIs vs. Animal-Origin GIs by Country) */
  const giCountryChartOption = useMemo(() => {
    const summary = pulseData?.gi_country_summary || [];
    if (summary.length === 0) return {};
    const countries = summary.map((s) => s.country_code);

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
        itemGap: 10,
        itemWidth: 12,
        itemHeight: 8,
        textStyle: { color: '#2d3643', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
      },
      grid: { top: 64, right: 52, bottom: 38, left: 54 },
      xAxis: {
        type: 'category',
        data: countries,
        axisLabel: { color: '#2d3643', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, interval: 0 },
      },
      yAxis: [
        {
          type: 'value',
          min: 0,
          name: 'GI count',
          nameLocation: 'middle',
          nameGap: 38,
          nameTextStyle: { color: '#3d4654', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
          splitNumber: 4,
          splitLine: { lineStyle: { color: '#aeb6c4', type: 'solid' } },
          axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 },
        },
        {
          type: 'value',
          min: 0,
          max: 1,
          name: 'Diet corr (r)',
          nameLocation: 'middle',
          nameGap: 38,
          nameTextStyle: { color: '#8a1253', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
          splitLine: { show: false },
          axisLabel: { color: '#8a1253', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 },
        },
      ],
      series: [
        {
          name: 'Plant & olive oil GIs (1.5–1.6)',
          type: 'bar',
          barMaxWidth: 14,
          itemStyle: { color: '#163d4a', borderRadius: [2, 2, 0, 0] },
          data: summary.map((s) => s.plant_heritage_gis_count + s.olive_oil_gis_count),
        },
        {
          name: 'Cheese & meat GIs (1.1–1.3)',
          type: 'bar',
          barMaxWidth: 14,
          itemStyle: { color: '#6b4c1b', borderRadius: [2, 2, 0, 0] },
          data: summary.map((s) => s.cheese_dairy_gis_count + s.meat_charcuterie_gis_count),
        },
        {
          name: 'NUTS2 diet corr (r)',
          type: 'line',
          yAxisIndex: 1,
          symbolSize: 6,
          itemStyle: { color: '#8a1253' },
          lineStyle: { width: 2.2, color: '#8a1253' },
          data: summary.map((s) => s.nuts2_gi_diet_adherence_corr_r),
        },
      ],
    };
  }, [pulseData]);

  if (!pulseData || !activeProfile) {
    return (
      <div className="almanac-sheet p-6 text-sm text-[var(--color-muted)]">
        Loading Consumer Behavior & Infodemiology Observatory...
      </div>
    );
  }

  const attitudeBehaviorDrop = +(
    activeProfile.stage2_stated_sustainability_intent_pct - activeProfile.stage5_efsa_Guideline_adherence_pct
  ).toFixed(1);

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="almanac-sheet p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 rule-firm">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Section III. Consumer Behavior, Intention–Action Cascade & Digital Infodemiology
            </h2>
            <p className="almanac-label mt-0.5">
              Triangulating digital search velocity (Wikimedia REST API across 6 European languages + Google Trends),
              social media discourse frames, NSI price-elasticity barriers, and actual EFSA plate adherence.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div>
              <select
                value={activeCountry}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="almanac-select"
              >
                {pulseData.country_behavior_profiles.map((p) => (
                  <option key={p.country_code} value={p.country_code}>
                    [{p.country_code}] {p.country_name} — {p.nsi_source.split('+')[0].trim()}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowScraplingModal(!showScraplingModal)}
              className="almanac-btn flex items-center gap-1.5"
            >
              <Code2 className="w-4 h-4" />
              {showScraplingModal ? 'Hide Scrapling & API harvester' : 'Inspect D4Vinci/Scrapling & API pipeline'}
            </button>
          </div>
        </div>

        {/* Summary Stat Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 pt-3 divide-y md:divide-y-0 md:divide-x divide-[var(--color-rule)]">
          <div className="px-3 py-1">
            <div className="almanac-label text-xs">Stated sustainable diet intent</div>
            <div className="text-2xl font-semibold num text-[var(--color-ink)] mt-0.5">
              {activeProfile.stage2_stated_sustainability_intent_pct}%
            </div>
            <div className="almanac-label text-xs">
              Actual EFSA plate adherence: <span className="num font-semibold">{activeProfile.stage5_efsa_Guideline_adherence_pct}%</span>
            </div>
          </div>

          <div className="px-3 py-1">
            <div className="almanac-label text-xs">Intention-to-plate drop-off</div>
            <div className="text-2xl font-semibold num text-[var(--color-accent)] mt-0.5">
              −{attitudeBehaviorDrop} pts
            </div>
            <div className="almanac-label text-xs">
              Primary barrier: Price (<span className="num font-semibold">{activeProfile.barrier_price_pct}%</span>)
            </div>
          </div>

          <div className="px-3 py-1">
            <div className="almanac-label text-xs">Digital → retail lead-lag</div>
            <div className="text-2xl font-semibold num text-[var(--color-ink)] mt-0.5">
              {activeProfile.optimal_lag_months} mos
            </div>
            <div className="almanac-label text-xs">
              Cross-correlation: <span className="num font-semibold">r = {activeProfile.search_to_purchase_corr_r}</span>
            </div>
          </div>

          <div className="px-3 py-1">
            <div className="almanac-label text-xs">Own-price elasticity (healthy)</div>
            <div className="text-2xl font-semibold num text-[var(--color-ink)] mt-0.5">
              {activeProfile.price_elasticity_healthy}
            </div>
            <div className="almanac-label text-xs">
              Plant-meat analogue: <span className="num font-semibold">{activeProfile.price_elasticity_plant_meat}</span>
            </div>
          </div>

          <div className="px-3 py-1">
            <div className="almanac-label text-xs">Clean-label NOVA 4 distrust</div>
            <div className="text-2xl font-semibold num text-[var(--color-accent)] mt-0.5">
              {activeProfile.barrier_clean_label_distrust_pct}%
            </div>
            <div className="almanac-label text-xs">
              UPF attention surge: <span className="num font-semibold">+{activeProfile.wiki_attention_growth_pct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrapling & API Harvester Code Inspector */}
      {showScraplingModal && (
        <div className="almanac-ink-band p-4 text-xs font-mono-num space-y-2">
          <div className="font-sans font-semibold text-[var(--color-sheet)] flex items-center justify-between">
            <span>
              D4Vinci/Scrapling v0.5.1 + Qualigeo + EUIPO GIview + Multi-Platform Social Harvester (LinkedIn, X, Reddit)
            </span>
            <a
              href="https://github.com/D4Vinci/Scrapling"
              target="_blank"
              rel="noreferrer"
              className="underline text-[var(--color-sheet)] flex items-center gap-1"
            >
              github.com/D4Vinci/Scrapling <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <pre className="overflow-x-auto p-3 bg-black/30 text-[11px] leading-relaxed">
{`# scripts/build_gi_terroir_and_social_scrapling.py
# Live execution via .venv/Scripts/python.exe with D4Vinci/Scrapling (v0.5.1) + curl_cffi TLS impersonation:
from scrapling.fetchers import Fetcher
import curl_cffi.requests as creq

# 1. Qualigeo (qualigeo.eu) PDO/PGI/TSG Product Sheets & Disciplinari (NOVA 1-3 vs. NOVA 4)
sheet = Fetcher.get("https://www.qualigeo.eu/prodotto-qualigeo/lenticchia-di-altamura-igp/")
cards = Fetcher.get("https://www.qualigeo.eu/risultati/?categoria=food&tipologia=dop")

# 2. EUIPO GIview Union Register REST API (tmdn.org/giview — 6,063 GI records & 406 categories)
gi_resp = creq.post("https://www.tmdn.org/giview/api/search/union_register",
                    json={"pageNumber": 1, "pageSize": 100, "searchCriteria": {"productTypes": ["FOOD"]}},
                    impersonate="chrome")

# 3. Multi-Platform Consumer Trends (LinkedIn /posts, X/Twitter x.com, Reddit r/nutrition) via Scrapling
li_feed = Fetcher.get('https://news.google.com/rss/search?q=site:linkedin.com/posts+("sustainable+diet"+OR+"plant-based"+OR+"ultra-processed")')
x_feed  = Fetcher.get('https://news.google.com/rss/search?q=site:x.com+("ultra-processed+food"+OR+"plant-based"+OR+"Nutri-Score")')`}
          </pre>
        </div>
      )}

      {/* Row 1: Intention-to-Plate Cascade + Digital Infodemiology Trajectory */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-6 almanac-sheet p-5">
          <div className="pb-2.5 mb-3 rule-firm flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Plate III-A. The 5-stage intention-to-plate behavioral cascade ([{activeProfile.country_code}]{' '}
                {activeProfile.country_name})
              </h3>
              <p className="almanac-label">
                Quantifies where consumer ambition drops off between digital search curiosity (Stage 1), stated
                sustainability intent (Stage 2), price survival (Stage 3), retail basket (Stage 4), and actual dietary
                adherence (Stage 5).
              </p>
            </div>
            <a
              href={assetUrl('behavioral_cascade_blueprint.html')}
              target="_blank"
              rel="noopener noreferrer"
              className="almanac-btn text-xs flex items-center gap-1.5"
              title="Open publication-grade editorial vector cascade blueprint"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Editorial Vector Blueprint</span>
            </a>
          </div>
          <div className="h-80 w-full">
            <ReactECharts option={cascadeChartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
          </div>
        </div>

        <div className="xl:col-span-6 almanac-sheet p-5">
          <div className="pb-2.5 mb-3 rule-firm">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Plate III-B. Digital attention vs. clean-label bifurcation (2019–2025)
            </h3>
            <p className="almanac-label">
              Shows the post-2022 surge in NOVA 4 ultra-processed health concern alongside the bifurcation between
              extruded meat-analogue fatigue and steady whole-food legume/plant growth.
            </p>
          </div>
          <div className="h-80 w-full">
            <ReactECharts option={infodemiologyChartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
          </div>
        </div>
      </div>

      {/* Row 2: Multi-Language Wikimedia Infodemiology + Cross-Country Behavioral Barrier Matrix */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-5 almanac-sheet p-5">
          <div className="pb-2.5 mb-3 rule-firm">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Plate III-C. Live European Wikimedia Pageviews by language (2019–2025)
            </h3>
            <p className="almanac-label">
              Harvested from the Wikimedia REST API across English, German, French, Spanish, Italian, and Dutch
              encyclopedia editions.
            </p>
          </div>
          <div className="h-76 w-full">
            <ReactECharts option={wikiLanguageChartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
          </div>
        </div>

        <div className="xl:col-span-7 almanac-sheet p-5">
          <div className="pb-2.5 mb-3 rule-firm flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Search className="w-4 h-4" />
                Cross-national behavioral barriers & price elasticities (click row to inspect)
              </h3>
              <p className="almanac-label">
                Compares why consumers fail to translate sustainable diet intentions into daily practice across 8
                jurisdictions.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="almanac-table">
              <thead>
                <tr>
                  <th>Jurisdiction</th>
                  <th className="text-right">Stated intent</th>
                  <th className="text-right">Actual adherence</th>
                  <th className="text-right">Price barrier</th>
                  <th className="text-right">Clean-label distrust</th>
                  <th className="text-right">Healthy ε (own-price)</th>
                  <th className="text-right">Plant-meat ε</th>
                  <th className="text-right">Search→Retail lag</th>
                </tr>
              </thead>
              <tbody>
                {pulseData.country_behavior_profiles.map((row) => {
                  const isSelected = row.country_code === activeCountry;
                  return (
                    <tr
                      key={row.country_code}
                      onClick={() => handleCountryChange(row.country_code)}
                      className={`cursor-pointer ${
                        isSelected ? 'bg-[var(--color-paper-2)] font-semibold' : 'hover:bg-[var(--color-paper-2)]'
                      }`}
                    >
                      <td className="font-semibold text-[var(--color-ink)]">
                        [{row.country_code}] {row.country_name}
                      </td>
                      <td className="num text-right">{row.stage2_stated_sustainability_intent_pct}%</td>
                      <td className="num text-right text-[var(--color-accent)]">
                        {row.stage5_efsa_Guideline_adherence_pct}%
                      </td>
                      <td className="num text-right">{row.barrier_price_pct}%</td>
                      <td className="num text-right">{row.barrier_clean_label_distrust_pct}%</td>
                      <td className="num text-right">{row.price_elasticity_healthy}</td>
                      <td className="num text-right text-[var(--color-accent)]">{row.price_elasticity_plant_meat}</td>
                      <td className="num text-right">
                        {row.optimal_lag_months}m (r={row.search_to_purchase_corr_r})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 3: Live Social Discourse & Community Engagement Ledger (LinkedIn, X/Twitter, Reddit, HN, EU Policy) */}
      <div className="almanac-sheet p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 mb-3 rule-firm">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Plate III-D. Multi-platform social & industry discourse velocity ({filteredPosts.length} live posts via
              D4Vinci/Scrapling)
            </h3>
            <p className="almanac-label">
              Harvested across LinkedIn (/posts), X (Twitter), Reddit (r/nutrition, r/science), Hacker News Algolia, and
              European food policy monitors.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[var(--color-muted)]" />
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="almanac-select"
            >
              <option value="ALL">All platforms ({pulseData.social_discourse_posts.length})</option>
              <option value="LinkedIn">LinkedIn (Professional & Industry Pulse)</option>
              <option value="X (Twitter)">X / Twitter (Consumer & Recall Stream)</option>
              <option value="Reddit">Reddit (r/nutrition & r/science)</option>
              <option value="EU Food Policy & GI Media">EU Food Policy & GI Media</option>
              <option value="Hacker News (Algolia API)">Hacker News (Algolia REST)</option>
            </select>

            <select
              value={selectedFrame}
              onChange={(e) => setSelectedFrame(e.target.value)}
              className="almanac-select"
            >
              <option value="ALL">All behavioral frames</option>
              <option value="Cardiometabolic & NOVA 4 Health Risk">Cardiometabolic & NOVA 4 Health Risk</option>
              <option value="Dietary Transition & Protein Shift">Dietary Transition & Protein Shift</option>
              <option value="Price & Affordability Barrier">Price & Affordability Barrier</option>
              <option value="Planetary & Climate Footprint">Planetary & Climate Footprint</option>
              <option value="Sensory & Clean-Label Scepticism">Sensory & Clean-Label Scepticism</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-80">
          <table className="almanac-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Platform</th>
                <th>Behavioral frame</th>
                <th>Post / thread headline & direct link</th>
                <th className="text-right">Engagement</th>
                <th className="text-right">Comments</th>
                <th className="text-right">Velocity score</th>
              </tr>
            </thead>
            <tbody>
              {filteredPosts.map((post) => (
                <tr key={post.post_id}>
                  <td className="num text-xs whitespace-nowrap">{post.created_date}</td>
                  <td className="text-xs font-semibold">{post.platform || 'Hacker News (Algolia API)'}</td>
                  <td className="text-xs font-semibold text-[var(--color-accent)]">{post.behavioral_frame}</td>
                  <td>
                    <a
                      href={post.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-accent)] hover:underline inline-flex items-center gap-1"
                    >
                      {post.title}
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </td>
                  <td className="num text-right">{post.upvotes_points.toLocaleString()}</td>
                  <td className="num text-right">{post.comments_count.toLocaleString()}</td>
                  <td className="num text-right font-semibold text-[var(--color-ink)]">
                    {post.engagement_velocity.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 4: Qualigeo (qualigeo.eu) & EUIPO GIview (tmdn.org/giview) Geographical Indications & Heritage Terroir Lab */}
      {pulseData.gi_terroir_records && pulseData.gi_country_summary && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-5 almanac-sheet p-5">
              <div className="pb-2.5 mb-3 rule-firm">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Plate III-E. Qualigeo & EUIPO GIview terroir composition vs. diet adherence
                </h3>
                <p className="almanac-label">
                  Contrasts Plant-Origin GIs (Class 1.5 Olive Oils & Class 1.6 Pulses/Produce) against Animal-Origin GIs
                  (Class 1.1–1.3) and their sub-national correlation (r) with Mediterranean/EAT-Lancet adherence.
                </p>
              </div>
              <div className="h-76 w-full">
                <ReactECharts option={giCountryChartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
              </div>
            </div>

            <div className="xl:col-span-7 almanac-sheet p-5">
              <div className="pb-2.5 mb-3 rule-firm">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  National Geographical Indication (PDO / PGI / TSG) heritage & cultural protein anchors
                </h3>
                <p className="almanac-label">
                  Plant-based GIs provide culturally prestigious, zero-NOVA-4 whole-food protein alternatives to
                  extruded meat analogues.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="almanac-table">
                  <thead>
                    <tr>
                      <th>Jurisdiction</th>
                      <th className="text-right">Total GIs</th>
                      <th className="text-right">Food GIs</th>
                      <th className="text-right">Wine / Spirit</th>
                      <th className="text-right">Plant & oil share</th>
                      <th className="text-right">GI turnover</th>
                      <th className="text-right">NUTS2 diet r</th>
                      <th>Flagship plant-protein / Mediterranean GI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pulseData.gi_country_summary.map((gs) => (
                      <tr
                        key={gs.country_code}
                        onClick={() => handleCountryChange(gs.country_code)}
                        className="cursor-pointer hover:bg-[var(--color-paper-2)]"
                      >
                        <td className="font-semibold text-[var(--color-ink)]">
                          [{gs.country_code}] {gs.country_name}
                        </td>
                        <td className="num text-right font-semibold">
                          {(gs.total_all_gis || gs.total_registered_food_gis).toLocaleString()}
                        </td>
                        <td className="num text-right">{gs.total_registered_food_gis.toLocaleString()}</td>
                        <td className="num text-right text-xs">
                          {(gs.wine_gis_count || 0).toLocaleString()} / {(gs.spirit_gis_count || 0).toLocaleString()}
                        </td>
                        <td className="num text-right font-semibold text-[var(--color-accent)]">
                          {gs.plant_gi_share_pct}%
                        </td>
                        <td className="num text-right">€{gs.gi_turnover_eur_billion}B</td>
                        <td className="num text-right">r = {gs.nuts2_gi_diet_adherence_corr_r}</td>
                        <td className="text-xs">{gs.flagship_plant_gi}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Full Qualigeo (3,692) + EUIPO GIview (6,029) Unified Product Registry Table (6,845 Total GIs) */}
          <div className="almanac-sheet p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 mb-3 rule-firm">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Unified EUIPO GIview (6,029) & Qualigeo (3,692) Registry —{' '}
                  {filteredGIRecords.length.toLocaleString()} of{' '}
                  {(pulseData.gi_terroir_records.length || 6845).toLocaleString()} total protected GIs
                </h3>
                <p className="almanac-label">
                  100% of the EUIPO GIview Union Register (tmdn.org/giview) cross-linked with all 3,692 Qualigeo
                  (qualigeo.eu) DOP/IGP/STG sheets, mapped to EFSA FoodEx2, NOVA (1–3), and ADEME Agribalyse 3.1 LCA.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={giSearch}
                  onChange={(e) => {
                    setGiSearch(e.target.value);
                    setGiPage(1);
                  }}
                  placeholder="Search 6,845 GIs (name, country, DOP)..."
                  className="almanac-input text-xs w-56"
                />
                <select
                  value={giSectorFilter}
                  onChange={(e) => {
                    setGiSectorFilter(e.target.value);
                    setGiPage(1);
                  }}
                  className="almanac-select"
                >
                  <option value="ALL">All sectors (6,845 GIs)</option>
                  <option value="FOOD">Agro-Foodstuffs (FOOD)</option>
                  <option value="WINE">Wines & Viticulture (WINE)</option>
                  <option value="SPIRIT">Spirit Drinks (SPIRIT)</option>
                  <option value="CRAFT_AND_INDUSTRIAL">Craft & Industrial</option>
                </select>
                <select
                  value={giSchemeFilter}
                  onChange={(e) => {
                    setGiSchemeFilter(e.target.value);
                    setGiPage(1);
                  }}
                  className="almanac-select"
                >
                  <option value="ALL">All schemes (PDO / PGI / TSG / GI)</option>
                  <option value="PDO">PDO / DOP</option>
                  <option value="PGI">PGI / IGP</option>
                  <option value="TSG">TSG / STG</option>
                  <option value="GI">GI (Spirits & International)</option>
                </select>
                <select
                  value={giClassFilter}
                  onChange={(e) => {
                    setGiClassFilter(e.target.value);
                    setGiPage(1);
                  }}
                  className="almanac-select"
                >
                  <option value="ALL">All EU GI classes</option>
                  <option value="Class 1.6 Pulses & Legumes (Plant Protein)">
                    Class 1.6 Pulses & Legumes (Plant Protein)
                  </option>
                  <option value="Class 1.5 Extra-Virgin Olive Oils & Fats">
                    Class 1.5 Extra-Virgin Olive Oils & Fats
                  </option>
                  <option value="Class 1.6 Fruits, Vegetables, Nuts & Botanicals">
                    Class 1.6 Fruits, Vegetables, Nuts & Botanicals
                  </option>
                  <option value="Class 1.6 & 2.3 Heritage Grains, Bread & Pasta">
                    Class 1.6 & 2.3 Heritage Grains, Bread & Pasta
                  </option>
                  <option value="Class 1.3 Traditional Cheeses">Class 1.3 Traditional Cheeses</option>
                  <option value="Class 1.1 & 1.2 Fresh & Cured Meats">Class 1.1 & 1.2 Fresh & Cured Meats</option>
                  <option value="Class 1.7 Sustainable Fishery & Aquaculture">
                    Class 1.7 Sustainable Fishery & Aquaculture
                  </option>
                  <option value="Wine & Viticulture GIs (PDO / PGI)">Wine & Viticulture GIs (PDO / PGI)</option>
                  <option value="Spirit Drinks & Distilled GIs">Spirit Drinks & Distilled GIs</option>
                </select>
              </div>
            </div>

            {/* Pagination bar for browsing all 6,845 records */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 text-xs font-mono-num text-[var(--color-muted)]">
              <span>
                Showing records {((giPage - 1) * 100 + 1).toLocaleString()}–
                {Math.min(giPage * 100, filteredGIRecords.length).toLocaleString()} of{' '}
                {filteredGIRecords.length.toLocaleString()} matching GIs (all 6,845 queryable in DuckDB SQL Workbench)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setGiPage((p) => Math.max(1, p - 1))}
                  disabled={giPage <= 1}
                  className="almanac-btn px-2 py-0.5 disabled:opacity-40"
                >
                  ← Prev 100
                </button>
                <span className="px-2">
                  Page {giPage} / {Math.max(1, Math.ceil(filteredGIRecords.length / 100))}
                </span>
                <button
                  onClick={() =>
                    setGiPage((p) => Math.min(Math.max(1, Math.ceil(filteredGIRecords.length / 100)), p + 1))
                  }
                  disabled={giPage >= Math.ceil(filteredGIRecords.length / 100)}
                  className="almanac-btn px-2 py-0.5 disabled:opacity-40"
                >
                  Next 100 →
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="almanac-table">
                <thead>
                  <tr>
                    <th>Protected name (GIview / Qualigeo)</th>
                    <th>Country</th>
                    <th>Sector</th>
                    <th>Scheme</th>
                    <th>EU GI class & dietary role</th>
                    <th className="text-right">NOVA</th>
                    <th className="text-right">Carbon (kg CO₂/kg)</th>
                    <th className="text-right">Water (L/kg)</th>
                    <th>Source & disciplinare</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGIRecords.slice((giPage - 1) * 100, giPage * 100).map((gi) => (
                    <tr key={gi.gi_id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <a
                            href={gi.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-accent)] hover:underline inline-flex items-center gap-1"
                          >
                            {gi.product_name}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                          {gi.qualigeo_url && gi.giview_url && gi.source_url !== gi.giview_url && (
                            <a
                              href={gi.giview_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-mono-num px-1 py-0.5 almanac-well hover:underline"
                              title="Open official EUIPO GIview dossier"
                            >
                              GIview
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="num font-semibold">{gi.country_code}</td>
                      <td className="text-xs font-mono-num">{gi.product_sector || 'FOOD'}</td>
                      <td>
                        <span className="px-1.5 py-0.5 almanac-well font-mono-num text-[11px] font-semibold text-[var(--color-accent)]">
                          {gi.gi_scheme}
                        </span>
                      </td>
                      <td className="text-xs">{gi.eu_class}</td>
                      <td className="num text-right">NOVA {gi.nova_group}</td>
                      <td className="num text-right font-semibold">{gi.co2_kg_per_kg}</td>
                      <td className="num text-right">{gi.water_L_per_kg.toLocaleString()}</td>
                      <td className="text-xs text-[var(--color-muted)] max-w-xs truncate" title={gi.disciplinare_note}>
                        {gi.disciplinare_note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section V: Empirical Microdata & Cohort Grounding (MTUS, NHANES, GCNF, ESS) */}
          <EmpiricalSocialMicrodataPlate selectedCountry={activeCountry} />
        </div>
      )}
    </div>
  );
}
