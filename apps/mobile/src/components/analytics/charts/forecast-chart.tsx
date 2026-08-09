import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { fixedDomain } from '@/lib/analytics/chart-domain';
import { linePath, uncertaintyPolygon } from '@/lib/analytics/chart-geometry';
import { ChartFrame } from './chart-frame';

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
  const historicalPath = linePath(historical, domain, { width, height });
  const forecastPath = linePath(
    forecast.map((point) => point.value),
    domain,
    { width, height },
  );
  return (
    <ChartFrame accessibilityLabel={accessibilityLabel}>
      <View>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Polygon
            points={uncertaintyPolygon(forecast, domain, { width, height })}
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
        </Svg>
      </View>
    </ChartFrame>
  );
}
