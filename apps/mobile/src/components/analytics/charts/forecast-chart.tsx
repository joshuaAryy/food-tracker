import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Path, Polygon } from 'react-native-svg';
import { fixedDomain } from '@/lib/analytics/chart-domain';
import {
  forecastPathWithContinuity,
  linePath,
  uncertaintyPolygonAtOffset,
} from '@/lib/analytics/chart-geometry';
import {
  selectedIndexForScrubX,
  shouldAnnounceSelectionChange,
} from '@/lib/analytics/chart-interaction';
import { ChartFrame } from './chart-frame';
import { CartesianPlot } from './cartesian-plot';
import { ChartSelectionOverlay } from './chart-selection-overlay';

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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedIndexRef = useRef<number | null>(null);
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
  const selectIndex = useCallback((nextIndex: number) => {
    if (shouldAnnounceSelectionChange(selectedIndexRef.current, nextIndex)) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    selectedIndexRef.current = nextIndex;
    setSelectedIndex(nextIndex);
  }, []);
  const selectedValue =
    selectedIndex === null
      ? null
      : selectedIndex < historical.length
        ? historical[selectedIndex]
        : (forecast[selectedIndex - historical.length]?.value ?? null);
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
    <ChartFrame
      accessibilityLabel={accessibilityLabel}
      selectedDescription={
        selectedIndex === null
          ? undefined
          : `${selectedIndex < historical.length ? 'Historical' : 'Estimated'} value: ${selectedValue ?? 'No recorded value'}`
      }
    >
      <View>
        <CartesianPlot
          width={width}
          height={height}
          pointCount={pointCount}
          todayIndex={historical.length === 0 ? null : historical.length - 1}
          selectedIndex={selectedIndex}
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
        <ChartSelectionOverlay
          width={width}
          height={height}
          onScrub={(x) => {
            const index = selectedIndexForScrubX(x, pointCount, width);
            if (index !== null) selectIndex(index);
          }}
          onAccessibilityStep={(direction) => {
            if (pointCount === 0) return;
            const current = selectedIndexRef.current ?? 0;
            selectIndex(
              Math.max(
                0,
                Math.min(
                  pointCount - 1,
                  current + (direction === 'increment' ? 1 : -1),
                ),
              ),
            );
          }}
        />
      </View>
    </ChartFrame>
  );
}
