import { convertMassUnit } from './nutritionEngine';
import type { AnalyticalResult, DataNature } from './types';

export const AFFORDABILITY_ENGINE_VERSION = '3.3.0-phase3d';

export type AffordabilityDataLayer =
  | 'retail_sku_eur'
  | 'hicp_index'
  | 'ppp_pli'
  | 'cohd_ppp_usd_day';

export type RetailPriceBasis = 'per_kg' | 'per_litre' | 'per_package';

export interface OpenPricesSkuInput {
  barcode: string;
  product_name: string;
  fenomeno_category?: string;
  price_eur: number | null;
  currency?: string;
  price_per?: string;
  product_quantity?: number | null;
  product_quantity_unit?: string | null;
  quantity_label?: string | null;
  retailer?: string;
  country_code?: string;
  observed_date?: string;
  data_source?: string;
}

export interface ObservedRetailPriceRecord {
  recordId: string;
  barcode: string;
  productName: string;
  category: string;
  retailer: string;
  countryCode: string;
  observedDate: string | null;
  currency: string;
  packagePriceEur: number | null;
  pricePerType: string;
  packageQuantity: number | null;
  packageUnit: string | null;
  quantityLabel: string | null;
  sourceDataset: string;
  dataNature: Extract<DataNature, 'Observed'>;
}

export type RetailUnitExclusionReason =
  | 'missing_or_invalid_price'
  | 'unsupported_currency'
  | 'missing_package_quantity'
  | 'unsupported_package_unit'
  | 'incompatible_mass_vs_volume';

export interface EvaluatedRetailPrice {
  record: ObservedRetailPriceRecord;
  targetBasis: RetailPriceBasis;
  computable: boolean;
  value: number | null;
  unit: string;
  transformation: string;
  exclusionReason: RetailUnitExclusionReason | null;
  calculationVersion: string;
}

export interface CategoryRetailPriceAggregate {
  category: string;
  basis: RetailPriceBasis;
  unit: string;
  totalRecords: number;
  validDenominator: number;
  excludedCount: number;
  exclusionReasons: Record<string, number>;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  disclosure: string;
}

export interface HicpSeriesRecord {
  countryCode: string;
  coicopCode: string;
  coicopLabel: string;
  indexBase: '2015 = 100';
  isAbsolutePrice: false;
  isEuFallback: boolean;
  sourceName: string;
  valuesByYear: Record<string, number>;
  dataNature: Extract<DataNature, 'Observed'>;
}

export interface HicpInflationAnalysis {
  countryCode: string;
  coicopCode: string;
  coicopLabel: string;
  startYear: number | null;
  endYear: number | null;
  startIndex: number | null;
  endIndex: number | null;
  indexPointsDelta: number | null;
  cumulativeChangePct: number | null;
  annualizedCagrPct: number | null;
  isEuFallback: boolean;
  interpretationWarning: string;
}

export interface PppBenchmarkRecord {
  countryCode: string;
  referenceYear: number;
  seriesCode: string;
  indexBase: 'EU27_2020 = 100';
  foodPriceLevelIndex: number;
  isPppNotExchangeRate: true;
  dataNature: Extract<DataNature, 'Observed'>;
}

export interface CoHDRecord {
  iso3: string;
  countryName: string;
  year: number;
  costHealthyDietPppUsd: number | null;
  unaffordablePct: number | null;
  unaffordableMillions: number | null;
  currencyBasis: 'ICP PPP USD / person / day';
  basketDefinition: string;
  householdContext: string;
  sourceName: string;
  dataNature: Extract<DataNature, 'Observed'>;
}

export interface CoHDSummary {
  referenceYearCoverage: string;
  totalRows: number;
  validCostDenominator: number;
  validUnaffordDenominator: number;
  meanCostPppUsd: number | null;
  medianCostPppUsd: number | null;
  minCostPppUsd: number | null;
  maxCostPppUsd: number | null;
  scopeDisclosure: string;
}

function roundTo(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

function medianOf(sorted: number[]): number {
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

export function fromOpenPricesSku(item: OpenPricesSkuInput): ObservedRetailPriceRecord {
  const price =
    typeof item.price_eur === 'number' && Number.isFinite(item.price_eur) && item.price_eur > 0
      ? roundTo(item.price_eur, 2)
      : null;
  const qty =
    typeof item.product_quantity === 'number' &&
    Number.isFinite(item.product_quantity) &&
    item.product_quantity > 0
      ? item.product_quantity
      : null;
  const unit = qty !== null && item.product_quantity_unit ? item.product_quantity_unit.trim().toLowerCase() : null;

  return {
    recordId: `OP:${item.barcode}_${item.country_code ?? 'EU'}_${item.retailer ?? 'ret'}`,
    barcode: item.barcode,
    productName: item.product_name,
    category: item.fenomeno_category ?? 'Uncategorized',
    retailer: item.retailer ?? 'Independent Retailer',
    countryCode: (item.country_code ?? 'EU').toUpperCase(),
    observedDate: item.observed_date || null,
    currency: (item.currency ?? 'EUR').toUpperCase(),
    packagePriceEur: price,
    pricePerType: (item.price_per ?? 'UNIT').toUpperCase(),
    packageQuantity: qty,
    packageUnit: unit,
    quantityLabel: item.quantity_label ?? null,
    sourceDataset: item.data_source ?? 'scrapling_retail_claims.parquet',
    dataNature: 'Observed',
  };
}

export function evaluateRetailUnitPrice(
  rec: ObservedRetailPriceRecord,
  targetBasis: RetailPriceBasis
): EvaluatedRetailPrice {
  const unitString =
    targetBasis === 'per_kg' ? 'EUR / kg' : targetBasis === 'per_litre' ? 'EUR / L' : 'EUR / package';

  if (rec.packagePriceEur === null || rec.packagePriceEur <= 0) {
    return {
      record: rec,
      targetBasis,
      computable: false,
      value: null,
      unit: unitString,
      transformation: 'Excluded: missing or non-positive EUR price.',
      exclusionReason: 'missing_or_invalid_price',
      calculationVersion: AFFORDABILITY_ENGINE_VERSION,
    };
  }

  if (rec.currency !== 'EUR') {
    return {
      record: rec,
      targetBasis,
      computable: false,
      value: null,
      unit: unitString,
      transformation: `Excluded: non-EUR currency '${rec.currency}' without explicit FX rate table.`,
      exclusionReason: 'unsupported_currency',
      calculationVersion: AFFORDABILITY_ENGINE_VERSION,
    };
  }

  if (targetBasis === 'per_package') {
    return {
      record: rec,
      targetBasis,
      computable: true,
      value: rec.packagePriceEur,
      unit: 'EUR / package',
      transformation: 'Observed shelf receipt package price in EUR (no package-weight normalization).',
      exclusionReason: null,
      calculationVersion: AFFORDABILITY_ENGINE_VERSION,
    };
  }

  if (targetBasis === 'per_kg' && rec.pricePerType === 'KILOGRAM') {
    return {
      record: rec,
      targetBasis,
      computable: true,
      value: rec.packagePriceEur,
      unit: 'EUR / kg',
      transformation: 'Direct EUR/kg unit-priced shelf record (price_per = KILOGRAM).',
      exclusionReason: null,
      calculationVersion: AFFORDABILITY_ENGINE_VERSION,
    };
  }

  if (rec.packageQuantity === null || !rec.packageUnit) {
    return {
      record: rec,
      targetBasis,
      computable: false,
      value: null,
      unit: unitString,
      transformation: 'Excluded: missing package quantity/unit (no default weight assumed).',
      exclusionReason: 'missing_package_quantity',
      calculationVersion: AFFORDABILITY_ENGINE_VERSION,
    };
  }

  const u = rec.packageUnit;
  if (targetBasis === 'per_kg') {
    if (u === 'g' || u === 'kg' || u === 'mg') {
      const kg = convertMassUnit(rec.packageQuantity, u, 'kg');
      if (!kg || kg <= 0) {
        return {
          record: rec,
          targetBasis,
          computable: false,
          value: null,
          unit: unitString,
          transformation: 'Excluded: invalid mass conversion.',
          exclusionReason: 'unsupported_package_unit',
          calculationVersion: AFFORDABILITY_ENGINE_VERSION,
        };
      }
      return {
        record: rec,
        targetBasis,
        computable: true,
        value: roundTo(rec.packagePriceEur / kg, 2),
        unit: 'EUR / kg',
        transformation: `EUR ${rec.packagePriceEur} / (${rec.packageQuantity} ${u} = ${kg} kg)`,
        exclusionReason: null,
        calculationVersion: AFFORDABILITY_ENGINE_VERSION,
      };
    }
    if (u === 'ml' || u === 'cl' || u === 'l') {
      return {
        record: rec,
        targetBasis,
        computable: false,
        value: null,
        unit: unitString,
        transformation: `Excluded from EUR/kg: liquid SKU measured in '${u}' cannot be equated to kg without density.`,
        exclusionReason: 'incompatible_mass_vs_volume',
        calculationVersion: AFFORDABILITY_ENGINE_VERSION,
      };
    }
  }

  if (targetBasis === 'per_litre') {
    if (u === 'ml' || u === 'cl' || u === 'l') {
      const toLitre: Record<string, number> = { ml: 0.001, cl: 0.01, l: 1 };
      const litres = rec.packageQuantity * toLitre[u];
      return {
        record: rec,
        targetBasis,
        computable: true,
        value: roundTo(rec.packagePriceEur / litres, 2),
        unit: 'EUR / L',
        transformation: `EUR ${rec.packagePriceEur} / (${rec.packageQuantity} ${u} = ${roundTo(litres, 4)} L)`,
        exclusionReason: null,
        calculationVersion: AFFORDABILITY_ENGINE_VERSION,
      };
    }
    if (u === 'g' || u === 'kg' || u === 'mg') {
      return {
        record: rec,
        targetBasis,
        computable: false,
        value: null,
        unit: unitString,
        transformation: `Excluded from EUR/L: solid SKU measured in '${u}'.`,
        exclusionReason: 'incompatible_mass_vs_volume',
        calculationVersion: AFFORDABILITY_ENGINE_VERSION,
      };
    }
  }

  return {
    record: rec,
    targetBasis,
    computable: false,
    value: null,
    unit: unitString,
    transformation: `Excluded: unsupported package unit '${u}'.`,
    exclusionReason: 'unsupported_package_unit',
    calculationVersion: AFFORDABILITY_ENGINE_VERSION,
  };
}

export function aggregateRetailPricesByCategory(
  records: readonly ObservedRetailPriceRecord[],
  targetBasis: RetailPriceBasis
): AnalyticalResult<CategoryRetailPriceAggregate[]> {
  const unitStr =
    targetBasis === 'per_kg' ? 'EUR / kg' : targetBasis === 'per_litre' ? 'EUR / L' : 'EUR / package';
  const evaluated = records.map((r) => evaluateRetailUnitPrice(r, targetBasis));
  const grouped = new Map<string, EvaluatedRetailPrice[]>();

  for (const ev of evaluated) {
    const arr = grouped.get(ev.record.category) ?? [];
    arr.push(ev);
    grouped.set(ev.record.category, arr);
  }

  const summaries: CategoryRetailPriceAggregate[] = [];
  let totalIncluded = 0;

  for (const [cat, items] of Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const vals: number[] = [];
    const exclusionReasons: Record<string, number> = {};
    for (const item of items) {
      if (item.computable && item.value !== null) {
        vals.push(item.value);
      } else if (item.exclusionReason) {
        exclusionReasons[item.exclusionReason] = (exclusionReasons[item.exclusionReason] ?? 0) + 1;
      }
    }
    const sorted = [...vals].sort((a, b) => a - b);
    const n = vals.length;
    totalIncluded += n;

    summaries.push({
      category: cat,
      basis: targetBasis,
      unit: unitStr,
      totalRecords: items.length,
      validDenominator: n,
      excludedCount: items.length - n,
      exclusionReasons,
      mean: n > 0 ? roundTo(vals.reduce((s, x) => s + x, 0) / n, 2) : null,
      median: n > 0 ? roundTo(medianOf(sorted), 2) : null,
      min: n > 0 ? roundTo(sorted[0], 2) : null,
      max: n > 0 ? roundTo(sorted[sorted.length - 1], 2) : null,
      disclosure: `Observed Open Prices EU receipt SKUs on '${unitStr}' basis across n=${n} valid items (unweighted sample of user-submitted receipts, not national CPI weights).`,
    });
  }

  return {
    data: summaries,
    unit: unitStr,
    provenance: {
      module: 'affordabilityEngine.aggregateRetailPricesByCategory',
      version: AFFORDABILITY_ENGINE_VERSION,
      dataNature: 'Observed',
      sources: ['scrapling_retail_claims.parquet (Open Prices EU)'],
      assumptions: [
        `Fixed price basis: ${unitStr}; SKUs lacking verified mass/volume quantity remain excluded.`,
        'Receipt sample skews heavily toward France (FR) and Germany (DE); do not generalize as EU-wide population-weighted shelf price.',
      ],
    },
    missingness: {
      totalRecords: records.length,
      includedRecords: totalIncluded,
      missingOrExcludedRecords: records.length - totalIncluded,
    },
  };
}

export function fromEurostatHicpSeries(
  countryCode: string,
  coicopCode: string,
  coicopLabel: string,
  valuesByYear: Record<string, number>,
  isEuFallback: boolean
): HicpSeriesRecord {
  return {
    countryCode,
    coicopCode,
    coicopLabel,
    indexBase: '2015 = 100',
    isAbsolutePrice: false,
    isEuFallback,
    sourceName: countryCode === 'GBR' ? 'ONS MM23 CPIH' : 'Eurostat prc_hicp_aind (2015 = 100)',
    valuesByYear,
    dataNature: 'Observed',
  };
}

export function analyzeHicpInflation(
  rec: HicpSeriesRecord,
  startYear: number = 2015,
  endYear: number = 2025
): AnalyticalResult<HicpInflationAnalysis> {
  const ys = Object.keys(rec.valuesByYear)
    .map(Number)
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b);

  const vStart = rec.valuesByYear[String(startYear)] ?? null;
  const vEnd = rec.valuesByYear[String(endYear)] ?? null;
  const yearsSpan = endYear - startYear;

  const valid = vStart !== null && vEnd !== null && vStart > 0 && yearsSpan > 0;
  const delta = valid ? roundTo(vEnd - vStart, 2) : null;
  const pct = valid ? roundTo(((vEnd / vStart) - 1) * 100, 2) : null;
  const cagr = valid ? roundTo((Math.pow(vEnd / vStart, 1 / yearsSpan) - 1) * 100, 2) : null;

  return {
    data: {
      countryCode: rec.countryCode,
      coicopCode: rec.coicopCode,
      coicopLabel: rec.coicopLabel,
      startYear: valid ? startYear : ys[0] ?? null,
      endYear: valid ? endYear : ys[ys.length - 1] ?? null,
      startIndex: vStart,
      endIndex: vEnd,
      indexPointsDelta: delta,
      cumulativeChangePct: pct,
      annualizedCagrPct: cagr,
      isEuFallback: rec.isEuFallback,
      interpretationWarning:
        'HICP (2015 = 100) measures temporal inflation of a representative basket only; never interpret an HICP value as an absolute EUR cost or retail SKU price.',
    },
    unit: 'HICP Index (2015 = 100) / % change',
    provenance: {
      module: 'affordabilityEngine.analyzeHicpInflation',
      version: AFFORDABILITY_ENGINE_VERSION,
      dataNature: 'Observed',
      sources: [rec.sourceName],
      assumptions: [
        rec.isEuFallback
          ? `EU-27 aggregate proxy shown because national Eurostat HICP lacks '${rec.countryCode}'.`
          : `National Eurostat HICP index for ${rec.countryCode} · ${rec.coicopCode}.`,
      ],
    },
    missingness: {
      totalRecords: 1,
      includedRecords: valid ? 1 : 0,
      missingOrExcludedRecords: valid ? 0 : 1,
    },
  };
}

export function fromEurostatPppCalibration(
  countryCode: string,
  foodPriceLevelIndex: number,
  referenceYear: number = 2024
): PppBenchmarkRecord {
  return {
    countryCode,
    referenceYear,
    seriesCode: 'prc_ppp_ind (PLI_EU27_2020, A01 Food & non-alcoholic beverages)',
    indexBase: 'EU27_2020 = 100',
    foodPriceLevelIndex: roundTo(foodPriceLevelIndex, 1),
    isPppNotExchangeRate: true,
    dataNature: 'Observed',
  };
}

export function refuseSkuPppConversion(
  sku: ObservedRetailPriceRecord,
  ppp: PppBenchmarkRecord
): { allowed: false; reason: string } {
  return {
    allowed: false,
    reason: `Cannot rescale individual SKU '${sku.productName}' (EUR ${sku.packagePriceEur ?? 'NULL'} in ${sku.countryCode}) into an implied '${ppp.countryCode}' price using aggregate ${ppp.seriesCode} (${ppp.referenceYear} PLI=${ppp.foodPriceLevelIndex}). Macro food A01 PLIs reflect national consumption basket weights, VAT/tax regimes, and store-format mixes rather than single branded SKUs.`,
  };
}

export function fromCoHDRecord(item: {
  iso3: string;
  country_name: string;
  year: number;
  cost_healthy_diet_ppp_usd: number | null;
  unaffordable_pct: number | null;
  unaffordable_millions: number | null;
  data_source?: string;
}): CoHDRecord {
  return {
    iso3: item.iso3,
    countryName: item.country_name,
    year: item.year,
    costHealthyDietPppUsd:
      typeof item.cost_healthy_diet_ppp_usd === 'number' && Number.isFinite(item.cost_healthy_diet_ppp_usd)
        ? roundTo(item.cost_healthy_diet_ppp_usd, 2)
        : null,
    unaffordablePct:
      typeof item.unaffordable_pct === 'number' && Number.isFinite(item.unaffordable_pct)
        ? roundTo(item.unaffordable_pct, 1)
        : null,
    unaffordableMillions:
      typeof item.unaffordable_millions === 'number' && Number.isFinite(item.unaffordable_millions)
        ? roundTo(item.unaffordable_millions, 2)
        : null,
    currencyBasis: 'ICP PPP USD / person / day',
    basketDefinition: 'FAO/World Bank least-cost locally available foods meeting national food-based dietary guidelines (2,330 kcal/day reference)',
    householdContext: 'National population headcount unable to afford least-cost healthy diet (>52% of household income threshold)',
    sourceName: item.data_source ?? 'World Bank & FAO Food Prices for Nutrition (ICP PPP)',
    dataNature: 'Observed',
  };
}

export function summarizeCoHDBenchmarks(
  records: readonly CoHDRecord[]
): AnalyticalResult<CoHDSummary> {
  const validCosts = records
    .map((r) => r.costHealthyDietPppUsd)
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b);
  const validUnafford = records.filter((r) => r.unaffordablePct !== null).length;
  const years = records.map((r) => r.year).filter((y) => Number.isFinite(y));

  return {
    data: {
      referenceYearCoverage:
        years.length > 0 ? `${Math.min(...years)}–${Math.max(...years)}` : 'None',
      totalRows: records.length,
      validCostDenominator: validCosts.length,
      validUnaffordDenominator: validUnafford,
      meanCostPppUsd:
        validCosts.length > 0
          ? roundTo(validCosts.reduce((s, v) => s + v, 0) / validCosts.length, 2)
          : null,
      medianCostPppUsd: validCosts.length > 0 ? roundTo(medianOf(validCosts), 2) : null,
      minCostPppUsd: validCosts.length > 0 ? validCosts[0] : null,
      maxCostPppUsd: validCosts.length > 0 ? validCosts[validCosts.length - 1] : null,
      scopeDisclosure:
        'Measures daily macro cost of a least-cost healthy diet in ICP PPP USD/person/day; cannot be equated to individual retail product prices.',
    },
    unit: 'ICP PPP USD / person / day',
    provenance: {
      module: 'affordabilityEngine.summarizeCoHDBenchmarks',
      version: AFFORDABILITY_ENGINE_VERSION,
      dataNature: 'Observed',
      sources: ['global_healthy_diet_affordability.parquet'],
      assumptions: [
        'Costs expressed in World Bank ICP Purchasing Power Parity USD/day (not market FX EUR).',
        'Missing unaffordability counts remain excluded from unaffordability denominators.',
      ],
    },
    missingness: {
      totalRecords: records.length,
      includedRecords: validCosts.length,
      missingOrExcludedRecords: records.length - validCosts.length,
    },
  };
}

export function checkAffordabilityLayerCompatibility(
  layerA: AffordabilityDataLayer,
  layerB: AffordabilityDataLayer,
  geoA?: string,
  geoB?: string
): {
  compatible: boolean;
  reasons: string[];
  guidance: string;
} {
  const reasons: string[] = [];
  if (layerA !== layerB) {
    reasons.push(
      `Incompatible economic data layers: '${layerA}' vs '${layerB}' cannot be merged or arithmetically compared (distinct currencies, bases, and observational units).`
    );
  }
  if (geoA && geoB && geoA.toUpperCase() !== geoB.toUpperCase()) {
    reasons.push(
      `Geographic scope mismatch: '${geoA.toUpperCase()}' vs '${geoB.toUpperCase()}'—retail markets, VAT regimes, and purchasing power differ across jurisdictions.`
    );
  }
  return {
    compatible: reasons.length === 0,
    reasons,
    guidance:
      reasons.length === 0
        ? 'Compatible economic layer and jurisdiction.'
        : 'Display each affordability layer separately with explicit currency, index base, and geographical context.',
  };
}
