import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  AFFORDABILITY_ENGINE_VERSION,
  type OpenPricesSkuInput,
  aggregateRetailPricesByCategory,
  analyzeHicpInflation,
  checkAffordabilityLayerCompatibility,
  evaluateRetailUnitPrice,
  fromCoHDRecord,
  fromEurostatHicpSeries,
  fromEurostatPppCalibration,
  fromOpenPricesSku,
  refuseSkuPppConversion,
  summarizeCoHDBenchmarks,
} from './affordabilityEngine';

const SKU_250G_LENTILS: OpenPricesSkuInput = {
  barcode: '3229820794589',
  product_name: 'Organic Green Lentils',
  fenomeno_category: 'Lifestyle (Plant-based)',
  price_eur: 2.0,
  currency: 'EUR',
  price_per: 'UNIT',
  product_quantity: 250,
  product_quantity_unit: 'g',
  retailer: 'Carrefour Market',
  country_code: 'FR',
  observed_date: '2026-10-12',
};

const SKU_500ML_OAT_DRINK: OpenPricesSkuInput = {
  barcode: '3760020507350',
  product_name: 'Organic Oat Drink',
  fenomeno_category: 'Organic & Sustainability',
  price_eur: 1.5,
  currency: 'EUR',
  price_per: 'UNIT',
  product_quantity: 500,
  product_quantity_unit: 'ml',
  retailer: 'Biocoop',
  country_code: 'FR',
  observed_date: '2026-10-14',
};

const SKU_MISSING_QTY: OpenPricesSkuInput = {
  barcode: '9999999999999',
  product_name: 'Bakery Item Unknown Weight',
  fenomeno_category: 'Standard Retail Basket',
  price_eur: 3.0,
  currency: 'EUR',
  price_per: 'UNIT',
  product_quantity: null,
  product_quantity_unit: null,
  retailer: 'Alnatura',
  country_code: 'DE',
};

const SKU_GBP_CURRENCY: OpenPricesSkuInput = {
  barcode: '8888888888888',
  product_name: 'UK Retail Pack',
  fenomeno_category: 'Standard Retail Basket',
  price_eur: 2.5,
  currency: 'GBP',
  price_per: 'UNIT',
  product_quantity: 500,
  product_quantity_unit: 'g',
  retailer: 'Tesco',
  country_code: 'GBR',
};

describe('affordabilityEngine (Phase 3D)', () => {
  it('converts retail EUR/kg and EUR/litre cleanly while excluding missing quantities and unsupported currencies', () => {
    const lentils = fromOpenPricesSku(SKU_250G_LENTILS);
    const evalKg = evaluateRetailUnitPrice(lentils, 'per_kg');
    expect(evalKg.computable).toBe(true);
    expect(evalKg.value).toBe(8.0); // EUR 2.00 / 0.25 kg
    expect(evalKg.unit).toBe('EUR / kg');
    expect(evalKg.calculationVersion).toBe(AFFORDABILITY_ENGINE_VERSION);

    // Liquid SKU computes EUR / L, but blocks silent conversion to EUR / kg
    const oat = fromOpenPricesSku(SKU_500ML_OAT_DRINK);
    const evalL = evaluateRetailUnitPrice(oat, 'per_litre');
    expect(evalL.computable).toBe(true);
    expect(evalL.value).toBe(3.0); // EUR 1.50 / 0.5 L
    const evalOatKg = evaluateRetailUnitPrice(oat, 'per_kg');
    expect(evalOatKg.computable).toBe(false);
    expect(evalOatKg.exclusionReason).toBe('incompatible_mass_vs_volume');

    // Missing package quantity must exclude without guessing weight
    const miss = evaluateRetailUnitPrice(fromOpenPricesSku(SKU_MISSING_QTY), 'per_kg');
    expect(miss.computable).toBe(false);
    expect(miss.exclusionReason).toBe('missing_package_quantity');

    // Non-EUR currency excluded
    const gbp = evaluateRetailUnitPrice(fromOpenPricesSku(SKU_GBP_CURRENCY), 'per_kg');
    expect(gbp.computable).toBe(false);
    expect(gbp.exclusionReason).toBe('unsupported_currency');
  });

  it('aggregates observed retail prices by category with explicit denominators and exclusions', () => {
    const skus = [SKU_250G_LENTILS, SKU_500ML_OAT_DRINK, SKU_MISSING_QTY].map(fromOpenPricesSku);
    const aggKg = aggregateRetailPricesByCategory(skus, 'per_kg');
    expect(aggKg.unit).toBe('EUR / kg');
    expect(aggKg.missingness.includedRecords).toBe(1);
    expect(aggKg.missingness.missingOrExcludedRecords).toBe(2);
    expect(aggKg.provenance.dataNature).toBe('Observed');
  });

  it('analyzes HICP inflation indices strictly as non-absolute indices and refuses SKU PPP conversion', () => {
    const hicp = fromEurostatHicpSeries(
      'ES',
      'CP0114',
      'Milk, cheese and eggs',
      { '2015': 100.0, '2025': 142.0 },
      false
    );
    expect(hicp.isAbsolutePrice).toBe(false);

    const analysis = analyzeHicpInflation(hicp, 2015, 2025);
    expect(analysis.data.cumulativeChangePct).toBe(42.0);
    expect(analysis.data.indexPointsDelta).toBe(42.0);
    expect(analysis.data.interpretationWarning).toContain('never interpret an HICP value as an absolute EUR');

    const ppp = fromEurostatPppCalibration('ES', 90.7, 2024);
    expect(ppp.referenceYear).toBe(2024);
    expect(ppp.isPppNotExchangeRate).toBe(true);

    const denied = refuseSkuPppConversion(fromOpenPricesSku(SKU_250G_LENTILS), ppp);
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toContain('2024 PLI=90.7');
  });

  it('summarizes Cost of a Healthy Diet cleanly and flags layer & geographic mismatches', () => {
    const cohdRows = [
      fromCoHDRecord({
        iso3: 'ITA',
        country_name: 'Italy',
        year: 2024,
        cost_healthy_diet_ppp_usd: 4.12,
        unaffordable_pct: 1.5,
        unaffordable_millions: 0.9,
      }),
      fromCoHDRecord({
        iso3: 'ABW',
        country_name: 'Aruba',
        year: 2024,
        cost_healthy_diet_ppp_usd: 5.0,
        unaffordable_pct: null,
        unaffordable_millions: null,
      }),
    ];
    const summary = summarizeCoHDBenchmarks(cohdRows);
    expect(summary.data.validCostDenominator).toBe(2);
    expect(summary.data.validUnaffordDenominator).toBe(1); // null unaffordable_pct not treated as 0
    expect(summary.data.meanCostPppUsd).toBe(4.56);
    expect(summary.data.scopeDisclosure).toContain('ICP PPP USD/person/day');

    const compatLayer = checkAffordabilityLayerCompatibility('retail_sku_eur', 'cohd_ppp_usd_day', 'FR', 'ITA');
    expect(compatLayer.compatible).toBe(false);
    expect(compatLayer.reasons).toHaveLength(2);
  });

  it('validates live scrapling_retail_claims.json package quantity coverage via affordabilityEngine', () => {
    const raw = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/scrapling_retail_claims.json'), 'utf-8')
    ) as OpenPricesSkuInput[];
    const records = raw.map(fromOpenPricesSku);
    const kgSummary = aggregateRetailPricesByCategory(records, 'per_kg');
    const lSummary = aggregateRetailPricesByCategory(records, 'per_litre');
    expect(kgSummary.missingness.totalRecords).toBe(1355);
    expect(kgSummary.missingness.includedRecords).toBe(1036); // 1036 'g' SKUs -> EUR/kg
    expect(lSummary.missingness.includedRecords).toBe(187); // 187 'ml' SKUs -> EUR/L
  });
});
