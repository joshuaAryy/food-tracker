import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { AnalyticsComparisonStrategy } from '@food-tracker/shared';
import { linePath } from '@/lib/analytics/chart-geometry';
import {
  chartDomainFromAxis,
  comparisonValues,
} from '@/lib/analytics/comparison-chart';
import { ChartFrame } from './chart-frame';

export function ComparisonChart({
  primary,
  comparison,
  strategy,
  primaryAxis,
  comparisonAxis,
  width,
  height = 180,
  accessibilityLabel,
}: {
  primary: readonly { value: number | null; normalizedValue?: number }[];
  comparison: readonly { value: number | null; normalizedValue?: number }[];
  strategy: AnalyticsComparisonStrategy;
  primaryAxis: { minimum: number; maximum: number };
  comparisonAxis: { minimum: number; maximum: number };
  width: number;
  height?: number;
  accessibilityLabel: string;
}) {
  const primaryDomain = chartDomainFromAxis(primaryAxis);
  const comparisonDomain = chartDomainFromAxis(comparisonAxis);
  const primaryPath = useMemo(
    () =>
      linePath(comparisonValues(primary, strategy), primaryDomain, {
        width,
        height,
      }),
    [height, primary, primaryDomain, strategy, width],
  );
  const comparisonPath = useMemo(
    () =>
      linePath(comparisonValues(comparison, strategy), comparisonDomain, {
        width,
        height,
      }),
    [comparison, comparisonDomain, height, strategy, width],
  );
  return (
    <ChartFrame accessibilityLabel={accessibilityLabel}>
      <View>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Path d={primaryPath} fill="none" stroke="#C9242D" strokeWidth={3} />
          <Path
            d={comparisonPath}
            fill="none"
            stroke="#7A9B76"
            strokeWidth={3}
          />
        </Svg>
      </View>
    </ChartFrame>
  );
}
