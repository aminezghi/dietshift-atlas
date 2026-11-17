import type { DataNature } from '../types/dataRegistry';

const NATURE_STYLES: Record<DataNature, { border: string; text: string; title: string }> = {
  Observed: {
    border: 'border-[var(--color-teal)]',
    text: 'text-[var(--color-teal)]',
    title: 'Observed empirical measurements from primary surveys, APIs, or clinical microdata',
  },
  Estimated: {
    border: 'border-[var(--color-ochre)]',
    text: 'text-[var(--color-ochre)]',
    title: 'Estimated via proxy assignment, synthesis, or harmonization rules',
  },
  'Model Output': {
    border: 'border-[var(--color-ink-2)]',
    text: 'text-[var(--color-ink)]',
    title: 'Model output derived from disaggregation, clustering, or dimensionality reduction',
  },
  Forecast: {
    border: 'border-[var(--color-accent)]',
    text: 'text-[var(--color-accent)]',
    title: 'Chronological statistical out-of-sample projection with uncertainty bounds',
  },
  Simulated: {
    border: 'border-[var(--color-accent)]',
    text: 'text-[var(--color-accent)]',
    title: 'Counterfactual policy or dietary scenario simulation based on explicit model assumptions',
  },
  'Manually Compiled': {
    border: 'border-[var(--color-rule-2)]',
    text: 'text-[var(--color-muted)]',
    title: 'Curated or transcribed from published institutional reports and reference tables',
  },
};

export function DataNatureBadge({
  nature,
  label,
}: {
  nature: DataNature;
  label?: string;
}) {
  const style = NATURE_STYLES[nature];
  return (
    <span
      title={style.title}
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono-num font-semibold border ${style.border} ${style.text} bg-[var(--color-paper-2)] whitespace-nowrap`}
    >
      {label ? `${nature}: ${label}` : nature}
    </span>
  );
}
