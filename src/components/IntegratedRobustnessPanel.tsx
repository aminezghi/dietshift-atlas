import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileJson,
  Filter,
  Globe2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type {
  CoHDRecord,
  ObservedRetailPriceRecord,
  PppBenchmarkRecord,
} from '../analytics/affordabilityEngine';
import type { ClassificationMappingRecord } from '../analytics/classificationEngine';
import type { GITerroirInput, PooreLcaInput } from '../analytics/environmentEngine';
import {
  CATEGORY_EVIDENCE_LAYER_ORDER,
  type CategoryEvidenceLayerId,
  type EvidenceNatureTag,
  type RobustnessLayerId,
  evaluateIntegratedRobustnessSuite,
  serializeIntegratedRobustnessCsv,
} from '../analytics/integratedRobustness';
import type { StandardizedNutritionInput } from '../analytics/nutritionEngine';
import type { AgribalyseItem, EurostatCountryData } from '../types/research';
import { fetchCachedJson, fetchGiTerroirBundle } from '../services/dataProvider';
import { downloadCsvContent, downloadJsonPayload } from '../utils/exportDownload';
import { classifyResourceError, type ResourceDisclosure } from '../utils/resourceAvailability';
import { DataNatureBadge } from './DataNatureBadge';
import { ResourceDisclosureBanner } from './ResourceDisclosureBanner';

interface IntegratedRobustnessPanelProps {
  selectedCountry: string;
  countryName: string;
  mappings: readonly ClassificationMappingRecord[];
  nutritionInputs: readonly StandardizedNutritionInput[];
  agribalyseItems: readonly AgribalyseItem[];
  retailPriceRecords: readonly ObservedRetailPriceRecord[];
  hicpCountryCode: string;
  hicpData: EurostatCountryData | null;
  isHicpEuFallback: boolean;
  pppBenchmark: PppBenchmarkRecord | null;
  cohdLatest: CoHDRecord | null;
}

const LAYER_LABELS: Record<CategoryEvidenceLayerId, string> = {
  classification_bridge: 'Classification Bridge',
  nutrition_per_100g: 'Nutrition (per 100g)',
  nutrition_per_100kcal: 'Nutrition (per 100 kcal)',
  nutrition_per_serving: 'Nutrition (per serving)',
  environment_agribalyse: 'Env: Agribalyse',
  environment_poore: 'Env: Poore & Nemecek',
  environment_gi_proxy: 'Env: GI Proxy (FOOD)',
  affordability_retail_sku_eur_kg: 'Retail SKU (EUR/kg)',
};

function natureBadgeProps(nature: EvidenceNatureTag) {
  if (nature === 'Observed') return <DataNatureBadge nature="Observed" />;
  if (nature === 'Estimated') return <DataNatureBadge nature="Estimated" />;
  if (nature === 'Model Output') return <DataNatureBadge nature="Model Output" />;
  if (nature === 'Proxy') return <DataNatureBadge nature="Estimated" label="Class Proxy" />;
  return (
    <span className="px-1.5 py-0.5 text-[10px] border border-[#7c2d12]/40 bg-[#7c2d12]/10 text-[#7c2d12] font-mono-num">
      Missing
    </span>
  );
}

export function IntegratedRobustnessPanel({
  selectedCountry,
  countryName,
  mappings,
  nutritionInputs,
  agribalyseItems,
  retailPriceRecords,
  hicpCountryCode,
  hicpData,
  isHicpEuFallback,
  pppBenchmark,
  cohdLatest,
}: IntegratedRobustnessPanelProps) {
  const [layerFilter, setLayerFilter] = useState<'all' | RobustnessLayerId>('all');
  const [pooreItems, setPooreItems] = useState<PooreLcaInput[]>([]);
  const [giItems, setGiItems] = useState<GITerroirInput[]>([]);
  const [auxLoading, setAuxLoading] = useState(true);
  const [retryTick, setRetryTick] = useState(0);
  const [auxDisclosures, setAuxDisclosures] = useState<ResourceDisclosure[]>([]);

  useEffect(() => {
    let cancelled = false;
    const forceRetry = retryTick > 0;

    Promise.allSettled([
      fetchCachedJson<{ poore_nemecek_lca?: PooreLcaInput[] }>('data/global_benchmarks.json', { forceRetry }),
      fetchGiTerroirBundle<{ gi_terroir_records?: GITerroirInput[] }>({ forceRetry }),
    ]).then(([gbRes, giRes]) => {
      if (cancelled) return;
      const nextDisclosures: ResourceDisclosure[] = [];

      if (gbRes.status === 'fulfilled') {
        setPooreItems(gbRes.value.poore_nemecek_lca ?? []);
      } else {
        setPooreItems([]);
        nextDisclosures.push(
          classifyResourceError(gbRes.reason, {
            resourcePath: 'data/global_benchmarks.json',
            resourceLabel: 'Poore & Nemecek global LCA benchmarks',
            availableSummary: 'ADEME Agribalyse 3.1.1, Open Food Facts nutrition, Open Prices EU SKUs, and classification scenarios remain active.',
          })
        );
      }

      if (giRes.status === 'fulfilled') {
        setGiItems(giRes.value.gi_terroir_records ?? []);
      } else {
        setGiItems([]);
        nextDisclosures.push(
          classifyResourceError(giRes.reason, {
            resourcePath: 'data/gi_terroir_bundle.json',
            availableSummary:
              'Poore & Nemecek LCA (45 commodities), Agribalyse 3.1.1, Open Food Facts nutrition, Open Prices EU retail SKUs, and all 12 Phase 4D robustness scenarios remain active. GI class proxy cells are marked Missing without synthetic substitution.',
          })
        );
      }

      setAuxDisclosures(nextDisclosures);
      setAuxLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  const suiteResult = useMemo(
    () =>
      evaluateIntegratedRobustnessSuite({
        mappings,
        nutritionInputs,
        agribalyseItems,
        pooreItems,
        giItems,
        retailPriceRecords,
        hicpCountryCode,
        hicpData,
        isHicpEuFallback,
        pppBenchmark,
        cohdLatest,
      }),
    [
      mappings,
      nutritionInputs,
      agribalyseItems,
      pooreItems,
      giItems,
      retailPriceRecords,
      hicpCountryCode,
      hicpData,
      isHicpEuFallback,
      pppBenchmark,
      cohdLatest,
    ]
  );

  const ws = suiteResult.data;
  const filteredScenarios = useMemo(
    () =>
      layerFilter === 'all'
        ? ws.scenarios
        : ws.scenarios.filter((s) => s.layer === layerFilter),
    [ws.scenarios, layerFilter]
  );

  const frScenario = ws.scenarios.find((s) => s.scenarioId === 'rob_aff_fr_subset');
  const deScenario = ws.scenarios.find((s) => s.scenarioId === 'rob_aff_de_subset');
  const per100kcalScenario = ws.scenarios.find((s) => s.scenarioId === 'rob_nut_derived_per100kcal');
  const agbWeightScenario = ws.scenarios.find(
    (s) => s.scenarioId === 'rob_env_agb_lci_count_vs_equal_subgroup'
  );

  const canExport = ws.scenarios.length > 0;

  const exportCsv = () => {
    if (!canExport) return;
    const csv = serializeIntegratedRobustnessCsv({
      countryCode: selectedCountry,
      workspace: ws,
    });
    downloadCsvContent(
      csv,
      `dietshift_integrated_robustness_${selectedCountry}.csv`
    );
  };

  const exportJson = () => {
    if (!canExport) return;
    downloadJsonPayload(
      {
        ...suiteResult,
        auxiliaryAvailability: {
          pooreItemsCount: pooreItems.length,
          giItemsCount: giItems.length,
          giProxyAvailable: giItems.length > 0,
          disclosures: auxDisclosures,
        },
      },
      `dietshift_integrated_robustness_${selectedCountry}.json`
    );
  };

  return (
    <div className="space-y-5" data-testid="phase4d-robustness-panel">
      {/* Header & Disclosure Bar */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 rule-hair">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">
              Phase 4D — Integrated Comparator Robustness &amp; Evidence Coverage Matrix
            </h3>
            <span className="px-2 py-0.5 border border-[var(--color-rule)] font-mono-num text-[11px] bg-[var(--color-well)]">
              v{suiteResult.provenance.version}
            </span>
          </div>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            Stress-tests classification regimes, nutrient completeness/functional units, separate LCI/proxy boundaries, and observed EU retail barcode slices while isolating HICP/PPP/CoHD macro indicators.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!canExport}
            aria-disabled={!canExport}
            data-testid="phase4d-export-csv"
            className="almanac-btn text-xs flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            Export Robustness CSV
          </button>
          <button
            type="button"
            onClick={exportJson}
            disabled={!canExport}
            aria-disabled={!canExport}
            data-testid="phase4d-export-json"
            className="almanac-btn text-xs flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <FileJson className="w-3.5 h-3.5" />
            Export JSON Dossier
          </button>
        </div>
      </div>

      {auxDisclosures.map((d, idx) => (
        <ResourceDisclosureBanner
          key={`${d.category}-${d.resourceLabel}-${idx}`}
          disclosure={d}
          onRetry={
            d.isRetryable
              ? () => {
                  setAuxLoading(true);
                  setRetryTick((t) => t + 1);
                }
              : undefined
          }
          compact
        />
      ))}

      {/* Structural Guardrail Callouts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 border border-[var(--color-rule)] bg-[var(--color-well)] flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-[#163d4a] shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-[var(--color-ink)]">
              LCI Subgroup Uniqueness Verified ({ws.lciSubgroupOverlapCheck.duplicateSubgroupCodesCount} duplicates / {ws.lciSubgroupOverlapCheck.distinctSubgroupsMapped} mapped)
            </div>
            <p className="text-[var(--color-muted)] mt-0.5 leading-relaxed">
              {ws.lciSubgroupOverlapCheck.weightingNote}
            </p>
          </div>
        </div>

        <div className="p-3 border border-[#8a1253]/40 bg-[var(--color-well)] flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-[#8a1253] shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-[var(--color-ink)]">
              Per-Serving &amp; Cross-Unit Guardrails Active
            </div>
            <p className="text-[var(--color-muted)] mt-0.5 leading-relaxed">
              {ws.perServingUnavailableDisclosure} Cross-unit value deltas (per-100g vs per-100kcal; per-kg vs per-100g protein) and macro HICP/PPP/CoHD rankings are structurally blocked.
            </p>
          </div>
        </div>
      </div>

      {/* Layer Filters */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="almanac-label flex items-center gap-1 mr-1">
          <Filter className="w-3.5 h-3.5" /> Layer:
        </span>
        {(
          [
            { id: 'all', label: `All (${ws.scenarios.length})` },
            { id: 'classification', label: 'Classification' },
            { id: 'nutrition', label: 'Nutrition' },
            { id: 'environment', label: 'Environment' },
            { id: 'affordability', label: 'Affordability' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setLayerFilter(tab.id)}
            className={`almanac-btn text-xs ${
              layerFilter === tab.id ? 'almanac-btn--primary' : ''
            }`}
          >
            {tab.label}
          </button>
        ))}
        {auxLoading && (
          <span className="text-[11px] font-mono-num text-[var(--color-muted)] ml-2">
            Loading Poore &amp; GI streams...
          </span>
        )}
      </div>

      {/* Robustness Scenarios Table */}
      <div className="overflow-x-auto border border-[var(--color-rule)] bg-[var(--color-sheet)]">
        <table className="almanac-table text-xs w-full" data-testid="phase4d-scenarios-table">
          <thead>
            <tr>
              <th>Scenario &amp; Mechanism</th>
              <th className="text-right">Valid Denominator (Base → Scen)</th>
              <th className="text-right">Common Universe (n)</th>
              <th className="text-right">Value Shift / Unit Guard</th>
              <th className="text-right">Spearman rho</th>
              <th>Top-K / Bottom-K Retention (n ≥ 6)</th>
            </tr>
          </thead>
          <tbody>
            {filteredScenarios.map((s) => {
              const rs = s.rankingStability;
              const gs = rs?.groupStability;
              return (
                <tr key={s.scenarioId}>
                  <td className="max-w-sm">
                    <div className="font-semibold text-[var(--color-ink)]">{s.label}</div>
                    <div className="font-mono-num text-[10px] text-[var(--color-muted)] mt-0.5">
                      {s.scenarioId} · {s.scenarioType} · {s.scenarioOrigin}
                    </div>
                    <div className="text-[11px] text-[var(--color-ink-2)] mt-0.5">
                      Mechanism: {s.effectMechanismLabel} · Engine: {s.reusedEngineAndVersion}
                    </div>
                  </td>
                  <td className="num text-right align-top">
                    <div className="font-mono-num">
                      {s.denominators.baselineValid.toLocaleString()} →{' '}
                      {s.denominators.scenarioValid.toLocaleString()}
                    </div>
                    <div
                      className={`font-mono-num text-[10px] ${
                        s.denominators.denominatorGrainComparable
                          ? 'text-[var(--color-muted)]'
                          : 'text-[#8a1253]'
                      }`}
                      title={s.denominators.denominatorDeltaBlockedReason ?? undefined}
                    >
                      {s.denominators.denominatorDelta !== null
                        ? `Δ ${s.denominators.denominatorDelta >= 0 ? '+' : ''}${s.denominators.denominatorDelta.toLocaleString()}`
                        : 'Incompatible grains (Δ blocked)'}
                    </div>
                    {s.denominators.positiveEnergyEligibleCount !== undefined && (
                      <div className="font-mono-num text-[10px] text-[#163d4a] mt-0.5">
                        Pool (kcal &gt; 0): {s.denominators.positiveEnergyEligibleCount.toLocaleString()}
                      </div>
                    )}
                  </td>
                  <td className="num text-right align-top">
                    <div className="font-mono-num font-semibold">
                      n = {s.comparisonUniverse.commonUniverseSize}
                    </div>
                    {(s.comparisonUniverse.baselineOnlyExcludedIds.length > 0 ||
                      s.comparisonUniverse.scenarioOnlyExcludedIds.length > 0) && (
                      <div className="text-[10px] text-[var(--color-muted)] max-w-[140px] ml-auto truncate" title={s.comparisonUniverse.exclusionReason}>
                        Excluded: {s.comparisonUniverse.baselineOnlyExcludedIds.length + s.comparisonUniverse.scenarioOnlyExcludedIds.length}
                      </div>
                    )}
                  </td>
                  <td className="num text-right align-top">
                    {s.valueSummary.comparableAcrossUnits ? (
                      <>
                        <div className="font-mono-num">
                          {s.valueSummary.baselineMean ?? 'N/A'} → {s.valueSummary.scenarioMean ?? 'N/A'}
                        </div>
                        <div className="font-mono-num text-[10px] text-[var(--color-muted)]">
                          {s.valueSummary.relativeDiffPct !== null
                            ? `${s.valueSummary.relativeDiffPct >= 0 ? '+' : ''}${s.valueSummary.relativeDiffPct}%`
                            : 'N/A'}{' '}
                          ({s.valueSummary.unit})
                        </div>
                      </>
                    ) : (
                      <span className="inline-block px-1.5 py-0.5 border border-[#8a1253]/50 bg-[#8a1253]/10 text-[#8a1253] font-mono-num text-[10px]">
                        Cross-unit blocked
                      </span>
                    )}
                  </td>
                  <td className="num text-right align-top">
                    {rs && rs.spearmanRho !== null ? (
                      <div>
                        <span className="font-mono-num font-semibold">{rs.spearmanRho}</span>
                        <div className="font-mono-num text-[10px] text-[#163d4a]">
                          {rs.dimension} (n={rs.pairwiseSampleSize}
                          {rs.tiedRankGroupsCount > 0 ? `, ${rs.tiedRankGroupsCount} ties` : ''})
                        </div>
                        {rs.smallRankSampleWarning && (
                          <div className="text-[10px] text-[#8a1253]">n &lt; 10 caution</div>
                        )}
                        {s.dimensionRankings.length > 1 && (
                          <div className="mt-1 pt-1 border-t border-[var(--color-rule)]/40 space-y-0.5">
                            {s.dimensionRankings
                              .filter((dr) => dr.dimension !== rs.dimension)
                              .map((dr) => (
                                <div
                                  key={dr.dimension}
                                  className="font-mono-num text-[10px] text-[var(--color-muted)]"
                                >
                                  {dr.dimension}: rho={dr.spearmanRho} (n={dr.pairwiseSampleSize})
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span
                        className="inline-block px-1.5 py-0.5 border border-[#7c2d12]/40 bg-[#7c2d12]/10 text-[#7c2d12] font-mono-num text-[10px]"
                        title={s.rankingBlockedReason ?? undefined}
                      >
                        Blocked / Descriptive
                      </span>
                    )}
                  </td>
                  <td className="align-top text-[11px]">
                    {gs ? (
                      gs.status === 'computed' ? (
                        <div>
                          <div className="font-mono-num">
                            Top-{gs.kCutoff} J = <b>{gs.topKJaccard}</b> ({gs.topKRealizedSizes.baseline}/{gs.topKRealizedSizes.scenario}) · Bottom-{gs.kCutoff} J = <b>{gs.bottomKJaccard}</b> ({gs.bottomKRealizedSizes.baseline}/{gs.bottomKRealizedSizes.scenario})
                          </div>
                          {(gs.topKEntering.length > 0 || gs.bottomKEntering.length > 0) && (
                            <div className="text-[10px] text-[var(--color-muted)] mt-0.5">
                              Top Δ: +{gs.topKEntering.length}/-{gs.topKExiting.length} · Bot Δ: +{gs.bottomKEntering.length}/-{gs.bottomKExiting.length}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 border border-[#6b4c1b]/40 bg-[#6b4c1b]/10 text-[#6b4c1b] font-mono-num text-[10px]">
                          Suppressed (n={gs.commonUniverseSize} &lt; 6)
                        </span>
                      )
                    ) : (
                      <span className="text-[var(--color-muted)]">
                        {s.rankingBlockedReason ?? 'Not applicable'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Agribalyse Weighting Grain Audit Card */}
      {agbWeightScenario?.denominators.environmentalWeightingGrain && (
        <div
          className="almanac-well p-3.5 border border-[var(--color-rule)] space-y-2 text-xs"
          data-testid="phase4d-agb-grain-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">
              Agribalyse Weighting Denominator Grain Audit (No Cross-Grain Delta Arithmetic)
            </span>
            <DataNatureBadge nature="Model Output" label="Grain metadata explicit" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono-num text-[11px]">
            {[
              {
                label: 'Unique Mapped LCI Records',
                val: `${agbWeightScenario.denominators.environmentalWeightingGrain.validLciRecordCount.toLocaleString()} / ${agbWeightScenario.denominators.environmentalWeightingGrain.totalAgribalyseLciCatalogCount.toLocaleString()}`,
              },
              {
                label: 'Category–LCI Links',
                val: agbWeightScenario.denominators.environmentalWeightingGrain.categoryLciRecordPairCount.toLocaleString(),
              },
              {
                label: 'Unique Subgroups (Active / Total COICOP)',
                val: `${agbWeightScenario.denominators.environmentalWeightingGrain.uniqueLciSubgroupCount} / ${agbWeightScenario.denominators.environmentalWeightingGrain.totalCoicopMappedSubgroupCount}`,
              },
              {
                label: 'Category–Subgroup Pairs',
                val: agbWeightScenario.denominators.environmentalWeightingGrain.categorySubgroupPairCount.toString(),
              },
              {
                label: 'Eligible Categories',
                val: agbWeightScenario.denominators.environmentalWeightingGrain.eligibleCategoryCount.toString(),
              },
              {
                label: 'Final Category Estimates',
                val: agbWeightScenario.denominators.environmentalWeightingGrain.finalCategoryEstimateCount.toString(),
              },
            ].map((item) => (
              <div
                key={item.label}
                className="p-2 border border-[var(--color-rule)] bg-[var(--color-sheet)]"
              >
                <div className="text-[10px] text-[var(--color-muted)]">{item.label}</div>
                <div className="font-semibold text-[var(--color-ink)]">{item.val}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
            {agbWeightScenario.denominators.environmentalWeightingGrain.grainExplanation}
          </p>
        </div>
      )}

      {/* Positive-Energy Nutrient-Specific Intersecting Denominator Disclosure */}
      {per100kcalScenario?.denominators.nutrientSpecificScenarioDenominators && (
        <div className="almanac-well p-3.5 border border-[var(--color-rule)] space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">
              Per-100 kcal Intersecting Nutrient Denominators (Positive-Energy Eligible Pool ={' '}
              {per100kcalScenario.denominators.positiveEnergyEligibleCount?.toLocaleString()})
            </span>
            <DataNatureBadge nature="Estimated" label="Derived mass-to-energy density" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 font-mono-num text-[11px]">
            {Object.entries(per100kcalScenario.denominators.nutrientSpecificScenarioDenominators).map(
              ([k, val]) => (
                <div
                  key={k}
                  className="p-2 border border-[var(--color-rule)] bg-[var(--color-sheet)]"
                >
                  <div className="text-[10px] text-[var(--color-muted)]">{k}</div>
                  <div className="font-semibold text-[var(--color-ink)]">
                    {val?.toLocaleString() ?? 0}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Descriptive Affordability Coverage Splits (FULL / FR / DE) */}
      {frScenario?.denominators.retailBaselineSubset &&
        frScenario.denominators.retailScenarioSubset &&
        deScenario?.denominators.retailScenarioSubset && (
          <div className="almanac-well p-3.5 border border-[var(--color-rule)] space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">
                Observed Open Prices SKU Coverage &amp; Exact OFF Barcode Overlaps (Descriptive Only — Category Ranking Blocked)
              </span>
              <DataNatureBadge nature="Observed" label="Receipt shelf SKUs" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                frScenario.denominators.retailBaselineSubset,
                frScenario.denominators.retailScenarioSubset,
                deScenario.denominators.retailScenarioSubset,
              ].map((sub) => (
                <div
                  key={sub.subsetCode}
                  className="p-3 border border-[var(--color-rule)] bg-[var(--color-sheet)] space-y-1"
                >
                  <div className="font-semibold flex items-center justify-between">
                    <span>{sub.subsetCode} Retail Slice</span>
                    <span className="font-mono-num text-[11px]">
                      {sub.exactOffBarcodeTotalMatches} OFF matches
                    </span>
                  </div>
                  <div className="font-mono-num text-[11px] text-[var(--color-muted)]">
                    Raw SKUs: {sub.rawSkuCount.toLocaleString()} · EUR/kg: {sub.validMassEurKgCount.toLocaleString()} · EUR/L: {sub.validLiquidEurLCount.toLocaleString()}
                  </div>
                  <div className="font-mono-num text-[11px] text-[#163d4a]">
                    Barcode split: {sub.exactOffBarcodeMassEurKgMatches} EUR/kg +{' '}
                    {sub.exactOffBarcodeLiquidEurLMatches} EUR/L
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* 13-Category x 8-Layer Evidence Coverage Matrix */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">
            13-Category × 8-Layer Evidence Coverage Matrix (Nature &amp; Valid Denominators Preserved)
          </h4>
          <span className="font-mono-num text-[11px] text-[var(--color-muted)]">
            {ws.evidenceMatrix.length} categories × {CATEGORY_EVIDENCE_LAYER_ORDER.length} layers
          </span>
        </div>

        <div className="overflow-x-auto border border-[var(--color-rule)] bg-[var(--color-sheet)]">
          <table className="almanac-table text-[11px] w-full" data-testid="phase4d-evidence-matrix">
            <thead>
              <tr>
                <th>Category (Support Level)</th>
                {CATEGORY_EVIDENCE_LAYER_ORDER.map((lid) => (
                  <th key={lid}>{LAYER_LABELS[lid]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ws.evidenceMatrix.map((row) => (
                <tr key={row.categoryId}>
                  <td className="min-w-[200px]">
                    <div className="font-semibold text-[var(--color-ink)]">{row.categoryLabel}</div>
                    <div className="font-mono-num text-[10px] text-[var(--color-muted)]">
                      {row.overallSupportLevel} · {row.supportedLayerCount}/{row.totalLayerCount} active
                    </div>
                  </td>
                  {CATEGORY_EVIDENCE_LAYER_ORDER.map((lid) => {
                    const cell = row.layers[lid];
                    return (
                      <td
                        key={lid}
                        className="align-top min-w-[130px]"
                        title={cell.blockingOrMissingnessReason ?? cell.mappingOrMatchingStatus}
                      >
                        <div className="flex items-center justify-between gap-1">
                          {natureBadgeProps(cell.evidenceNature)}
                          <span className="font-mono-num font-semibold">
                            n={cell.validDenominator.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--color-muted)] mt-1 leading-snug">
                          {cell.mappingOrMatchingStatus}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Separate National / Macro Context Panel */}
      <div
        className="almanac-well p-4 border-2 border-[#163d4a]/40 space-y-3 text-xs"
        data-testid="phase4d-macro-context-panel"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-sm text-[var(--color-ink)]">
            <Globe2 className="w-4 h-4 text-[#163d4a]" />
            Separate National / Macro Context Panel — [{ws.macroContext.countryCode}] {countryName}
          </div>
          <span className="px-2 py-0.5 border border-[#8a1253] bg-[#8a1253]/10 text-[#8a1253] font-mono-num text-[10px] font-semibold">
            {ws.macroContext.categoryRankingEligibility}
          </span>
        </div>

        <div className="p-2 border border-[#8a1253]/30 bg-[var(--color-sheet)] flex items-start gap-2 text-[11px]">
          <AlertTriangle className="w-3.5 h-3.5 text-[#8a1253] shrink-0 mt-0.5" />
          <span>
            Macro indices (Eurostat HICP inflation, PPP Food Price Level Index, and World Bank/FAO CoHD) operate at country or broad COICOP division level and are structurally excluded from Phase 4D category-level robustness rankings.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 border border-[var(--color-rule)] bg-[var(--color-sheet)] space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Eurostat HICP (2015=100)</span>
              <DataNatureBadge nature={ws.macroContext.hicp.evidenceNature} />
            </div>
            <div className="font-mono-num text-[11px]">
              Series mapped: {ws.macroContext.hicp.seriesAvailableCount} ·{' '}
              {ws.macroContext.hicp.isEuFallback ? 'EU27 Fallback' : 'National'}
            </div>
            <p className="text-[11px] text-[var(--color-muted)]">{ws.macroContext.hicp.note}</p>
          </div>

          <div className="p-3 border border-[var(--color-rule)] bg-[var(--color-sheet)] space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold">PPP Food Price Level Index</span>
              {natureBadgeProps(ws.macroContext.ppp.evidenceNature)}
            </div>
            <div className="font-mono-num text-[11px]">
              PLI: {ws.macroContext.ppp.foodPriceLevelIndexEu27 ?? 'N/A'} (
              {ws.macroContext.ppp.referenceYear ?? '—'})
            </div>
            <p className="text-[11px] text-[var(--color-muted)]">{ws.macroContext.ppp.note}</p>
          </div>

          <div className="p-3 border border-[var(--color-rule)] bg-[var(--color-sheet)] space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold">WB / FAO Healthy Diet Cost</span>
              {natureBadgeProps(ws.macroContext.cohd.evidenceNature)}
            </div>
            <div className="font-mono-num text-[11px]">
              {ws.macroContext.cohd.costPerDayPppUsd !== null
                ? `$${ws.macroContext.cohd.costPerDayPppUsd} ICP PPP/d (${ws.macroContext.cohd.year})`
                : 'N/A'}
            </div>
            <p className="text-[11px] text-[var(--color-muted)]">{ws.macroContext.cohd.note}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
