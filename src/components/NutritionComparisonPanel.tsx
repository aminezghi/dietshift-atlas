import { useMemo } from 'react';
import { AlertCircle, Calculator, Info } from 'lucide-react';
import {
  type ComparisonBasis,
  NUTRIENT_KEYS,
  NUTRIENT_LABELS,
  type StandardizedNutritionInput,
  aggregateNutritionByCategory,
  summarizeNutritionDataset,
} from '../analytics/nutritionEngine';
import { DataNatureBadge } from './DataNatureBadge';

interface NutritionComparisonPanelProps {
  inputs: StandardizedNutritionInput[];
  basis: ComparisonBasis;
  onBasisChange: (basis: ComparisonBasis) => void;
  title?: string;
}

const BASIS_OPTIONS: { id: ComparisonBasis; label: string; desc: string }[] = [
  { id: 'per_100g', label: 'Per 100g', desc: 'Original observed values (NULLs preserved)' },
  { id: 'per_100kcal', label: 'Per 100 kcal', desc: 'Derived nutrient density (requires energy > 0)' },
  { id: 'per_serving', label: 'Per Serving', desc: 'Requires verified serving_quantity_g or parseable serving_size' },
];

export function NutritionComparisonPanel({
  inputs,
  basis,
  onBasisChange,
  title = 'Nutrition Comparability & Missingness Engine',
}: NutritionComparisonPanelProps) {
  const datasetCoverage = useMemo(
    () => summarizeNutritionDataset(inputs, basis),
    [inputs, basis]
  );

  const categoryAggregates = useMemo(
    () =>
      aggregateNutritionByCategory(inputs, basis, [
        'energy_kcal',
        'proteins_g',
        'sugars_g',
        'saturated_fat_g',
        'fiber_g',
        'salt_g',
      ]),
    [inputs, basis]
  );

  const cov = datasetCoverage.data;
  const exclusionEntries = Object.entries(cov.exclusionReasons);
  const activeUnitSuffix =
    basis === 'per_100g' ? 'g/100g' : basis === 'per_100kcal' ? 'g/100kcal' : 'g/serving';
  const energyUnit =
    basis === 'per_100g' ? 'kcal/100g' : basis === 'per_100kcal' ? 'kcal/100kcal' : 'kcal/serving';

  return (
    <div className="almanac-sheet p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 rule-firm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[var(--color-accent)]" />
              {title}
            </h3>
            <DataNatureBadge nature={basis === 'per_100g' ? 'Observed' : 'Model Output'} />
            <span className="px-2 py-0.5 border border-[var(--color-rule)] font-mono-num text-[11px] bg-[var(--color-well)]">
              v{datasetCoverage.provenance.version}
            </span>
          </div>
          <p className="almanac-label mt-1">
            {BASIS_OPTIONS.find((o) => o.id === basis)?.desc}. Missing values are excluded cleanly from denominators rather than coerced to zero.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Nutrition comparison unit">
          {BASIS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onBasisChange(opt.id)}
              className={`almanac-btn text-xs ${basis === opt.id ? 'almanac-btn--primary' : ''}`}
              title={opt.desc}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Coverage & Exclusion Diagnostics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 border border-[var(--color-rule)] bg-[var(--color-sheet)]">
        <div className="p-2.5 rule-hair-right">
          <div className="almanac-label text-xs">Input Records</div>
          <div className="font-mono-num font-semibold text-base text-[var(--color-ink)]">
            {cov.totalRecords.toLocaleString()}
          </div>
        </div>
        <div className="p-2.5 rule-hair-right">
          <div className="almanac-label text-xs">Computable ({basis})</div>
          <div className="font-mono-num font-semibold text-base text-[#163d4a]">
            {cov.computableForBasisRecords.toLocaleString()}
          </div>
        </div>
        <div className="p-2.5 rule-hair-right">
          <div className="almanac-label text-xs">Excluded ({basis})</div>
          <div className="font-mono-num font-semibold text-base text-[var(--color-accent)]">
            {cov.excludedForBasisRecords.toLocaleString()}
          </div>
        </div>
        <div className="p-2.5 rule-hair-right">
          <div className="almanac-label text-xs">Profiles (Comp / Part)</div>
          <div className="font-mono-num font-semibold text-sm text-[var(--color-ink)]">
            {cov.completenessBreakdown.complete} / {cov.completenessBreakdown.partial}
          </div>
        </div>
        <div className="p-2.5">
          <div className="almanac-label text-xs">All-NULL Profiles</div>
          <div className="font-mono-num font-semibold text-base text-[#7c2d12]">
            {cov.completenessBreakdown.missing}
          </div>
        </div>
      </div>

      {exclusionEntries.length > 0 && (
        <div className="p-3 border border-[var(--color-accent)]/40 bg-[var(--color-well)] text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[var(--color-ink)]">Explicit Exclusions on {basis}:</span>{' '}
            <span className="font-mono-num text-[var(--color-ink-2)]">
              {exclusionEntries.map(([reason, cnt]) => `${reason}: ${cnt}`).join(' · ')}
            </span>
          </div>
        </div>
      )}

      {/* Per-nutrient coverage badges */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono-num">
        <span className="text-[var(--color-muted)]">Valid coverage ({basis}):</span>
        {NUTRIENT_KEYS.map((nk) => {
          const item = cov.perNutrientCoverage[nk];
          return (
            <span
              key={nk}
              className="px-2 py-0.5 border border-[var(--color-rule)] bg-[var(--color-well)]"
              title={`${NUTRIENT_LABELS[nk]}: ${item.valid} valid, ${item.missingOrExcluded} missing/excluded`}
            >
              {NUTRIENT_LABELS[nk]}: <b>{item.coveragePct}%</b> ({item.valid}/{cov.totalRecords})
            </span>
          );
        })}
      </div>

      {/* Category-level aggregates table */}
      <div className="overflow-x-auto max-h-72 border border-[var(--color-rule)]">
        <table className="almanac-table">
          <thead>
            <tr>
              <th>Category ({categoryAggregates.data.length})</th>
              <th className="text-right">N (Rows)</th>
              <th className="text-right">Energy ({energyUnit})</th>
              <th className="text-right">Protein ({activeUnitSuffix})</th>
              <th className="text-right">Sugars ({activeUnitSuffix})</th>
              <th className="text-right">Sat. Fat ({activeUnitSuffix})</th>
              <th className="text-right">Fiber ({activeUnitSuffix})</th>
              <th className="text-right">Salt ({activeUnitSuffix})</th>
            </tr>
          </thead>
          <tbody>
            {categoryAggregates.data.map((cat) => {
              const renderCell = (m?: { mean: number | null; validDenominator: number }, digits = 1) => {
                if (!m || m.mean === null || m.validDenominator === 0) {
                  return <span className="text-[var(--color-muted)]">N/A (n=0)</span>;
                }
                return (
                  <span>
                    {m.mean.toFixed(digits)}{' '}
                    <span className="text-[10px] text-[var(--color-muted)]">(n={m.validDenominator})</span>
                  </span>
                );
              };
              return (
                <tr key={cat.category} title={cat.categoryDisclosure}>
                  <td className="font-semibold text-xs text-[var(--color-ink)]">{cat.category}</td>
                  <td className="num text-right text-xs">{cat.totalCategoryRecords}</td>
                  <td className="num text-right text-xs">{renderCell(cat.metrics.energy_kcal, 1)}</td>
                  <td className="num text-right text-xs font-semibold text-[#163d4a]">
                    {renderCell(cat.metrics.proteins_g, 1)}
                  </td>
                  <td className="num text-right text-xs">{renderCell(cat.metrics.sugars_g, 1)}</td>
                  <td className="num text-right text-xs">{renderCell(cat.metrics.saturated_fat_g, 1)}</td>
                  <td className="num text-right text-xs">{renderCell(cat.metrics.fiber_g, 1)}</td>
                  <td className="num text-right text-xs">{renderCell(cat.metrics.salt_g, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-[var(--color-muted)] flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>
          Category means reflect pooled valid observations only (`n` denominator shown explicitly) and never substitute for individual product measurements.
        </span>
      </div>
    </div>
  );
}
