import { useMemo, type ComponentProps } from 'react';
import ReactECharts from 'echarts-for-react';
import { adaptChartOption, useDarkMode } from '../utils/chartTheme';

type EChartsProps = ComponentProps<typeof ReactECharts>;

export default function ThemedEChart({ option, ...rest }: EChartsProps) {
  const isDark = useDarkMode();
  const adaptedOption = useMemo(() => adaptChartOption(option, isDark), [option, isDark]);
  return <ReactECharts option={adaptedOption} {...rest} />;
}
