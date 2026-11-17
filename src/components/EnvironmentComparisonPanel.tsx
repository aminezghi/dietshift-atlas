import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Leaf, Scale, ShieldAlert } from 'lucide-react';
import {
  type EnvironmentIndicatorKey,
  type EnvironmentSourceId,
  ENVIRONMENT_INDICATOR_SPECS,
  ENVIRONMENT_SOURCE_METADATA,
  type GITerroirInput,
  type PooreLcaInput,
  aggregateEnvironmentByCategory,
  compareEnvironmentRecords,
  fromAgribalyseItem,
  fromGITerroirItem,
  fromPooreNemecekItem,
} from '../analytics/environmentEngine';
import type { AgribalyseItem } from '../types/research';
import { fetchGiTerroirBundle } from '../services/dataProvider';
import { classifyResourceError, type ResourceDisclosure } from '../utils/resourceAvailability';
import { DataNatureBadge } from './DataNatureBadge';
import { ResourceDisclosureBanner } from './ResourceDisclosureBanner';

interface EnvironmentComparisonPanelProps {
  agribalyseItems: AgribalyseItem[];
  pooreItems: PooreLcaInput[];
  selectedAgbIndicator?: EnvironmentIndicatorKey;
  onAgbIndicatorChange?: (k: EnvironmentIndicatorKey) => void;
}

const SOURCE_INDICATORS: Record<EnvironmentSourceId, EnvironmentIndicatorKey[]> = {
  agribalyse_31: [
    'climate_co2eq',
    'water_aware_m3',
    'land_ef_pt',
    'acidification',
    'eutrophication_terrestrial',
    'ef_single_score',
  ],
  poore_nemecek_2018: [
    'ghg_per_kg',
    'ghg_per_100g_protein',
    'ghg_per_1000kcal',
    'land_use_m2',
    'freshwater_withdrawals_l',
    'scarcity_water_l',
    'eutrophying_po4_g',
  ],
  gi_terroir_proxy: ['gi_proxy_co2_kg', 'gi_proxy_water_l', 'gi_proxy_land_m2'],
};

const ALL_INDICATOR_KEYS = Object.keys(ENVIRONMENT_INDICATOR_SPECS) as EnvironmentIndicatorKey[];

export function EnvironmentComparisonPanel({
  agribalyseItems,
  pooreItems,
  selectedAgbIndicator = 'climate_co2eq',
  onAgbIndicatorChange,
}: EnvironmentComparisonPanelProps) {
  const [subMode, setSubMode] = useState<'explorer' | 'compatibility'>('explorer');
  const [activeSource, setActiveSource] = useState<EnvironmentSourceId>('agribalyse_31');
  const [localIndicator, setLocalIndicator] = useState<EnvironmentIndicatorKey>('climate_co2eq');
  const [giRecordsRaw, setGiRecordsRaw] = useState<GITerroirInput[] | null>(null);
  const [giLoading, setGiLoading] = useState(false);
  const [giDisclosure, setGiDisclosure] = useState<ResourceDisclosure | null>(null);
  const [includeNonFoodGi, setIncludeNonFoodGi] = useState(false);

  // Compatibility Inspector state (default demonstrates boundary check: Agribalyse vs Poore)
  const [compatKeyA, setCompatKeyA] = useState<EnvironmentIndicatorKey>('land_ef_pt');
  const [compatKeyB, setCompatKeyB] = useState<EnvironmentIndicatorKey>('land_use_m2');
  const [recordIdxA, setRecordIdxA] = useState<number>(0);
  const [recordIdxB, setRecordIdxB] = useState<number>(0);

  const effectiveIndicator: EnvironmentIndicatorKey =
    activeSource === 'agribalyse_31' && SOURCE_INDICATORS.agribalyse_31.includes(selectedAgbIndicator)
      ? selectedAgbIndicator
      : SOURCE_INDICATORS[activeSource].includes(localIndicator)
      ? localIndicator
      : SOURCE_INDICATORS[activeSource][0];

  const loadGiIfNeeded = (forceRetry = false) => {
    if ((giRecordsRaw && !forceRetry) || giLoading) return;
    setGiLoading(true);
    setGiDisclosure(null);
    fetchGiTerroirBundle<{ gi_terroir_records?: GITerroirInput[] }>({ forceRetry })
      .then((data) => {
        setGiRecordsRaw(data.gi_terroir_records ?? []);
      })
      .catch((err: unknown) => {
        setGiDisclosure(
          classifyResourceError(err, {
            resourcePath: 'data/gi_terroir_bundle.json',
            availableSummary:
              'ADEME Agribalyse 3.1.1 (2,451 LCI items) and Poore & Nemecek (2018) (45 commodities) remain fully active with compatibility checks.',
          })
        );
      })
      .finally(() => setGiLoading(false));
  };

  const handleSourceChange = (src: EnvironmentSourceId) => {
    setActiveSource(src);
    setLocalIndicator(SOURCE_INDICATORS[src][0]);
    if (src === 'gi_terroir_proxy') loadGiIfNeeded();
  };

  const agbStd = useMemo(() => agribalyseItems.map(fromAgribalyseItem), [agribalyseItems]);
  const pooreStd = useMemo(() => pooreItems.map(fromPooreNemecekItem), [pooreItems]);
  const giStd = useMemo(() => (giRecordsRaw ?? []).map(fromGITerroirItem), [giRecordsRaw]);

  const activeRecords = useMemo(() => {
    if (activeSource === 'agribalyse_31') return agbStd;
    if (activeSource === 'poore_nemecek_2018') return pooreStd;
    return giStd;
  }, [activeSource, agbStd, pooreStd, giStd]);

  const categorySummary = useMemo(
    () =>
      aggregateEnvironmentByCategory(activeRecords, effectiveIndicator, {
        includeNonFoodGiSectors: includeNonFoodGi,
      }),
    [activeRecords, effectiveIndicator, includeNonFoodGi]
  );

  const sourceCtx = ENVIRONMENT_SOURCE_METADATA[activeSource];
  const indicatorSpec = ENVIRONMENT_INDICATOR_SPECS[effectiveIndicator];

  // Compatibility comparison pools & calculation
  const poolA = useMemo(() => {
    const src = ENVIRONMENT_INDICATOR_SPECS[compatKeyA].sourceId;
    if (src === 'agribalyse_31') return agbStd;
    if (src === 'poore_nemecek_2018') return pooreStd;
    return giStd;
  }, [compatKeyA, agbStd, pooreStd, giStd]);

  const poolB = useMemo(() => {
    const src = ENVIRONMENT_INDICATOR_SPECS[compatKeyB].sourceId;
    if (src === 'agribalyse_31') return agbStd;
    if (src === 'poore_nemecek_2018') return pooreStd;
    return giStd;
  }, [compatKeyB, agbStd, pooreStd, giStd]);

  const compatResult = useMemo(() => {
    const recA = poolA[recordIdxA] ?? poolA[0] ?? null;
    const recB = poolB[recordIdxB] ?? poolB[0] ?? null;
    if (!recA || !recB) return null;
    return compareEnvironmentRecords(recA, compatKeyA, recB, compatKeyB);
  }, [poolA, recordIdxA, compatKeyA, poolB, recordIdxB, compatKeyB]);

  return (
    <div className="almanac-sheet p-5 space-y-4">
      {giDisclosure && (activeSource === 'gi_terroir_proxy' || subMode === 'compatibility') && (
        <ResourceDisclosureBanner
          disclosure={giDisclosure}
          onRetry={giDisclosure.isRetryable ? () => loadGiIfNeeded(true) : undefined}
          retryLabel="Retry GI Load"
          compact
        />
      )}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 rule-firm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Leaf className="w-4 h-4 text-[#163d4a]" />
              Boundary-Aware Environmental Analytical Engine
            </h3>
            <DataNatureBadge nature={sourceCtx.dataNature} />
            <span className="px-2 py-0.5 border border-[var(--color-rule)] font-mono-num text-[11px] bg-[var(--color-well)]">
              v{categorySummary.provenance.version}
            </span>
          </div>
          <p className="almanac-label mt-1">
            Preserves original functional units, physical dimensions, geographies, and system boundaries—never collapsing incompatible units or presenting GI class proxies as measured LCA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSubMode('explorer')}
            className={`almanac-btn text-xs flex items-center gap-1.5 ${
              subMode === 'explorer' ? 'almanac-btn--primary' : ''
            }`}
          >
            <Leaf className="w-3.5 h-3.5" />
            Source Explorer
          </button>
          <button
            onClick={() => {
              setSubMode('compatibility');
              loadGiIfNeeded();
            }}
            className={`almanac-btn text-xs flex items-center gap-1.5 ${
              subMode === 'compatibility' ? 'almanac-btn--primary' : ''
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Compatibility &amp; Boundary Guard
          </button>
        </div>
      </div>

      {subMode === 'explorer' && (
        <div className="space-y-4">
          {/* Dataset & Single Indicator Switchers */}
          <div className="flex flex-wrap items-end gap-3 pb-3 rule-hair-bottom">
            <div>
              <label className="block almanac-label mb-1">1. Environmental Source Dataset</label>
              <select
                value={activeSource}
                onChange={(e) => handleSourceChange(e.target.value as EnvironmentSourceId)}
                className="almanac-select"
              >
                <option value="agribalyse_31">
                  ADEME Agribalyse 3.1.1 ({agribalyseItems.length.toLocaleString()} items · Model Output)
                </option>
                <option value="poore_nemecek_2018">
                  Poore &amp; Nemecek 2018 Global ({pooreItems.length} commodities · Estimated)
                </option>
                <option value="gi_terroir_proxy">
                  EUIPO GIview / Qualigeo Registry (Estimated Class Proxies)
                </option>
              </select>
            </div>

            <div>
              <label className="block almanac-label mb-1">2. Single Unit-Consistent Indicator</label>
              <select
                value={effectiveIndicator}
                onChange={(e) => {
                  const key = e.target.value as EnvironmentIndicatorKey;
                  setLocalIndicator(key);
                  if (activeSource === 'agribalyse_31' && onAgbIndicatorChange) {
                    onAgbIndicatorChange(key);
                  }
                }}
                className="almanac-select"
              >
                {SOURCE_INDICATORS[activeSource].map((k) => {
                  const s = ENVIRONMENT_INDICATOR_SPECS[k];
                  return (
                    <option key={k} value={k}>
                      {s.label} [{s.unit}]
                    </option>
                  );
                })}
              </select>
            </div>

            {activeSource === 'gi_terroir_proxy' && (
              <label className="flex items-center gap-2 text-xs cursor-pointer pb-1.5">
                <input
                  type="checkbox"
                  checked={includeNonFoodGi}
                  onChange={(e) => setIncludeNonFoodGi(e.target.checked)}
                />
                <span>Include non-food GIs (WINE / SPIRIT / CRAFT — excluded by default)</span>
              </label>
            )}
          </div>

          {/* Provenance & Boundary Strip */}
          <div className="grid grid-cols-1 md:grid-cols-4 border border-[var(--color-rule)] bg-[var(--color-sheet)] text-xs">
            <div className="p-2.5 rule-hair-right">
              <div className="almanac-label text-[11px]">Functional Unit</div>
              <div className="font-mono-num font-semibold text-[var(--color-ink)] mt-0.5">
                {indicatorSpec.functionalUnit} ({indicatorSpec.unit})
              </div>
            </div>
            <div className="p-2.5 rule-hair-right">
              <div className="almanac-label text-[11px]">Geography</div>
              <div className="text-[var(--color-ink)] mt-0.5">{sourceCtx.geography}</div>
            </div>
            <div className="p-2.5 rule-hair-right">
              <div className="almanac-label text-[11px]">System Boundary</div>
              <div className="text-[var(--color-ink-2)] mt-0.5">{sourceCtx.systemBoundary}</div>
            </div>
            <div className="p-2.5">
              <div className="almanac-label text-[11px]">Valid Coverage</div>
              <div className="font-mono-num font-semibold text-[#163d4a] mt-0.5">
                {categorySummary.missingness.includedRecords.toLocaleString()} /{' '}
                {categorySummary.missingness.totalRecords.toLocaleString()} records
              </div>
            </div>
          </div>

          {sourceCtx.isClassProxy ? (
            <div className="p-3 border border-[#8a1253]/50 bg-[#8a1253]/10 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-[#8a1253] shrink-0 mt-0.5" />
              <div>
                <b className="text-[#8a1253]">Class-Proxy Disclosure (Not Measured Product LCA):</b>{' '}
                {sourceCtx.disclosureNote}
              </div>
            </div>
          ) : (
            <div className="p-2.5 border border-[var(--color-rule)] bg-[var(--color-well)] text-xs flex items-start gap-2">
              <Info className="w-4 h-4 text-[#163d4a] shrink-0 mt-0.5" />
              <div>
                <span>{sourceCtx.disclosureNote}</span>{' '}
                {indicatorSpec.compositeMethodNote && (
                  <span className="font-semibold text-[var(--color-ink)] ml-1">
                    {indicatorSpec.compositeMethodNote}
                  </span>
                )}
              </div>
            </div>
          )}

          {giLoading && activeSource === 'gi_terroir_proxy' ? (
            <div className="p-4 text-xs text-[var(--color-muted)]">Loading GI registry records...</div>
          ) : (
            <div className="overflow-x-auto max-h-72 border border-[var(--color-rule)]">
              <table className="almanac-table">
                <thead>
                  <tr>
                    <th>{activeSource === 'gi_terroir_proxy' ? 'EU GI Proxy Class' : 'Category / Commodity Group'}</th>
                    <th className="text-right">Valid Denominator</th>
                    <th className="text-right">Missing (NULL)</th>
                    <th className="text-right">Mean ({indicatorSpec.unit})</th>
                    <th className="text-right">Median ({indicatorSpec.unit})</th>
                    <th className="text-right">Range [Min – Max]</th>
                  </tr>
                </thead>
                <tbody>
                  {categorySummary.data.map((row) => (
                    <tr key={row.category} title={row.aggregateDisclosure}>
                      <td className="font-semibold text-xs text-[var(--color-ink)]">
                        {row.category}
                        {row.isClassProxy && (
                          <span className="ml-1.5 text-[10px] font-mono-num text-[#8a1253]">
                            [Class Proxy]
                          </span>
                        )}
                      </td>
                      <td className="num text-right text-xs">
                        {row.validDenominator} / {row.totalRecords}
                      </td>
                      <td className="num text-right text-xs text-[var(--color-muted)]">
                        {row.missingCount}
                      </td>
                      <td className="num text-right text-xs font-semibold text-[#163d4a]">
                        {row.mean !== null ? row.mean.toFixed(2) : 'N/A'}
                      </td>
                      <td className="num text-right text-xs">
                        {row.median !== null ? row.median.toFixed(2) : 'N/A'}
                      </td>
                      <td className="num text-right text-xs text-[var(--color-muted)]">
                        {row.min !== null && row.max !== null
                          ? `[${row.min.toFixed(2)} – ${row.max.toFixed(2)}]`
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subMode === 'compatibility' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="almanac-well p-3 border border-[var(--color-rule)] space-y-2">
              <div className="font-display-head font-semibold text-xs text-[var(--color-ink)]">
                Reference A (Original Indicator &amp; Boundary)
              </div>
              <select
                value={compatKeyA}
                onChange={(e) => {
                  const k = e.target.value as EnvironmentIndicatorKey;
                  setCompatKeyA(k);
                  setRecordIdxA(0);
                }}
                className="w-full almanac-select text-xs"
              >
                {ALL_INDICATOR_KEYS.map((k) => {
                  const s = ENVIRONMENT_INDICATOR_SPECS[k];
                  return (
                    <option key={k} value={k}>
                      [{s.sourceId}] {s.label} ({s.unit})
                    </option>
                  );
                })}
              </select>
              <select
                value={recordIdxA}
                onChange={(e) => setRecordIdxA(Number(e.target.value))}
                className="w-full almanac-select text-xs"
              >
                {poolA.slice(0, 60).map((r, i) => (
                  <option key={`${r.recordId}-${i}`} value={i}>
                    {r.recordId} — {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="almanac-well p-3 border border-[var(--color-rule)] space-y-2">
              <div className="font-display-head font-semibold text-xs text-[var(--color-ink)]">
                Reference B (Comparison Target)
              </div>
              <select
                value={compatKeyB}
                onChange={(e) => {
                  const k = e.target.value as EnvironmentIndicatorKey;
                  setCompatKeyB(k);
                  setRecordIdxB(0);
                }}
                className="w-full almanac-select text-xs"
              >
                {ALL_INDICATOR_KEYS.map((k) => {
                  const s = ENVIRONMENT_INDICATOR_SPECS[k];
                  return (
                    <option key={k} value={k}>
                      [{s.sourceId}] {s.label} ({s.unit})
                    </option>
                  );
                })}
              </select>
              <select
                value={recordIdxB}
                onChange={(e) => setRecordIdxB(Number(e.target.value))}
                className="w-full almanac-select text-xs"
              >
                {poolB.slice(0, 60).map((r, i) => (
                  <option key={`${r.recordId}-${i}`} value={i}>
                    {r.recordId} — {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {compatResult && (
            <div className="space-y-3">
              {/* Compatibility Verdict Banner */}
              <div
                className={`p-3.5 border text-xs space-y-1.5 ${
                  compatResult.data.compatibility.comparabilityLevel === 'direct'
                    ? 'border-[#163d4a] bg-[#163d4a]/10'
                    : compatResult.data.compatibility.comparabilityLevel === 'cautionary_cross_boundary'
                    ? 'border-[#6b4c1b] bg-[#6b4c1b]/10'
                    : 'border-[#8a1253] bg-[#8a1253]/10'
                }`}
              >
                <div className="font-semibold flex items-center gap-2 text-sm">
                  {compatResult.data.compatibility.comparabilityLevel === 'direct' ? (
                    <CheckCircle2 className="w-4 h-4 text-[#163d4a]" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-[#8a1253]" />
                  )}
                  Verdict:{' '}
                  <span className="uppercase font-mono-num">
                    {compatResult.data.compatibility.comparabilityLevel}
                  </span>
                </div>
                <p>{compatResult.data.compatibility.guidanceSummary}</p>
                {compatResult.data.compatibility.incompatibilityReasons.length > 0 && (
                  <ul className="list-disc pl-5 space-y-0.5 text-[var(--color-ink-2)]">
                    {compatResult.data.compatibility.incompatibilityReasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                )}
                {compatResult.data.compatibility.requirementsToEnableComparison.length > 0 && (
                  <div className="pt-1 font-mono-num text-[11px] text-[var(--color-ink)]">
                    <b>Required to enable valid comparison:</b>{' '}
                    {compatResult.data.compatibility.requirementsToEnableComparison.join(' ')}
                  </div>
                )}
              </div>

              {/* Side-by-Side Original Values (Displayed Separately, Never Forced) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[compatResult.data.sideA, compatResult.data.sideB].map((side, idx) => (
                  <div key={idx} className="almanac-sheet p-3.5 border border-[var(--color-rule)] space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--color-ink)]">{side.name}</span>
                      <DataNatureBadge nature={side.context.dataNature} />
                    </div>
                    <div className="font-mono-num text-lg font-semibold text-[var(--color-accent)]">
                      {side.value !== null ? `${side.value} ${side.indicator.unit}` : `NULL (${side.indicator.unit})`}
                    </div>
                    <div className="font-mono-num text-[11px] text-[var(--color-muted)]">
                      ID: {side.recordId} · FU: {side.indicator.functionalUnit}
                    </div>
                    <div className="text-[11px] text-[var(--color-ink-2)]">
                      <b>Boundary:</b> {side.context.systemBoundary}
                    </div>
                    <div className="text-[11px] text-[var(--color-ink-2)]">
                      <b>Geography:</b> {side.context.geography}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
