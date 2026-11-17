import { useId, useMemo, useState, type ComponentProps } from 'react';
import ReactECharts from 'echarts-for-react';
import { adaptChartOption, useDarkMode } from '../utils/chartTheme';

export interface ChartDataTableFallback {
  caption?: string;
  headers: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>;
}

type EChartsProps = ComponentProps<typeof ReactECharts> & {
  ariaLabel?: string;
  accessibleSummary?: string;
  dataTableFallback?: ChartDataTableFallback;
};

export default function ThemedEChart({
  option,
  ariaLabel,
  accessibleSummary,
  dataTableFallback,
  ...rest
}: EChartsProps) {
  const isDark = useDarkMode();
  const [showTable, setShowTable] = useState(false);
  const summaryId = useId();
  const adaptedOption = useMemo(() => adaptChartOption(option, isDark), [option, isDark]);

  const hasAccessibilityExtras = Boolean(
    ariaLabel || accessibleSummary || (dataTableFallback && dataTableFallback.rows.length > 0)
  );

  if (!hasAccessibilityExtras) {
    return <ReactECharts option={adaptedOption} {...rest} />;
  }

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      aria-describedby={accessibleSummary ? summaryId : undefined}
      className="relative w-full h-full"
    >
      {accessibleSummary && (
        <p id={summaryId} className="sr-only">
          {accessibleSummary}
        </p>
      )}

      <div className={showTable ? 'hidden' : 'w-full h-full'}>
        <ReactECharts option={adaptedOption} {...rest} />
      </div>

      {dataTableFallback && dataTableFallback.rows.length > 0 && (
        <>
          <div className="absolute right-1 bottom-1 z-30">
            <button
              type="button"
              onClick={() => setShowTable((prev) => !prev)}
              aria-expanded={showTable}
              className="almanac-btn text-[10px] px-2 py-0.5 bg-[var(--color-sheet)]/95 shadow-xs"
            >
              {showTable ? 'Show chart view' : 'View chart data table'}
            </button>
          </div>

          {showTable && (
            <div className="absolute inset-0 z-20 overflow-auto bg-[var(--color-sheet)] border border-[var(--color-rule)] p-3 pb-10">
              <table className="almanac-table text-xs w-full">
                {dataTableFallback.caption && (
                  <caption className="text-left font-semibold text-[var(--color-ink)] mb-2">
                    {dataTableFallback.caption}
                  </caption>
                )}
                <thead>
                  <tr>
                    {dataTableFallback.headers.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataTableFallback.rows.map((row, idx) => (
                    <tr key={idx}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className={typeof cell === 'number' ? 'num text-right' : ''}>
                          {cell === null || cell === undefined ? '—' : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
