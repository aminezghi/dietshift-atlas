import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileJson,
  GitBranch,
  Layers,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  type ClassificationFilter,
  type ClassificationMappingRecord,
  type MappingType,
  type TaxonomySystem,
  MAPPING_TYPES,
  TAXONOMY_SYSTEMS,
  filterMappings,
  serializeMappingsToCsv,
  serializeMappingsToJson,
  summarizeMappings,
} from '../analytics/classificationEngine';
import { fetchCachedJson } from '../services/dataProvider';
import { triggerBlobDownload } from '../utils/exportDownload';
import { DataNatureBadge } from './DataNatureBadge';

export interface RosettaCrosswalkRow {
  crosswalk_id: string;
  ecoicop_code: string;
  ecoicop_label: string;
  foodex2_code: string;
  foodex2_level1: string;
  foodex2_level2: string;
  agb_code: string;
  agb_lci_name: string;
  nova_group: number;
  allocation_weight: number;
  edible_yield_factor: number;
  mean_co2_kg: number;
  mean_water_m3: number;
  eat_lancet_group: string;
  mapping_type?: string;
  confidence?: number;
  explanation?: string;
  mapping_version?: string;
}

interface ClassificationInspectorProps {
  rosettaData: RosettaCrosswalkRow[];
}

const MAPPING_TYPE_BADGES: Record<MappingType, { label: string; badgeClass: string }> = {
  exact: { label: 'Exact', badgeClass: 'border-[#163d4a] text-[#163d4a] bg-[#163d4a]/10' },
  hierarchical: { label: 'Hierarchical', badgeClass: 'border-[#3f6f7d] text-[#163d4a] bg-[#3f6f7d]/10' },
  approximate: { label: 'Approximate', badgeClass: 'border-[#6b4c1b] text-[#6b4c1b] bg-[#6b4c1b]/10' },
  ambiguous: { label: 'Ambiguous', badgeClass: 'border-[#8a1253] text-[#8a1253] bg-[#8a1253]/10' },
  unmatched: { label: 'Unmatched', badgeClass: 'border-[#7c2d12] text-[#7c2d12] bg-[#7c2d12]/10' },
};

export function ClassificationInspector({ rosettaData }: ClassificationInspectorProps) {
  const [mappings, setMappings] = useState<ClassificationMappingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sourceSystem, setSourceSystem] = useState<TaxonomySystem | 'ALL'>('ALL');
  const [targetSystem, setTargetSystem] = useState<TaxonomySystem | 'ALL'>('ALL');
  const [selectedTypes, setSelectedTypes] = useState<MappingType[]>([]);
  const [onlyAmbiguous, setOnlyAmbiguous] = useState(false);
  const [onlyUnmatched, setOnlyUnmatched] = useState(false);
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'harmonisation' | 'rosetta'>('harmonisation');

  useEffect(() => {
    let cancelled = false;
    fetchCachedJson<ClassificationMappingRecord[]>('data/classification_mappings.json')
      .then((data) => {
        if (!cancelled) {
          setMappings(data);
          if (data.length > 0) setSelectedMappingId(data[0].mapping_id);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeFilter: ClassificationFilter = useMemo(
    () => ({
      searchQuery,
      sourceSystem,
      targetSystem,
      mappingTypes: selectedTypes,
      onlyAmbiguous,
      onlyUnmatched,
    }),
    [searchQuery, sourceSystem, targetSystem, selectedTypes, onlyAmbiguous, onlyUnmatched]
  );

  const filteredMappings = useMemo(
    () => filterMappings(mappings, activeFilter),
    [mappings, activeFilter]
  );

  const summaryResult = useMemo(() => summarizeMappings(mappings), [mappings]);
  const filteredSummaryResult = useMemo(() => summarizeMappings(filteredMappings), [filteredMappings]);

  const activeRecord = useMemo(
    () => filteredMappings.find((r) => r.mapping_id === selectedMappingId) ?? filteredMappings[0] ?? null,
    [filteredMappings, selectedMappingId]
  );

  const toggleMappingType = (mt: MappingType) => {
    setSelectedTypes((prev) =>
      prev.includes(mt) ? prev.filter((item) => item !== mt) : [...prev, mt]
    );
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSourceSystem('ALL');
    setTargetSystem('ALL');
    setSelectedTypes([]);
    setOnlyAmbiguous(false);
    setOnlyUnmatched(false);
  };

  return (
    <div className="space-y-5">
      {/* Header & Mode Switch */}
      <div className="almanac-sheet p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-3 mb-3 rule-firm">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-[var(--color-accent)]" />
                Food Classification &amp; Harmonisation Engine (FoodEx2 × Agribalyse × OFF × COICOP)
              </h3>
              <DataNatureBadge nature="Manually Compiled" />
              <span className="px-2 py-0.5 border border-[var(--color-rule)] font-mono-num text-[11px] bg-[var(--color-well)]">
                v3.0.0-phase3a
              </span>
            </div>
            <p className="almanac-label mt-1">
              Traceable multi-taxonomy crosswalk separating Exact, Hierarchical, Approximate, Ambiguous, and Unmatched gaps. Missing targets remain explicit (NULL)—never fabricated to inflate match counts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setViewMode('harmonisation')}
              className={`almanac-btn flex items-center gap-1.5 ${viewMode === 'harmonisation' ? 'almanac-btn--primary' : ''}`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              Mapping Inspector ({mappings.length})
            </button>
            <button
              onClick={() => setViewMode('rosetta')}
              className={`almanac-btn flex items-center gap-1.5 ${viewMode === 'rosetta' ? 'almanac-btn--primary' : ''}`}
            >
              <Layers className="w-3.5 h-3.5" />
              Rosetta Anchors ({rosettaData.length})
            </button>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-[var(--color-rule)] bg-[var(--color-sheet)]">
          <div className="p-2.5 rule-hair-right">
            <div className="almanac-label text-xs">Total Rules</div>
            <div className="font-mono-num font-semibold text-base text-[var(--color-ink)]">
              {summaryResult.data.totalRules}
            </div>
          </div>
          <div className="p-2.5 rule-hair-right">
            <div className="almanac-label text-xs">Exact / Hierarchical</div>
            <div className="font-mono-num font-semibold text-base text-[#163d4a]">
              {summaryResult.data.byMappingType.exact + summaryResult.data.byMappingType.hierarchical}{' '}
              <span className="text-xs font-normal text-[var(--color-muted)]">
                ({summaryResult.data.exactOrHierarchicalPct}%)
              </span>
            </div>
          </div>
          <div className="p-2.5 rule-hair-right">
            <div className="almanac-label text-xs">Approximate</div>
            <div className="font-mono-num font-semibold text-base text-[#6b4c1b]">
              {summaryResult.data.byMappingType.approximate}
            </div>
          </div>
          <div className="p-2.5 rule-hair-right">
            <div className="almanac-label text-xs">Ambiguous</div>
            <div className="font-mono-num font-semibold text-base text-[var(--color-accent)]">
              {summaryResult.data.ambiguousCount}
            </div>
          </div>
          <div className="p-2.5 rule-hair-right">
            <div className="almanac-label text-xs">Unmatched Gaps</div>
            <div className="font-mono-num font-semibold text-base text-[#7c2d12]">
              {summaryResult.data.unmatchedCount}
            </div>
          </div>
          <div className="p-2.5">
            <div className="almanac-label text-xs">Filtered Slice</div>
            <div className="font-mono-num font-semibold text-base text-[var(--color-ink)]">
              {filteredSummaryResult.data.totalRules} rules
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'harmonisation' && (
        <div className="almanac-sheet p-5 space-y-4">
          {loadError && (
            <div className="p-3 border border-[#7c2d12] bg-[#7c2d12]/10 text-xs text-[#7c2d12] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Failed to load classification mappings: {loadError}
            </div>
          )}

          {/* Filter Toolbar & Export Controls */}
          <div className="flex flex-wrap items-end justify-between gap-3 pb-3 rule-hair-bottom">
            <div className="flex flex-wrap items-end gap-3 flex-1 min-w-[260px]">
              <div className="flex-1 min-w-[210px]">
                <label className="block almanac-label mb-1">Search code, food group, or rationale</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[var(--color-muted)] absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. A03TD, CP0115, beurres, milk, unmatched..."
                    className="w-full almanac-input pl-8"
                  />
                </div>
              </div>

              <div>
                <label className="block almanac-label mb-1">Source taxonomy</label>
                <select
                  value={sourceSystem}
                  onChange={(e) => setSourceSystem(e.target.value as TaxonomySystem | 'ALL')}
                  className="almanac-select"
                >
                  <option value="ALL">All sources</option>
                  {TAXONOMY_SYSTEMS.map((sys) => (
                    <option key={sys} value={sys}>
                      {sys}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block almanac-label mb-1">Target taxonomy</label>
                <select
                  value={targetSystem}
                  onChange={(e) => setTargetSystem(e.target.value as TaxonomySystem | 'ALL')}
                  className="almanac-select"
                >
                  <option value="ALL">All targets</option>
                  {TAXONOMY_SYSTEMS.map((sys) => (
                    <option key={sys} value={sys}>
                      {sys}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={resetFilters}
                className="almanac-btn flex items-center gap-1"
                title="Reset all taxonomy and mapping filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
              <button
                onClick={() =>
                  triggerBlobDownload(
                    serializeMappingsToCsv(filteredMappings),
                    'text/csv;charset=utf-8;',
                    'dietshift_classification_mappings.csv'
                  )
                }
                disabled={filteredMappings.length === 0}
                className="almanac-btn flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV ({filteredMappings.length})
              </button>
              <button
                onClick={() =>
                  triggerBlobDownload(
                    serializeMappingsToJson(filteredMappings, activeFilter),
                    'application/json;charset=utf-8;',
                    'dietshift_classification_mappings.json'
                  )
                }
                disabled={filteredMappings.length === 0}
                className="almanac-btn flex items-center gap-1.5"
              >
                <FileJson className="w-3.5 h-3.5" />
                Export JSON
              </button>
            </div>
          </div>

          {/* Mapping Type Toggle Pills + Gap Audits */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="almanac-label text-xs mr-1">Mapping types:</span>
            {MAPPING_TYPES.map((mt) => {
              const active = selectedTypes.includes(mt);
              return (
                <button
                  key={mt}
                  onClick={() => toggleMappingType(mt)}
                  className={`almanac-btn text-xs py-1 px-2.5 ${active ? 'almanac-btn--primary' : ''}`}
                >
                  {MAPPING_TYPE_BADGES[mt].label} ({summaryResult.data.byMappingType[mt]})
                </button>
              );
            })}
            <span className="mx-1 text-[var(--color-rule)]">|</span>
            <button
              onClick={() => {
                setOnlyAmbiguous((v) => !v);
                setOnlyUnmatched(false);
              }}
              className={`almanac-btn text-xs py-1 px-2.5 ${onlyAmbiguous ? 'almanac-btn--primary' : ''}`}
            >
              Audit ambiguous ({summaryResult.data.ambiguousCount})
            </button>
            <button
              onClick={() => {
                setOnlyUnmatched((v) => !v);
                setOnlyAmbiguous(false);
              }}
              className={`almanac-btn text-xs py-1 px-2.5 ${onlyUnmatched ? 'almanac-btn--primary' : ''}`}
            >
              Audit unmatched gaps ({summaryResult.data.unmatchedCount})
            </button>
          </div>

          {/* Two-Column Workbench: Mapping Table + Provenance Detail Panel */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 overflow-x-auto max-h-[28rem] border border-[var(--color-rule)]">
              {loading ? (
                <div className="p-6 text-xs text-[var(--color-muted)]">Loading harmonized mapping index...</div>
              ) : filteredMappings.length === 0 ? (
                <div className="p-6 text-xs text-[var(--color-muted)]">
                  No classification mappings match your current filter.
                </div>
              ) : (
                <table className="almanac-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Source label / code</th>
                      <th>Target</th>
                      <th>Target label / gap</th>
                      <th>Relationship</th>
                      <th>Confidence tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMappings.map((row) => {
                      const selected = activeRecord?.mapping_id === row.mapping_id;
                      const badge = MAPPING_TYPE_BADGES[row.mapping_type];
                      return (
                        <tr
                          key={row.mapping_id}
                          onClick={() => setSelectedMappingId(row.mapping_id)}
                          className={`cursor-pointer ${selected ? 'bg-[var(--color-well)] font-medium' : ''}`}
                        >
                          <td className="font-mono-num text-[11px] whitespace-nowrap">{row.source_system}</td>
                          <td>
                            <div className="text-xs text-[var(--color-ink)]">{row.source_label}</div>
                            <div className="font-mono-num text-[10px] text-[var(--color-muted)]">
                              {row.source_code} ({row.source_item_count} {row.source_item_count === 1 ? 'node' : 'items'})
                            </div>
                          </td>
                          <td className="font-mono-num text-[11px] whitespace-nowrap">{row.target_system}</td>
                          <td>
                            {row.target_code ? (
                              <>
                                <div className="text-xs text-[var(--color-ink)]">{row.target_label}</div>
                                <div className="font-mono-num text-[10px] text-[var(--color-accent)]">
                                  {row.target_code}
                                </div>
                              </>
                            ) : (
                              <span className="font-mono-num text-[11px] text-[#7c2d12]">NULL (Unmatched)</span>
                            )}
                          </td>
                          <td>
                            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-mono-num border ${badge.badgeClass}`}>
                              {badge.label}
                              {row.hierarchy_direction ? ` · ${row.hierarchy_direction}` : ''}
                            </span>
                          </td>
                          <td className="font-mono-num text-[11px]">{row.confidence_tier}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Selected Mapping Provenance & Rationale Card */}
            <div className="almanac-well p-4 border border-[var(--color-rule)] space-y-3">
              <div className="pb-2 rule-firm flex items-center justify-between">
                <span className="font-display-head font-semibold text-sm">Mapping Provenance Dossier</span>
                <span className="font-mono-num text-[11px] text-[var(--color-muted)]">
                  {activeRecord?.mapping_id ?? '—'}
                </span>
              </div>

              {activeRecord ? (
                <div className="space-y-2.5 text-xs">
                  <div>
                    <div className="almanac-label text-[11px]">Source ({activeRecord.source_system})</div>
                    <div className="font-semibold text-[var(--color-ink)]">{activeRecord.source_label}</div>
                    <div className="font-mono-num text-[11px] text-[var(--color-muted)]">
                      Code: {activeRecord.source_code} · Coverage: {activeRecord.source_item_count} items
                    </div>
                    {activeRecord.representative_agb_code && (
                      <div className="font-mono-num text-[11px] text-[#163d4a]">
                        Verified Agribalyse FK: #{activeRecord.representative_agb_code}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="almanac-label text-[11px]">Target ({activeRecord.target_system})</div>
                    <div className="font-semibold text-[var(--color-ink)]">
                      {activeRecord.target_label ?? 'Unmatched — no verified counterpart'}
                    </div>
                    <div className="font-mono-num text-[11px] text-[var(--color-accent)]">
                      Code: {activeRecord.target_code ?? 'NULL'} · Tier: {activeRecord.confidence_tier}
                    </div>
                  </div>

                  {activeRecord.candidate_targets && (
                    <div className="p-2 border border-[var(--color-rule)] bg-[var(--color-sheet)]">
                      <div className="almanac-label text-[10px]">Competing / Multi-Branch Candidates</div>
                      <div className="font-mono-num text-[11px] text-[var(--color-ink)] mt-0.5">
                        {activeRecord.candidate_targets}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="almanac-label text-[11px]">Mapping Rationale</div>
                    <p className="text-[var(--color-ink-2)] leading-relaxed mt-0.5">{activeRecord.rationale}</p>
                  </div>

                  <div className="pt-2 rule-hair-top space-y-1 font-mono-num text-[11px] text-[var(--color-muted)]">
                    <div>Sources: {activeRecord.source_reference}</div>
                    <div>Version: {activeRecord.mapping_version}</div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[var(--color-muted)]">Select any row to inspect rationale and provenance.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'rosetta' && (
        <div className="almanac-sheet p-5">
          <div className="pb-3 mb-3 rule-firm">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Canonical Dual-Anchor Rosetta Crosswalk (crosswalk_rosetta.parquet)
            </h4>
            <p className="almanac-label mt-0.5">
              {rosettaData.length} curated expenditure-to-LCA anchors linking ECOICOP 5-digit codes to EFSA FoodEx2 and verified ADEME Agribalyse 3.1.1 Code_AGB records.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="almanac-table">
              <thead>
                <tr>
                  <th>ECOICOP 5-digit</th>
                  <th>NSI household expenditure &amp; CPI category</th>
                  <th>EFSA FoodEx2</th>
                  <th>Agribalyse AGB (Verified)</th>
                  <th>Mapping type</th>
                  <th className="text-right">Confidence</th>
                  <th className="text-right">NOVA</th>
                  <th className="text-right">Edible yield</th>
                  <th className="text-right">Climate (kg CO₂/kg)</th>
                </tr>
              </thead>
              <tbody>
                {rosettaData.map((row) => (
                  <tr key={row.crosswalk_id} title={row.explanation || ''}>
                    <td className="num font-semibold text-[var(--color-ink)]">{row.ecoicop_code}</td>
                    <td>{row.ecoicop_label}</td>
                    <td className="num text-[var(--color-accent)]">{row.foodex2_code}</td>
                    <td className="num">
                      #{row.agb_code} ({row.agb_lci_name.slice(0, 24)})
                    </td>
                    <td className="font-mono-num text-xs">{row.mapping_type ?? 'partial'}</td>
                    <td className="num text-right">{row.confidence != null ? row.confidence.toFixed(2) : '—'}</td>
                    <td className="num text-right">{row.nova_group}</td>
                    <td className="num text-right">{row.edible_yield_factor.toFixed(2)}</td>
                    <td className="num text-right font-semibold text-[var(--color-accent)]">
                      {row.mean_co2_kg.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
