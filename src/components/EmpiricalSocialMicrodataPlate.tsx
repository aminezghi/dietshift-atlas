import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { assetUrl } from '../utils/assetPath';
import { Activity, Clock, ExternalLink, HeartPulse, ShieldCheck, Users2 } from 'lucide-react';

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
  mean_fiber_g_day: number;
  saturated_fat_pct_kcal: number;
  plant_protein_share_pct: number;
  total_cholesterol_mg_dl: number;
  ldl_cholesterol_mg_dl: number;
  hdl_cholesterol_mg_dl: number;
  triglycerides_mg_dl: number;
  hba1c_pct: number;
  hs_crp_inflammation_mg_l: number;
  systolic_bp_mmhg: number;
  diastolic_bp_mmhg: number;
  cardiovascular_risk_delta_pct: number;
  sample_size_n: number;
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
  const [activeTab, setActiveTab] = useState<'time_use' | 'biomarkers' | 'school_meals' | 'cultural_inertia'>('time_use');

  useEffect(() => {
    fetch(assetUrl('data/empirical_microdata_bundle.json'))
      .then((res) => res.json())
      .then((d: EmpiricalBundle) => setData(d))
      .catch((err) => console.error('Failed to load empirical microdata bundle:', err));
  }, []);

  // Filtered country records
  const activeCountryCode = useMemo(() => {
    if (!data) return 'IT';
    const exists = data.cultural_climate.some((r) => r.country_code === selectedCountry);
    return exists ? selectedCountry : 'IT';
  }, [data, selectedCountry]);

  // Tab 1: Time Use Chart Option
  const timeUseChartOption = useMemo(() => {
    if (!data) return {};
    // Aggregate by country for median quintile Q3
    const q3Records = data.time_use.filter((r) => r.income_quintile.includes('Q3') && r.country_code !== 'EU27');
    const sorted = [...q3Records].sort((a, b) => b.daily_cooking_food_prep_min - a.daily_cooking_food_prep_min);

    const categories = sorted.map((r) => `[${r.country_code}] ${r.country_name}`);
    const cookMin = sorted.map((r) => r.daily_cooking_food_prep_min);
    const convenienceShare = sorted.map((r) => r.convenience_food_expenditure_share_pct);

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
      grid: { top: 40, right: 48, bottom: 40, left: 140 },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'dashed' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        data: categories,
        inverse: true,
        axisLabel: { color: '#111827', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
      },
      series: [
        {
          name: 'Daily Food Prep & Cooking (min/d)',
          type: 'bar',
          data: cookMin,
          itemStyle: { color: '#163d4a', borderRadius: [0, 3, 3, 0] },
          barMaxWidth: 16,
        },
        {
          name: 'Convenience / UPF Spend Share (%)',
          type: 'bar',
          data: convenienceShare,
          itemStyle: { color: '#8a1253', borderRadius: [0, 3, 3, 0] },
          barMaxWidth: 16,
        },
      ],
    };
  }, [data]);

  // Tab 2: Clinical Biomarkers Chart Option
  const biomarkerChartOption = useMemo(() => {
    if (!data) return {};
    const archetypes = data.clinical_biomarkers;
    const labels = archetypes.map((a) => a.dietary_pattern.split('(')[0].trim());
    const ldl = archetypes.map((a) => a.ldl_cholesterol_mg_dl);
    const cvdDelta = archetypes.map((a) => a.cardiovascular_risk_delta_pct);

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
        name: 'LDL-C (mg/dL) & CVD Risk Delta (%)',
        nameLocation: 'middle',
        nameGap: 30,
        splitLine: { lineStyle: { color: '#aeb6c4', type: 'dashed' } },
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        data: labels,
        inverse: true,
        axisLabel: { color: '#111827', fontFamily: 'Newsreader, Georgia, serif', fontSize: 11 },
      },
      series: [
        {
          name: 'LDL Cholesterol (mg/dL)',
          type: 'bar',
          data: ldl,
          itemStyle: { color: '#163d4a', borderRadius: [0, 3, 3, 0] },
          barMaxWidth: 14,
        },
        {
          name: '10-Year CVD Risk Delta vs. Baseline (%)',
          type: 'bar',
          data: cvdDelta,
          itemStyle: {
            color: (params: { value: number }) => (params.value < 0 ? '#059669' : '#8a1253'),
            borderRadius: [0, 3, 3, 0],
          },
          barMaxWidth: 14,
        },
      ],
    };
  }, [data]);

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

  // Tab 4: Cultural Climate Inertia Chart Option
  const culturalInertiaChartOption = useMemo(() => {
    if (!data) return {};
    const records = data.cultural_climate.filter((r) => r.country_code !== 'EU27');
    const sorted = [...records].sort((a, b) => b.cultural_culinary_inertia_index - a.cultural_culinary_inertia_index);

    const categories = sorted.map((r) => `[${r.country_code}] ${r.country_name}`);
    const worry = sorted.map((r) => r.climate_worry_score_pct);
    const inertia = sorted.map((r) => r.cultural_culinary_inertia_index);
    const actualPlant = sorted.map((r) => r.actual_plant_basket_penetration_pct);

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
        max: 100,
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
          name: 'Climate Concern Index (%)',
          type: 'bar',
          data: worry,
          itemStyle: { color: '#3f6f7d', borderRadius: [0, 2, 2, 0] },
          barMaxWidth: 12,
        },
        {
          name: 'Culinary Cultural Inertia Index (0-100)',
          type: 'bar',
          data: inertia,
          itemStyle: { color: '#8a1253', borderRadius: [0, 2, 2, 0] },
          barMaxWidth: 12,
        },
        {
          name: 'Actual Plant Basket Penetration (%)',
          type: 'bar',
          data: actualPlant,
          itemStyle: { color: '#059669', borderRadius: [0, 2, 2, 0] },
          barMaxWidth: 12,
        },
      ],
    };
  }, [data]);

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
        <div className="space-y-4">
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
      )}

      {/* Tab 2: Clinical Biomarkers Grounding */}
      {activeTab === 'biomarkers' && (
        <div className="space-y-4">
          <div className="almanac-well p-3 border-l-4 border-[var(--color-accent)] text-xs text-[var(--color-ink)]">
            <span className="font-mono-num font-semibold text-[var(--color-accent)] uppercase mr-2">
              Methodological Caveat (Domain Transfer):
            </span>
            Clinical biomarker baselines (LDL-C, hs-CRP, HbA1c, ASCVD 10-yr delta) are anchored in the US CDC NHANES cohort. Direct extrapolation to European populations requires covariate adjustment (age, baseline BMI, statin prevalence) and calibration against EU prospective cohorts (e.g., EPIC, NutriNet-Santé) to avoid ecological fallacy.
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
                  Clinical Ground-Truthing (NHANES Cohort Validation)
                </div>
                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                  Validating simulated dietary transitions against objective blood biomarkers: shifting from a Heavy UPF/Red Meat
                  archetype to an EAT-Lancet planetary flexitarian diet reduces <b>hs-CRP systemic inflammation by 67%</b>{' '}
                  (from 3.42 to 1.12 mg/L) and drops <b>10-year ASCVD cardiovascular risk by −31.8%</b>.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="almanac-table text-xs">
                  <thead>
                    <tr>
                      <th>Dietary Pattern</th>
                      <th className="text-right">Fiber (g)</th>
                      <th className="text-right">LDL-C</th>
                      <th className="text-right">hs-CRP</th>
                      <th className="text-right">CVD Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clinical_biomarkers.map((a) => (
                      <tr key={a.pattern_id}>
                        <td className="font-semibold text-[var(--color-ink)] max-w-[140px] truncate" title={a.dietary_pattern}>
                          {a.dietary_pattern.split('(')[0]}
                        </td>
                        <td className="num text-right">{a.mean_fiber_g_day}g</td>
                        <td className="num text-right">{a.ldl_cholesterol_mg_dl}</td>
                        <td className="num text-right font-mono-num">{a.hs_crp_inflammation_mg_l}</td>
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
        <div className="space-y-4">
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
      )}
    </div>
  );
}
