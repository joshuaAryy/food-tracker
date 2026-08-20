import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Path } from 'react-native-svg';
import type { AnalyticsComparisonStrategy } from '@food-tracker/shared';
import { AppText } from '@/components/app-text';
import { formatPresentationDate } from '@/lib/date-time';
import { formatMetricValue } from '@/lib/reporting-ui';
import { smoothLinePath } from '@/lib/analytics/chart-geometry';
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

const PRIMARY_SERIES_COLOR = '#C9242D';
const COMPARISON_SERIES_COLOR = '#7A9B76';

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
  primaryAxisLabel,
  comparisonAxisLabel,
  width,
  height = 180,
  accessibilityLabel,
}: {
  primary: readonly ComparisonChartDatum[];
  comparison: readonly ComparisonChartDatum[];
  strategy: AnalyticsComparisonStrategy;
  primaryAxis: { minimum: number; maximum: number };
  comparisonAxis: { minimum: number; maximum: number };
  primaryAxisLabel: string;
  comparisonAxisLabel: string;
  width: number;
  height?: number;
  accessibilityLabel: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedIndexRef = useRef<number | null>(null);
  const primaryDomain = chartDomainFromAxis(primaryAxis);
  const comparisonDomain = chartDomainFromAxis(comparisonAxis);
  const plotWidth = Math.max(220, width - 52);
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
          : `${formatPresentationDate(selectedValues.date)}: ${formatSelectedValue(selectedValues.primaryValue)}; ${formatSelectedValue(selectedValues.comparisonValue)}`
      }
    >
      <View>
        <View className="flex-row items-stretch gap-2">
          <AxisLabels
            axis={primaryAxis}
            color={PRIMARY_SERIES_COLOR}
            normalized={strategy === 'reference_normalized'}
          />
          <View className="relative flex-1 gap-1">
            <View className="flex-row justify-between gap-2">
              <AppText
                variant="caption"
                style={{ color: PRIMARY_SERIES_COLOR }}
              >
                {primaryAxisLabel}
              </AppText>
              {strategy === 'dual_axis' ? (
                <AppText
                  variant="caption"
                  style={{ color: COMPARISON_SERIES_COLOR }}
                >
                  {comparisonAxisLabel}
                </AppText>
              ) : null}
            </View>
            <CartesianPlot
              width={plotWidth}
              height={height}
              pointCount={primary.length}
              selectedIndex={selectedIndex}
            >
              <Path
                testID="comparison-primary-series"
                d={smoothLinePath(
                  comparisonValues(primary, strategy),
                  primaryDomain,
                  {
                    width: plotWidth,
                    height,
                  },
                )}
                fill="none"
                stroke={PRIMARY_SERIES_COLOR}
                strokeWidth={3}
              />
              <Path
                testID="comparison-secondary-series"
                d={smoothLinePath(
                  comparisonValues(comparison, strategy),
                  comparisonDomain,
                  { width: plotWidth, height },
                )}
                fill="none"
                stroke={COMPARISON_SERIES_COLOR}
                strokeWidth={3}
              />
            </CartesianPlot>
            <ChartSelectionOverlay
              width={plotWidth}
              height={height}
              onScrub={(x) => {
                const index = selectedIndexForScrubX(
                  x,
                  primary.length,
                  plotWidth,
                );
                if (index !== null) selectIndex(index);
              }}
              onAccessibilityStep={(direction) => {
                if (primary.length === 0) return;
                const currentIndex = selectedIndexRef.current ?? 0;
                const delta = direction === 'increment' ? 1 : -1;
                selectIndex(
                  Math.max(
                    0,
                    Math.min(primary.length - 1, currentIndex + delta),
                  ),
                );
              }}
            />
            <ComparisonXAxis dates={primary.map((point) => point.date)} />
          </View>
          {strategy === 'dual_axis' ? (
            <AxisLabels axis={comparisonAxis} color={COMPARISON_SERIES_COLOR} />
          ) : null}
        </View>
        {selectedValues === null ? null : (
          <View className="rounded-[12px] bg-ink px-3 py-2">
            <AppText variant="caption" className="text-white">
              {formatPresentationDate(selectedValues.date)}
            </AppText>
            <View className="flex-row flex-wrap gap-x-4 gap-y-1">
              <AppText variant="caption" className="text-white">
                {primaryAxisLabel}:{' '}
                {formatSelectedValue(selectedValues.primaryValue)}
              </AppText>
              <AppText variant="caption" className="text-white">
                {comparisonAxisLabel}:{' '}
                {formatSelectedValue(selectedValues.comparisonValue)}
              </AppText>
            </View>
          </View>
        )}
      </View>
    </ChartFrame>
  );
}

function ComparisonXAxis({ dates }: { dates: readonly string[] }) {
  const indexes = comparisonTickIndexes(dates.length);
  return (
    <View
      testID="comparison-chart-x-axis"
      className="flex-row justify-between pt-1"
    >
      {indexes.map((index) => {
        const date = dates[index];
        return date === undefined ? null : (
          <AppText
            key={`${date}-${index}`}
            variant="caption"
            className="text-[10px] text-muted"
          >
            {formatPresentationDate(date)}
          </AppText>
        );
      })}
    </View>
  );
}

function comparisonTickIndexes(length: number): number[] {
  if (length <= 0) return [];
  const indexes = [
    0,
    Math.round((length - 1) / 4),
    Math.round((length - 1) / 2),
    Math.round(((length - 1) * 3) / 4),
    length - 1,
  ];
  return indexes.filter(
    (index, position) => indexes.indexOf(index) === position,
  );
}

function AxisLabels({
  axis,
  color,
  normalized = false,
}: {
  axis: { minimum: number; maximum: number };
  color: string;
  normalized?: boolean;
}) {
  const midpoint = (axis.minimum + axis.maximum) / 2;
  return (
    <View className="w-9 justify-between py-1">
      {[axis.maximum, midpoint, axis.minimum].map((value) => (
        <AppText
          key={`${value}`}
          variant="caption"
          className="text-right text-[9px]"
          style={{ color }}
        >
          {normalized ? `${Math.round(value * 100)}%` : formatAxisValue(value)}
        </AppText>
      ))}
    </View>
  );
}

function formatAxisValue(value: number): string {
  return formatMetricValue(value);
}

function formatSelectedValue(value: number | null): string {
  return value === null ? 'No recorded value' : formatMetricValue(value);
}
