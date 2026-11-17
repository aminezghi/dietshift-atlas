import type { AgribalyseItem, CountryDietaryProfile, CustomBasketItem } from '../types/research';
import type { AnalyticalResult } from './types';

export const SANDBOX_LEDGER_VERSION = '5.1.0-phase5a';

export interface BasketMissingnessCounts {
  totalItems: number;
  carbonMissing: number;
  waterAwareMissing: number;
  landPtMissing: number;
  kcalMissing: number;
  proteinMissing: number;
  costMissing: number;
  novaMissing: number;
  importedLcaOnlyItems: number;
  userCsvItems: number;
}

export interface CustomBasketSummary {
  totalGrams: number;
  totalCarbonKg: number;
  totalWaterAwareM3: number; // AWARE deprivation-weighted m3 world-eq / d (never physical L)
  totalLandPt: number;       // PEF 3.1 Land Use Pt / d (never converted to m2)
  totalKcal: number | null;
  totalProteinG: number | null;
  totalCostEur: number | null;
  upfSharePct: number | null;
  missingness: BasketMissingnessCounts;
  eatLancetBasket: {
    redMeat: number;
    dairy: number;
    legumesNuts: number;
    wholeGrains: number;
    vegetablesFruits: number;
    ultraProcessedShare: number | null;
  };
  unitIntegrityNotes: string[];
}

function parseNullableFinite(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string' && raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Converts an ADEME Agribalyse 3.1.1 record into a custom basket entry while strictly
 * preserving native LCA units (CO2eq, AWARE m3 world-eq, PEF Pt) and keeping unavailable
 * nutrition, NOVA, and retail price attributes strictly as null (never guessed).
 */
export function fromAgribalyseToBasketItem(agb: AgribalyseItem): CustomBasketItem {
  const grp = (agb.Groupe_aliment || agb["Groupe_d'aliment"] || '').toLowerCase();
  let cat = 'Unclassified (Agribalyse)';
  if (grp.includes('viande') || grp.includes('meat')) cat = 'Red Meat';
  else if (grp.includes('lait') || grp.includes('fromage')) cat = 'Dairy';
  else if (grp.includes('céréal')) cat = 'Whole Grains';
  else if (grp.includes('légumineuse') || grp.includes('oléagineux')) cat = 'Legumes & Nuts';
  else if (grp.includes('fruit') || grp.includes('légume')) cat = 'Vegetables & Fruits';
  else if (grp.includes('plat') || grp.includes('sucr')) cat = 'Ultra-Processed';

  const co2 = parseNullableFinite(agb.Changement_climatique_kg_CO2eq ?? agb.Changement_climatique);
  const water = parseNullableFinite(agb.Eau_m3 ?? agb['Épuisement_des_ressources_eau']);
  const land = parseNullableFinite(agb.Sol_Pt ?? agb.Utilisation_du_sol);

  return {
    id: `agb-${agb.Code_AGB}-${Date.now()}`,
    foodName: agb.LCI_Name || agb.Nom_du_Produit_en_Francais || `Agribalyse ${agb.Code_AGB}`,
    foodEx2Category: cat,
    gramsPerDay: 85,
    novaGroup: null, // Agribalyse LCI database does not supply observed NOVA classification
    carbonPerKg: co2 !== null ? +co2.toFixed(3) : null,
    waterM3PerKg: water !== null ? +water.toFixed(3) : null,
    landPtPerKg: land !== null ? +land.toFixed(2) : null,
    kcalPer100g: null,   // Unavailable in Agribalyse LCI JSON (never hardcoded)
    proteinPer100g: null,
    costEurPerKg: null,
    sourceNatureTag: 'Model Output',
    itemOrigin: 'agribalyse_lca_import',
  };
}

export interface CsvBasketParseResult {
  items: CustomBasketItem[];
  skippedInvalidGramsCount: number;
  importedMissingFieldCount: number;
}

/**
 * Parses uploaded survey CSV rows without silent numeric fallbacks:
 * blank or non-numeric columns remain null and are counted explicitly.
 */
export function parseSurveyCsvRows(rows: readonly Record<string, string | undefined>[]): CsvBasketParseResult {
  const items: CustomBasketItem[] = [];
  let skippedInvalidGramsCount = 0;
  let importedMissingFieldCount = 0;

  rows.forEach((row, idx) => {
    const grams = parseNullableFinite(row.grams_per_day ?? row.GramsPerDay);
    if (grams === null || grams <= 0) {
      skippedInvalidGramsCount += 1;
      return;
    }

    const novaRaw = parseNullableFinite(row.nova_group ?? row.NOVA);
    const novaGroup = novaRaw !== null && [1, 2, 3, 4].includes(Math.round(novaRaw)) ? Math.round(novaRaw) : null;
    const carbonPerKg = parseNullableFinite(row.carbon_kg_per_kg ?? row.CarbonPerKg);
    const waterM3PerKg = parseNullableFinite(
      row.water_aware_m3_per_kg ?? row.water_m3_per_kg ?? row.WaterM3PerKg
    );
    const landPtPerKg = parseNullableFinite(row.land_pt_per_kg ?? row.LandPtPerKg);
    const kcalPer100g = parseNullableFinite(row.kcal_100g ?? row.Energy_kcal_100g);
    const proteinPer100g = parseNullableFinite(row.protein_100g ?? row.Proteins_100g);
    const costEurPerKg = parseNullableFinite(row.cost_eur_per_kg ?? row.CostEurPerKg);

    for (const v of [novaGroup, carbonPerKg, waterM3PerKg, landPtPerKg, kcalPer100g, proteinPer100g, costEurPerKg]) {
      if (v === null) importedMissingFieldCount += 1;
    }

    items.push({
      id: `csv-${idx}-${Date.now()}`,
      foodName: (row.food_name || row.FoodName || row.product_name || '').trim() || `Survey item ${idx + 1}`,
      foodEx2Category: (row.category || row.FoodEx2_Category || '').trim() || 'Unclassified (CSV)',
      gramsPerDay: grams,
      novaGroup,
      carbonPerKg,
      waterM3PerKg,
      landPtPerKg,
      kcalPer100g,
      proteinPer100g,
      costEurPerKg,
      sourceNatureTag: 'User Supplied',
      itemOrigin: 'user_csv_import',
    });
  });

  return { items, skippedInvalidGramsCount, importedMissingFieldCount };
}

/**
 * Aggregates a custom researcher basket strictly within native units:
 * - Never converts AWARE deprivation water (m3 world-eq) into physical liters
 * - Never converts PEF Land Use Pt into square meters
 * - Preserves NULL denominators cleanly across partial nutrition/cost/NOVA items
 */
export function summarizeCustomBasket(
  basket: readonly CustomBasketItem[],
  baselineProfile: CountryDietaryProfile
): AnalyticalResult<CustomBasketSummary> {
  let totalGrams = 0;
  let totalCarbonKg = 0;
  let totalWaterAwareM3 = 0;
  let totalLandPt = 0;
  let totalKcal = 0;
  let totalProteinG = 0;
  let totalCostEur = 0;
  let nova4Kcal = 0;
  let knownNovaKcal = 0;

  let carbonValid = 0;
  let waterValid = 0;
  let landValid = 0;
  let kcalValid = 0;
  let proteinValid = 0;
  let costValid = 0;

  const missingness: BasketMissingnessCounts = {
    totalItems: basket.length,
    carbonMissing: 0,
    waterAwareMissing: 0,
    landPtMissing: 0,
    kcalMissing: 0,
    proteinMissing: 0,
    costMissing: 0,
    novaMissing: 0,
    importedLcaOnlyItems: 0,
    userCsvItems: 0,
  };

  const catGrams: Record<string, number> = {
    'Red Meat': 0,
    Dairy: 0,
    'Legumes & Nuts': 0,
    'Whole Grains': 0,
    'Vegetables & Fruits': 0,
    'Ultra-Processed': 0,
  };

  for (const item of basket) {
    const kg = item.gramsPerDay / 1000.0;
    totalGrams += item.gramsPerDay;

    if (item.itemOrigin === 'agribalyse_lca_import') missingness.importedLcaOnlyItems += 1;
    if (item.itemOrigin === 'user_csv_import') missingness.userCsvItems += 1;

    if (item.carbonPerKg !== null) {
      totalCarbonKg += kg * item.carbonPerKg;
      carbonValid += 1;
    } else {
      missingness.carbonMissing += 1;
    }

    if (item.waterM3PerKg !== null) {
      totalWaterAwareM3 += kg * item.waterM3PerKg;
      waterValid += 1;
    } else {
      missingness.waterAwareMissing += 1;
    }

    if (item.landPtPerKg !== null) {
      totalLandPt += kg * item.landPtPerKg;
      landValid += 1;
    } else {
      missingness.landPtMissing += 1;
    }

    let itemKcal: number | null = null;
    if (item.kcalPer100g !== null) {
      itemKcal = (item.gramsPerDay / 100.0) * item.kcalPer100g;
      totalKcal += itemKcal;
      kcalValid += 1;
    } else {
      missingness.kcalMissing += 1;
    }

    if (item.proteinPer100g !== null) {
      totalProteinG += (item.gramsPerDay / 100.0) * item.proteinPer100g;
      proteinValid += 1;
    } else {
      missingness.proteinMissing += 1;
    }

    if (item.costEurPerKg !== null) {
      totalCostEur += kg * item.costEurPerKg;
      costValid += 1;
    } else {
      missingness.costMissing += 1;
    }

    if (item.novaGroup === null) {
      missingness.novaMissing += 1;
    } else if (itemKcal !== null) {
      knownNovaKcal += itemKcal;
      if (item.novaGroup === 4) {
        nova4Kcal += itemKcal;
      }
    }

    if (catGrams[item.foodEx2Category] !== undefined) {
      catGrams[item.foodEx2Category] += item.gramsPerDay;
    }
  }

  const upfSharePct = knownNovaKcal > 0 ? Math.round((nova4Kcal / knownNovaKcal) * 100) : null;

  return {
    data: {
      totalGrams: Math.round(totalGrams),
      totalCarbonKg: +totalCarbonKg.toFixed(2),
      totalWaterAwareM3: +totalWaterAwareM3.toFixed(3),
      totalLandPt: +totalLandPt.toFixed(2),
      totalKcal: kcalValid > 0 ? Math.round(totalKcal) : null,
      totalProteinG: proteinValid > 0 ? +totalProteinG.toFixed(1) : null,
      totalCostEur: costValid > 0 ? +totalCostEur.toFixed(2) : null,
      upfSharePct,
      missingness,
      eatLancetBasket: {
        redMeat: Math.min(400, Math.round((catGrams['Red Meat'] / 28.0) * 100)),
        dairy: Math.min(300, Math.round((catGrams.Dairy / 250.0) * 100)),
        legumesNuts: Math.min(150, Math.round((catGrams['Legumes & Nuts'] / 125.0) * 100)),
        wholeGrains: Math.min(150, Math.round((catGrams['Whole Grains'] / 232.0) * 100)),
        vegetablesFruits: Math.min(150, Math.round((catGrams['Vegetables & Fruits'] / 500.0) * 100)),
        ultraProcessedShare: upfSharePct !== null ? Math.min(70, upfSharePct) : null,
      },
      unitIntegrityNotes: [
        'Water impact reported strictly in AWARE deprivation-weighted m3 world-eq/d (not physical volumetric liters).',
        'Land impact reported strictly in PEF 3.1 Land Use Pt/d (not physical m2 area).',
        `Valid item coverage: carbon ${carbonValid}/${basket.length}, water AWARE ${waterValid}/${basket.length}, land Pt ${landValid}/${basket.length}, kcal ${kcalValid}/${basket.length}, protein ${proteinValid}/${basket.length}, cost ${costValid}/${basket.length}.`,
      ],
    },
    unit: 'Multi-unit ledger (kg CO2eq, m3 world-eq AWARE, PEF Pt, kcal, g protein, EUR)',
    provenance: {
      module: 'sandboxLedger.summarizeCustomBasket',
      version: SANDBOX_LEDGER_VERSION,
      dataNature: 'Simulated',
      sources: [
        'User / Preset Basket Ledger entries',
        `Manually Compiled Reference Baseline: ${baselineProfile.code}`,
        'ADEME Agribalyse 3.1.1 (LCA Model Output only when imported)',
      ],
      assumptions: [
        'Missing nutrition, NOVA, and price values are preserved as NULL and excluded from partial sums rather than imputed.',
        'EAT-Lancet radar axes count only categorized food-group items; unmapped Agribalyse imports are retained outside EAT-Lancet axes.',
      ],
    },
    missingness: {
      totalRecords: basket.length,
      includedRecords: basket.length,
      missingOrExcludedRecords:
        missingness.kcalMissing + missingness.proteinMissing + missingness.costMissing,
    },
  };
}

/**
 * Serializes the researcher basket CSV preserving genuine NULL cells as blank strings
 * and documenting AWARE m3 and PEF Pt columns explicitly.
 */
export function serializeBasketCsv(basket: readonly CustomBasketItem[]): string {
  const headers = [
    'food_name',
    'category',
    'grams_per_day',
    'nova_group',
    'carbon_kg_per_kg',
    'water_aware_m3_per_kg',
    'land_pt_per_kg',
    'kcal_100g',
    'protein_100g',
    'cost_eur_per_kg',
    'item_origin',
  ];
  const rows = basket.map((b) => [
    `"${b.foodName.replace(/"/g, '""')}"`,
    `"${b.foodEx2Category.replace(/"/g, '""')}"`,
    b.gramsPerDay,
    b.novaGroup ?? '',
    b.carbonPerKg ?? '',
    b.waterM3PerKg ?? '',
    b.landPtPerKg ?? '',
    b.kcalPer100g ?? '',
    b.proteinPer100g ?? '',
    b.costEurPerKg ?? '',
    b.itemOrigin ?? 'preset_reference',
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
