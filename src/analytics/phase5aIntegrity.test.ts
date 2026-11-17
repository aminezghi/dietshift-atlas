import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ENVIRONMENT_INDICATOR_SPECS } from './environmentEngine';
import {
  buildBiomarkerChartSeries,
  buildCulturalInertiaChartSeries,
  buildTimeUseChartSeries,
} from './microdataViewHelper';
import { filterProductsWithNovaAudit } from './nutritionEngine';
import {
  ANALYST_POLICY_COEFFICIENTS,
  evaluatePolicyScenario,
} from './policyScenarioModel';
import {
  fromAgribalyseToBasketItem,
  parseSurveyCsvRows,
  serializeBasketCsv,
  summarizeCustomBasket,
} from './sandboxLedger';
import { COUNTRY_PROFILES, type AgribalyseItem, type OFFProduct } from '../types/research';

describe('Phase 5A Scientific Integrity & Communication Regressions', () => {
  it('C-01: preserves AWARE m3 eq and PEF Pt units without conversion or hardcoded nutrition/cost on Agribalyse & CSV imports', () => {
    const sampleAgb: AgribalyseItem = {
      Code_AGB: 'AGB_TEST_1',
      LCI_Name: 'Beef steak, grilled',
      Groupe_aliment: 'viandes, œufs, poissons',
      Score_unique_EF: 2.5,
      Changement_climatique_kg_CO2eq: 25.0,
      Eau_m3: 1.5, // AWARE deprivation-weighted m3 world-eq / kg
      Sol_Pt: 12.0, // PEF Land Use Pt / kg
      Eutrophisation_terrestre: 0.1,
    };

    const imported = fromAgribalyseToBasketItem(sampleAgb);
    expect(imported.gramsPerDay).toBe(85);
    expect(imported.kcalPer100g).toBeNull();
    expect(imported.proteinPer100g).toBeNull();
    expect(imported.costEurPerKg).toBeNull();
    expect(imported.novaGroup).toBeNull();
    expect(imported.waterM3PerKg).toBe(1.5);
    expect(imported.landPtPerKg).toBe(12.0);
    expect(imported.sourceNatureTag).toBe('Model Output');

    // CSV import with blank optional columns keeps them strictly NULL (never 100/1.8/0.25/2.0/140/6.5/4.5)
    const csvParsed = parseSurveyCsvRows([
      {
        food_name: 'Dry chickpeas',
        category: 'Legumes & Nuts',
        grams_per_day: '200',
        nova_group: '',
        carbon_kg_per_kg: '0.8',
        water_aware_m3_per_kg: '',
        land_pt_per_kg: '',
        kcal_100g: '',
        protein_100g: '',
        cost_eur_per_kg: '',
      },
      {
        food_name: 'Invalid zero mass',
        grams_per_day: '',
      },
    ]);
    expect(csvParsed.skippedInvalidGramsCount).toBe(1);
    expect(csvParsed.importedMissingFieldCount).toBe(6);
    expect(csvParsed.items).toHaveLength(1);
    expect(csvParsed.items[0].kcalPer100g).toBeNull();
    expect(csvParsed.items[0].costEurPerKg).toBeNull();
    expect(csvParsed.items[0].waterM3PerKg).toBeNull();

    // Summarize basket consisting strictly of 1000g/d imported Agribalyse item -> 1.5 m3 eq, 12.0 Pt (never 1500 L or 3.0 m2!)
    const fullKgAgb = { ...imported, gramsPerDay: 1000 };
    const summary = summarizeCustomBasket([fullKgAgb], COUNTRY_PROFILES.IT);
    expect(summary.data.totalCarbonKg).toBe(25.0);
    expect(summary.data.totalWaterAwareM3).toBe(1.5);
    expect(summary.data.totalLandPt).toBe(12.0);
    expect(summary.data.totalKcal).toBeNull();
    expect(summary.data.totalProteinG).toBeNull();
    expect(summary.data.totalCostEur).toBeNull();
    expect(summary.data.upfSharePct).toBeNull();

    const csvOut = serializeBasketCsv([fullKgAgb]);
    expect(csvOut).toContain('water_aware_m3_per_kg');
    expect(csvOut).not.toContain('NaN');
  });

  it('C-02: policy scenario separates analyst heuristic coefficients and blocks fabricated 95% CI and PPP claims', () => {
    expect(ANALYST_POLICY_COEFFICIENTS.assumptionOrigin).toBe('analyst_defined_heuristic');
    const res = evaluatePolicyScenario(
      COUNTRY_PROFILES.IT,
      { empirical_own_price_elasticity: -0.62, hbs_q1_food_share_pct: 18.3, hbs_q5_food_share_pct: 14.4 },
      { simPlantShiftPct: 35, simUpfReductionPct: 25, simCarbonTaxEurT: 50, simWasteCutPct: 20 }
    );
    expect(res.data.baselineNature).toBe('Manually Compiled');
    expect(res.data.uncertaintyStatus.available).toBe(false);
    expect(res.data.uncertaintyStatus.ci95ForPolicyCarbonShift).toBeNull();
    expect(res.data.pppStatus.pppNormalized).toBe(false);
    expect(res.provenance.dataNature).toBe('Simulated');
  });

  it('H-04: microdata chart builders strictly enforce homogeneous single-unit axes', () => {
    const timeRows = [
      {
        country_code: 'IT',
        country_name: 'Italy',
        income_quintile: 'Q3 (Median)',
        daily_cooking_food_prep_min: 62,
        convenience_food_expenditure_share_pct: 28,
      },
    ];
    const tCook = buildTimeUseChartSeries(timeRows, 'cooking_min_day');
    const tSpend = buildTimeUseChartSeries(timeRows, 'convenience_spend_pct');
    expect(tCook.mixedUnitsPresent).toBe(false);
    expect(tCook.unit).toBe('min/d');
    expect(tSpend.mixedUnitsPresent).toBe(false);
    expect(tSpend.unit).toBe('%');

    const bioRows = [
      {
        dietary_pattern: 'Q5 (NHANES)',
        total_cholesterol_mg_dl: 188.5,
        non_hdl_cholesterol_mg_dl: 133.6,
        hs_crp_inflammation_mg_l: 2.94,
        systolic_bp_mmhg: 119.6,
        cardiovascular_risk_delta_pct: -5.4,
      },
    ];
    for (const mode of ['lipids_mg_dl', 'hs_crp_mg_l', 'systolic_bp_mmhg', 'cvd_risk_delta_pct'] as const) {
      const b = buildBiomarkerChartSeries(bioRows, mode);
      expect(b.mixedUnitsPresent).toBe(false);
      expect(new Set(b.series.map((s) => s.unit)).size).toBe(1);
    }
    const lipids = buildBiomarkerChartSeries(bioRows, 'lipids_mg_dl');
    expect(lipids.series.map((s) => s.name).join(' ')).not.toContain('LDL');

    const cult = buildCulturalInertiaChartSeries(
      [
        {
          country_code: 'IT',
          country_name: 'Italy',
          climate_worry_score_pct: 82.4,
          cultural_culinary_inertia_index: 84.5,
          actual_plant_basket_penetration_pct: 14.2,
        },
      ],
      'inertia_index_100'
    );
    expect(cult.mixedUnitsPresent).toBe(false);
    expect(cult.unit).toBe('index (0-100)');
  });

  it('H-05: NOVA filter never silently drops NULL-NOVA products and tracks exclusions transparently', () => {
    const sample: OFFProduct[] = [
      { code: '1', name: 'Oats', brand: 'A', category: 'Grains', nutriscore_grade: 'A', nutriscore_score: -5, ecoscore_grade: 'A', ecoscore_score: 85, nova_group: 1, primary_country: 'FR', proteins_100g: 12, energy_kcal_100g: 370, fiber_100g: 10, salt_100g: 0.01 },
      { code: '2', name: 'Soda', brand: 'B', category: 'Drinks', nutriscore_grade: 'E', nutriscore_score: 20, ecoscore_grade: null, ecoscore_score: null, nova_group: 4, primary_country: 'FR', proteins_100g: 0, energy_kcal_100g: 42, fiber_100g: 0, salt_100g: 0.02 },
      { code: '3', name: 'Unclassified Tofu', brand: 'C', category: 'Legumes', nutriscore_grade: 'A', nutriscore_score: -3, ecoscore_grade: null, ecoscore_score: null, nova_group: null, primary_country: 'FR', proteins_100g: 14, energy_kcal_100g: 120, fiber_100g: 2, salt_100g: 0.1 },
    ];

    const withMissing = filterProductsWithNovaAudit(sample, {
      selectedCategory: 'ALL',
      selectedNova: [1],
      includeMissingNova: true,
      searchQuery: '',
    });
    expect(withMissing.filtered.map((p) => p.code)).toEqual(['1', '3']);
    expect(withMissing.missingNovaMatchedCount).toBe(1);
    expect(withMissing.excludedMissingNovaCount).toBe(0);
    expect(withMissing.excludedNonMatchingNovaCount).toBe(1);

    const withoutMissing = filterProductsWithNovaAudit(sample, {
      selectedCategory: 'ALL',
      selectedNova: [1],
      includeMissingNova: false,
      searchQuery: '',
    });
    expect(withoutMissing.filtered.map((p) => p.code)).toEqual(['1']);
    expect(withoutMissing.excludedMissingNovaCount).toBe(1);
  });

  it('H-02 & H-03: verifies Agribalyse AWARE/PEF specs and ensures zero stale TimesFM or 3,740 OFF claims in public docs & UI', () => {
    expect(ENVIRONMENT_INDICATOR_SPECS.water_aware_m3.unit).toContain('world eq');
    expect(ENVIRONMENT_INDICATOR_SPECS.land_ef_pt.unit).toContain('Pt');

    const root = process.cwd();
    const filesToCheck = [
      'README.md',
      'src/App.tsx',
      'public/public_guide.html',
      'public/architecture_blueprint.html',
      'public/floorplan.html',
    ];
    for (const rel of filesToCheck) {
      const content = fs.readFileSync(path.join(root, rel), 'utf-8');
      expect(content).not.toMatch(/TimesFM/i);
      expect(content).not.toMatch(/ml_timesfm_forecasts/);
      expect(content).not.toMatch(/\b3,740\b/);
      expect(content).not.toMatch(/\b9 ZSTD\b/);
      expect(content).not.toMatch(/\b11 Parquet\b/);
    }
  });
});
