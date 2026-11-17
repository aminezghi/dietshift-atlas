import type { AgribalyseItem } from '../types/research';
import type { AnalyticalResult, DataNature } from './types';

export const ENVIRONMENT_ENGINE_VERSION = '3.2.0-phase3c';

export type EnvironmentSourceId =
  | 'agribalyse_31'
  | 'poore_nemecek_2018'
  | 'gi_terroir_proxy';

export type FunctionalUnit = 'per_kg' | 'per_100g_protein' | 'per_1000kcal';

export type EnvironmentDimension =
  | 'climate'
  | 'water_scarcity_aware'
  | 'water_withdrawal'
  | 'water_scarcity_weighted'
  | 'land_ef_pt'
  | 'land_area'
  | 'acidification'
  | 'eutrophication_terrestrial'
  | 'eutrophication_po4'
  | 'pef_single_score';

export type EnvironmentIndicatorKey =
  | 'climate_co2eq'
  | 'water_aware_m3'
  | 'land_ef_pt'
  | 'acidification'
  | 'eutrophication_terrestrial'
  | 'ef_single_score'
  | 'ghg_per_kg'
  | 'ghg_per_100g_protein'
  | 'ghg_per_1000kcal'
  | 'land_use_m2'
  | 'freshwater_withdrawals_l'
  | 'scarcity_water_l'
  | 'eutrophying_po4_g'
  | 'gi_proxy_co2_kg'
  | 'gi_proxy_water_l'
  | 'gi_proxy_land_m2';

export interface EnvironmentSourceContext {
  sourceId: EnvironmentSourceId;
  datasetFile: string;
  sourceTitle: string;
  methodology: string;
  geography: string;
  systemBoundary: string;
  defaultFunctionalUnit: FunctionalUnit;
  dataNature: Extract<DataNature, 'Observed' | 'Estimated' | 'Model Output'>;
  isClassProxy: boolean;
  disclosureNote: string;
}

export const ENVIRONMENT_SOURCE_METADATA: Record<EnvironmentSourceId, EnvironmentSourceContext> = {
  agribalyse_31: {
    sourceId: 'agribalyse_31',
    datasetFile: 'agribalyse_31.parquet',
    sourceTitle: 'ADEME / INRAE Agribalyse 3.1.1 Life-Cycle Inventory',
    methodology: 'French Environmental Footprint (PEF 3.1 / EF 3.0) LCI model',
    geography: 'France / European retail supply mix',
    systemBoundary: 'Cradle-to-consumer gate (agriculture, processing, packaging, transport, retail, home preparation)',
    defaultFunctionalUnit: 'per_kg',
    dataNature: 'Model Output',
    isClassProxy: false,
    disclosureNote: 'ADEME Agribalyse 3.1.1 LCI values are modeled environmental footprint outputs for a French supply mix and preparation stage—not direct physical measurements of individual SKUs.',
  },
  poore_nemecek_2018: {
    sourceId: 'poore_nemecek_2018',
    datasetFile: 'global_poore_nemecek_lca.parquet',
    sourceTitle: 'Poore & Nemecek (Science 2018) Global Meta-Analysis via OWID',
    methodology: 'Synthesized global farm-to-retail LCA meta-analysis (38,700 commercial farms, 119 countries)',
    geography: 'Global production-weighted average (not country-specific)',
    systemBoundary: 'Farm-to-retail gate (land-use change, farm, animal feed, processing, transport, retail, packaging, losses)',
    defaultFunctionalUnit: 'per_kg',
    dataNature: 'Estimated',
    isClassProxy: false,
    disclosureNote: 'Global meta-analytic source-derived estimates across 45 commodities; never substitute silently for country-specific LCI measurements.',
  },
  gi_terroir_proxy: {
    sourceId: 'gi_terroir_proxy',
    datasetFile: 'gi_terroir_registry.parquet',
    sourceTitle: 'EUIPO GIview & Qualigeo Registry with Keyword Class Proxies',
    methodology: 'Rule-based EU class proxy assignment (classify_gi_full -> eu_class)',
    geography: 'EU-27 + 55 international registered GI jurisdictions',
    systemBoundary: 'Secondary category benchmark assigned by GI sector/name keywords (NOT product-measured LCA)',
    defaultFunctionalUnit: 'per_kg',
    dataNature: 'Estimated',
    isClassProxy: true,
    disclosureNote: 'GI product identities and terroir schemes are official records, whereas CO₂, water, and land values are rule-assigned category proxies—not product-specific LCA measurements.',
  },
};

export interface EnvironmentIndicatorSpec {
  key: EnvironmentIndicatorKey;
  sourceId: EnvironmentSourceId;
  originalField: string;
  label: string;
  unit: string;
  functionalUnit: FunctionalUnit;
  dimension: EnvironmentDimension;
  dataNature: Extract<DataNature, 'Observed' | 'Estimated' | 'Model Output'>;
  isCompositeMethod: boolean;
  compositeMethodNote?: string;
}

export const ENVIRONMENT_INDICATOR_SPECS: Record<EnvironmentIndicatorKey, EnvironmentIndicatorSpec> = {
  climate_co2eq: {
    key: 'climate_co2eq',
    sourceId: 'agribalyse_31',
    originalField: 'Changement_climatique_kg_CO2eq',
    label: 'Climate change (GWP100)',
    unit: 'kg CO₂eq / kg',
    functionalUnit: 'per_kg',
    dimension: 'climate',
    dataNature: 'Model Output',
    isCompositeMethod: false,
  },
  water_aware_m3: {
    key: 'water_aware_m3',
    sourceId: 'agribalyse_31',
    originalField: 'Eau_m3',
    label: 'Water scarcity (AWARE deprivation)',
    unit: 'm³ world eq / kg',
    functionalUnit: 'per_kg',
    dimension: 'water_scarcity_aware',
    dataNature: 'Model Output',
    isCompositeMethod: false,
  },
  land_ef_pt: {
    key: 'land_ef_pt',
    sourceId: 'agribalyse_31',
    originalField: 'Sol_Pt',
    label: 'Land use (EF soil quality index)',
    unit: 'Pt / kg',
    functionalUnit: 'per_kg',
    dimension: 'land_ef_pt',
    dataNature: 'Model Output',
    isCompositeMethod: false,
  },
  acidification: {
    key: 'acidification',
    sourceId: 'agribalyse_31',
    originalField: 'Acidification',
    label: 'Acidification (terrestrial & freshwater)',
    unit: 'mol H+ eq / kg',
    functionalUnit: 'per_kg',
    dimension: 'acidification',
    dataNature: 'Model Output',
    isCompositeMethod: false,
  },
  eutrophication_terrestrial: {
    key: 'eutrophication_terrestrial',
    sourceId: 'agribalyse_31',
    originalField: 'Eutrophisation_terrestre',
    label: 'Terrestrial eutrophication',
    unit: 'mol N eq / kg',
    functionalUnit: 'per_kg',
    dimension: 'eutrophication_terrestrial',
    dataNature: 'Model Output',
    isCompositeMethod: false,
  },
  ef_single_score: {
    key: 'ef_single_score',
    sourceId: 'agribalyse_31',
    originalField: 'Score_unique_EF',
    label: 'ADEME PEF 3.1 Single Score',
    unit: 'mPt / kg',
    functionalUnit: 'per_kg',
    dimension: 'pef_single_score',
    dataNature: 'Model Output',
    isCompositeMethod: true,
    compositeMethodNote: 'Published ADEME/EC PEF 3.1 normalization and weighting methodology (not an ad-hoc index).',
  },
  ghg_per_kg: {
    key: 'ghg_per_kg',
    sourceId: 'poore_nemecek_2018',
    originalField: 'ghg_kg_co2eq_per_kg',
    label: 'Supply-chain GHG emissions (per kg)',
    unit: 'kg CO₂eq / kg',
    functionalUnit: 'per_kg',
    dimension: 'climate',
    dataNature: 'Estimated',
    isCompositeMethod: false,
  },
  ghg_per_100g_protein: {
    key: 'ghg_per_100g_protein',
    sourceId: 'poore_nemecek_2018',
    originalField: 'ghg_kg_per_100g_protein',
    label: 'Supply-chain GHG per 100g protein',
    unit: 'kg CO₂eq / 100g protein',
    functionalUnit: 'per_100g_protein',
    dimension: 'climate',
    dataNature: 'Estimated',
    isCompositeMethod: false,
  },
  ghg_per_1000kcal: {
    key: 'ghg_per_1000kcal',
    sourceId: 'poore_nemecek_2018',
    originalField: 'ghg_kg_per_1000kcal',
    label: 'Supply-chain GHG per 1000 kcal',
    unit: 'kg CO₂eq / 1000 kcal',
    functionalUnit: 'per_1000kcal',
    dimension: 'climate',
    dataNature: 'Estimated',
    isCompositeMethod: false,
  },
  land_use_m2: {
    key: 'land_use_m2',
    sourceId: 'poore_nemecek_2018',
    originalField: 'land_use_m2_per_kg',
    label: 'Agricultural land use',
    unit: 'm² / kg',
    functionalUnit: 'per_kg',
    dimension: 'land_area',
    dataNature: 'Estimated',
    isCompositeMethod: false,
  },
  freshwater_withdrawals_l: {
    key: 'freshwater_withdrawals_l',
    sourceId: 'poore_nemecek_2018',
    originalField: 'freshwater_withdrawals_l_per_kg',
    label: 'Freshwater withdrawals (unweighted)',
    unit: 'L / kg',
    functionalUnit: 'per_kg',
    dimension: 'water_withdrawal',
    dataNature: 'Estimated',
    isCompositeMethod: false,
  },
  scarcity_water_l: {
    key: 'scarcity_water_l',
    sourceId: 'poore_nemecek_2018',
    originalField: 'scarcity_water_l_per_kg',
    label: 'Scarcity-weighted water use',
    unit: 'L scarcity-eq / kg',
    functionalUnit: 'per_kg',
    dimension: 'water_scarcity_weighted',
    dataNature: 'Estimated',
    isCompositeMethod: false,
  },
  eutrophying_po4_g: {
    key: 'eutrophying_po4_g',
    sourceId: 'poore_nemecek_2018',
    originalField: 'eutrophying_g_po4_per_kg',
    label: 'Eutrophying emissions',
    unit: 'g PO₄eq / kg',
    functionalUnit: 'per_kg',
    dimension: 'eutrophication_po4',
    dataNature: 'Estimated',
    isCompositeMethod: false,
  },
  gi_proxy_co2_kg: {
    key: 'gi_proxy_co2_kg',
    sourceId: 'gi_terroir_proxy',
    originalField: 'co2_kg_per_kg',
    label: 'Estimated class proxy carbon',
    unit: 'kg CO₂eq / kg',
    functionalUnit: 'per_kg',
    dimension: 'climate',
    dataNature: 'Estimated',
    isCompositeMethod: false,
  },
  gi_proxy_water_l: {
    key: 'gi_proxy_water_l',
    sourceId: 'gi_terroir_proxy',
    originalField: 'water_L_per_kg',
    label: 'Estimated class proxy water',
    unit: 'L / kg',
    functionalUnit: 'per_kg',
    dimension: 'water_withdrawal',
    dataNature: 'Estimated',
    isCompositeMethod: false,
  },
  gi_proxy_land_m2: {
    key: 'gi_proxy_land_m2',
    sourceId: 'gi_terroir_proxy',
    originalField: 'land_m2_per_kg',
    label: 'Estimated class proxy land',
    unit: 'm² / kg',
    functionalUnit: 'per_kg',
    dimension: 'land_area',
    dataNature: 'Estimated',
    isCompositeMethod: false,
  },
};

export interface PooreLcaInput {
  food_item: string;
  ghg_kg_co2eq_per_kg: number | null;
  ghg_kg_per_100g_protein?: number | null;
  ghg_kg_per_1000kcal?: number | null;
  land_use_m2_per_kg: number | null;
  freshwater_withdrawals_l_per_kg: number | null;
  scarcity_water_l_per_kg?: number | null;
  eutrophying_g_po4_per_kg?: number | null;
  stage_land_use?: number | null;
  stage_farm?: number | null;
  stage_animal_feed?: number | null;
  stage_processing?: number | null;
  stage_transport?: number | null;
  stage_retail?: number | null;
  stage_packaging?: number | null;
  stage_losses?: number | null;
  transport_share_pct?: number | null;
  data_source?: string;
}

export interface GITerroirInput {
  gi_id: string;
  product_name: string;
  country_code: string;
  gi_scheme?: string;
  product_sector?: string;
  eu_class: string;
  co2_kg_per_kg: number | null;
  water_L_per_kg: number | null;
  land_m2_per_kg: number | null;
  foodex2_code?: string;
  data_source?: string;
}

export interface StandardizedEnvironmentRecord {
  recordId: string;
  secondaryCode: string | null;
  name: string;
  category: string;
  subCategory: string | null;
  sourceId: EnvironmentSourceId;
  sourceDataset: string;
  geography: string;
  systemBoundary: string;
  functionalUnit: FunctionalUnit;
  dataNature: Extract<DataNature, 'Observed' | 'Estimated' | 'Model Output'>;
  isClassProxy: boolean;
  proxyMethodNote: string | null;
  metrics: Partial<Record<EnvironmentIndicatorKey, number | null>>;
  calculationVersion: string;
}

function cleanEnvNum(val: number | null | undefined): number | null {
  if (val === null || val === undefined || typeof val !== 'number' || !Number.isFinite(val)) {
    return null;
  }
  return val;
}

function roundTo(val: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(val * f) / f;
}

export function fromAgribalyseItem(item: AgribalyseItem): StandardizedEnvironmentRecord {
  const ctx = ENVIRONMENT_SOURCE_METADATA.agribalyse_31;
  return {
    recordId: `AGB:${item.Code_AGB}`,
    secondaryCode: item.Code_CIQUAL ?? null,
    name: item.LCI_Name,
    category: item.Groupe_aliment ?? item["Groupe_d'aliment"] ?? 'Uncategorized',
    subCategory: item.Sous_groupe_aliment ?? item["Sous-groupe_d'aliment"] ?? null,
    sourceId: 'agribalyse_31',
    sourceDataset: ctx.datasetFile,
    geography: ctx.geography,
    systemBoundary: ctx.systemBoundary,
    functionalUnit: ctx.defaultFunctionalUnit,
    dataNature: ctx.dataNature,
    isClassProxy: false,
    proxyMethodNote: null,
    metrics: {
      climate_co2eq: cleanEnvNum(item.Changement_climatique_kg_CO2eq ?? item.Changement_climatique),
      water_aware_m3: cleanEnvNum(item.Eau_m3 ?? item['Épuisement_des_ressources_eau']),
      land_ef_pt: cleanEnvNum(item.Sol_Pt ?? item.Utilisation_du_sol),
      acidification: cleanEnvNum(item.Acidification ?? item.Acidification_terrestre_et_eaux_douces),
      eutrophication_terrestrial: cleanEnvNum(item.Eutrophisation_terrestre),
      ef_single_score: cleanEnvNum(item.Score_unique_EF),
    },
    calculationVersion: ENVIRONMENT_ENGINE_VERSION,
  };
}

export function fromPooreNemecekItem(item: PooreLcaInput): StandardizedEnvironmentRecord {
  const ctx = ENVIRONMENT_SOURCE_METADATA.poore_nemecek_2018;
  return {
    recordId: `POORE:${item.food_item}`,
    secondaryCode: null,
    name: item.food_item,
    category: 'Global Commodity Meta-Analysis',
    subCategory: null,
    sourceId: 'poore_nemecek_2018',
    sourceDataset: ctx.datasetFile,
    geography: ctx.geography,
    systemBoundary: ctx.systemBoundary,
    functionalUnit: ctx.defaultFunctionalUnit,
    dataNature: ctx.dataNature,
    isClassProxy: false,
    proxyMethodNote: 'Source-derived global weighted average across 119 countries (not nation-specific).',
    metrics: {
      ghg_per_kg: cleanEnvNum(item.ghg_kg_co2eq_per_kg),
      ghg_per_100g_protein: cleanEnvNum(item.ghg_kg_per_100g_protein),
      ghg_per_1000kcal: cleanEnvNum(item.ghg_kg_per_1000kcal),
      land_use_m2: cleanEnvNum(item.land_use_m2_per_kg),
      freshwater_withdrawals_l: cleanEnvNum(item.freshwater_withdrawals_l_per_kg),
      scarcity_water_l: cleanEnvNum(item.scarcity_water_l_per_kg),
      eutrophying_po4_g: cleanEnvNum(item.eutrophying_g_po4_per_kg),
    },
    calculationVersion: ENVIRONMENT_ENGINE_VERSION,
  };
}

export function fromGITerroirItem(item: GITerroirInput): StandardizedEnvironmentRecord {
  const ctx = ENVIRONMENT_SOURCE_METADATA.gi_terroir_proxy;
  return {
    recordId: `GI:${item.gi_id}`,
    secondaryCode: item.foodex2_code ?? null,
    name: item.product_name,
    category: item.eu_class,
    subCategory: item.product_sector ?? 'FOOD',
    sourceId: 'gi_terroir_proxy',
    sourceDataset: ctx.datasetFile,
    geography: `${item.country_code} (${ctx.geography})`,
    systemBoundary: ctx.systemBoundary,
    functionalUnit: ctx.defaultFunctionalUnit,
    dataNature: 'Estimated',
    isClassProxy: true,
    proxyMethodNote: `Rule-based class average for '${item.eu_class}' assigned by keyword classification (classify_gi_full); not a measured LCA for '${item.product_name}'.`,
    metrics: {
      gi_proxy_co2_kg: cleanEnvNum(item.co2_kg_per_kg),
      gi_proxy_water_l: cleanEnvNum(item.water_L_per_kg),
      gi_proxy_land_m2: cleanEnvNum(item.land_m2_per_kg),
    },
    calculationVersion: ENVIRONMENT_ENGINE_VERSION,
  };
}

export interface EnvironmentCompatibilityReport {
  compatibleForDirectComparison: boolean;
  comparabilityLevel: 'direct' | 'cautionary_cross_boundary' | 'incompatible';
  indicatorA: EnvironmentIndicatorSpec;
  indicatorB: EnvironmentIndicatorSpec;
  incompatibilityReasons: string[];
  requirementsToEnableComparison: string[];
  guidanceSummary: string;
}

export function checkEnvironmentCompatibility(
  keyA: EnvironmentIndicatorKey,
  keyB: EnvironmentIndicatorKey
): EnvironmentCompatibilityReport {
  const specA = ENVIRONMENT_INDICATOR_SPECS[keyA];
  const specB = ENVIRONMENT_INDICATOR_SPECS[keyB];
  const ctxA = ENVIRONMENT_SOURCE_METADATA[specA.sourceId];
  const ctxB = ENVIRONMENT_SOURCE_METADATA[specB.sourceId];

  const reasons: string[] = [];
  const requirements: string[] = [];

  if (specA.functionalUnit !== specB.functionalUnit) {
    reasons.push(
      `Incompatible functional units: '${specA.functionalUnit}' (${specA.unit}) vs '${specB.functionalUnit}' (${specB.unit}).`
    );
    requirements.push(
      'Verified protein content (g/kg) and/or energy density (kcal/kg) for the identical food items to harmonize functional units.'
    );
  }

  if (specA.dimension !== specB.dimension) {
    reasons.push(
      `Incompatible environmental impact definitions: '${specA.dimension}' (${specA.unit}) vs '${specB.dimension}' (${specB.unit}).`
    );
    if (
      (specA.dimension === 'land_ef_pt' && specB.dimension === 'land_area') ||
      (specB.dimension === 'land_ef_pt' && specA.dimension === 'land_area')
    ) {
      requirements.push(
        'LANCA characterization factors converting physical agricultural area (m²) into EF soil quality points (Pt) are missing and cannot be assumed uniformly.'
      );
    } else if (
      specA.dimension.startsWith('water_') &&
      specB.dimension.startsWith('water_')
    ) {
      requirements.push(
        'Regionalized AWARE watershed characterization factors matching withdrawal volumes (L) to world-eq deprivation (m³) are required.'
      );
    } else {
      requirements.push(
        'Compare metrics on separate charts/axes; do not sum or equate distinct impact categories.'
      );
    }
  }

  if (ctxA.isClassProxy !== ctxB.isClassProxy || (ctxA.isClassProxy && ctxB.isClassProxy && keyA !== keyB)) {
    reasons.push(
      'One or both series rely on rule-assigned GI class proxy averages rather than product-level LCI measurements.'
    );
    requirements.push(
      'Product-specific disciplinare LCA audits or verified farm-to-fork EPD data for protected GI products.'
    );
  }

  if (specA.sourceId !== specB.sourceId) {
    reasons.push(
      `Different system boundaries & geographies: [${ctxA.sourceId}: ${ctxA.geography}; ${ctxA.systemBoundary}] vs [${ctxB.sourceId}: ${ctxB.geography}; ${ctxB.systemBoundary}].`
    );
    requirements.push(
      'Harmonized system boundaries (matching farm-to-retail vs. cradle-to-consumer cutoff) and national trade-mix origin weights.'
    );
  }

  if (reasons.length === 0) {
    return {
      compatibleForDirectComparison: true,
      comparabilityLevel: 'direct',
      indicatorA: specA,
      indicatorB: specB,
      incompatibilityReasons: [],
      requirementsToEnableComparison: [],
      guidanceSummary: `Direct comparison valid within ${ctxA.sourceTitle} (${specA.unit}, ${ctxA.systemBoundary}).`,
    };
  }

  const sameUnitAndDimension =
    specA.functionalUnit === specB.functionalUnit &&
    specA.dimension === specB.dimension &&
    !ctxA.isClassProxy &&
    !ctxB.isClassProxy;

  if (sameUnitAndDimension) {
    return {
      compatibleForDirectComparison: false,
      comparabilityLevel: 'cautionary_cross_boundary',
      indicatorA: specA,
      indicatorB: specB,
      incompatibilityReasons: reasons,
      requirementsToEnableComparison: requirements,
      guidanceSummary:
        'Same physical indicator unit, but system boundaries and geographies differ. Display separately with explicit boundary context; never pool into a merged average.',
    };
  }

  return {
    compatibleForDirectComparison: false,
    comparabilityLevel: 'incompatible',
    indicatorA: specA,
    indicatorB: specB,
    incompatibilityReasons: reasons,
    requirementsToEnableComparison: requirements,
    guidanceSummary:
      'Scientifically incompatible indicators/units/boundaries. Display separately using original values and units without conversion.',
  };
}

export interface SideBySideEnvironmentComparison {
  compatibility: EnvironmentCompatibilityReport;
  sideA: {
    recordId: string;
    name: string;
    indicator: EnvironmentIndicatorSpec;
    value: number | null;
    context: EnvironmentSourceContext;
    categoryDisclosure: string;
  };
  sideB: {
    recordId: string;
    name: string;
    indicator: EnvironmentIndicatorSpec;
    value: number | null;
    context: EnvironmentSourceContext;
    categoryDisclosure: string;
  };
  numericDifference: number | null;
  differenceBlockedReason: string | null;
}

export function compareEnvironmentRecords(
  recordA: StandardizedEnvironmentRecord,
  indicatorKeyA: EnvironmentIndicatorKey,
  recordB: StandardizedEnvironmentRecord,
  indicatorKeyB: EnvironmentIndicatorKey
): AnalyticalResult<SideBySideEnvironmentComparison> {
  const compat = checkEnvironmentCompatibility(indicatorKeyA, indicatorKeyB);
  const valA = recordA.metrics[indicatorKeyA] ?? null;
  const valB = recordB.metrics[indicatorKeyB] ?? null;

  let numericDifference: number | null = null;
  let differenceBlockedReason: string | null = null;

  if (!compat.compatibleForDirectComparison) {
    differenceBlockedReason = compat.incompatibilityReasons.join(' ');
  } else if (valA === null || valB === null) {
    differenceBlockedReason = 'Missing environmental measurement on one or both records.';
  } else {
    numericDifference = roundTo(valA - valB, 3);
  }

  return {
    data: {
      compatibility: compat,
      sideA: {
        recordId: recordA.recordId,
        name: recordA.name,
        indicator: compat.indicatorA,
        value: valA,
        context: ENVIRONMENT_SOURCE_METADATA[recordA.sourceId],
        categoryDisclosure: recordA.proxyMethodNote ?? ENVIRONMENT_SOURCE_METADATA[recordA.sourceId].disclosureNote,
      },
      sideB: {
        recordId: recordB.recordId,
        name: recordB.name,
        indicator: compat.indicatorB,
        value: valB,
        context: ENVIRONMENT_SOURCE_METADATA[recordB.sourceId],
        categoryDisclosure: recordB.proxyMethodNote ?? ENVIRONMENT_SOURCE_METADATA[recordB.sourceId].disclosureNote,
      },
      numericDifference,
      differenceBlockedReason,
    },
    unit: compat.compatibleForDirectComparison ? compat.indicatorA.unit : 'incompatible_display_separately',
    provenance: {
      module: 'environmentEngine.compareEnvironmentRecords',
      version: ENVIRONMENT_ENGINE_VERSION,
      dataNature: recordA.dataNature === recordB.dataNature ? recordA.dataNature : 'Mixed',
      sources: Array.from(new Set([recordA.sourceDataset, recordB.sourceDataset])),
      assumptions: [
        compat.guidanceSummary,
        'Numeric deltas are blocked unless functional units, impact definitions, boundaries, and geographies match.',
      ],
    },
    missingness: {
      totalRecords: 2,
      includedRecords: (valA !== null ? 1 : 0) + (valB !== null ? 1 : 0),
      missingOrExcludedRecords: (valA === null ? 1 : 0) + (valB === null ? 1 : 0),
    },
  };
}

export interface CategoryEnvironmentAggregate {
  category: string;
  indicatorKey: EnvironmentIndicatorKey;
  label: string;
  unit: string;
  functionalUnit: FunctionalUnit;
  sourceId: EnvironmentSourceId;
  geography: string;
  systemBoundary: string;
  dataNature: Extract<DataNature, 'Observed' | 'Estimated' | 'Model Output'>;
  isClassProxy: boolean;
  totalRecords: number;
  validDenominator: number;
  missingCount: number;
  coveragePct: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  aggregateDisclosure: string;
}

export interface FoodSectorFilterResult {
  eligibleRecords: StandardizedEnvironmentRecord[];
  excludedNonFoodRecords: StandardizedEnvironmentRecord[];
  excludedBySector: Record<string, number>;
}

export function filterFoodEligibleEnvironmentRecords(
  records: readonly StandardizedEnvironmentRecord[],
  includeNonFoodGiSectors: boolean = false
): FoodSectorFilterResult {
  if (includeNonFoodGiSectors) {
    return {
      eligibleRecords: [...records],
      excludedNonFoodRecords: [],
      excludedBySector: {},
    };
  }
  const eligibleRecords: StandardizedEnvironmentRecord[] = [];
  const excludedNonFoodRecords: StandardizedEnvironmentRecord[] = [];
  const excludedBySector: Record<string, number> = {};

  for (const r of records) {
    if (r.sourceId === 'gi_terroir_proxy') {
      const sector = (r.subCategory ?? 'FOOD').toUpperCase();
      if (sector !== 'FOOD') {
        excludedNonFoodRecords.push(r);
        excludedBySector[sector] = (excludedBySector[sector] ?? 0) + 1;
        continue;
      }
    }
    eligibleRecords.push(r);
  }
  return { eligibleRecords, excludedNonFoodRecords, excludedBySector };
}

function medianOf(sorted: number[]): number {
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

export function aggregateEnvironmentByCategory(
  records: readonly StandardizedEnvironmentRecord[],
  indicatorKey: EnvironmentIndicatorKey,
  options: { includeNonFoodGiSectors?: boolean } = {}
): AnalyticalResult<CategoryEnvironmentAggregate[]> {
  const spec = ENVIRONMENT_INDICATOR_SPECS[indicatorKey];
  const ctx = ENVIRONMENT_SOURCE_METADATA[spec.sourceId];

  const sourceScoped = records.filter((r) => r.sourceId === spec.sourceId);
  const excludedCrossSource = records.length - sourceScoped.length;
  const giFilter = filterFoodEligibleEnvironmentRecords(
    sourceScoped,
    options.includeNonFoodGiSectors ?? false
  );
  const validSourceRecords = giFilter.eligibleRecords;

  const grouped = new Map<string, StandardizedEnvironmentRecord[]>();
  for (const r of validSourceRecords) {
    const arr = grouped.get(r.category) ?? [];
    arr.push(r);
    grouped.set(r.category, arr);
  }

  const summaries: CategoryEnvironmentAggregate[] = [];
  let totalValidAcrossAll = 0;

  for (const [cat, items] of Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const vals: number[] = [];
    for (const item of items) {
      const v = item.metrics[indicatorKey];
      if (v !== null && v !== undefined && Number.isFinite(v)) {
        vals.push(v);
      }
    }
    const sorted = [...vals].sort((a, b) => a - b);
    const n = vals.length;
    totalValidAcrossAll += n;

    summaries.push({
      category: cat,
      indicatorKey,
      label: spec.label,
      unit: spec.unit,
      functionalUnit: spec.functionalUnit,
      sourceId: spec.sourceId,
      geography: ctx.geography,
      systemBoundary: ctx.systemBoundary,
      dataNature: ctx.dataNature,
      isClassProxy: ctx.isClassProxy,
      totalRecords: items.length,
      validDenominator: n,
      missingCount: items.length - n,
      coveragePct: items.length > 0 ? roundTo((n / items.length) * 100, 1) : 0,
      mean: n > 0 ? roundTo(vals.reduce((s, x) => s + x, 0) / n, 3) : null,
      median: n > 0 ? roundTo(medianOf(sorted), 3) : null,
      min: n > 0 ? roundTo(sorted[0], 3) : null,
      max: n > 0 ? roundTo(sorted[sorted.length - 1], 3) : null,
      aggregateDisclosure: ctx.isClassProxy
        ? `Estimated rule-based GI class proxy summary over ${n} eligible records (unweighted class proxy; NOT measured individual GI LCA or market sales weight).`
        : `Unweighted arithmetic category summary (mean, median, min–max) across ${n} valid LCI entries from ${ctx.sourceTitle}; does not represent market-share-weighted sales or actual consumption volumes.`,
    });
  }

  const nonFoodDetails = Object.entries(giFilter.excludedBySector)
    .map(([sec, cnt]) => `${sec}: ${cnt}`)
    .join(', ');

  return {
    data: summaries,
    unit: spec.unit,
    provenance: {
      module: 'environmentEngine.aggregateEnvironmentByCategory',
      version: ENVIRONMENT_ENGINE_VERSION,
      dataNature: ctx.dataNature,
      sources: [ctx.datasetFile],
      assumptions: [
        `Fixed source & indicator: ${spec.sourceId} · ${spec.label} (${spec.unit}).`,
        `Excluded ${excludedCrossSource} cross-source records to prevent boundary/unit contamination.`,
        ...(giFilter.excludedNonFoodRecords.length > 0
          ? [
              `Excluded ${giFilter.excludedNonFoodRecords.length} non-food GI records (${nonFoodDetails}) from food environmental comparisons.`,
            ]
          : []),
        'Category averages are strictly unweighted arithmetic product means alongside medians/ranges—not market-share or intake-weighted estimates.',
      ],
    },
    missingness: {
      totalRecords: records.length,
      includedRecords: totalValidAcrossAll,
      missingOrExcludedRecords: records.length - totalValidAcrossAll,
    },
  };
}

export interface UnsupportedCompositeError {
  allowed: false;
  reason: string;
}

export function attemptCompositeScore(
  _indicators: Partial<Record<EnvironmentIndicatorKey, number>>,
  explicitWeightingScheme?: { methodName: string; weights: Record<string, number> } | null
): UnsupportedCompositeError | { allowed: true; score: number; method: string } {
  if (!explicitWeightingScheme || !explicitWeightingScheme.methodName.trim()) {
    return {
      allowed: false,
      reason:
        'Combining climate (kg CO2eq), water (m3/L), and land (Pt/m2) into a single score without a published, normalized weighting methodology (such as ADEME PEF 3.1 Score_unique_EF) is scientifically invalid and disabled.',
    };
  }
  const weightSum = Object.values(explicitWeightingScheme.weights).reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1.0) > 1e-4) {
    return {
      allowed: false,
      reason: `Explicit weighting scheme '${explicitWeightingScheme.methodName}' weights must sum to 1.0 (got ${weightSum}).`,
    };
  }
  let score = 0;
  for (const [k, w] of Object.entries(explicitWeightingScheme.weights)) {
    const val = _indicators[k as EnvironmentIndicatorKey];
    if (val === undefined || !Number.isFinite(val)) {
      return { allowed: false, reason: `Missing normalized indicator '${k}' required by ${explicitWeightingScheme.methodName}.` };
    }
    score += val * w;
  }
  return {
    allowed: true,
    score: roundTo(score, 4),
    method: explicitWeightingScheme.methodName,
  };
}
