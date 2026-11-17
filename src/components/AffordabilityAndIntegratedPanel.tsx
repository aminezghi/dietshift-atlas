import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileJson,
  Layers,
  Scale,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { IntegratedRobustnessPanel } from './IntegratedRobustnessPanel';
import {
  type OpenPricesSkuInput,
  type RetailPriceBasis,
  aggregateRetailPricesByCategory,
  analyzeHicpInflation,
  fromCoHDRecord,
  fromEurostatHicpSeries,
  fromEurostatPppCalibration,
  fromOpenPricesSku,
  refuseSkuPppConversion,
} from '../analytics/affordabilityEngine';
import type { ClassificationMappingRecord } from '../analytics/classificationEngine';
import {
  type ComparatorRankingDimension,
  type IntegratedSupportLevel,
  attemptUnifiedFoodScore,
  buildIntegratedCategoryProfiles,
  rankCategoriesWithinDimension,
} from '../analytics/integratedComparator';
import { fromOFFProduct } from '../analytics/nutritionEngine';
import type { AgribalyseItem, EurostatCountryData, OFFProduct } from '../types/research';
import { fetchCachedJson } from '../services/dataProvider';
import { downloadCsvContent, downloadJsonPayload, serializeCsvTable } from '../utils/exportDownload';
import { DataNatureBadge } from './DataNatureBadge';

interface AffordabilityAndIntegratedPanelProps {
  selectedCountry: string;
  countryName: string;
  countryGeoName: string;
  hicpTargetCode: string;
  isHicpFallback: boolean;
  hicpData: EurostatCountryData | null;
  pppIndexEu27: number | null;
  cohdRecords: Array<{
    iso3: string;
    country_name: string;
    geojson_name: string;
    year: number;
    cost_healthy_diet_ppp_usd: number;
    unaffordable_pct: number | null;
    unaffordable_millions: number | null;
    data_source?: string;
  }>;
  offProducts: OFFProduct[];
  agribalyseItems: AgribalyseItem[];
}

const SUPPORT_BADGES: Record<IntegratedSupportLevel, { label: string; cls: string }> = {
  directly_supported: { label: 'Supported', cls: 'border-[#163d4a] text-[#163d4a] bg-[#163d4a]/10' },
  approximate_or_hierarchical: {
    label: 'Hierarchical / Approx.',
    cls: 'border-[#6b4c1b] text-[#6b4c1b] bg-[#6b4c1b]/10',
  },
  ambiguous_split: { label: 'Ambiguous Split', cls: 'border-[#8a1253] text-[#8a1253] bg-[#8a1253]/10' },
  unsupported_unmatched: {
    label: 'Unmatched Gap',
    cls: 'border-[#7c2d12] text-[#7c2d12] bg-[#7c2d12]/10',
  },
};

export function AffordabilityAndIntegratedPanel({
  selectedCountry,
  countryName,
  countryGeoName,
  hicpTargetCode,
  isHicpFallback,
  hicpData,
  pppIndexEu27,
  cohdRecords,
  offProducts,
  agribalyseItems,
}: AffordabilityAndIntegratedPanelProps) {
  const [view, setView] = useState<'integrated' | 'affordability' | 'robustness'>('integrated');
  const [retailBasis, setRetailBasis] = useState<RetailPriceBasis>('per_kg');
  const [rankDimension, setRankDimension] = useState<ComparatorRankingDimension>('agb_climate_co2eq_per_kg');
  const [rankDesc, setRankDesc] = useState<boolean>(true);

  const [mappings, setMappings] = useState<ClassificationMappingRecord[]>([]);
  const [scraplingRaw, setScraplingRaw] = useState<OpenPricesSkuInput[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchCachedJson<ClassificationMappingRecord[]>('data/classification_mappings.json'),
      fetchCachedJson<OpenPricesSkuInput[]>('data/scrapling_retail_claims.json'),
    ])
      .then(([mData, sData]) => {
        if (!cancelled) {
          setMappings(mData);
          setScraplingRaw(sData);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const retailRecords = useMemo(() => scraplingRaw.map(fromOpenPricesSku), [scraplingRaw]);
  const retailCategorySummary = useMemo(
    () => aggregateRetailPricesByCategory(retailRecords, retailBasis),
    [retailRecords, retailBasis]
  );

  const pppRecord = useMemo(
    () =>
      pppIndexEu27 !== null
        ? fromEurostatPppCalibration(hicpTargetCode, pppIndexEu27, 2024)
        : null,
    [hicpTargetCode, pppIndexEu27]
  );

  const cohdLatest = useMemo(() => {
    const match = cohdRecords.find(
      (c) =>
        c.geojson_name.toLowerCase() === countryGeoName.toLowerCase() ||
        c.iso3 === selectedCountry
    );
    return match ? fromCoHDRecord(match) : null;
  }, [cohdRecords, countryGeoName, selectedCountry]);

  const hicpBasketOverview = useMemo(() => {
    if (!hicpData) return [];
    return Object.entries(hicpData.categories).map(([code, cat]) =>
      analyzeHicpInflation(
        fromEurostatHicpSeries(hicpTargetCode, code, cat.label, cat.series, isHicpFallback),
        2015,
        2025
      ).data
    );
  }, [hicpData, hicpTargetCode, isHicpFallback]);

  const nutritionInputs = useMemo(() => offProducts.map(fromOFFProduct), [offProducts]);

  const integratedWorkspace = useMemo(
    () =>
      buildIntegratedCategoryProfiles({
        mappings,
        nutritionInputs,
        agribalyseItems,
        retailPriceRecords: retailRecords,
        hicpCountryCode: hicpTargetCode,
        hicpData,
        isHicpEuFallback: isHicpFallback,
        pppBenchmark: pppRecord,
        cohdLatest,
      }),
    [
      mappings,
      nutritionInputs,
      agribalyseItems,
      retailRecords,
      hicpTargetCode,
      hicpData,
      isHicpFallback,
      pppRecord,
      cohdLatest,
    ]
  );

  const dimensionRanking = useMemo(
    () => rankCategoriesWithinDimension(integratedWorkspace.data.profiles, rankDimension, rankDesc),
    [integratedWorkspace.data.profiles, rankDimension, rankDesc]
  );

  const compositeRefusal = useMemo(() => attemptUnifiedFoodScore({}), []);
  const pppRefusalExample = useMemo(() => {
    if (!retailRecords.length || !pppRecord) return null;
    return refuseSkuPppConversion(retailRecords[0], pppRecord);
  }, [retailRecords, pppRecord]);

  const exportIntegratedJson = () => {
    downloadJsonPayload(
      integratedWorkspace,
      `dietshift_integrated_comparison_${selectedCountry}.json`
    );
  };

  const exportIntegratedCsv = () => {
    const headers = [
      'Category_ID',
      'Category_Label',
      'Support_Level',
      'FoodEx2',
      'FoodEx2_MapType',
      'COICOP',
      'COICOP_MapType',
      'OFF_Products_N',
      'OFF_Mean_Kcal_100g',
      'OFF_Mean_Protein_g_100g',
      'Agribalyse_Matched_N',
      'Agribalyse_Mean_CO2_kg_kg_ModelOutput',
      'Agribalyse_Mean_Water_AWARE_m3_kg_ModelOutput',
      'Macro_HICP_2015_2025_Pct',
      'Exact_Barcode_Price_Matches_N',
    ];
    const rows = integratedWorkspace.data.profiles.map((p) => [
      p.categoryId,
      p.categoryLabel,
      p.supportLevel,
      p.classificationEvidence.foodex2Code ?? '',
      p.classificationEvidence.foodex2MappingType,
      p.classificationEvidence.coicopCode ?? '',
      p.classificationEvidence.coicopMappingType,
      p.nutritionPer100g?.totalProducts ?? 0,
      p.nutritionPer100g?.meanKcal ?? '',
      p.nutritionPer100g?.meanProteinG ?? '',
      p.environmentPerKg?.matchedItemsDenominator ?? 0,
      p.environmentPerKg?.meanCo2KgPerKg ?? '',
      p.environmentPerKg?.meanWaterAwareM3PerKg ?? '',
      p.macroInflationContext?.analysis.cumulativeChangePct ?? '',
      p.observedBarcodePriceMatches.matchedSkuCount,
    ]);
    downloadCsvContent(
      serializeCsvTable(headers, rows),
      `dietshift_integrated_comparison_${selectedCountry}.csv`
    );
  };

  const ws = integratedWorkspace.data;

  return (
    <div className="space-y-5">
      <div className="almanac-sheet p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 rule-firm">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--color-accent)]" />
                Affordability Engine &amp; Integrated Category Comparator
              </h2>
              <DataNatureBadge nature="Observed" label="Nutrition · Macro" />
              <DataNatureBadge nature="Model Output" label="Agribalyse LCA" />
              <span className="px-2 py-0.5 border border-[var(--color-rule)] font-mono-num text-[11px] bg-[var(--color-well)]">
                v{integratedWorkspace.provenance.version}
              </span>
            </div>
            <p className="almanac-label mt-1">
              Synthesizes Nutrition (Observed), Environmental LCA (Model Output), Affordability (Observed EU SKUs + Macro HICP/PPP/CoHD), and Classification Mapping provenance without mixing units or fabricating unified scores.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setView('integrated')}
              className={`almanac-btn text-xs flex items-center gap-1.5 ${
                view === 'integrated' ? 'almanac-btn--primary' : ''
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              Integrated Comparator ({ws.profiles.length})
            </button>
            <button
              onClick={() => setView('affordability')}
              className={`almanac-btn text-xs flex items-center gap-1.5 ${
                view === 'affordability' ? 'almanac-btn--primary' : ''
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              4-Layer Affordability Audit
            </button>
            <button
              onClick={() => setView('robustness')}
              data-testid="tab-phase4d-robustness"
              className={`almanac-btn text-xs flex items-center gap-1.5 ${
                view === 'robustness' ? 'almanac-btn--primary' : ''
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Phase 4D: Robustness &amp; Matrix
            </button>
          </div>
        </div>

        {loadErr && (
          <div className="p-3 border border-[#8a1253] bg-[#8a1253]/10 text-xs text-[#8a1253]">
            Dataset load warning: {loadErr}
          </div>
        )}

        {/* Strict Separate National Macro Context Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 border border-[var(--color-rule)] bg-[var(--color-sheet)] text-xs">
          <div className="p-2.5 rule-hair-right">
            <div className="almanac-label text-[11px]">Active Jurisdiction Context</div>
            <div className="font-semibold text-[var(--color-ink)] mt-0.5">
              [{selectedCountry}] {countryName}
            </div>
            <div className="font-mono-num text-[10px] text-[var(--color-muted)]">
              HICP scope: {hicpTargetCode} {isHicpFallback ? '(EU-27 fallback)' : '(National)'}
            </div>
          </div>
          <div className="p-2.5 rule-hair-right">
            <div className="almanac-label text-[11px]">PPP Food PLI (EU27=100, 2024)</div>
            <div className="font-mono-num font-semibold text-base text-[var(--color-ink)]">
              {pppRecord ? pppRecord.foodPriceLevelIndex : 'N/A'}
            </div>
            <div className="font-mono-num text-[10px] text-[var(--color-muted)]">
              Not FX; basket index only
            </div>
          </div>
          <div className="p-2.5 rule-hair-right">
            <div className="almanac-label text-[11px]">WB/FAO Healthy Diet Cost (2024)</div>
            <div className="font-mono-num font-semibold text-base text-[#163d4a]">
              {cohdLatest?.costHealthyDietPppUsd != null
                ? `$${cohdLatest.costHealthyDietPppUsd} ICP PPP/d`
                : 'N/A'}
            </div>
            <div className="font-mono-num text-[10px] text-[var(--color-muted)]">
              Unaffordability: {cohdLatest?.unaffordablePct != null ? `${cohdLatest.unaffordablePct}%` : 'N/A'}
            </div>
          </div>
          <div className="p-2.5">
            <div className="almanac-label text-[11px]">Observed Retail SKUs (EU Open Prices)</div>
            <div className="font-mono-num font-semibold text-base text-[var(--color-accent)]">
              {retailCategorySummary.missingness.includedRecords.toLocaleString()} /{' '}
              {retailCategorySummary.missingness.totalRecords.toLocaleString()}
            </div>
            <div className="font-mono-num text-[10px] text-[var(--color-muted)]">
              Valid on {retailBasis} basis
            </div>
          </div>
        </div>

        <div className="p-2.5 border border-[#8a1253]/40 bg-[var(--color-well)] text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#8a1253] shrink-0 mt-0.5" />
          <span>
            <b>Comparability Guard:</b> {compositeRefusal.reason} {ws.countryAffordabilityContext.macroBoundaryWarning}
          </span>
        </div>

        {view === 'integrated' && (
          <div className="space-y-4">
            {/* Support Summary Strip & Single-Dimension Ranking Controls */}
            <div className="flex flex-wrap items-end justify-between gap-3 pb-3 rule-hair-bottom">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2 py-1 border border-[#163d4a] bg-[#163d4a]/10 font-mono-num">
                  Directly Supported: <b>{ws.supportSummary.directly_supported}</b>
                </span>
                <span className="px-2 py-1 border border-[#6b4c1b] bg-[#6b4c1b]/10 font-mono-num">
                  Hierarchical / Approx: <b>{ws.supportSummary.approximate_or_hierarchical}</b>
                </span>
                <span className="px-2 py-1 border border-[#8a1253] bg-[#8a1253]/10 font-mono-num">
                  Ambiguous Splits: <b>{ws.supportSummary.ambiguous_split}</b>
                </span>
                <span className="px-2 py-1 border border-[#7c2d12] bg-[#7c2d12]/10 font-mono-num">
                  Unmatched Gaps: <b>{ws.supportSummary.unsupported_unmatched}</b>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={rankDimension}
                  onChange={(e) => setRankDimension(e.target.value as ComparatorRankingDimension)}
                  className="almanac-select text-xs"
                  aria-label="Within-dimension ranking selector"
                >
                  <option value="agb_climate_co2eq_per_kg">Rank by: Agribalyse Climate (kg CO₂eq/kg)</option>
                  <option value="agb_water_aware_m3_per_kg">Rank by: Agribalyse Water AWARE (m³/kg)</option>
                  <option value="protein_per_100g">Rank by: OFF Protein (g/100g)</option>
                  <option value="fiber_per_100g">Rank by: OFF Fiber (g/100g)</option>
                  <option value="sugars_per_100g">Rank by: OFF Sugars (g/100g)</option>
                  <option value="energy_kcal_per_100g">Rank by: OFF Energy (kcal/100g)</option>
                  <option value="hicp_inflation_pct">Rank by: Macro HICP % Change (2015–2025)</option>
                </select>
                <button
                  onClick={() => setRankDesc((v) => !v)}
                  className="almanac-btn text-xs"
                >
                  {rankDesc ? 'Desc ↓' : 'Asc ↑'}
                </button>
                <button onClick={exportIntegratedCsv} className="almanac-btn text-xs flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button onClick={exportIntegratedJson} className="almanac-btn text-xs flex items-center gap-1">
                  <FileJson className="w-3.5 h-3.5" /> JSON
                </button>
              </div>
            </div>

            {/* Integrated Multi-Dimension Matrix (Strictly Unmerged Columns) */}
            <div className="overflow-x-auto max-h-96 border border-[var(--color-rule)]">
              <table className="almanac-table">
                <thead>
                  <tr>
                    <th>Category &amp; Mapping Support</th>
                    <th>Classification Bridges</th>
                    <th className="text-right">Nutrition [Observed · per 100g]</th>
                    <th className="text-right">Environment [Model Output · FR per kg]</th>
                    <th className="text-right">Macro HICP (2015–25)</th>
                    <th className="text-right">Barcode SKU Matches</th>
                  </tr>
                </thead>
                <tbody>
                  {ws.profiles.map((p) => {
                    const sb = SUPPORT_BADGES[p.supportLevel];
                    return (
                      <tr key={p.categoryId} title={p.classificationEvidence.rationaleSummary}>
                        <td>
                          <div className="font-semibold text-xs text-[var(--color-ink)]">{p.categoryLabel}</div>
                          <span className={`inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-mono-num border ${sb.cls}`}>
                            {sb.label}
                          </span>
                        </td>
                        <td className="font-mono-num text-[11px]">
                          <div>
                            FX2: <b>{p.classificationEvidence.foodex2Code ?? 'NULL'}</b> ({p.classificationEvidence.foodex2MappingType})
                          </div>
                          <div>
                            COICOP: <b>{p.classificationEvidence.coicopCode ?? 'NULL'}</b> ({p.classificationEvidence.coicopMappingType})
                          </div>
                          {p.classificationEvidence.ambiguousNotes.length > 0 && (
                            <div className="text-[10px] text-[#8a1253] max-w-xs truncate" title={p.classificationEvidence.ambiguousNotes.join(' ')}>
                              ⚠ {p.classificationEvidence.ambiguousNotes[0]}
                            </div>
                          )}
                        </td>
                        <td className="num text-right text-xs">
                          {p.nutritionPer100g ? (
                            <div>
                              <div>
                                Prot: <b>{p.nutritionPer100g.meanProteinG ?? 'N/A'}g</b> (n={p.nutritionPer100g.proteinDenominator})
                              </div>
                              <div className="text-[10px] text-[var(--color-muted)]">
                                {p.nutritionPer100g.meanKcal ?? 'N/A'} kcal · Sug: {p.nutritionPer100g.meanSugarsG ?? 'N/A'}g
                              </div>
                            </div>
                          ) : (
                            <span className="text-[var(--color-muted)]">N/A (No OFF)</span>
                          )}
                        </td>
                        <td className="num text-right text-xs">
                          {p.environmentPerKg ? (
                            <div>
                              <div className="font-semibold text-[var(--color-accent)]">
                                {p.environmentPerKg.meanCo2KgPerKg ?? 'N/A'} kg CO₂eq/kg
                              </div>
                              <div className="text-[10px] text-[var(--color-muted)]">
                                Water: {p.environmentPerKg.meanWaterAwareM3PerKg ?? 'N/A'} m³/kg (n={p.environmentPerKg.matchedItemsDenominator})
                              </div>
                            </div>
                          ) : (
                            <span className="text-[var(--color-muted)]">N/A (Unmapped)</span>
                          )}
                        </td>
                        <td className="num text-right text-xs">
                          {p.macroInflationContext ? (
                            <div>
                              <b>
                                {p.macroInflationContext.analysis.cumulativeChangePct != null
                                  ? `${p.macroInflationContext.analysis.cumulativeChangePct > 0 ? '+' : ''}${p.macroInflationContext.analysis.cumulativeChangePct}%`
                                  : 'N/A'}
                              </b>
                              <div className="text-[10px] text-[var(--color-muted)]">
                                {p.macroInflationContext.coicopCode} ({p.macroInflationContext.analysis.countryCode})
                              </div>
                            </div>
                          ) : (
                            <span className="text-[var(--color-muted)]">No HICP</span>
                          )}
                        </td>
                        <td className="num text-right text-xs" title={p.observedBarcodePriceMatches.exclusionNote}>
                          {p.observedBarcodePriceMatches.matchedSkuCount > 0 ? (
                            <span>
                              <b>{p.observedBarcodePriceMatches.matchedSkuCount}</b> SKUs
                              {p.observedBarcodePriceMatches.medianEurPerKg != null && (
                                <span className="block text-[10px] text-[var(--color-muted)]">
                                  Med: €{p.observedBarcodePriceMatches.medianEurPerKg}/kg
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[var(--color-muted)]">0 matches</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Single-Dimension Ranking Strip */}
            <div className="almanac-well p-4 border border-[var(--color-rule)] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[var(--color-ink)]">
                  Single-Dimension Projection Ranking ({dimensionRanking.data[0]?.unit ?? rankDimension})
                </span>
                <span className="font-mono-num text-[11px] text-[var(--color-muted)]">
                  Included: {dimensionRanking.missingness.includedRecords} · Excluded (missing): {dimensionRanking.missingness.missingOrExcludedRecords}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {dimensionRanking.data.slice(0, 8).map((row) => (
                  <div key={row.categoryId} className="p-2 bg-[var(--color-sheet)] border border-[var(--color-rule)] text-xs">
                    <div className="flex items-center justify-between font-mono-num text-[10px] text-[var(--color-muted)]">
                      <span>#{row.rank}</span>
                      <span>{row.dataNature}</span>
                    </div>
                    <div className="font-semibold text-[var(--color-ink)] truncate" title={row.categoryLabel}>
                      {row.categoryLabel}
                    </div>
                    <div className="font-mono-num text-sm font-semibold text-[var(--color-accent)]">
                      {row.value} {row.unit}
                    </div>
                    <div className="font-mono-num text-[10px] text-[var(--color-muted)] truncate">
                      {row.caveat}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'affordability' && (
          <div className="space-y-5">
            {/* Layer 1: Observed Retail Shelf Prices (Open Prices EU) */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-[#163d4a]" />
                    Layer 1: Observed EU Retail SKU Prices (Open Prices EU · Unweighted Sample)
                    <DataNatureBadge nature="Observed" />
                  </h3>
                  <p className="almanac-label text-xs">
                    Unit conversions computed strictly from observed product_quantity &amp; unit (missing quantities and liquid/solid mismatches excluded).
                  </p>
                </div>

                <div className="flex items-center gap-1" role="group" aria-label="Retail price basis">
                  {(
                    [
                      { id: 'per_kg', lbl: 'EUR / kg (Mass SKUs)' },
                      { id: 'per_litre', lbl: 'EUR / L (Liquid SKUs)' },
                      { id: 'per_package', lbl: 'EUR / package (All)' },
                    ] as { id: RetailPriceBasis; lbl: string }[]
                  ).map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setRetailBasis(b.id)}
                      className={`almanac-btn text-xs ${retailBasis === b.id ? 'almanac-btn--primary' : ''}`}
                    >
                      {b.lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto border border-[var(--color-rule)]">
                <table className="almanac-table">
                  <thead>
                    <tr>
                      <th>Retail Claim / Basket Pillar</th>
                      <th className="text-right">Valid SKUs</th>
                      <th className="text-right">Excluded SKUs</th>
                      <th className="text-right">Mean ({retailCategorySummary.unit})</th>
                      <th className="text-right">Median ({retailCategorySummary.unit})</th>
                      <th className="text-right">Min – Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retailCategorySummary.data.map((row) => (
                      <tr key={row.category} title={row.disclosure}>
                        <td className="font-semibold text-xs text-[var(--color-ink)]">{row.category}</td>
                        <td className="num text-right text-xs">
                          {row.validDenominator} / {row.totalRecords}
                        </td>
                        <td className="num text-right text-xs text-[var(--color-muted)]">{row.excludedCount}</td>
                        <td className="num text-right text-xs font-semibold text-[#163d4a]">
                          {row.mean !== null ? `€${row.mean.toFixed(2)}` : 'N/A'}
                        </td>
                        <td className="num text-right text-xs">
                          {row.median !== null ? `€${row.median.toFixed(2)}` : 'N/A'}
                        </td>
                        <td className="num text-right text-xs text-[var(--color-muted)]">
                          {row.min !== null && row.max !== null
                            ? `€${row.min.toFixed(2)} – €${row.max.toFixed(2)}`
                            : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Layer 2 & 3: Macro HICP & PPP Refusal Audit */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="almanac-well p-4 border border-[var(--color-rule)] space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#8a1253]" />
                  Layer 2: HICP Inflation Indices (2015 = 100, Not EUR Cost)
                </h4>
                <div className="overflow-x-auto max-h-56">
                  <table className="almanac-table">
                    <thead>
                      <tr>
                        <th>COICOP Division</th>
                        <th className="text-right">2015</th>
                        <th className="text-right">2025</th>
                        <th className="text-right">Change (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hicpBasketOverview.map((h) => (
                        <tr key={h.coicopCode}>
                          <td className="text-xs">
                            <b>{h.coicopCode}</b> · {h.coicopLabel}
                          </td>
                          <td className="num text-right text-xs">{h.startIndex ?? 'N/A'}</td>
                          <td className="num text-right text-xs">{h.endIndex ?? 'N/A'}</td>
                          <td className="num text-right text-xs font-semibold text-[var(--color-accent)]">
                            {h.cumulativeChangePct != null ? `+${h.cumulativeChangePct}%` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="almanac-well p-4 border border-[var(--color-rule)] space-y-2 text-xs">
                <h4 className="text-sm font-semibold">Layer 3 &amp; 4: PPP &amp; CoHD Guardrail Disclosure</h4>
                {pppRefusalExample && (
                  <p className="text-[var(--color-ink-2)] leading-relaxed">{pppRefusalExample.reason}</p>
                )}
                {cohdLatest && (
                  <div className="p-2.5 bg-[var(--color-sheet)] border border-[var(--color-rule)] font-mono-num text-[11px]">
                    <b>{cohdLatest.countryName} ({cohdLatest.iso3}, {cohdLatest.year}):</b> $
                    {cohdLatest.costHealthyDietPppUsd} {cohdLatest.currencyBasis} ·{' '}
                    {cohdLatest.basketDefinition}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'robustness' && (
          <IntegratedRobustnessPanel
            selectedCountry={selectedCountry}
            countryName={countryName}
            mappings={mappings}
            nutritionInputs={nutritionInputs}
            agribalyseItems={agribalyseItems}
            retailPriceRecords={retailRecords}
            hicpCountryCode={hicpTargetCode}
            hicpData={hicpData}
            isHicpEuFallback={isHicpFallback}
            pppBenchmark={pppRecord}
            cohdLatest={cohdLatest}
          />
        )}
      </div>
    </div>
  );
}
