import type { CountryDietaryProfile } from '../types/research';
import type { AnalyticalResult } from './types';

export const POLICY_SCENARIO_MODEL_VERSION = '5.1.0-phase5a';

export interface PolicyCalibrationInput {
  empirical_own_price_elasticity?: number | null;
  hbs_q1_food_share_pct?: number | null;
  hbs_q5_food_share_pct?: number | null;
  ehis_q1_5plus_veg_pct?: number | null;
  ehis_q5_5plus_veg_pct?: number | null;
  eurostat_food_ppp_index_eu27_100?: number | null;
}

export interface PolicyLeversInput {
  simPlantShiftPct: number;
  simUpfReductionPct: number;
  simCarbonTaxEurT: number;
  simWasteCutPct: number;
}

/**
 * Explicit analyst-defined linear scenario assumptions.
 * Preserved transparently for interactive exploration; NOT calibrated as
 * econometric causal elasticities or statistically validated prediction intervals.
 */
export const ANALYST_POLICY_COEFFICIENTS = {
  assumptionOrigin: 'analyst_defined_heuristic' as const,
  plantCarbonSlope: 0.42,
  wasteCarbonSlope: 0.18,
  carbonTaxDivisorEurT: 150,
  carbonTaxPassThroughWeight: 0.18,
  defaultElasticityFallback: -0.65,
  plantWaterSlope: 0.24,
  wasteWaterSlope: 0.16,
  plantLandSlope: 0.48,
  wasteLandSlope: 0.15,
  plantCostPctPerUnit: -0.11,
  wasteCostPctPerUnit: -0.18,
  carbonTaxCostPctPer100EurT: 2.5,
  upfCostPctPerUnit: -0.05,
  plantHealthGainPerUnit: 0.28,
  upfHealthGainPerUnit: 0.35,
  carbonTaxHealthGainPer100EurT: 4.2,
  healthGainCapPct: 42,
} as const;

export interface PolicyScenarioOutput {
  baselineProfileCode: string;
  baselineNature: 'Manually Compiled';
  newCarbon: number;
  carbonDeltaPct: number;
  newWater: number;
  waterDeltaPct: number;
  newLand: number;
  landDeltaPct: number;
  newCost: number;
  costDeltaPct: number;
  healthGainPct: number;
  elasticityMag: number;
  q1TaxExposureRatio: number;
  q1BudgetImpactPct: number;
  q5BudgetImpactPct: number;
  eatLancetSimulated: {
    redMeat: number;
    dairy: number;
    legumesNuts: number;
    wholeGrains: number;
    vegetablesFruits: number;
    ultraProcessedShare: number;
  };
  uncertaintyStatus: {
    available: false;
    ci95ForPolicyCarbonShift: null;
    reason: string;
  };
  pppStatus: {
    pppNormalized: false;
    note: string;
  };
}

/**
 * Evaluates deterministic policy lever perturbations over COUNTRY_PROFILES
 * while explicitly withholding unsubstantiated 95% CIs and PPP claims.
 */
export function evaluatePolicyScenario(
  base: CountryDietaryProfile,
  cal: PolicyCalibrationInput | null | undefined,
  levers: PolicyLeversInput
): AnalyticalResult<PolicyScenarioOutput> {
  const C = ANALYST_POLICY_COEFFICIENTS;
  const elasticityMag = Math.abs(cal?.empirical_own_price_elasticity ?? C.defaultElasticityFallback);
  const taxPricePassThrough =
    (levers.simCarbonTaxEurT / C.carbonTaxDivisorEurT) *
    C.carbonTaxPassThroughWeight *
    elasticityMag;

  const carbonFactor =
    (1 - (levers.simPlantShiftPct / 100) * C.plantCarbonSlope) *
    (1 - (levers.simWasteCutPct / 100) * C.wasteCarbonSlope) *
    (1 - taxPricePassThrough);
  const newCarbon = +(base.dailyCarbonKg * carbonFactor).toFixed(2);

  const waterFactor =
    (1 - (levers.simPlantShiftPct / 100) * C.plantWaterSlope) *
    (1 - (levers.simWasteCutPct / 100) * C.wasteWaterSlope);
  const newWater = Math.round(base.dailyWaterLiters * waterFactor);

  const landFactor =
    (1 - (levers.simPlantShiftPct / 100) * C.plantLandSlope) *
    (1 - (levers.simWasteCutPct / 100) * C.wasteLandSlope);
  const newLand = +(base.dailyLandM2 * landFactor).toFixed(2);

  const costDeltaPct =
    levers.simPlantShiftPct * C.plantCostPctPerUnit -
    levers.simWasteCutPct * 0.18 +
    (levers.simCarbonTaxEurT / 100) * C.carbonTaxCostPctPer100EurT +
    levers.simUpfReductionPct * C.upfCostPctPerUnit;
  const newCost = +(base.dailyBasketCostEur * (1 + costDeltaPct / 100)).toFixed(2);

  const healthGainPct = Math.min(
    C.healthGainCapPct,
    +(
      levers.simPlantShiftPct * C.plantHealthGainPerUnit +
      levers.simUpfReductionPct * C.upfHealthGainPerUnit +
      (levers.simCarbonTaxEurT / 100) * C.carbonTaxHealthGainPer100EurT
    ).toFixed(1)
  );

  const q1FoodShare = cal?.hbs_q1_food_share_pct ?? 18.3;
  const q5FoodShare = cal?.hbs_q5_food_share_pct ?? 14.4;
  const q1TaxExposureRatio = +(q1FoodShare / Math.max(q5FoodShare, 1)).toFixed(2);

  const q1BudgetImpactPct = +(
    (levers.simCarbonTaxEurT / 100) * 1.9 * q1TaxExposureRatio -
    levers.simPlantShiftPct * 0.04
  ).toFixed(1);
  const q5BudgetImpactPct = +(
    (levers.simCarbonTaxEurT / 100) * 1.4 -
    levers.simPlantShiftPct * 0.02
  ).toFixed(1);

  return {
    data: {
      baselineProfileCode: base.code,
      baselineNature: 'Manually Compiled',
      newCarbon,
      carbonDeltaPct: +(((newCarbon - base.dailyCarbonKg) / base.dailyCarbonKg) * 100).toFixed(1),
      newWater,
      waterDeltaPct: +(((newWater - base.dailyWaterLiters) / base.dailyWaterLiters) * 100).toFixed(1),
      newLand,
      landDeltaPct: +(((newLand - base.dailyLandM2) / base.dailyLandM2) * 100).toFixed(1),
      newCost,
      costDeltaPct: +costDeltaPct.toFixed(1),
      healthGainPct,
      elasticityMag,
      q1TaxExposureRatio,
      q1BudgetImpactPct,
      q5BudgetImpactPct,
      eatLancetSimulated: {
        redMeat: Math.max(
          40,
          Math.round(base.eatLancetIndex.redMeat * (1 - (levers.simPlantShiftPct / 100) * 0.72))
        ),
        dairy: Math.max(
          60,
          Math.round(base.eatLancetIndex.dairy * (1 - (levers.simPlantShiftPct / 100) * 0.35))
        ),
        legumesNuts: Math.min(
          130,
          Math.round(base.eatLancetIndex.legumesNuts * (1 + (levers.simPlantShiftPct / 100) * 1.45))
        ),
        wholeGrains: Math.min(
          115,
          Math.round(base.eatLancetIndex.wholeGrains * (1 + (levers.simUpfReductionPct / 100) * 0.45))
        ),
        vegetablesFruits: Math.min(
          120,
          Math.round(
            base.eatLancetIndex.vegetablesFruits *
              (1 + (levers.simCarbonTaxEurT / 100) * 0.22 + (levers.simUpfReductionPct / 100) * 0.2)
          )
        ),
        ultraProcessedShare: Math.max(
          8,
          Math.round(base.eatLancetIndex.ultraProcessedShare * (1 - levers.simUpfReductionPct / 100))
        ),
      },
      uncertaintyStatus: {
        available: false,
        ci95ForPolicyCarbonShift: null,
        reason:
          'Empirical uncertainty intervals are unavailable for deterministic analyst-defined policy levers (HBS ci95RelHalfwidth measures baseline survey dispersion, not policy effect error).',
      },
      pppStatus: {
        pppNormalized: false,
        note:
          'Scenario cost delta represents unadjusted nominal EUR percentage shift over static baseline assumptions, not Purchasing Power Parity (PPP) rescaling.',
      },
    },
    unit: 'Illustrative policy perturbation summary (non-validated scenario outputs)',
    provenance: {
      module: 'policyScenarioModel.evaluatePolicyScenario',
      version: POLICY_SCENARIO_MODEL_VERSION,
      dataNature: 'Simulated',
      sources: [
        `COUNTRY_PROFILES[${base.code}] (Manually Compiled national baseline)`,
        'ANALYST_POLICY_COEFFICIENTS (analyst_defined_heuristic linear elasticities)',
        cal ? 'econometric_calibration.json (HBS Q1/Q5 food shares & derived Engel elasticity)' : 'Fallback food-share defaults',
      ],
      assumptions: [
        'Linear single-period perturbation responses (0.42 CO2, 0.24 water, 0.48 land, 0.28/0.35 health index) are analyst-defined heuristics for interactive exploration.',
        'Scenario outputs are not statistically calibrated predictions and carry no 95% confidence interval or PPP transformation.',
      ],
    },
    missingness: {
      totalRecords: 1,
      includedRecords: 1,
      missingOrExcludedRecords: 0,
    },
  };
}
