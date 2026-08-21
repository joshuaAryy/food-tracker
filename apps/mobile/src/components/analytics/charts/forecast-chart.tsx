import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Line, Path, Polygon } from 'react-native-svg';
import { fixedDomain } from '@/lib/analytics/chart-domain';
import { numericAxisTicks } from '@/lib/analytics/chart-axis';
import {
  forecastPathWithContinuity,
  linePath,
  pointY,
  uncertaintyPolygonAtOffset,
} from '@/lib/analytics/chart-geometry';
import {
  selectedIndexForScrubX,
  shouldAnnounceSelectionChange,
} from '@/lib/analytics/chart-interaction';
import { ChartFrame } from './chart-frame';
import { CartesianPlot } from './cartesian-plot';
import { ChartSelectionOverlay } from './chart-selection-overlay';
import { ChartAxes, chartPlotWidth } from './chart-axes';
import { formatMetricValue } from '@/lib/reporting-ui';

export function ForecastChart({
  historical,
  historicalDates,
  forecast,
  width,
  height = 180,
  showAxes = false,
  periodDays,
  unit = '',
  accessibilityLabel,
}: {
  historical: readonly (number | null)[];
  historicalDates?: readonly string[] | undefined;
  forecast: readonly {
    date?: string | undefined;
    value: number;
    lower: number;
    upper: number;
  }[];
  width: number;
  height?: number;
  showAxes?: boolean | undefined;
  periodDays?: number | undefined;
  unit?: string | undefined;
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
  const dates = [
    ...(historicalDates ?? []),
    ...forecast.map((point) => point.date ?? ''),
  ];
  const hasDateAxis =
    showAxes &&
    historicalDates?.length === historical.length &&
    forecast.every((point) => point.date !== undefined);
  const plotWidth = chartPlotWidth(width, hasDateAxis);
  const gridTicks = numericAxisTicks(
    { minimum: domain.min, maximum: domain.max },
    { includeZero: false },
  );
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
    { width: plotWidth, height },
  );
  const forecastPath = forecastPathWithContinuity(
    historical,
    forecast.map((point) => point.value),
    domain,
    { width: plotWidth, height },
  );
  const chart = (
    <View>
      <CartesianPlot
        width={plotWidth}
        height={height}
        pointCount={pointCount}
        todayIndex={historical.length === 0 ? null : historical.length - 1}
        selectedIndex={selectedIndex}
      >
        {hasDateAxis
          ? gridTicks.map((tick) => (
              <Line
                key={`forecast-grid-${tick}`}
                testID={`forecast-chart-grid-${tick}`}
                x1={0}
                x2={plotWidth}
                y1={pointY(tick, domain, height)}
                y2={pointY(tick, domain, height)}
                stroke="#E4E4E0"
                strokeWidth={1}
                opacity={0.7}
              />
            ))
          : null}
        <Polygon
          points={uncertaintyPolygonAtOffset(
            forecast,
            domain,
            { width: plotWidth, height },
            { startIndex: historical.length, totalPointCount: pointCount },
          )}
          fill="#C9242D"
          opacity={0.12}
        />
        <Path d={historicalPath} fill="none" stroke="#C9242D" strokeWidth={3} />
        <Path
          d={forecastPath}
          fill="none"
          stroke="#C9242D"
          strokeWidth={3}
          strokeDasharray="6 5"
        />
      </CartesianPlot>
      <ChartSelectionOverlay
        width={plotWidth}
        height={height}
        onScrub={(x) => {
          const index = selectedIndexForScrubX(x, pointCount, plotWidth);
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
  );
  return (
    <ChartFrame
      accessibilityLabel={accessibilityLabel}
      selectedDescription={
        selectedIndex === null
          ? undefined
          : `${selectedIndex < historical.length ? 'Historical' : 'Estimated'} value: ${selectedValue === null ? 'No recorded value' : formatMetricValue(selectedValue)}`
      }
    >
      {hasDateAxis ? (
        <ChartAxes
          dates={dates}
          domain={domain}
          height={height}
          periodDays={periodDays}
          unit={unit}
          width={width}
        >
          {chart}
        </ChartAxes>
      ) : (
        chart
      )}
    </ChartFrame>
  );
}
