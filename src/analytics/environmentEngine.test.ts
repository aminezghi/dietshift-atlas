import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { AgribalyseItem } from '../types/research';
import {
  ENVIRONMENT_ENGINE_VERSION,
  ENVIRONMENT_INDICATOR_SPECS,
  ENVIRONMENT_SOURCE_METADATA,
  type GITerroirInput,
  type PooreLcaInput,
  aggregateEnvironmentByCategory,
  attemptCompositeScore,
  checkEnvironmentCompatibility,
  compareEnvironmentRecords,
  filterFoodEligibleEnvironmentRecords,
  fromAgribalyseItem,
  fromGITerroirItem,
  fromPooreNemecekItem,
} from './environmentEngine';

const SAMPLE_AGB_STOCK: AgribalyseItem = {
  Code_AGB: '11172',
  Code_CIQUAL: '11172',
  LCI_Name: 'Aromatic stock cube, for fish, dehydrated',
  Groupe_aliment: 'aides culinaires et ingrédients divers',
  Sous_groupe_aliment: 'aides culinaires',
  Changement_climatique_kg_CO2eq: 7.58,
  Eau_m3: 3.38,
  Sol_Pt: 106.0,
  Acidification: 0.0456,
  Eutrophisation_terrestre: 0.137,
  Score_unique_EF: 1.87,
};

const SAMPLE_AGB_BEEF: AgribalyseItem = {
  Code_AGB: '6111',
  Code_CIQUAL: '6111',
  LCI_Name: 'Beef, sirloin steak, raw',
  Groupe_aliment: 'viandes, œufs, poissons',
  Sous_groupe_aliment: 'viandes crues',
  Changement_climatique_kg_CO2eq: 28.4,
  Eau_m3: 0.55,
  Sol_Pt: 1420.0,
  Acidification: 0.21,
  Eutrophisation_terrestre: 0.91,
  Score_unique_EF: 2.31,
};

const SAMPLE_POORE_BEEF: PooreLcaInput = {
  food_item: 'Beef (beef herd)',
  ghg_kg_co2eq_per_kg: 99.48,
  ghg_kg_per_100g_protein: 49.89,
  ghg_kg_per_1000kcal: 36.44,
  land_use_m2_per_kg: 326.21,
  freshwater_withdrawals_l_per_kg: 1451.2,
  scarcity_water_l_per_kg: 34732.5,
  eutrophying_g_po4_per_kg: 301.41,
};

const SAMPLE_POORE_COFFEE_MISSING_PROTEIN: PooreLcaInput = {
  food_item: 'Coffee',
  ghg_kg_co2eq_per_kg: 28.53,
  ghg_kg_per_100g_protein: null,
  ghg_kg_per_1000kcal: null,
  land_use_m2_per_kg: 21.62,
  freshwater_withdrawals_l_per_kg: 25.9,
  scarcity_water_l_per_kg: 337.0,
  eutrophying_g_po4_per_kg: 110.52,
};

const SAMPLE_GI_CHEESE: GITerroirInput = {
  gi_id: 'IT_PDO_001',
  product_name: 'Parmigiano Reggiano',
  country_code: 'IT',
  gi_scheme: 'PDO',
  product_sector: 'FOOD',
  eu_class: 'Class 1.3 Cheeses & Dairy Ferments',
  co2_kg_per_kg: 11.4,
  water_L_per_kg: 4650,
  land_m2_per_kg: 24.5,
  foodex2_code: 'A02QE',
  data_source: 'EUIPO GIview',
};

describe('environmentEngine (Phase 3C)', () => {
  it('preserves original identifiers, indicators, boundaries, geography, and provenance', () => {
    const agb = fromAgribalyseItem(SAMPLE_AGB_STOCK);
    expect(agb.recordId).toBe('AGB:11172');
    expect(agb.secondaryCode).toBe('11172');
    expect(agb.sourceId).toBe('agribalyse_31');
    expect(agb.dataNature).toBe('Model Output');
    expect(agb.isClassProxy).toBe(false);
    expect(agb.geography).toContain('France');
    expect(agb.systemBoundary).toContain('Cradle-to-consumer');
    expect(agb.metrics.climate_co2eq).toBe(7.58);
    expect(agb.metrics.water_aware_m3).toBe(3.38);
    expect(agb.metrics.land_ef_pt).toBe(106.0);
    expect(agb.calculationVersion).toBe(ENVIRONMENT_ENGINE_VERSION);

    const poore = fromPooreNemecekItem(SAMPLE_POORE_BEEF);
    expect(poore.recordId).toBe('POORE:Beef (beef herd)');
    expect(poore.dataNature).toBe('Estimated');
    expect(poore.geography).toContain('Global');
    expect(poore.systemBoundary).toContain('Farm-to-retail');
    expect(poore.metrics.ghg_per_kg).toBe(99.48);
    expect(poore.metrics.ghg_per_100g_protein).toBe(49.89);
    expect(poore.metrics.land_use_m2).toBe(326.21);
  });

  it('discloses GI class proxies explicitly as Estimated rather than measured LCA', () => {
    const gi = fromGITerroirItem(SAMPLE_GI_CHEESE);
    expect(gi.recordId).toBe('GI:IT_PDO_001');
    expect(gi.dataNature).toBe('Estimated');
    expect(gi.isClassProxy).toBe(true);
    expect(gi.proxyMethodNote).toContain('not a measured LCA');
    expect(ENVIRONMENT_SOURCE_METADATA.gi_terroir_proxy.isClassProxy).toBe(true);
  });

  it('allows direct comparison within same source/unit/boundary and blocks incompatible comparisons', () => {
    // 1. Direct compatible: Agribalyse climate vs Agribalyse climate
    const agbDirect = checkEnvironmentCompatibility('climate_co2eq', 'climate_co2eq');
    expect(agbDirect.compatibleForDirectComparison).toBe(true);
    expect(agbDirect.comparabilityLevel).toBe('direct');

    // 2. Boundary incompatibility: Agribalyse climate vs Poore & Nemecek climate
    const crossClimate = checkEnvironmentCompatibility('climate_co2eq', 'ghg_per_kg');
    expect(crossClimate.compatibleForDirectComparison).toBe(false);
    expect(crossClimate.comparabilityLevel).toBe('cautionary_cross_boundary');
    expect(crossClimate.incompatibilityReasons.join(' ')).toContain('Different system boundaries');

    // 3. Unit & definition incompatibility: AWARE m3/kg vs unweighted freshwater L/kg
    const waterIncompat = checkEnvironmentCompatibility('water_aware_m3', 'freshwater_withdrawals_l');
    expect(waterIncompat.compatibleForDirectComparison).toBe(false);
    expect(waterIncompat.comparabilityLevel).toBe('incompatible');
    expect(waterIncompat.requirementsToEnableComparison.join(' ')).toContain('AWARE');

    // 4. Land unit incompatibility: EF Pt/kg vs physical m2/kg
    const landIncompat = checkEnvironmentCompatibility('land_ef_pt', 'land_use_m2');
    expect(landIncompat.compatibleForDirectComparison).toBe(false);
    expect(landIncompat.comparabilityLevel).toBe('incompatible');
    expect(landIncompat.requirementsToEnableComparison.join(' ')).toContain('LANCA');

    // 5. Functional unit incompatibility: per kg vs per 100g protein
    const fnUnitIncompat = checkEnvironmentCompatibility('ghg_per_kg', 'ghg_per_100g_protein');
    expect(fnUnitIncompat.compatibleForDirectComparison).toBe(false);
    expect(fnUnitIncompat.comparabilityLevel).toBe('incompatible');

    // 6. Proxy vs measured incompatibility: Agribalyse CO2 vs GI proxy CO2
    const proxyIncompat = checkEnvironmentCompatibility('climate_co2eq', 'gi_proxy_co2_kg');
    expect(proxyIncompat.compatibleForDirectComparison).toBe(false);
    expect(proxyIncompat.comparabilityLevel).toBe('incompatible');
  });

  it('compares records side-by-side cleanly while blocking invalid numeric deltas', () => {
    const agbStock = fromAgribalyseItem(SAMPLE_AGB_STOCK);
    const agbBeef = fromAgribalyseItem(SAMPLE_AGB_BEEF);
    const validDiff = compareEnvironmentRecords(agbBeef, 'climate_co2eq', agbStock, 'climate_co2eq');
    expect(validDiff.data.numericDifference).toBe(20.82); // 28.4 - 7.58
    expect(validDiff.data.differenceBlockedReason).toBeNull();

    const pooreBeef = fromPooreNemecekItem(SAMPLE_POORE_BEEF);
    const blocked = compareEnvironmentRecords(agbBeef, 'climate_co2eq', pooreBeef, 'ghg_per_kg');
    expect(blocked.data.numericDifference).toBeNull();
    expect(blocked.data.differenceBlockedReason).toContain('system boundaries');
    // Original values are still preserved side-by-side!
    expect(blocked.data.sideA.value).toBe(28.4);
    expect(blocked.data.sideB.value).toBe(99.48);
  });

  it('rejects arbitrary CO2 + water + land composite scores without published normalized weights', () => {
    const denied = attemptCompositeScore({ climate_co2eq: 10, water_aware_m3: 2, land_ef_pt: 50 });
    expect(denied.allowed).toBe(false);

    const badSum = attemptCompositeScore(
      { climate_co2eq: 0.4, water_aware_m3: 0.2 },
      { methodName: 'Custom', weights: { climate_co2eq: 0.5, water_aware_m3: 0.2 } }
    );
    expect(badSum.allowed).toBe(false);

    // Known published composite: Agribalyse native Score_unique_EF is flagged
    expect(ENVIRONMENT_INDICATOR_SPECS.ef_single_score.isCompositeMethod).toBe(true);
  });

  it('handles missing values properly and excludes cross-source records in category aggregation', () => {
    const records = [
      fromPooreNemecekItem(SAMPLE_POORE_BEEF),
      fromPooreNemecekItem(SAMPLE_POORE_COFFEE_MISSING_PROTEIN),
      fromAgribalyseItem(SAMPLE_AGB_STOCK), // different source -> must be excluded from Poore aggregation
    ];

    const proteinGhg = aggregateEnvironmentByCategory(records, 'ghg_per_100g_protein');
    expect(proteinGhg.data).toHaveLength(1);
    const cat = proteinGhg.data[0];
    expect(cat.totalRecords).toBe(2);
    expect(cat.validDenominator).toBe(1); // Coffee has NULL ghg_per_100g_protein -> not counted as 0
    expect(cat.missingCount).toBe(1);
    expect(cat.mean).toBe(49.89);
    expect(proteinGhg.missingness.missingOrExcludedRecords).toBe(2); // 1 null + 1 cross-source excluded
  });

  it('validates regression examples and missingness across live Agribalyse, Poore & Nemecek, and GI bundles', () => {
    const agbRaw = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/agribalyse_full.json'), 'utf-8')
    ) as AgribalyseItem[];
    const agbRecords = agbRaw.map(fromAgribalyseItem);
    expect(agbRecords).toHaveLength(2451);

    const stock = agbRecords.find((r) => r.recordId === 'AGB:11172');
    expect(stock?.metrics.climate_co2eq).toBe(7.58);
    expect(stock?.metrics.water_aware_m3).toBe(3.38);

    const agbAgg = aggregateEnvironmentByCategory(agbRecords, 'climate_co2eq');
    expect(agbAgg.missingness.includedRecords).toBe(2451);

    const globRaw = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/global_benchmarks.json'), 'utf-8')
    ) as { poore_nemecek_lca: PooreLcaInput[] };
    const pooreRecords = globRaw.poore_nemecek_lca.map(fromPooreNemecekItem);
    expect(pooreRecords).toHaveLength(45);
    const protAgg = aggregateEnvironmentByCategory(pooreRecords, 'ghg_per_100g_protein');
    expect(protAgg.data[0].validDenominator).toBe(32); // 13 genuine NULLs preserved
    expect(protAgg.data[0].missingCount).toBe(13);

    const giBundle = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/gi_terroir_bundle.json'), 'utf-8')
    ) as { gi_terroir_records: GITerroirInput[] };
    const allGi = giBundle.gi_terroir_records.map(fromGITerroirItem);
    const giFilter = filterFoodEligibleEnvironmentRecords(allGi, false);
    expect(giFilter.eligibleRecords).toHaveLength(3037); // FOOD only
    expect(giFilter.excludedNonFoodRecords).toHaveLength(3808); // WINE + SPIRIT + CRAFT_AND_INDUSTRIAL
    expect(giFilter.excludedBySector.WINE).toBeGreaterThan(3000);

    const giAgg = aggregateEnvironmentByCategory(allGi, 'gi_proxy_co2_kg');
    expect(giAgg.provenance.dataNature).toBe('Estimated');
    expect(giAgg.missingness.includedRecords).toBe(3037);
    expect(giAgg.missingness.missingOrExcludedRecords).toBe(3808);
    expect(giAgg.data[0].isClassProxy).toBe(true);
    expect(giAgg.data.some((d) => d.category.includes('Wine') || d.category.includes('Spirit'))).toBe(false);

    // Explicit opt-in includes non-food GI sectors cleanly when specifically requested
    const giWithWine = aggregateEnvironmentByCategory(allGi, 'gi_proxy_co2_kg', {
      includeNonFoodGiSectors: true,
    });
    expect(giWithWine.missingness.includedRecords).toBe(6845);
  });
});
