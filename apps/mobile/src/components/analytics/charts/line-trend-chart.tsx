import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { fixedDomain } from '@/lib/analytics/chart-domain';
import { linePath, referenceLineY } from '@/lib/analytics/chart-geometry';

export interface LineTrendDatum {
  date: string;
  value: number | null;
}

interface LineTrendChartProps {
  data: readonly LineTrendDatum[];
  width: number;
  height?: number;
  color: string;
  reference?: number | null;
  accessibilityLabel: string;
}

/** Renders supplied canonical facts; it never fills a missing value with zero. */
export function LineTrendChart({
  data,
  width,
  height = 180,
  color,
  reference = null,
  accessibilityLabel,
}: LineTrendChartProps) {
  const domain = useMemo(
    () =>
      fixedDomain(
        data.map((point) => point.value),
        { includeZero: false },
      ),
    [data],
  );
  const path = useMemo(
    () =>
      domain === null
        ? ''
        : linePath(
            data.map((point) => point.value),
            domain,
            { width, height },
          ),
    [data, domain, height, width],
  );

  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {domain !== null && reference !== null ? (
          <Line
            x1={0}
            x2={width}
            y1={referenceLineY(reference, domain, height)}
            y2={referenceLineY(reference, domain, height)}
            stroke={color}
            strokeDasharray="4 4"
            opacity={0.35}
          />
        ) : null}
        {path === '' ? null : (
          <Path d={path} fill="none" stroke={color} strokeWidth={3} />
        )}
      </Svg>
    </View>
  );
}
