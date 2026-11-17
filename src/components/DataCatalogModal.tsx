import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Database, ExternalLink, Info, ShieldAlert, X } from 'lucide-react';
import type { DataNature, DataTier, DatasetMetadata, DatasetsRegistry } from '../types/dataRegistry';
import { DataNatureBadge } from './DataNatureBadge';

interface DataCatalogModalProps {
  registry: DatasetsRegistry | null;
  open: boolean;
  onClose: () => void;
}

const UPDATE_POLICY_LABELS: Record<DatasetMetadata['update_policy'], string> = {
  auto_api: 'Repeatable API',
  manual: 'Manual Refresh',
  static_reference: 'Static Reference',
  credentials_required: 'Credentials Req.',
  archived: 'Archived',
};

export function DataCatalogModal({ registry, open, onClose }: DataCatalogModalProps) {
  const [tierFilter, setTierFilter] = useState<'ALL' | DataTier>('ALL');
  const [natureFilter, setNatureFilter] = useState<'ALL' | DataNature>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const isVisible = Boolean(open && registry);

  useEffect(() => {
    if (!isVisible) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const raf = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isVisible, onClose]);

  const filtered = useMemo(() => {
    if (!registry) return [];
    const q = search.trim().toLowerCase();
    return registry.datasets.filter((d) => {
      if (tierFilter !== 'ALL' && d.tier !== tierFilter) return false;
      if (natureFilter !== 'ALL' && d.data_nature !== natureFilter) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.source_name.toLowerCase().includes(q) ||
        d.view_name.toLowerCase().includes(q)
      );
    });
  }, [registry, tierFilter, natureFilter, search]);

  const activeDataset = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.find((d) => d.id === selectedId) || filtered[0];
  }, [filtered, selectedId]);

  if (!open || !registry) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-catalog-modal-title"
        className="almanac-sheet w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 rule-firm flex flex-wrap items-center justify-between gap-3 bg-[var(--color-paper-2)]">
          <div>
            <h2 id="data-catalog-modal-title" className="text-base font-semibold flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--color-accent)]" />
              Data Infrastructure, Provenance &amp; Automated Quality Registry
            </h2>
            <p className="almanac-label text-xs mt-0.5">
              {registry.total_datasets} registered Parquet datasets · {registry.total_records.toLocaleString()} records ·{' '}
              {(registry.total_bytes / 1024).toFixed(1)} KB ZSTD · Validation:{' '}
              <span className="font-mono-num font-semibold text-[var(--color-teal)]">
                {registry.validation_summary.pass} pass
              </span>
              , {registry.validation_summary.warn} warn, {registry.validation_summary.fail} fail
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="almanac-btn flex items-center gap-1"
            aria-label="Close catalog"
          >
            <X className="w-3.5 h-3.5" /> Close
          </button>
        </div>

        {/* Filters */}
        <div className="p-3 rule-hair-bottom flex flex-wrap items-center gap-2 bg-[var(--color-sheet)] text-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dataset, view, or source..."
            className="almanac-input text-xs w-56"
          />
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as typeof tierFilter)}
            className="almanac-select text-xs"
          >
            <option value="ALL">All data tiers ({registry.total_datasets})</option>
            <option value="processed">Processed ({registry.summary_by_tier.processed})</option>
            <option value="harmonized">Harmonized ({registry.summary_by_tier.harmonized})</option>
            <option value="analytical">Analytical ({registry.summary_by_tier.analytical})</option>
            <option value="forecast">Forecast ({registry.summary_by_tier.forecast})</option>
          </select>
          <select
            value={natureFilter}
            onChange={(e) => setNatureFilter(e.target.value as typeof natureFilter)}
            className="almanac-select text-xs"
          >
            <option value="ALL">All data-nature types</option>
            <option value="Observed">Observed ({registry.summary_by_nature.Observed})</option>
            <option value="Estimated">Estimated ({registry.summary_by_nature.Estimated})</option>
            <option value="Model Output">Model Output ({registry.summary_by_nature['Model Output']})</option>
            <option value="Forecast">Forecast ({registry.summary_by_nature.Forecast})</option>
            <option value="Manually Compiled">Manually Compiled ({registry.summary_by_nature['Manually Compiled']})</option>
          </select>
          <span className="ml-auto font-mono-num text-[11px] text-[var(--color-muted)]">
            Manifest generated: {registry.generated_at_utc.slice(0, 19).replace('T', ' ')} UTC
          </span>
        </div>

        {/* Split Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Dataset List */}
          <div className="lg:col-span-5 overflow-y-auto border-r border-[var(--color-rule)] divide-y divide-[var(--color-rule)]">
            {filtered.map((ds) => {
              const active = activeDataset?.id === ds.id;
              return (
                <button
                  key={ds.id}
                  onClick={() => setSelectedId(ds.id)}
                  className={`w-full text-left p-3 transition cursor-pointer ${
                    active ? 'bg-[var(--color-paper-2)]' : 'hover:bg-[var(--color-paper-2)]/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display-head font-semibold text-xs text-[var(--color-ink)]">
                      {ds.name}
                    </span>
                    <span className="font-mono-num text-[11px] text-[var(--color-accent)] shrink-0">
                      {ds.record_count.toLocaleString()} rows
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <DataNatureBadge nature={ds.data_nature} />
                    <span className="px-1.5 py-0.5 text-[10px] font-mono-num border border-[var(--color-rule)] text-[var(--color-muted)]">
                      tier: {ds.tier}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-mono-num border border-[var(--color-rule)] text-[var(--color-muted)]">
                      {UPDATE_POLICY_LABELS[ds.update_policy]}
                    </span>
                    <span className="ml-auto font-mono-num text-[10px] text-[var(--color-teal)] flex items-center gap-1">
                      {ds.validation_status === 'pass' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <ShieldAlert className="w-3 h-3 text-[var(--color-accent)]" />
                      )}
                      {ds.validation_status.toUpperCase()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Dataset Inspector */}
          <div className="lg:col-span-7 overflow-y-auto p-4 space-y-4">
            {activeDataset ? (
              <>
                <div className="pb-3 rule-firm space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-[var(--color-ink)]">{activeDataset.name}</h3>
                    <DataNatureBadge nature={activeDataset.data_nature} />
                  </div>
                  <div className="text-xs font-mono-num text-[var(--color-muted)] flex flex-wrap gap-x-4 gap-y-1">
                    <span>SQL view: <b className="text-[var(--color-ink)]">{activeDataset.view_name}</b></span>
                    <span>Version: <b>{activeDataset.version}</b></span>
                    <span>Retrieved: <b>{activeDataset.retrieved_at}</b> ({activeDataset.freshness_days}d ago)</span>
                    <span>Size: <b>{(activeDataset.bytes / 1024).toFixed(1)} KB</b></span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono-num">
                  <div className="almanac-well p-2">
                    <div className="almanac-label text-[11px]">Records</div>
                    <div className="font-semibold text-[var(--color-ink)]">{activeDataset.record_count.toLocaleString()}</div>
                  </div>
                  <div className="almanac-well p-2">
                    <div className="almanac-label text-[11px]">Missingness</div>
                    <div className="font-semibold text-[var(--color-ink)]">{activeDataset.missingness_pct}%</div>
                  </div>
                  <div className="almanac-well p-2">
                    <div className="almanac-label text-[11px]">Dup. Keys</div>
                    <div className="font-semibold text-[var(--color-ink)]">{activeDataset.duplicate_key_count}</div>
                  </div>
                  <div className="almanac-well p-2">
                    <div className="almanac-label text-[11px]">Update Mode</div>
                    <div className="font-semibold text-[var(--color-ink)]">{UPDATE_POLICY_LABELS[activeDataset.update_policy]}</div>
                  </div>
                </div>

                <div className="almanac-well p-3 text-xs space-y-1">
                  <div><b>Source:</b> {activeDataset.source_name}</div>
                  <div><b>License:</b> {activeDataset.license}</div>
                  <div><b>Coverage:</b> {activeDataset.geographic_coverage} · {activeDataset.temporal_coverage}</div>
                  <div><b>Update cadence:</b> {activeDataset.update_cadence}</div>
                  <div><b>SHA-256:</b> <code className="text-[11px]">{activeDataset.sha256}</code></div>
                  <div className="pt-1 text-[var(--color-ink-2)]">
                    <b>Known limitations:</b> {activeDataset.limitations}
                  </div>
                  {activeDataset.source_urls.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-3">
                      {activeDataset.source_urls.map((u) => (
                        <a
                          key={u}
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--color-accent)] hover:underline font-mono-num"
                        >
                          Source link <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {activeDataset.issues.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="font-display-head font-semibold text-xs">Automated validation notes</div>
                    {activeDataset.issues.map((iss, idx) => (
                      <div
                        key={idx}
                        className="almanac-well p-2 text-xs flex items-center gap-2 font-mono-num"
                      >
                        <Info className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
                        <span className="uppercase text-[10px] font-semibold">[{iss.severity}]</span>
                        <span>{iss.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <div className="font-display-head font-semibold text-xs mb-1.5">
                    Column Schema &amp; Missingness ({activeDataset.column_count} columns)
                  </div>
                  <div className="overflow-x-auto max-h-60 border border-[var(--color-rule)]">
                    <table className="almanac-table text-xs">
                      <thead>
                        <tr>
                          <th>Column</th>
                          <th>Type</th>
                          <th className="text-right">Null count</th>
                          <th className="text-right">Null %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeDataset.schema.map((col) => (
                          <tr key={col.name}>
                            <td className="font-mono-num font-semibold text-[var(--color-ink)]">{col.name}</td>
                            <td className="font-mono-num text-[var(--color-muted)]">{col.type}</td>
                            <td className="num text-right">{col.null_count.toLocaleString()}</td>
                            <td className={`num text-right ${col.null_pct > 0 ? 'text-[var(--color-accent)] font-semibold' : ''}`}>
                              {col.null_pct}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="almanac-label text-xs p-6 text-center">No datasets match the active filters.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
