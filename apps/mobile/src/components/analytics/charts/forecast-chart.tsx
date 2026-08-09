import { useMemo } from 'react';
import { View } from 'react-native';
import { Path, Polygon } from 'react-native-svg';
import { fixedDomain } from '@/lib/analytics/chart-domain';
import {
  forecastPathWithContinuity,
  linePath,
  uncertaintyPolygonAtOffset,
} from '@/lib/analytics/chart-geometry';
import { ChartFrame } from './chart-frame';
import { CartesianPlot } from './cartesian-plot';

export function ForecastChart({
  historical,
  forecast,
  width,
  height = 180,
  accessibilityLabel,
}: {
  historical: readonly (number | null)[];
  forecast: readonly { value: number; lower: number; upper: number }[];
  width: number;
  height?: number;
  accessibilityLabel: string;
}) {
  const domain = useMemo(
    () =>
      fixedDomain(
        [
          ...historical,
          ...forecast.flatMap((point) => [point.lower, point.upper]),
        ],
        { includeZero: false },
      ),
    [forecast, historical],
  );
  if (domain === null)
    return <ChartFrame accessibilityLabel={accessibilityLabel} />;
  const pointCount = historical.length + forecast.length;
  const historicalPath = linePath(
    [...historical, ...forecast.map(() => null)],
    domain,
    { width, height },
  );
  const forecastPath = forecastPathWithContinuity(
    historical,
    forecast.map((point) => point.value),
    domain,
    { width, height },
  );
  return (
    <ChartFrame accessibilityLabel={accessibilityLabel}>
      <View>
        <CartesianPlot
          width={width}
          height={height}
          pointCount={pointCount}
          todayIndex={historical.length === 0 ? null : historical.length - 1}
        >
          <Polygon
            points={uncertaintyPolygonAtOffset(
              forecast,
              domain,
              { width, height },
              { startIndex: historical.length, totalPointCount: pointCount },
            )}
            fill="#C9242D"
            opacity={0.12}
          />
          <Path
            d={historicalPath}
            fill="none"
            stroke="#C9242D"
            strokeWidth={3}
          />
          <Path
            d={forecastPath}
            fill="none"
            stroke="#C9242D"
            strokeWidth={3}
            strokeDasharray="6 5"
          />
        </CartesianPlot>
      </View>
    </ChartFrame>
  );
}
