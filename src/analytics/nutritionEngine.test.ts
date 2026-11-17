import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { OFFProduct } from '../types/research';
import {
  NUTRITION_ENGINE_VERSION,
  type ScraplingNutritionShape,
  type StandardizedNutritionInput,
  aggregateNutritionByCategory,
  convertEnergyKjToKcal,
  convertMassUnit,
  evaluateProductNutrition,
  fromOFFProduct,
  fromScraplingProduct,
  parseServingSize,
  summarizeNutrientMetric,
  summarizeNutritionDataset,
} from './nutritionEngine';

const COMPLETE_LENTILS: StandardizedNutritionInput = {
  productId: 'TEST_001',
  barcode: '3017620422003',
  name: 'Cooked Green Lentils',
  category: 'Legumes, Pulses & Tofu',
  sourceDataset: 'test_fixture',
  sourceRecordRef: 'test:001',
  dataNature: 'Observed',
  servingQuantityG: 150,
  servingSizeLabel: '150 g',
  per100g: {
    energy_kcal: 250,
    proteins_g: 15,
    carbohydrates_g: 30,
    sugars_g: 2,
    fat_g: 4,
    saturated_fat_g: 0.5,
    fiber_g: 10,
    salt_g: 0.25,
  },
};

const ZERO_SUGAR_PARTIAL_WATER: StandardizedNutritionInput = {
  productId: 'TEST_002',
  barcode: '3017620422004',
  name: 'Zero Sugar Herbal Infusion',
  category: 'Legumes, Pulses & Tofu',
  sourceDataset: 'test_fixture',
  sourceRecordRef: 'test:002',
  dataNature: 'Observed',
  servingQuantityG: null,
  servingSizeLabel: '250 ml',
  per100g: {
    energy_kcal: 0,
    proteins_g: 0,
    carbohydrates_g: null,
    sugars_g: 0,
    fat_g: 0,
    saturated_fat_g: null,
    fiber_g: null,
    salt_g: null,
  },
};

const MISSING_NUTRITION_SKU: StandardizedNutritionInput = {
  productId: 'TEST_003',
  barcode: '3017620422005',
  name: 'Unmatched Shelf Receipt SKU',
  category: 'Fresh & Frozen Vegetables & Fruits',
  sourceDataset: 'test_fixture',
  sourceRecordRef: 'test:003',
  dataNature: 'Observed',
  servingQuantityG: null,
  servingSizeLabel: '1 handful',
  per100g: {
    energy_kcal: null,
    proteins_g: null,
    carbohydrates_g: null,
    sugars_g: null,
    fat_g: null,
    saturated_fat_g: null,
    fiber_g: null,
    salt_g: null,
  },
};

describe('nutritionEngine (Phase 3B)', () => {
  it('converts mass units and kJ to kcal accurately', () => {
    expect(convertMassUnit(500, 'mg', 'g')).toBe(0.5);
    expect(convertMassUnit(0.25, 'kg', 'g')).toBe(250);
    expect(convertMassUnit(-5, 'g', 'kg')).toBeNull();
    expect(convertEnergyKjToKcal(1046)).toBe(250);
    expect(convertEnergyKjToKcal(null)).toBeNull();
  });

  it('validates serving sizes strictly without assuming defaults on missing or invalid labels', () => {
    const obs = parseServingSize(40, '40 g');
    expect(obs.grams).toBe(40);
    expect(obs.provenance).toBe('observed_mass_grams');
    expect(obs.invalidReason).toBeNull();

    const massParsed = parseServingSize(null, '0.05 kg');
    expect(massParsed.grams).toBe(50);
    expect(massParsed.provenance).toBe('parsed_mass_unit');

    const volParsed = parseServingSize(null, '250 ml');
    expect(volParsed.grams).toBe(250);
    expect(volParsed.provenance).toBe('parsed_volume_1g_ml_assumption');
    expect(volParsed.assumptionNote).toContain('1.0 g/ml');

    const missing = parseServingSize(null, null);
    expect(missing.grams).toBeNull();
    expect(missing.invalidReason).toBe('missing_serving_quantity');

    const invalid = parseServingSize(null, '1 medium portion');
    expect(invalid.grams).toBeNull();
    expect(invalid.invalidReason).toBe('invalid_serving_quantity');

    const nonPos = parseServingSize(0, '0 g');
    expect(nonPos.grams).toBeNull();
    expect(nonPos.invalidReason).toBe('invalid_serving_quantity');
  });

  it('evaluates per 100g, per 100kcal, and per serving with known numerical references and provenance', () => {
    // Per 100g
    const p100g = evaluateProductNutrition(COMPLETE_LENTILS, 'per_100g');
    expect(p100g.completeness).toBe('complete');
    expect(p100g.computableForBasis).toBe(true);
    expect(p100g.values.proteins_g.value).toBe(15);
    expect(p100g.values.proteins_g.valueKind).toBe('observed');
    expect(p100g.values.proteins_g.unit).toBe('g/100g');
    expect(p100g.calculationVersion).toBe(NUTRITION_ENGINE_VERSION);

    // Per 100 kcal: (15 / 250) * 100 = 6 g/100kcal; (10 / 250) * 100 = 4 g/100kcal
    const p100kcal = evaluateProductNutrition(COMPLETE_LENTILS, 'per_100kcal');
    expect(p100kcal.computableForBasis).toBe(true);
    expect(p100kcal.values.energy_kcal.value).toBe(100);
    expect(p100kcal.values.proteins_g.value).toBe(6);
    expect(p100kcal.values.fiber_g.value).toBe(4);
    expect(p100kcal.values.salt_g.value).toBe(0.1);
    expect(p100kcal.values.proteins_g.valueKind).toBe('derived');
    expect(p100kcal.values.proteins_g.originalPer100gValue).toBe(15);
    expect(p100kcal.values.proteins_g.originalUnit).toBe('g/100g');
    expect(p100kcal.values.proteins_g.transformation).toContain('15 g/100g / 250 kcal/100g');

    // Per serving (150g): 1.5x per 100g -> 375 kcal, 22.5 g protein, 15 g fiber
    const pServ = evaluateProductNutrition(COMPLETE_LENTILS, 'per_serving');
    expect(pServ.computableForBasis).toBe(true);
    expect(pServ.values.energy_kcal.value).toBe(375);
    expect(pServ.values.proteins_g.value).toBe(22.5);
    expect(pServ.values.fiber_g.value).toBe(15);
    expect(pServ.values.proteins_g.unit).toBe('g/serving');
    expect(pServ.barcode).toBe('3017620422003');
    expect(pServ.sourceRecordRef).toBe('test:001');
  });

  it('distinguishes genuine zeros from missing NULLs and excludes zero/missing energy and invalid servings', () => {
    // ZERO_SUGAR_PARTIAL_WATER has 4 non-null fields (0 counts as observed!), 4 missing fields -> partial
    const p100g = evaluateProductNutrition(ZERO_SUGAR_PARTIAL_WATER, 'per_100g');
    expect(p100g.completeness).toBe('partial');
    expect(p100g.presentNutrientCount).toBe(4);
    expect(p100g.missingNutrientCount).toBe(4);
    expect(p100g.values.sugars_g.value).toBe(0);
    expect(p100g.values.sugars_g.valueKind).toBe('observed');
    expect(p100g.values.fiber_g.value).toBeNull();
    expect(p100g.values.fiber_g.valueKind).toBe('missing');

    // Energy = 0 -> excluded from per_100kcal
    const p100kcal = evaluateProductNutrition(ZERO_SUGAR_PARTIAL_WATER, 'per_100kcal');
    expect(p100kcal.computableForBasis).toBe(false);
    expect(p100kcal.basisExclusionReason).toBe('non_positive_energy');
    expect(p100kcal.values.proteins_g.value).toBeNull();
    expect(p100kcal.values.proteins_g.valueKind).toBe('excluded');

    // Missing energy & unparseable serving
    const missing100kcal = evaluateProductNutrition(MISSING_NUTRITION_SKU, 'per_100kcal');
    expect(missing100kcal.completeness).toBe('missing');
    expect(missing100kcal.basisExclusionReason).toBe('missing_energy');

    const invalidServing = evaluateProductNutrition(MISSING_NUTRITION_SKU, 'per_serving');
    expect(invalidServing.computableForBasis).toBe(false);
    expect(invalidServing.basisExclusionReason).toBe('invalid_serving_quantity');
  });

  it('aggregates metrics and categories using explicit non-missing denominators', () => {
    const dataset = [COMPLETE_LENTILS, ZERO_SUGAR_PARTIAL_WATER, MISSING_NUTRITION_SKU];

    // On per_100g sugars: TEST_001 has 2, TEST_002 has 0, TEST_003 is NULL -> mean = (2 + 0) / 2 = 1.0 (denominator n=2)
    const sugarsSummary = summarizeNutrientMetric(dataset, 'sugars_g', 'per_100g');
    expect(sugarsSummary.data.validDenominator).toBe(2);
    expect(sugarsSummary.data.missingOrExcludedCount).toBe(1);
    expect(sugarsSummary.data.mean).toBe(1);
    expect(sugarsSummary.data.median).toBe(1);
    expect(sugarsSummary.missingness.includedRecords).toBe(2);

    // On per_100g fiber: only TEST_001 has fiber=10; TEST_002 & TEST_003 are NULL -> mean = 10 (denominator n=1)
    const fiberSummary = summarizeNutrientMetric(dataset, 'fiber_g', 'per_100g');
    expect(fiberSummary.data.validDenominator).toBe(1);
    expect(fiberSummary.data.mean).toBe(10);

    // Category aggregation preserves completeness breakdown and disclosure
    const cats = aggregateNutritionByCategory(dataset, 'per_100g', ['proteins_g', 'fiber_g']);
    expect(cats.data).toHaveLength(2);
    const legumes = cats.data.find((c) => c.category === 'Legumes, Pulses & Tofu')!;
    expect(legumes.totalCategoryRecords).toBe(2);
    expect(legumes.completenessBreakdown).toEqual({ complete: 1, partial: 1, missing: 0 });
    expect(legumes.metrics.proteins_g?.validDenominator).toBe(2);
    expect(legumes.metrics.proteins_g?.mean).toBe(7.5); // (15 + 0) / 2
    expect(legumes.metrics.fiber_g?.validDenominator).toBe(1);
    expect(legumes.metrics.fiber_g?.mean).toBe(10);
    expect(legumes.categoryDisclosure).toContain("does not represent any single barcode's observed composition");
  });

  it('integrates with live openfoodfacts and scrapling JSON adapters preserving missingness', () => {
    const offRaw = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/off_expanded_rows.json'), 'utf-8')
    ) as OFFProduct[];
    const offInputs = offRaw.map(fromOFFProduct);
    const offServ = summarizeNutritionDataset(offInputs, 'per_serving');
    // Search-a-licious extract has 0 verified serving sizes -> must exclude all rather than assume defaults
    expect(offServ.data.totalRecords).toBe(3197);
    expect(offServ.data.computableForBasisRecords).toBe(0);
    expect(offServ.data.exclusionReasons.missing_serving_quantity).toBe(3197);

    const offKcal = summarizeNutritionDataset(offInputs, 'per_100kcal');
    expect(offKcal.data.computableForBasisRecords).toBeGreaterThan(3000);

    const scrRaw = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/scrapling_retail_claims.json'), 'utf-8')
    ) as ScraplingNutritionShape[];
    const scrCov = summarizeNutritionDataset(scrRaw.map(fromScraplingProduct), 'per_100g');
    expect(scrCov.data.totalRecords).toBe(1355);
    expect(scrCov.data.completenessBreakdown.missing).toBe(324);
  });
});
