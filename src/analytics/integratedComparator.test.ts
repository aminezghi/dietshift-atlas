import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { AgribalyseItem, EurostatCountryData, OFFProduct } from '../types/research';
import {
  type OpenPricesSkuInput,
  fromCoHDRecord,
  fromEurostatPppCalibration,
  fromOpenPricesSku,
} from './affordabilityEngine';
import type { ClassificationMappingRecord } from './classificationEngine';
import {
  attemptUnifiedFoodScore,
  buildIntegratedCategoryProfiles,
  rankCategoriesWithinDimension,
} from './integratedComparator';
import { fromOFFProduct } from './nutritionEngine';

describe('integratedComparator (Phase 3D)', () => {
  it('blocks unsupported unified health-environment-affordability composite scores', () => {
    const blocked = attemptUnifiedFoodScore({ nutrition: 80, environment: 1.5, affordability: 4.2 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('incompatible units');
  });

  it('builds traceable integrated category profiles across live classification, nutrition, LCA, HICP, PPP & CoHD datasets', () => {
    const mappings = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/classification_mappings.json'), 'utf-8')
    ) as ClassificationMappingRecord[];
    const offRaw = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/off_expanded_rows.json'), 'utf-8')
    ) as OFFProduct[];
    const agbRaw = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/agribalyse_full.json'), 'utf-8')
    ) as AgribalyseItem[];
    const scraplingRaw = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/scrapling_retail_claims.json'), 'utf-8')
    ) as OpenPricesSkuInput[];
    const bundleRaw = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/live_research_bundle.json'), 'utf-8')
    ) as { eurostat: Record<string, EurostatCountryData> };
    const globRaw = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/global_benchmarks.json'), 'utf-8')
    ) as { cohd_latest_by_country: Array<{ iso3: string; country_name: string; year: number; cost_healthy_diet_ppp_usd: number; unaffordable_pct: number | null; unaffordable_millions: number | null }> };

    const esCohd = globRaw.cohd_latest_by_country.find((c) => c.iso3 === 'ESP')!;
    const workspace = buildIntegratedCategoryProfiles({
      mappings,
      nutritionInputs: offRaw.map(fromOFFProduct),
      agribalyseItems: agbRaw,
      retailPriceRecords: scraplingRaw.map(fromOpenPricesSku),
      hicpCountryCode: 'ES',
      hicpData: bundleRaw.eurostat.ES,
      isHicpEuFallback: false,
      pppBenchmark: fromEurostatPppCalibration('ES', 90.7, 2024),
      cohdLatest: fromCoHDRecord(esCohd),
    });

    expect(workspace.provenance.dataNature).toBe('Mixed');
    expect(workspace.data.supportSummary.ambiguous_split).toBeGreaterThan(0);
    expect(workspace.data.supportSummary.unsupported_unmatched).toBeGreaterThan(0);
    expect(workspace.data.countryAffordabilityContext.macroBoundaryWarning).toContain('never single product shelf prices');

    // Verify ambiguous category preserves candidate splits visibly
    const fnv = workspace.data.profiles.find((p) => p.categoryId === 'OFF:Fresh & Frozen Vegetables & Fruits');
    expect(fnv?.supportLevel).toBe('ambiguous_split');
    expect(fnv?.classificationEvidence.ambiguousNotes.length).toBeGreaterThan(0);
    expect(fnv?.environmentPerKg?.dataNature).toBe('Model Output');
    expect(fnv?.nutritionPer100g?.dataNature).toBe('Observed');

    // Verify unmatched macro COICOP gap surfaces without fabricated OFF nutrition or Agribalyse LCA
    const cp0115Gap = workspace.data.profiles.find((p) => p.categoryId === 'COICOP:CP0115');
    expect(cp0115Gap?.supportLevel).toBe('unsupported_unmatched');
    expect(cp0115Gap?.nutritionPer100g).toBeNull();
    expect(cp0115Gap?.environmentPerKg).toBeNull();

    // Verify single-dimension ranking works cleanly and excludes missing rows rather than zero-filling
    const rankClimate = rankCategoriesWithinDimension(workspace.data.profiles, 'agb_climate_co2eq_per_kg', true);
    expect(rankClimate.data.length).toBe(11); // 11 OFF categories map via COICOP; 2 unmatched COICOP gaps excluded
    expect(rankClimate.data[0].dataNature).toBe('Model Output');
    expect(rankClimate.data[0].unit).toBe('kg CO2eq / kg');
    expect(rankClimate.missingness.missingOrExcludedRecords).toBe(2);
  });
});
