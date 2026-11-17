import { useEffect, useMemo, useState } from 'react';
import ReactECharts from './ThemedEChart';
import {
  AlertTriangle,
  Ban,
  Download,
  FileJson,
  GitCompare,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import {
  type OpenPricesSkuInput,
  fromOpenPricesSku,
} from '../analytics/affordabilityEngine';
import type { ClassificationMappingRecord } from '../analytics/classificationEngine';
import type { GITerroirInput, PooreLcaInput } from '../analytics/environmentEngine';
import { fromOFFProduct } from '../analytics/nutritionEngine';
import {
  SENSITIVITY_ENGINE_VERSION,
  SMALL_RANK_CORRELATION_THRESHOLD,
  type ConclusionStability,
  type ScenarioType,
  type SensitivityDimensionId,
  UNCERTAINTY_ASSUMPTION_REGISTRY,
  UNSUPPORTED_SENSITIVITY_EXPERIMENTS,
  runAllSensitivityScenarios,
  serializeSensitivityScenariosCsv,
} from '../analytics/sensitivityEngine';
import type { AgribalyseItem, EurostatCountryData, OFFProduct } from '../types/research';
import { fetchCachedJson, fetchGiTerroirBundle } from '../services/dataProvider';
import { downloadCsvContent, downloadJsonPayload } from '../utils/exportDownload';
import { classifyResourceError, type ResourceDisclosure } from '../utils/resourceAvailability';
import { DataNatureBadge } from './DataNatureBadge';
import { ResourceDisclosureBanner } from './ResourceDisclosureBanner';

interface SensitivityPanelProps {
  selectedCountry: string;
  countryName: string;
  hicpTargetCode: string;
  isHicpFallback: boolean;
  hicpData: EurostatCountryData | null;
  offProducts: OFFProduct[];
  agribalyseItems: AgribalyseItem[];
}

const DIMENSION_LABELS: Record<SensitivityDimensionId | 'all', string> = {
  all: 'All 6 Sensitivity Dimensions',
  classification: 'A. Classification Uncertainty',
  nutrition_missingness: 'B. Nutrition Missingness',
  environmental_proxy: 'C. Environmental Proxy Uncertainty',
  package_quantity: 'D. Package Quantity Uncertainty',
  geographic_coverage: 'E. Geographic Coverage',
  aggregation: 'F. Aggregation Sensitivity',
};

const SCENARIO_TYPE_LABELS: Record<ScenarioType, { label: string; cls: string }> = {
  data_subset_sensitivity: { label: 'Data Subset', cls: 'border-[#163d4a] text-[#163d4a]' },
  missingness_sensitivity: { label: 'Missingness', cls: 'border-[#525e70] text-[#525e70]' },
  methodological_sensitivity: { label: 'Methodological', cls: 'border-[#2d6a4f] text-[#2d6a4f]' },
  boundary_or_functional_unit_sensitivity: {
    label: 'Boundary / Unit',
    cls: 'border-[#6b4c1b] text-[#6b4c1b]',
  },
  diagnostic_stress_test: {
    label: 'Diagnostic Stress Test',
    cls: 'border-[#8a1253] text-[#8a1253] bg-[#8a1253]/10',
  },
};

const STABILITY_BADGE: Record<ConclusionStability, { label: string; cls: string }> = {
  stable: { label: 'Stable', cls: 'border-[#163d4a] text-[#163d4a] bg-[#163d4a]/10' },
  moderate_shift: {
    label: 'Moderate Shift',
    cls: 'border-[#6b4c1b] text-[#6b4c1b] bg-[#6b4c1b]/10',
  },
  sensitive: { label: 'Sensitive', cls: 'border-[#8a1253] text-[#8a1253] bg-[#8a1253]/10' },
  insufficient_overlap: {
    label: 'Collapsed / Low Overlap',
    cls: 'border-[#7c2d12] text-[#7c2d12] bg-[#7c2d12]/10',
  },
};

export function SensitivityPanel({
  selectedCountry,
  countryName,
  hicpTargetCode,
  isHicpFallback,
  hicpData,
  offProducts,
  agribalyseItems,
}: SensitivityPanelProps) {
  const [dimensionFilter, setDimensionFilter] = useState<SensitivityDimensionId | 'all'>('all');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('cls_exclude_ambiguous');

  const [mappings, setMappings] = useState<ClassificationMappingRecord[]>([]);
  const [scraplingRaw, setScraplingRaw] = useState<OpenPricesSkuInput[]>([]);
  const [pooreRaw, setPooreRaw] = useState<PooreLcaInput[]>([]);
  const [giRaw, setGiRaw] = useState<GITerroirInput[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [retryTick, setRetryTick] = useState<number>(0);
  const [disclosures, setDisclosures] = useState<ResourceDisclosure[]>([]);

  useEffect(() => {
    let cancelled = false;
    const forceRetry = retryTick > 0;

    Promise.allSettled([
      fetchCachedJson<ClassificationMappingRecord[]>('data/classification_mappings.json', { forceRetry }),
      fetchCachedJson<OpenPricesSkuInput[]>('data/scrapling_retail_claims.json', { forceRetry }),
      fetchCachedJson<{ poore_nemecek_lca?: PooreLcaInput[] }>('data/global_benchmarks.json', { forceRetry }),
      fetchGiTerroirBundle<{ gi_terroir_records?: GITerroirInput[] }>({ forceRetry }),
    ]).then(([mRes, sRes, gRes, giRes]) => {
      if (cancelled) return;
      const nextDisclosures: ResourceDisclosure[] = [];

      if (mRes.status === 'fulfilled') {
        setMappings(mRes.value);
      } else {
        setMappings([]);
        nextDisclosures.push(
          classifyResourceError(mRes.reason, {
            resourcePath: 'data/classification_mappings.json',
            resourceLabel: 'Crosswalk & classification mapping rules',
          })
        );
      }

      if (sRes.status === 'fulfilled') {
        setScraplingRaw(sRes.value);
      } else {
        setScraplingRaw([]);
        nextDisclosures.push(
          classifyResourceError(sRes.reason, {
            resourcePath: 'data/scrapling_retail_claims.json',
            resourceLabel: 'Open Prices EU retail price slice',
            availableSummary: 'Non-price classification, nutrition, and environmental sensitivity scenarios remain available.',
          })
        );
      }

      if (gRes.status === 'fulfilled') {
        setPooreRaw(gRes.value.poore_nemecek_lca ?? []);
      } else {
        setPooreRaw([]);
        nextDisclosures.push(
          classifyResourceError(gRes.reason, {
            resourcePath: 'data/global_benchmarks.json',
            resourceLabel: 'Poore & Nemecek global LCA benchmarks',
            availableSummary: 'Classification, nutrition, Agribalyse, package quantity, and aggregation scenarios remain available.',
          })
        );
      }

      if (giRes.status === 'fulfilled') {
        setGiRaw(giRes.value.gi_terroir_records ?? []);
      } else {
        setGiRaw([]);
        nextDisclosures.push(
          classifyResourceError(giRes.reason, {
            resourcePath: 'data/gi_terroir_bundle.json',
            availableSummary:
              'All 19 independent Track A scenarios (classification, nutrition, Agribalyse 3.1, Poore & Nemecek LCA, package quantity, HICP/geography, and aggregation) and CSV/JSON exports remain active.',
          })
        );
      }

      setDisclosures(nextDisclosures);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  const suiteResult = useMemo(() => {
    if (mappings.length === 0 || offProducts.length === 0 || agribalyseItems.length === 0) {
      return null;
    }
    const nutritionInputs = offProducts.map(fromOFFProduct);
    const nutritionCountryMap = new Map<string, string | null>(
      offProducts.map((p) => [p.code, p.primary_country ?? null])
    );
    const retailPriceRecords = scraplingRaw.map(fromOpenPricesSku);

    return runAllSensitivityScenarios({
      mappings,
      nutritionInputs,
      nutritionCountryMap,
      agribalyseItems,
      pooreItems: pooreRaw,
      giItems: giRaw,
      retailPriceRecords,
      hicpCountryCode: hicpTargetCode,
      hicpData,
      isHicpEuFallback: isHicpFallback,
    });
  }, [
    mappings,
    offProducts,
    agribalyseItems,
    pooreRaw,
    giRaw,
    scraplingRaw,
    hicpTargetCode,
    hicpData,
    isHicpFallback,
  ]);

  const filteredScenarios = useMemo(() => {
    if (!suiteResult) return [];
    if (dimensionFilter === 'all') return suiteResult.data;
    return suiteResult.data.filter((s) => s.dimension === dimensionFilter);
  }, [suiteResult, dimensionFilter]);

  const validScenarios = useMemo(
    () => filteredScenarios.filter((s) => !s.isDiagnosticOnly),
    [filteredScenarios]
  );

  const diagnosticScenarios = useMemo(
    () => filteredScenarios.filter((s) => s.isDiagnosticOnly),
    [filteredScenarios]
  );

  const activeScenario = useMemo(() => {
    if (filteredScenarios.length === 0) return null;
    return (
      filteredScenarios.find((s) => s.scenarioId === selectedScenarioId) ?? filteredScenarios[0]
    );
  }, [filteredScenarios, selectedScenarioId]);

  const activeAssumptionSpec = useMemo(() => {
    if (!activeScenario) return null;
    return (
      UNCERTAINTY_ASSUMPTION_REGISTRY.find((a) => a.assumptionId === activeScenario.assumptionId) ??
      null
    );
  }, [activeScenario]);

  const rankStabilityChartOption = useMemo(() => {
    if (!activeScenario || activeScenario.rankingMetrics.topDrivers.length === 0) return {};
    const drivers = [...activeScenario.rankingMetrics.topDrivers].reverse();
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: '#eaedf2',
        borderColor: '#2d3643',
        borderWidth: 1,
        textStyle: { color: '#111827', fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' },
      },
      legend: {
        top: 0,
        textStyle: { color: '#2d3643', fontSize: 11, fontFamily: 'Newsreader, Georgia, serif' },
        data: ['Baseline Rank (1 = Highest Value)', 'Scenario Rank (1 = Highest Value)'],
      },
      grid: { top: 34, right: 24, bottom: 32, left: 190 },
      xAxis: {
        type: 'value',
        minInterval: 1,
        name: 'Ordinal Category Rank',
        nameLocation: 'middle',
        nameGap: 20,
        axisLabel: { color: '#3d4654', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        data: drivers.map((d) =>
          d.category.length > 26 ? `${d.category.slice(0, 24)}…` : d.category
        ),
        axisLabel: { color: '#111827', fontSize: 11 },
      },
      series: [
        {
          name: 'Baseline Rank (1 = Highest Value)',
          type: 'bar',
          barGap: '18%',
          itemStyle: { color: '#163d4a' },
          data: drivers.map((d) => d.baselineRank),
        },
        {
          name: 'Scenario Rank (1 = Highest Value)',
          type: 'bar',
          itemStyle: { color: '#8a1253' },
          data: drivers.map((d) => d.scenarioRank),
        },
      ],
    };
  }, [activeScenario]);

  const unavailableScenarios = useMemo(() => {
    const items: Array<{ scenarioId: string; title: string; dimension: SensitivityDimensionId; reason: string }> = [];
    if (giRaw.length === 0) {
      const giDisclosure = disclosures.find((d) => d.resourceLabel.toLowerCase().includes('geographical indications'));
      items.push({
        scenarioId: 'env_gi_unfiltered_alcohol_leak',
        title: 'GI Terroir Unfiltered Denominator Leakage Diagnostic (WINE/SPIRIT Leak)',
        dimension: 'environmental_proxy',
        reason: giDisclosure?.isExcludedTrackB
          ? 'Excluded because the Qualigeo/EUIPO GI Terroir registry is omitted from the Track A open archive.'
          : 'Unavailable because GI Terroir input records could not be loaded.',
      });
    }
    return items;
  }, [giRaw.length, disclosures]);

  const canExport = Boolean(suiteResult && filteredScenarios.length > 0);

  const handleExportCsv = () => {
    if (!canExport || !suiteResult) return;
    const csv = serializeSensitivityScenariosCsv({
      countryCode: selectedCountry,
      scenarios: filteredScenarios,
    });
    downloadCsvContent(csv, `dietshift_sensitivity_phase4c_${selectedCountry}.csv`);
  };

  const handleExportJson = () => {
    if (!canExport || !suiteResult) return;
    const payload = {
      engineVersion: SENSITIVITY_ENGINE_VERSION,
      countryContext: { selectedCountry, countryName, hicpTargetCode, isHicpFallback },
      availabilitySummary: {
        executedScenariosCount: suiteResult.data.length,
        filteredScenariosCount: filteredScenarios.length,
        validScenariosCount: suiteResult.data.filter((s) => !s.isDiagnosticOnly).length,
        diagnosticScenariosCount: suiteResult.data.filter((s) => s.isDiagnosticOnly).length,
        unavailableScenarios,
      },
      uncertaintyRegistry: UNCERTAINTY_ASSUMPTION_REGISTRY,
      unsupportedExperiments: UNSUPPORTED_SENSITIVITY_EXPERIMENTS,
      scenariosExecuted: filteredScenarios,
      provenance: suiteResult.provenance,
    };
    downloadJsonPayload(
      payload,
      `dietshift_sensitivity_dossier_${selectedCountry}.json`
    );
  };

  return (
    <div className="space-y-5">
      {/* Header Sheet */}
      <div className="almanac-sheet p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-3 rule-firm">
          <div>
            <h2 className="text-lg font-semibold flex flex-wrap items-center gap-2">
              <GitCompare className="w-4 h-4" />
              Section XIII. Empirical Sensitivity &amp; Robustness Analysis ({suiteResult?.data.length ?? 0} Verified Scenarios)
              <DataNatureBadge nature="Model Output" label="OAT Scenarios" />
              <DataNatureBadge nature="Observed" label="Unmodified Sources" />
            </h2>
            <p className="almanac-label mt-0.5">
              One-at-a-time assumption perturbations across classification mappings, nutrient missingness, environmental proxies, package quantities, geography, and estimators. Never Sobol variance decomposition.
            </p>
            {!loading && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono-num">
                <span className="px-2 py-0.5 border border-[var(--color-rule)] bg-[var(--color-well)]">
                  Eligible executed: <b>{suiteResult?.data.length ?? 0}</b> ({suiteResult ? suiteResult.data.filter((s) => !s.isDiagnosticOnly).length : 0} valid + {suiteResult ? suiteResult.data.filter((s) => s.isDiagnosticOnly).length : 0} diagnostic)
                </span>
                <span className="px-2 py-0.5 border border-[var(--color-rule)] bg-[var(--color-well)]">
                  Excluded / unavailable: <b>{unavailableScenarios.length}</b>
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Sensitivity dimension filter"
              value={dimensionFilter}
              onChange={(e) => setDimensionFilter(e.target.value as SensitivityDimensionId | 'all')}
              className="almanac-select"
            >
              {(Object.keys(DIMENSION_LABELS) as Array<SensitivityDimensionId | 'all'>).map((k) => (
                <option key={k} value={k}>
                  {DIMENSION_LABELS[k]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!canExport}
              aria-disabled={!canExport}
              title={
                canExport
                  ? 'Export computed sensitivity scenarios to CSV'
                  : 'Exports disabled: no computable sensitivity scenarios under current availability or filter.'
              }
              className="almanac-btn flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              disabled={!canExport}
              aria-disabled={!canExport}
              title={
                canExport
                  ? 'Export full sensitivity dossier JSON'
                  : 'Exports disabled: no computable sensitivity scenarios under current availability or filter.'
              }
              className="almanac-btn flex items-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <FileJson className="w-3.5 h-3.5" />
              JSON Dossier
            </button>
          </div>
        </div>

        <div className="p-3 almanac-well border-l-4 border-[var(--color-accent)] text-xs text-[var(--color-ink-2)] flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
          <div>
            <b>Strict Methodological Safeguards:</b> Reuses verified calculations from{' '}
            <code>classificationEngine</code>, <code>nutritionEngine</code>,{' '}
            <code>environmentEngine</code>, <code>affordabilityEngine</code>, and{' '}
            <code>integratedComparator</code> directly without mutating source tables, imputing zeros,
            inventing probability distributions, or fabricating market-share weights. Cross-unit
            comparisons block raw value deltas cleanly (ordinal ranks only).
          </div>
        </div>

        {!loading && !canExport && (
          <div
            role="status"
            data-availability-category="missing_required_input"
            className="p-2.5 border border-[#8a1253]/50 bg-[#8a1253]/10 text-xs text-[#8a1253]"
          >
            {disclosures.some((d) => !d.isExcludedTrackB) && !suiteResult
              ? 'Failed to load auxiliary sensitivity bundles. '
              : ''}
            Exports disabled: 0 sensitivity scenarios are computable under the current data availability or dimension filter.
          </div>
        )}

        {disclosures.map((d, idx) => (
          <ResourceDisclosureBanner
            key={`${d.category}-${d.resourceLabel}-${idx}`}
            disclosure={d}
            onRetry={
              d.isRetryable
                ? () => {
                    setLoading(true);
                    setRetryTick((t) => t + 1);
                  }
                : undefined
            }
          />
        ))}

        {unavailableScenarios.length > 0 && !loading && (
          <div className="p-3 border border-[var(--color-rule)] bg-[var(--color-well)] text-xs space-y-1">
            <div className="font-semibold text-[var(--color-ink)]">
              Scenarios omitted from run ({unavailableScenarios.length} of {unavailableScenarios.length + (suiteResult?.data.length ?? 0)} total definitions):
            </div>
            {unavailableScenarios.map((u) => (
              <div key={u.scenarioId} className="text-[var(--color-muted)]">
                • <code>{u.scenarioId}</code> — {u.title}: {u.reason}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Valid Scenarios Comparison Ledger */}
      {validScenarios.length > 0 && (
        <div className="almanac-sheet p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 rule-firm">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Valid Sensitivity Scenario Matrix (Click any row to inspect drivers &amp; rank stability)
            </h3>
            <span className="almanac-label text-xs font-mono-num">
              {validScenarios.length} valid alternative(s) displayed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="almanac-table">
              <thead>
                <tr>
                  <th>Scenario · Type · Origin · Mechanism</th>
                  <th>Baseline Mean (Denom)</th>
                  <th>Scenario Mean (Denom)</th>
                  <th className="text-right">Abs / Rel Delta &amp; Δn</th>
                  <th className="text-right">Spearman ρ (n / ties / excl)</th>
                  <th>Stability</th>
                </tr>
              </thead>
              <tbody>
                {validScenarios.map((s) => {
                  const isActive = activeScenario?.scenarioId === s.scenarioId;
                  const badge = STABILITY_BADGE[s.rankingMetrics.conclusionStability];
                  const tBadge = SCENARIO_TYPE_LABELS[s.scenarioType];
                  return (
                    <tr
                      key={s.scenarioId}
                      onClick={() => setSelectedScenarioId(s.scenarioId)}
                      className={`cursor-pointer transition-colors ${
                        isActive ? 'bg-[var(--color-well)] font-medium' : 'hover:bg-[var(--color-paper-2)]'
                      }`}
                    >
                      <td className="text-xs">
                        <div className="font-semibold text-[var(--color-ink)]">{s.label}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 font-mono-num text-[10px] text-[var(--color-muted)]">
                          <span className={`px-1 border ${tBadge.cls}`}>{tBadge.label}</span>
                          <span
                            className={`px-1 border ${
                              s.scenarioOrigin === 'empirical_alternative'
                                ? 'border-[#163d4a] text-[#163d4a]'
                                : 'border-[#6b4c1b] text-[#6b4c1b]'
                            }`}
                          >
                            {s.scenarioOrigin === 'empirical_alternative'
                              ? 'Empirical Alternative'
                              : 'Analyst-Defined'}
                          </span>
                          <span>{s.effectMechanismLabel}</span>
                        </div>
                      </td>
                      <td className="num text-xs">
                        {s.baselineSummary.meanAcrossCategories ?? '—'}{' '}
                        <span className="text-[10px] text-[var(--color-muted)]">
                          (n={s.baselineSummary.validDenominator})
                        </span>
                      </td>
                      <td className="num text-xs">
                        {s.scenarioSummary.meanAcrossCategories ?? '—'}{' '}
                        <span className="text-[10px] text-[var(--color-muted)]">
                          (n={s.scenarioSummary.validDenominator})
                        </span>
                      </td>
                      <td className="num text-right text-xs">
                        <div>
                          {s.deltaMetrics.comparableAcrossUnits ? (
                            <span>
                              {s.deltaMetrics.absoluteDiff != null && s.deltaMetrics.absoluteDiff > 0 ? '+' : ''}
                              {s.deltaMetrics.absoluteDiff ?? '—'}{' '}
                              <span className="text-[10px] text-[var(--color-muted)]">
                                ({s.deltaMetrics.relativeDiffPct != null ? `${s.deltaMetrics.relativeDiffPct}%` : '—'})
                              </span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-[var(--color-muted)]">Cross-unit N/A</span>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--color-muted)]">
                          Δdenom: {s.affectedRecords.denominatorDelta > 0 ? '+' : ''}
                          {s.affectedRecords.denominatorDelta} · {s.affectedRecords.count} aff.
                        </div>
                      </td>
                      <td className="num text-right text-xs">
                        <div>
                          {s.rankingMetrics.spearmanRho ?? '—'}
                          {s.rankingMetrics.smallRankSampleWarning && s.rankingMetrics.pairwiseSampleSize > 0 && (
                            <span
                              title={`Small pairwise sample (n=${s.rankingMetrics.pairwiseSampleSize} < ${SMALL_RANK_CORRELATION_THRESHOLD}); interpret ordinal correlation cautiously.`}
                              className="ml-1 px-1 text-[10px] border border-[#6b4c1b] text-[#6b4c1b]"
                            >
                              small n={s.rankingMetrics.pairwiseSampleSize}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--color-muted)]">
                          n={s.rankingMetrics.pairwiseSampleSize}, ties={s.rankingMetrics.tiedRankGroupsCount}, excl={s.rankingMetrics.excludedCategoriesCount}
                        </div>
                      </td>
                      <td>
                        <span className={`px-1.5 py-0.5 text-[10px] font-mono-num border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Isolated Diagnostic Stress Tests (Separated from Valid Analytical Alternatives) */}
      {diagnosticScenarios.length > 0 && (
        <div className="almanac-sheet p-5 space-y-3 border-l-4 border-[#8a1253]">
          <div className="pb-2 rule-firm flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#8a1253] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Diagnostic Stress Tests — Invalid Sector Inclusion (Isolated from Valid Food Outputs)
            </h3>
            <span className="almanac-label text-xs font-mono-num">
              Production environmentEngine preserves FOOD-only eligibility by default
            </span>
          </div>
          {diagnosticScenarios.map((d) => (
            <div
              key={d.scenarioId}
              onClick={() => setSelectedScenarioId(d.scenarioId)}
              className={`p-3 border cursor-pointer text-xs grid grid-cols-1 md:grid-cols-12 gap-3 items-center ${
                activeScenario?.scenarioId === d.scenarioId
                  ? 'bg-[var(--color-well)] border-[#8a1253]'
                  : 'bg-[var(--color-paper-2)] border-[var(--color-rule)]'
              }`}
            >
              <div className="md:col-span-5 space-y-1">
                <div className="font-semibold text-[var(--color-ink)]">{d.label}</div>
                <div className="font-mono-num text-[10px] text-[#8a1253]">
                  {d.scenarioType} · {d.scenarioOrigin} · {d.effectMechanismLabel}
                </div>
              </div>
              <div className="md:col-span-4 font-mono-num text-[11px]">
                FOOD baseline: {d.baselineSummary.meanAcrossCategories} (n={d.baselineSummary.validDenominator}) → Unfiltered stress test: {d.scenarioSummary.meanAcrossCategories} (n={d.scenarioSummary.validDenominator}, {d.deltaMetrics.relativeDiffPct}%)
              </div>
              <div className="md:col-span-3 font-mono-num text-[11px] text-right">
                {d.affectedRecords.count} non-food records exposed · ρ={d.rankingMetrics.spearmanRho} (n={d.rankingMetrics.pairwiseSampleSize}, excl={d.rankingMetrics.excludedCategoriesCount})
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Scenario Inspector: Rank Stability + Inclusion Diagnostics + Assumption Provenance */}
      {activeScenario && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-7 almanac-sheet p-5 space-y-3">
            <div className="pb-2 rule-firm">
              <h3 className="text-sm font-semibold">
                Ranking Stability &amp; Top Category Drivers — {activeScenario.label}
              </h3>
              <p className="almanac-label text-xs">
                Scope: {activeScenario.rankingMetrics.comparisonScope}. Mechanism: <b>{activeScenario.effectMechanismLabel}</b>. Spearman ρ = {activeScenario.rankingMetrics.spearmanRho ?? '—'} (n={activeScenario.rankingMetrics.pairwiseSampleSize}, tied rank groups={activeScenario.rankingMetrics.tiedRankGroupsCount}, excluded categories={activeScenario.rankingMetrics.excludedCategoriesCount}).
                {activeScenario.rankingMetrics.smallRankSampleWarning && (
                  <span className="text-[#8a1253] font-semibold ml-1">
                    Small sample warning (n &lt; {SMALL_RANK_CORRELATION_THRESHOLD}): treat ρ strictly as descriptive ordinal overlap.
                  </span>
                )}
                {activeScenario.deltaMetrics.crossUnitNote && (
                  <span className="text-[var(--color-accent)] font-semibold ml-1">
                    {activeScenario.deltaMetrics.crossUnitNote}
                  </span>
                )}
              </p>
            </div>

            {activeScenario.rankingMetrics.topDrivers.length >= 2 ? (
              <div className="h-64 w-full">
                <ReactECharts
                  option={rankStabilityChartOption}
                  style={{ height: '100%', width: '100%' }}
                  notMerge={true}
                />
              </div>
            ) : (
              <div className="p-4 almanac-well text-xs text-[var(--color-muted)]">
                Insufficient overlapping categories ({activeScenario.rankingMetrics.comparableCategoriesCount}) under this strict restriction to plot rank shifts.
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--color-rule)] font-mono-num text-xs">
              <div className="p-2 bg-[var(--color-paper-2)]">
                <div className="text-[10px] text-[var(--color-muted)]">Baseline Excluded</div>
                <div className="font-semibold">{activeScenario.baselineSummary.excludedCount}</div>
              </div>
              <div className="p-2 bg-[var(--color-paper-2)]">
                <div className="text-[10px] text-[var(--color-muted)]">Scenario Excluded</div>
                <div className="font-semibold">{activeScenario.scenarioSummary.excludedCount}</div>
              </div>
              <div className="p-2 bg-[var(--color-paper-2)]">
                <div className="text-[10px] text-[var(--color-muted)]">Denominator Delta</div>
                <div className="font-semibold">{activeScenario.affectedRecords.denominatorDelta}</div>
              </div>
              <div className="p-2 bg-[var(--color-paper-2)]">
                <div className="text-[10px] text-[var(--color-muted)]">Pairwise / Ties / Excl</div>
                <div className="font-semibold">
                  {activeScenario.rankingMetrics.pairwiseSampleSize} / {activeScenario.rankingMetrics.tiedRankGroupsCount} / {activeScenario.rankingMetrics.excludedCategoriesCount}
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-5 almanac-sheet p-5 space-y-3 text-xs">
            <div className="pb-2 rule-firm font-semibold text-sm flex items-center justify-between">
              <span>Assumption Registry &amp; Provenance</span>
              <span className="font-mono-num text-[11px] text-[var(--color-muted)]">
                {activeScenario.assumptionId}
              </span>
            </div>

            {activeAssumptionSpec && (
              <div className="space-y-2">
                <div>
                  <span className="almanac-label">Scenario Classification:</span>{' '}
                  <code>{activeScenario.scenarioType}</code> · <code>{activeScenario.scenarioOrigin}</code>
                </div>
                <div>
                  <span className="almanac-label">Change Mechanism:</span>{' '}
                  <b>{activeScenario.effectMechanismLabel}</b>
                </div>
                <div>
                  <span className="almanac-label">Uncertainty Type:</span>{' '}
                  <b className="font-mono-num">{activeAssumptionSpec.uncertaintyType}</b>
                </div>
                <div>
                  <span className="almanac-label">Baseline Treatment:</span>{' '}
                  {activeAssumptionSpec.baselineTreatment}
                </div>
                <div>
                  <span className="almanac-label">Scenario Perturbation:</span>{' '}
                  {activeScenario.assumptionChanges.join(' ')}
                </div>
                <div>
                  <span className="almanac-label">Evidence / Rationale:</span>{' '}
                  {activeAssumptionSpec.evidenceOrRationale}
                </div>
                <div>
                  <span className="almanac-label">Source &amp; Version:</span>{' '}
                  <code>{activeAssumptionSpec.provenanceAndVersion}</code>
                </div>
              </div>
            )}

            <div className="p-2.5 bg-[var(--color-well)] border border-[var(--color-rule)] space-y-1 text-[11px] text-[var(--color-muted)]">
              <div className="font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#8a1253]" />
                Methodological Caveats
              </div>
              {activeScenario.caveats.map((c, idx) => (
                <div key={idx}>• {c}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Explicit Registry of Unsupported Sensitivity Experiments */}
      <div className="almanac-sheet p-5 space-y-3">
        <div className="pb-2 rule-firm flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Ban className="w-4 h-4 text-[#8a1253]" />
            Blocked / Unsupported Sensitivity Experiments ({UNSUPPORTED_SENSITIVITY_EXPERIMENTS.length} Explicitly Refused)
          </h3>
          <span className="almanac-label text-xs">Zero fabricated weights or distributions</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {UNSUPPORTED_SENSITIVITY_EXPERIMENTS.map((u) => (
            <div key={u.experimentId} className="p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule-strong)] space-y-1">
              <div className="font-semibold text-[var(--color-ink)]">{u.title}</div>
              <div className="text-[11px] text-[#8a1253]">{u.reasonUnsupported}</div>
              <div className="text-[10px] font-mono-num text-[var(--color-muted)]">
                Required: {u.requiredDataOrMethod}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
