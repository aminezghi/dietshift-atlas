export type TimeUseMetricMode = 'cooking_min_day' | 'convenience_spend_pct';
export type BiomarkerMetricMode =
  | 'lipids_mg_dl'
  | 'hs_crp_mg_l'
  | 'systolic_bp_mmhg'
  | 'cvd_risk_delta_pct';
export type CulturalMetricMode = 'prevalence_pct' | 'inertia_index_100';

export interface SingleUnitChartSpec {
  mode: string;
  xAxisName: string;
  unit: string;
  mixedUnitsPresent: false;
  categories: string[];
  series: Array<{
    name: string;
    unit: string;
    color: string;
    data: number[];
  }>;
}

export function buildTimeUseChartSeries(
  rows: ReadonlyArray<{
    country_code: string;
    country_name: string;
    income_quintile: string;
    daily_cooking_food_prep_min: number;
    convenience_food_expenditure_share_pct: number;
  }>,
  mode: TimeUseMetricMode
): SingleUnitChartSpec {
  const q3 = rows.filter((r) => r.income_quintile.includes('Q3') && r.country_code !== 'EU27');
  const sorted = [...q3].sort((a, b) =>
    mode === 'cooking_min_day'
      ? b.daily_cooking_food_prep_min - a.daily_cooking_food_prep_min
      : b.convenience_food_expenditure_share_pct - a.convenience_food_expenditure_share_pct
  );

  const categories = sorted.map((r) => `[${r.country_code}] ${r.country_name}`);
  if (mode === 'cooking_min_day') {
    return {
      mode,
      xAxisName: 'Daily Food Preparation & Cooking (min / day)',
      unit: 'min/d',
      mixedUnitsPresent: false,
      categories,
      series: [
        {
          name: 'Daily Food Prep & Cooking (min/d)',
          unit: 'min/d',
          color: '#163d4a',
          data: sorted.map((r) => r.daily_cooking_food_prep_min),
        },
      ],
    };
  }
  return {
    mode,
    xAxisName: 'Convenience / UPF Expenditure Share (% of food spend)',
    unit: '%',
    mixedUnitsPresent: false,
    categories,
    series: [
      {
        name: 'Convenience / UPF Spend Share (%)',
        unit: '%',
        color: '#8a1253',
        data: sorted.map((r) => r.convenience_food_expenditure_share_pct),
      },
    ],
  };
}

export function buildBiomarkerChartSeries(
  rows: ReadonlyArray<{
    dietary_pattern: string;
    total_cholesterol_mg_dl: number;
    non_hdl_cholesterol_mg_dl?: number;
    hs_crp_inflammation_mg_l: number;
    systolic_bp_mmhg: number;
    cardiovascular_risk_delta_pct: number;
  }>,
  mode: BiomarkerMetricMode
): SingleUnitChartSpec {
  const categories = rows.map((a) => a.dietary_pattern.split('(')[0].trim());
  if (mode === 'lipids_mg_dl') {
    return {
      mode,
      xAxisName: 'Serum Lipid Concentration (mg/dL, NHANES WTDRD1-weighted Observed)',
      unit: 'mg/dL',
      mixedUnitsPresent: false,
      categories,
      series: [
        {
          name: 'Total Cholesterol Observed (mg/dL)',
          unit: 'mg/dL',
          color: '#163d4a',
          data: rows.map((a) => a.total_cholesterol_mg_dl),
        },
        {
          name: 'Non-HDL Cholesterol Observed (mg/dL)',
          unit: 'mg/dL',
          color: '#3f6f7d',
          data: rows.map((a) => a.non_hdl_cholesterol_mg_dl ?? 0),
        },
      ],
    };
  }
  if (mode === 'hs_crp_mg_l') {
    return {
      mode,
      xAxisName: 'High-Sensitivity C-Reactive Protein hs-CRP (mg/L, Observed)',
      unit: 'mg/L',
      mixedUnitsPresent: false,
      categories,
      series: [
        {
          name: 'hs-CRP Inflammation (mg/L)',
          unit: 'mg/L',
          color: '#8a1253',
          data: rows.map((a) => a.hs_crp_inflammation_mg_l),
        },
      ],
    };
  }
  if (mode === 'systolic_bp_mmhg') {
    return {
      mode,
      xAxisName: 'Systolic Blood Pressure (mmHg, Observed)',
      unit: 'mmHg',
      mixedUnitsPresent: false,
      categories,
      series: [
        {
          name: 'Systolic Blood Pressure (mmHg)',
          unit: 'mmHg',
          color: '#6b4c1b',
          data: rows.map((a) => a.systolic_bp_mmhg),
        },
      ],
    };
  }
  return {
    mode,
    xAxisName: 'Derived Relative Composite CVD Index Δ vs. Q3 Baseline (%, Estimated Index)',
    unit: '% vs Q3',
    mixedUnitsPresent: false,
    categories,
    series: [
      {
        name: 'Derived Composite CVD Index Δ (% vs Q3)',
        unit: '% vs Q3',
        color: '#8a1253',
        data: rows.map((a) => a.cardiovascular_risk_delta_pct),
      },
    ],
  };
}

export function buildCulturalInertiaChartSeries(
  rows: ReadonlyArray<{
    country_code: string;
    country_name: string;
    climate_worry_score_pct: number;
    cultural_culinary_inertia_index: number;
    actual_plant_basket_penetration_pct: number;
  }>,
  mode: CulturalMetricMode
): SingleUnitChartSpec {
  const filtered = rows.filter((r) => r.country_code !== 'EU27');
  const sorted = [...filtered].sort(
    (a, b) => b.cultural_culinary_inertia_index - a.cultural_culinary_inertia_index
  );
  const categories = sorted.map((r) => `[${r.country_code}] ${r.country_name}`);

  if (mode === 'prevalence_pct') {
    return {
      mode,
      xAxisName: 'Surveyed Population / Basket Share (%)',
      unit: '%',
      mixedUnitsPresent: false,
      categories,
      series: [
        {
          name: 'Climate Concern Share (%)',
          unit: '%',
          color: '#3f6f7d',
          data: sorted.map((r) => r.climate_worry_score_pct),
        },
        {
          name: 'Actual Plant Basket Penetration (%)',
          unit: '%',
          color: '#059669',
          data: sorted.map((r) => r.actual_plant_basket_penetration_pct),
        },
      ],
    };
  }
  return {
    mode,
    xAxisName: 'Culinary Cultural Inertia Index (0–100 Composite Score)',
    unit: 'index (0-100)',
    mixedUnitsPresent: false,
    categories,
    series: [
      {
        name: 'Culinary Cultural Inertia Index (0-100)',
        unit: 'index (0-100)',
        color: '#8a1253',
        data: sorted.map((r) => r.cultural_culinary_inertia_index),
      },
    ],
  };
}
