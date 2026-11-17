import { useEffect, useMemo, useState } from 'react';
import ReactECharts from './ThemedEChart';
import { fetchCachedJson } from '../services/dataProvider';
import { classifyResourceError, type ResourceDisclosure } from '../utils/resourceAvailability';
import { Activity, Clock, ExternalLink, HeartPulse, ShieldCheck, Users2 } from 'lucide-react';
import { ResourceDisclosureBanner } from './ResourceDisclosureBanner';
import {
  type BiomarkerMetricMode,
  type CulturalMetricMode,
  type TimeUseMetricMode,
  buildBiomarkerChartSeries,
  buildCulturalInertiaChartSeries,
  buildTimeUseChartSeries,
} from '../analytics/microdataViewHelper';
import { DataNatureBadge } from './DataNatureBadge';

interface TimeUseRecord {
  record_id: string;
  country_code: string;
  country_name: string;
  income_quintile: string;
  daily_cooking_food_prep_min: number;
  daily_eating_drinking_min: number;
  daily_grocery_shopping_min: number;
  total_food_time_min: number;
  convenience_food_expenditure_share_pct: number;
  culinary_time_poverty_rate_pct: number;
  female_cooking_share_pct: number;
  data_source: string;
}

interface ClinicalBiomarkerRecord {
  pattern_id: string;
  dietary_pattern: string;
  description: string;
  n_respondents?: number;
  mean_fiber_g_day: number;
  saturated_fat_pct_kcal: number;
  plant_protein_share_pct: number;
  total_cholesterol_mg_dl: number;
  total_cholesterol_ci95?: number;
  non_hdl_cholesterol_mg_dl?: number;
  non_hdl_ci95?: number;
  ldl_cholesterol_mg_dl: number;
  hdl_cholesterol_mg_dl: number;
  triglycerides_mg_dl: number;
  hba1c_pct: number;
  hs_crp_inflammation_mg_l: number;
  hs_crp_ci95?: number;
  systolic_bp_mmhg: number;
  systolic_bp_ci95?: number;
  diastolic_bp_mmhg: number;
  cardiovascular_risk_delta_pct: number;
  sample_size_n?: number;
  cohort_source?: string;
}

interface SchoolMealRecord {
  country_code: string;
  country_name: string;
  legal_framework: string;
  mandatory_plant_days_per_week: number;
  voluntary_plant_options_allowed: boolean;
  organic_procurement_quota_pct: number;
  sustainable_quality_quota_pct: number;
  local_terroir_priority: boolean;
  students_served_daily_m: number;
  annual_procurement_budget_eur_m: number;
  co2_reduction_target_school_food_pct: number;
  evaluation_agency: string;
}

interface CulturalClimateRecord {
  country_code: string;
  country_name: string;
  climate_worry_score_pct: number;
  personal_responsibility_feel_pct: number;
  willingness_to_reduce_meat_pct: number;
  perceived_price_barrier_pct: number;
  cultural_culinary_inertia_index: number;
  actual_plant_basket_penetration_pct: number;
  say_do_divergence_gap_pct: number;
}

interface EmpiricalBundle {
  metadata: {
    title: string;
    source_curation: string;
    harmonized_sources: string[];
    total_records: number;
  };
  time_use: TimeUseRecord[];
  clinical_biomarkers: ClinicalBiomarkerRecord[];
  school_meals: SchoolMealRecord[];
  cultural_climate: CulturalClimateRecord[];
}

export function EmpiricalSocialMicrodataPlate({ selectedCountry }: { selectedCountry: string }) {
  const [data, setData] = useState<EmpiricalBundle | null>(null);
  const [loadDisclosure, setLoadDisclosure] = useState<ResourceDisclosure | null>(null);
  const [retryTick, setRetryTick] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'time_use' | 'biomarkers' | 'school_meals' | 'cultural_inertia'>('time_use');
  const [timeUseMode, setTimeUseMode] = useState<TimeUseMetricMode>('cooking_min_day');
  const [biomarkerMode, setBiomarkerMode] = useState<BiomarkerMetricMode>('lipids_mg_dl');
  const [culturalMode, setCulturalMode] = useState<CulturalMetricMode>('prevalence_pct');

  useEffect(() => {
    let cancelled = false;
    const forceRetry = retryTick > 0;
    fetchCachedJson<EmpiricalBundle>('data/empirical_microdata_bundle.json', {
      forceRetry,
    })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoadDisclosure(null);
        }
      })
      .catch(async (err: unknown) => {
        if (cancelled) return;
        const primaryDisclosure = classifyResourceError(err, {
          resourcePath: 'data/empirical_microdata_bundle.json',
          availableSummary:
            'Open CDC NHANES Clinical Biomarker Grounding and GCNF Public School Canteens datasets remain live in Tabs 2 and 3.',
        });

        if (primaryDisclosure.isExcludedTrackB) {
          const [nhanesRes, gcnfRes] = await Promise.allSettled([
            fetchCachedJson<ClinicalBiomarkerRecord[]>('data/clinical_biomarker_grounding.json', { forceRetry }),
            fetchCachedJson<SchoolMealRecord[]>('data/school_meals_procurement.json', { forceRetry }),
          ]);
          const biomarkers = nhanesRes.status === 'fulfilled' ? nhanesRes.value : [];
          const schoolMeals = gcnfRes.status === 'fulfilled' ? gcnfRes.value : [];
          if (!cancelled && (biomarkers.length > 0 || schoolMeals.length > 0)) {
            setData({
              metadata: {
                title: 'Track A Open Microdata Slice (NHANES & GCNF)',
                source_curation: 'CDC/NCHS NHANES 2021–2023 + GCNF',
                harmonized_sources: ['NHANES', 'GCNF'],
                total_records: biomarkers.length + schoolMeals.length,
              },
              time_use: [],
              clinical_biomarkers: biomarkers,
              school_meals: schoolMeals,
              cultural_climate: [],
            });
            setActiveTab((prev) => (prev === 'time_use' ? 'biomarkers' : prev));
            setLoadDisclosure(primaryDisclosure);
            return;
          }
        }

        if (!cancelled) {
          setLoadDisclosure(primaryDisclosure);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  // Filtered country records
  const isCountryFallback = useMemo(() => {
    if (!data) return false;
    const refPool = data.cultural_climate.length > 0 ? data.cultural_climate : data.school_meals;
    return !refPool.some((r) => r.country_code === selectedCountry);
  }, [data, selectedCountry]);

  const activeCountryCode = useMemo(() => {
    if (!data) return 'IT';
    const refPool = data.cultural_climate.length > 0 ? data.cultural_climate : data.school_meals;
    const exists = refPool.some((r) => r.country_code === selectedCountry);
    return exists ? selectedCountry : 'IT';
  }, [data, selectedCountry]);

  // Tab 1: Time Use Chart Option (strict single unit per axis)
  const timeUseChartOption = useMemo(() => {
    if (!data) return {};
    const spec = buildTimeUseChartSeries(data.time_use, timeUseMode);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        textStyle: { color: '#111827', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 },
      },
      legend: {
        top: 0,
        textStyle: { color: '#2d3643', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
      },
      grid: { top: 40, right: 48, bottom: 48, left: 140 },
      xAxis: {
        type: 'value',
        name: spec.xAxisName,
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: '#3d4654', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'dashed' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        data: spec.categories,
        inverse: true,
        axisLabel: { color: '#111827', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
      },
      series: spec.series.map((s) => ({
        name: s.name,
        type: 'bar',
        data: s.data,
        itemStyle: { color: s.color, borderRadius: [0, 3, 3, 0] },
        barMaxWidth: 16,
      })),
    };
  }, [data, timeUseMode]);

  // Tab 2: Clinical Biomarkers Chart Option (strict single homogeneous clinical unit per view)
  const biomarkerChartOption = useMemo(() => {
    if (!data) return {};
    const spec = buildBiomarkerChartSeries(data.clinical_biomarkers, biomarkerMode);

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
        textStyle: { color: '#2d3643', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
      },
      grid: { top: 44, right: 36, bottom: 48, left: 180 },
      xAxis: {
        type: 'value',
        name: spec.xAxisName,
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: '#3d4654', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'dashed' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        data: spec.categories,
        inverse: true,
        axisLabel: { color: '#111827', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
      },
      series: spec.series.map((s) => ({
        name: s.name,
        type: 'bar',
        data: s.data,
        itemStyle:
          biomarkerMode === 'cvd_risk_delta_pct'
            ? {
                color: (params: { value: number }) => (params.value < 0 ? '#059669' : '#8a1253'),
                borderRadius: [0, 3, 3, 0],
              }
            : { color: s.color, borderRadius: [0, 3, 3, 0] },
        barMaxWidth: 14,
      })),
    };
  }, [data, biomarkerMode]);

  // Tab 3: School Meals Chart Option
  const schoolMealsChartOption = useMemo(() => {
    if (!data) return {};
    const records = data.school_meals.filter((r) => r.country_code !== 'EU27');
    const sorted = [...records].sort((a, b) => b.organic_procurement_quota_pct - a.organic_procurement_quota_pct);

    const categories = sorted.map((r) => `[${r.country_code}] ${r.country_name}`);
    const organic = sorted.map((r) => r.organic_procurement_quota_pct);
    const quality = sorted.map((r) => r.sustainable_quality_quota_pct);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        textStyle: { color: '#111827', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 },
      },
      legend: {
        top: 0,
        textStyle: { color: '#2d3643', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
      },
      grid: { top: 40, right: 30, bottom: 40, left: 130 },
      xAxis: {
        type: 'value',
        max: 80,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'dashed' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, formatter: '{value}%' },
      },
      yAxis: {
        type: 'category',
        data: categories,
        inverse: true,
        axisLabel: { color: '#111827', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
      },
      series: [
        {
          name: 'Mandatory Organic Quota (%)',
          type: 'bar',
          data: organic,
          itemStyle: { color: '#059669', borderRadius: [0, 3, 3, 0] },
          barMaxWidth: 16,
        },
        {
          name: 'Sustainable / Terroir Quality Quota (%)',
          type: 'bar',
          data: quality,
          itemStyle: { color: '#163d4a', borderRadius: [0, 3, 3, 0] },
          barMaxWidth: 16,
        },
      ],
    };
  }, [data]);

  // Tab 4: Cultural Climate Inertia Chart Option (strict separation between % shares & 0-100 index)
  const culturalInertiaChartOption = useMemo(() => {
    if (!data) return {};
    const spec = buildCulturalInertiaChartSeries(data.cultural_climate, culturalMode);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        textStyle: { color: '#111827', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 },
      },
      legend: {
        top: 0,
        textStyle: { color: '#2d3643', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
      },
      grid: { top: 40, right: 30, bottom: 48, left: 130 },
      xAxis: {
        type: 'value',
        max: 100,
        name: spec.xAxisName,
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { color: '#3d4654', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'dashed' } },
        axisLabel: {
          color: '#3d4654',
          fontFamily: 'IBM Plex Mono, monospace',
          fontSize: 10,
          formatter: culturalMode === 'prevalence_pct' ? '{value}%' : '{value}',
        },
      },
      yAxis: {
        type: 'category',
        data: spec.categories,
        inverse: true,
        axisLabel: { color: '#111827', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
      },
      series: spec.series.map((s) => ({
        name: s.name,
        type: 'bar',
        data: s.data,
        itemStyle: { color: s.color, borderRadius: [0, 2, 2, 0] },
        barMaxWidth: 14,
      })),
    };
  }, [data, culturalMode]);

  if (loadDisclosure && !data) {
    return (
      <ResourceDisclosureBanner
        disclosure={loadDisclosure}
        onRetry={
          loadDisclosure.isRetryable
            ? () => {
                setLoadDisclosure(null);
                setRetryTick((t) => t + 1);
              }
            : undefined
        }
      />
    );
  }

  if (!data) {
    return (
      <div className="almanac-sheet p-5 text-center text-xs text-[var(--color-muted)] font-mono-num">
        Loading empirical microdata and social science datasets (MTUS, NHANES, GCNF, ESS)...
      </div>
    );
  }

  const currentCountryTimeUse = data.time_use.filter((r) => r.country_code === activeCountryCode);
  const currentCountryCulture = data.cultural_climate.find((r) => r.country_code === activeCountryCode);
  const currentSchoolMeal = data.school_meals.find((r) => r.country_code === activeCountryCode);

  return (
    <div className="almanac-sheet p-5 space-y-5">
      {loadDisclosure && (
        <ResourceDisclosureBanner
          disclosure={loadDisclosure}
          onRetry={
            loadDisclosure.isRetryable
              ? () => {
                  setLoadDisclosure(null);
                  setRetryTick((t) => t + 1);
                }
              : undefined
          }
          compact
        />
      )}
      {isCountryFallback && (
        <div className="p-2.5 border-l-4 border-[#6b4c1b] bg-[#6b4c1b]/10 text-xs text-[var(--color-ink)]">
          <b>Jurisdiction Fallback Disclosure:</b> Selected jurisdiction <code>{selectedCountry}</code> is not covered
          in Plate III-F country tables; country highlight falls back to <code>[IT] Italy</code> while cross-country
          comparators show all available records.
        </div>
      )}
      {/* Masthead */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 rule-firm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--color-ink)] flex items-center gap-2">
              <Users2 className="w-4 h-4 text-[#8a1253]" />
              Plate III-F. Empirical Social Science & Microeconomic Microdata Lab
            </h3>
            <span className="almanac-pill text-[10px] tracking-wide uppercase">Todd R. Jones Open Datasets</span>
          </div>
          <p className="almanac-label text-xs mt-1">
            Grounding retail scanner behaviors in empirical time diaries (MTUS/ATUS), objective clinical biomarkers (NHANES),
            statutory public canteen mandates (GCNF 167 Countries), and European socio-cultural surveys (ESS/TISP).
          </p>
        </div>

        <a
          href="https://github.com/toddrjones/datasets"
          target="_blank"
          rel="noopener noreferrer"
          className="almanac-btn text-xs flex items-center gap-1.5 shrink-0"
          title="Open source Todd R. Jones curated social science compilation"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>toddrjones/datasets</span>
        </a>
      </div>

      {/* Nav Tabs */}
      <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-[var(--color-rule)]">
        <button
          onClick={() => setActiveTab('time_use')}
          className={`almanac-btn flex items-center gap-1.5 ${
            activeTab === 'time_use' ? 'almanac-btn--primary' : ''
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>1. Time Poverty & Cooking Friction (MTUS)</span>
        </button>

        <button
          onClick={() => setActiveTab('biomarkers')}
          className={`almanac-btn flex items-center gap-1.5 ${
            activeTab === 'biomarkers' ? 'almanac-btn--primary' : ''
          }`}
        >
          <HeartPulse className="w-3.5 h-3.5" />
          <span>2. Clinical Biomarker Validation (NHANES)</span>
        </button>

        <button
          onClick={() => setActiveTab('school_meals')}
          className={`almanac-btn flex items-center gap-1.5 ${
            activeTab === 'school_meals' ? 'almanac-btn--primary' : ''
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>3. Public School Canteens (GCNF)</span>
        </button>

        <button
          onClick={() => setActiveTab('cultural_inertia')}
          className={`almanac-btn flex items-center gap-1.5 ${
            activeTab === 'cultural_inertia' ? 'almanac-btn--primary' : ''
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>4. Cultural Inertia vs. Climate Concern (ESS/TISP)</span>
        </button>
      </div>

      {/* Tab 1: Time Use & Cooking Friction */}
      {activeTab === 'time_use' && (
        data.time_use.length === 0 ? (
          <ResourceDisclosureBanner
            disclosure={classifyResourceError(
              { status: 404, message: 'HTTP 404 for data/time_use_cooking_friction.json' },
              {
                resourcePath: 'data/time_use_cooking_friction.json',
                availableSummary: 'CDC NHANES Clinical Biomarkers (Tab 2) and GCNF Public School Canteens (Tab 3) remain fully available.',
              }
            )}
          />
        ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <DataNatureBadge nature="Estimated" label="MTUS/ATUS Scaled Quintiles" />
            <div className="flex items-center gap-1.5" role="group" aria-label="Time use single unit">
              <button
                onClick={() => setTimeUseMode('cooking_min_day')}
                className={`almanac-btn text-xs ${timeUseMode === 'cooking_min_day' ? 'almanac-btn--primary' : ''}`}
              >
                Cooking Time (min/d)
              </button>
              <button
                onClick={() => setTimeUseMode('convenience_spend_pct')}
                className={`almanac-btn text-xs ${timeUseMode === 'convenience_spend_pct' ? 'almanac-btn--primary' : ''}`}
              >
                Convenience Spend (%)
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7">
              <div className="h-80 w-full">
                <ReactECharts option={timeUseChartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
              </div>
            </div>

            <div className="xl:col-span-5 space-y-3">
              <div className="almanac-well p-4 space-y-2">
                <div className="font-semibold text-xs text-[var(--color-ink)] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#8a1253]" />
                  The Culinary Time-Poverty Threshold (MTUS/ATUS)
                </div>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  Whole plant-rich transitions (cooking dry pulses, whole heritage grains, fresh produce) demand an average of{' '}
                  <b>45–65 minutes/day</b>. In countries where cooking time falls below 40 minutes (e.g. UK: 34m/d, NL: 38.5m/d),{' '}
                  <b>convenience and ultra-processed food expenditure surges above 40%</b>.
                </p>
              </div>

              {currentCountryTimeUse.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="almanac-table text-xs">
                    <thead>
                      <tr>
                        <th>Quintile</th>
                        <th className="text-right">Cooking (min)</th>
                        <th className="text-right">Convenience %</th>
                        <th className="text-right">Time Poverty %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentCountryTimeUse.map((row) => (
                        <tr key={row.income_quintile}>
                          <td className="font-semibold text-[var(--color-ink)]">{row.income_quintile}</td>
                          <td className="num text-right">{row.daily_cooking_food_prep_min}m</td>
                          <td className="num text-right text-[var(--color-accent)]">
                            {row.convenience_food_expenditure_share_pct}%
                          </td>
                          <td className="num text-right">{row.culinary_time_poverty_rate_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
        )
      )}

      {/* Tab 2: Clinical Biomarkers Grounding */}
      {activeTab === 'biomarkers' && (
        <div className="space-y-4">
          <div className="almanac-well p-3 border-l-4 border-[var(--color-accent)] text-xs text-[var(--color-ink)]">
            <span className="font-mono-num font-semibold text-[var(--color-accent)] uppercase mr-2">
              Methodological Caveat (Domain Transfer &amp; Proxy Columns):
            </span>
            Total Cholesterol, HDL-C, Non-HDL-C, hs-CRP, and Systolic BP are WTDRD1-weighted empirical quintile means from US CDC NHANES 2021–2023 (domain transfer caveat for Europe). Note that auxiliary schema columns (`ldl_cholesterol_mg_dl`, `triglycerides_mg_dl`, `fasting_glucose_mg_dl=96.0`, `hba1c_pct=5.5%`, `bmi_mean=28.4`) are proxy/reference constants, and `CVD Risk Δ` is a derived weighted composite index vs Q3.
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <DataNatureBadge
              nature={biomarkerMode === 'cvd_risk_delta_pct' ? 'Estimated' : 'Observed'}
              label={biomarkerMode === 'cvd_risk_delta_pct' ? 'Derived Composite Index' : 'NHANES Lab Biomarker'}
            />
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Biomarker single unit">
              {(
                [
                  { id: 'lipids_mg_dl', label: 'Lipids (mg/dL)' },
                  { id: 'hs_crp_mg_l', label: 'hs-CRP (mg/L)' },
                  { id: 'systolic_bp_mmhg', label: 'Systolic BP (mmHg)' },
                  { id: 'cvd_risk_delta_pct', label: 'Composite CVD Index Δ (%)' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setBiomarkerMode(opt.id)}
                  className={`almanac-btn text-xs ${biomarkerMode === opt.id ? 'almanac-btn--primary' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7">
              <div className="h-80 w-full">
                <ReactECharts option={biomarkerChartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
              </div>
            </div>

            <div className="xl:col-span-5 space-y-3">
              <div className="almanac-well p-4 space-y-2">
                <div className="font-semibold text-xs text-[var(--color-ink)] flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-[#059669]" />
                  Clinical Ground-Truthing (CDC NHANES 2021–2023 Microdata)
                </div>
                {(() => {
                  const totalN = data.clinical_biomarkers.reduce(
                    (acc, r) => acc + (r.n_respondents ?? r.sample_size_n ?? 0),
                    0
                  );
                  const topQ = data.clinical_biomarkers[0];
                  const botQ = data.clinical_biomarkers[data.clinical_biomarkers.length - 1];
                  const crpDropPct =
                    topQ && botQ && botQ.hs_crp_inflammation_mg_l > 0
                      ? (((botQ.hs_crp_inflammation_mg_l - topQ.hs_crp_inflammation_mg_l) / botQ.hs_crp_inflammation_mg_l) * 100).toFixed(1)
                      : '—';
                  return (
                    <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                      Directly aggregated from <b>{totalN.toLocaleString()} CDC NHANES 2021–2023</b> adult examination
                      microdata records (<code>DEMO_L</code>, <code>DR1TOT_L</code>, <code>TCHOL_L</code>,{' '}
                      <code>HDL_L</code>, <code>HSCRP_L</code>, <code>BPXO_L</code> with <code>WTDRD1</code> weights):
                      top fiber-density quintile (Q5, <b>{topQ?.mean_fiber_g_day} g/d</b>) vs bottom quintile (Q1,{' '}
                      <b>{botQ?.mean_fiber_g_day} g/d</b>) exhibits <b>{crpDropPct}% lower mean hs-CRP</b> (
                      {topQ?.hs_crp_inflammation_mg_l} ± {topQ?.hs_crp_ci95 ?? '—'} vs. {botQ?.hs_crp_inflammation_mg_l} ±{' '}
                      {botQ?.hs_crp_ci95 ?? '—'} mg/L) and non-HDL differential CVD risk delta of{' '}
                      <b>{topQ?.cardiovascular_risk_delta_pct}%</b> vs. median.
                    </p>
                  );
                })()}
              </div>

              <div className="overflow-x-auto">
                <table className="almanac-table text-xs">
                  <thead>
                    <tr>
                      <th>Dietary Quintile</th>
                      <th className="text-right">n</th>
                      <th className="text-right">Fiber</th>
                      <th className="text-right">Non-HDL (±CI)</th>
                      <th className="text-right">hs-CRP (±CI)</th>
                      <th className="text-right">CVD Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clinical_biomarkers.map((a) => (
                      <tr key={a.pattern_id} title={a.cohort_source || a.description}>
                        <td className="font-semibold text-[var(--color-ink)] max-w-[130px] truncate" title={a.dietary_pattern}>
                          {a.dietary_pattern.split('(')[0]}
                        </td>
                        <td className="num text-right text-[var(--color-muted)]">
                          {(a.n_respondents ?? a.sample_size_n ?? 0).toLocaleString()}
                        </td>
                        <td className="num text-right">{a.mean_fiber_g_day}g</td>
                        <td className="num text-right font-mono-num">
                          {a.non_hdl_cholesterol_mg_dl ?? a.ldl_cholesterol_mg_dl}
                          {a.non_hdl_ci95 != null ? ` ±${a.non_hdl_ci95}` : ''}
                        </td>
                        <td className="num text-right font-mono-num">
                          {a.hs_crp_inflammation_mg_l}
                          {a.hs_crp_ci95 != null ? ` ±${a.hs_crp_ci95}` : ''}
                        </td>
                        <td
                          className={`num text-right font-semibold ${
                            a.cardiovascular_risk_delta_pct < 0 ? 'text-[#059669]' : 'text-[var(--color-accent)]'
                          }`}
                        >
                          {a.cardiovascular_risk_delta_pct > 0 ? '+' : ''}
                          {a.cardiovascular_risk_delta_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: School Meals & Public Procurement */}
      {activeTab === 'school_meals' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7">
              <div className="h-80 w-full">
                <ReactECharts option={schoolMealsChartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
              </div>
            </div>

            <div className="xl:col-span-5 space-y-3">
              <div className="almanac-well p-4 space-y-2">
                <div className="font-semibold text-xs text-[var(--color-ink)] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#163d4a]" />
                  Public Canteen Mandates (Global Survey of School Meal Programs)
                </div>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  Across the EU-27, <b>42.5 million students</b> consume daily meals in public institutions (€18.5B annual public spend).
                  Statutory frameworks like France's <i>Loi EGALIM</i> (mandatory weekly vegetarian day + 50% sustainable procurement)
                  and Italy's <i>CAM Ristorazione</i> (40% organic quota) represent the fastest non-retail driver of dietary shift.
                </p>
              </div>

              {currentSchoolMeal && (
                <div className="almanac-sheet p-3.5 text-xs space-y-1.5 border border-[var(--color-rule)]">
                  <div className="font-semibold text-[var(--color-ink)]">
                    [{currentSchoolMeal.country_code}] {currentSchoolMeal.country_name}: Statutory Framework
                  </div>
                  <div className="text-[var(--color-accent)] font-serif-label italic">
                    {currentSchoolMeal.legal_framework}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-mono-num">
                    <div>Mandatory Veg Days: <b>{currentSchoolMeal.mandatory_plant_days_per_week}/wk</b></div>
                    <div>Organic Quota: <b>{currentSchoolMeal.organic_procurement_quota_pct}%</b></div>
                    <div>Daily Students: <b>{currentSchoolMeal.students_served_daily_m}M</b></div>
                    <div>Annual Budget: <b>€{currentSchoolMeal.annual_procurement_budget_eur_m}M</b></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Cultural Culinary Inertia */}
      {activeTab === 'cultural_inertia' && (
        data.cultural_climate.length === 0 ? (
          <ResourceDisclosureBanner
            disclosure={classifyResourceError(
              { status: 404, message: 'HTTP 404 for data/cultural_climate_inertia.json' },
              {
                resourcePath: 'data/cultural_climate_inertia.json',
                availableSummary: 'CDC NHANES Clinical Biomarkers (Tab 2) and GCNF Public School Canteens (Tab 3) remain fully available.',
              }
            )}
          />
        ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <DataNatureBadge nature="Estimated" label="ESS / TISP Synthesis" />
            <div className="flex items-center gap-1.5" role="group" aria-label="Cultural indicator unit">
              <button
                onClick={() => setCulturalMode('prevalence_pct')}
                className={`almanac-btn text-xs ${culturalMode === 'prevalence_pct' ? 'almanac-btn--primary' : ''}`}
              >
                Prevalence Shares (%)
              </button>
              <button
                onClick={() => setCulturalMode('inertia_index_100')}
                className={`almanac-btn text-xs ${culturalMode === 'inertia_index_100' ? 'almanac-btn--primary' : ''}`}
              >
                Inertia Index (0–100)
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-7">
              <div className="h-80 w-full">
                <ReactECharts option={culturalInertiaChartOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
              </div>
            </div>

            <div className="xl:col-span-5 space-y-3">
              <div className="almanac-well p-4 space-y-2">
                <div className="font-semibold text-xs text-[var(--color-ink)] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#8a1253]" />
                  The Culinary Inertia Paradox (ESS & TISP 68-Country Survey)
                </div>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  High environmental awareness does not automatically translate into plant meat adoption. In Mediterranean nations
                  (Italy: 82.4% climate worry, Spain: 84.8%), <b>Culinary Cultural Inertia (84.5 and 81.2)</b> remains the dominant brake.
                  Consumers refuse industrial meat analogues in defense of regional gastronomic identity and PDO/PGI terroir heritage.
                </p>
              </div>

              {currentCountryCulture && (
                <div className="almanac-sheet p-3.5 text-xs space-y-1.5 border border-[var(--color-rule)]">
                  <div className="font-semibold text-[var(--color-ink)]">
                    [{currentCountryCulture.country_code}] {currentCountryCulture.country_name}: Attitude vs. Plate Ledger
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-mono-num">
                    <div>Climate Concern: <b>{currentCountryCulture.climate_worry_score_pct}%</b></div>
                    <div>Meat Reduction Intent: <b>{currentCountryCulture.willingness_to_reduce_meat_pct}%</b></div>
                    <div>Culinary Inertia: <b className="text-[var(--color-accent)]">{currentCountryCulture.cultural_culinary_inertia_index}/100</b></div>
                    <div>Actual Plant Basket: <b className="text-[#059669]">{currentCountryCulture.actual_plant_basket_penetration_pct}%</b></div>
                    <div className="col-span-2 text-[var(--color-muted)]">
                      Say-Do Gap: <b>{currentCountryCulture.say_do_divergence_gap_pct}% divergence</b>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )
      )}
    </div>
  );
}
