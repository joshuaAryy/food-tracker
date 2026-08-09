import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Path } from 'react-native-svg';
import type { AnalyticsComparisonStrategy } from '@food-tracker/shared';
import { linePath } from '@/lib/analytics/chart-geometry';
import {
  selectedIndexForScrubX,
  selectionForSharedDate,
  shouldAnnounceSelectionChange,
} from '@/lib/analytics/chart-interaction';
import {
  chartDomainFromAxis,
  comparisonValues,
} from '@/lib/analytics/comparison-chart';
import { ChartFrame } from './chart-frame';
import { ChartSelectionOverlay } from './chart-selection-overlay';
import { CartesianPlot } from './cartesian-plot';

export interface ComparisonChartDatum {
  date: string;
  value: number | null;
  normalizedValue?: number;
}

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
  primary: readonly ComparisonChartDatum[];
  comparison: readonly ComparisonChartDatum[];
  strategy: AnalyticsComparisonStrategy;
  primaryAxis: { minimum: number; maximum: number };
  comparisonAxis: { minimum: number; maximum: number };
  width: number;
  height?: number;
  accessibilityLabel: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedIndexRef = useRef<number | null>(null);
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
  const selected =
    selectedIndex === null ? null : (primary[selectedIndex] ?? null);
  const selectedValues =
    selected === null
      ? null
      : selectionForSharedDate(primary, comparison, selected.date);
  const selectIndex = useCallback((nextIndex: number) => {
    if (shouldAnnounceSelectionChange(selectedIndexRef.current, nextIndex)) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    selectedIndexRef.current = nextIndex;
    setSelectedIndex(nextIndex);
  }, []);
  return (
    <ChartFrame
      accessibilityLabel={accessibilityLabel}
      selectedDescription={
        selectedValues === null
          ? undefined
          : `${selectedValues.date}: ${selectedValues.primaryValue ?? 'No recorded primary value'}; ${selectedValues.comparisonValue ?? 'No recorded comparison value'}`
      }
    >
      <View>
        <CartesianPlot
          width={width}
          height={height}
          pointCount={primary.length}
          selectedIndex={selectedIndex}
        >
          <Path d={primaryPath} fill="none" stroke="#C9242D" strokeWidth={3} />
          <Path
            d={comparisonPath}
            fill="none"
            stroke="#7A9B76"
            strokeWidth={3}
          />
        </CartesianPlot>
        <ChartSelectionOverlay
          width={width}
          height={height}
          onScrub={(x) => {
            const index = selectedIndexForScrubX(x, primary.length, width);
            if (index !== null) selectIndex(index);
          }}
          onAccessibilityStep={(direction) => {
            if (primary.length === 0) return;
            const currentIndex = selectedIndexRef.current ?? 0;
            const delta = direction === 'increment' ? 1 : -1;
            selectIndex(
              Math.max(0, Math.min(primary.length - 1, currentIndex + delta)),
            );
          }}
        />
      </View>
    </ChartFrame>
  );
}
