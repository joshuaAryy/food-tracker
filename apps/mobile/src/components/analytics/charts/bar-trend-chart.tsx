import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Line, Path, Rect } from 'react-native-svg';
import { AppText } from '@/components/app-text';
import { formatPresentationDate } from '@/lib/date-time';
import { formatMetricValue } from '@/lib/reporting-ui';
import { fixedDomain } from '@/lib/analytics/chart-domain';
import {
  barRects,
  pointX,
  referenceLineY,
  smoothLinePath,
} from '@/lib/analytics/chart-geometry';
import {
  selectedIndexForScrubX,
  shouldAnnounceSelectionChange,
} from '@/lib/analytics/chart-interaction';
import { referenceBand } from '@/lib/analytics/reference-geometry';
import { ChartFrame } from './chart-frame';
import { ChartSelectionOverlay } from './chart-selection-overlay';
import { CartesianPlot } from './cartesian-plot';
import type { LineTrendDatum } from './line-trend-chart';

export function BarTrendChart({
  data,
  width,
  height = 180,
  color,
  barFill,
  trendValues,
  reference = null,
  referenceRange = null,
  accessibilityLabel,
}: {
  data: readonly LineTrendDatum[];
  width: number;
  height?: number;
  color: string;
  barFill?: string | undefined;
  trendValues?: readonly (number | null)[] | undefined;
  reference?: number | null;
  referenceRange?: { lower: number; upper: number } | null;
  accessibilityLabel: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedIndexRef = useRef<number | null>(null);
  const domain = useMemo(
    () =>
      fixedDomain(
        [...data.map((point) => point.value), ...(trendValues ?? [])],
        { includeZero: true },
      ),
    [data, trendValues],
  );
  const bars = useMemo(
    () =>
      domain === null
        ? []
        : barRects(
            data.map((point) => point.value),
            domain,
            { width, height },
          ),
    [data, domain, height, width],
  );
  const selected =
    selectedIndex === null ? null : (data[selectedIndex] ?? null);
  const selectedX =
    selectedIndex === null ? null : pointX(selectedIndex, data.length, width);
  const rangeBand =
    domain === null ? null : referenceBand(referenceRange, domain, height);
  const trendPath = useMemo(
    () =>
      domain === null || trendValues === undefined
        ? ''
        : smoothLinePath(trendValues, domain, { width, height }),
    [domain, height, trendValues, width],
  );
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
        selected === null
          ? undefined
          : `${formatPresentationDate(selected.date)}: ${selected.value === null ? 'No recorded value' : formatMetricValue(selected.value)}`
      }
    >
      <View className="relative">
        <CartesianPlot
          width={width}
          height={height}
          pointCount={data.length}
          selectedIndex={selectedIndex}
        >
          {rangeBand === null ? null : (
            <>
              <Rect
                x={0}
                y={Math.max(0, rangeBand.y - 10)}
                width={width}
                height={Math.min(height, rangeBand.height + 20)}
                fill={color}
                opacity={0.035}
              />
              <Rect
                x={0}
                y={rangeBand.y}
                width={width}
                height={rangeBand.height}
                fill={color}
                opacity={0.12}
              />
            </>
          )}
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
          {bars.map((bar) => (
            <Rect
              key={bar.index}
              {...bar}
              fill={barFill ?? color}
              {...(barFill === undefined
                ? {}
                : { stroke: color, strokeWidth: 1 })}
              opacity={
                selectedIndex === null || selectedIndex === bar.index ? 1 : 0.55
              }
              rx={3}
            />
          ))}
          {trendPath === '' ? null : (
            <Path d={trendPath} fill="none" stroke={color} strokeWidth={2.5} />
          )}
        </CartesianPlot>
        <ChartSelectionOverlay
          width={width}
          height={height}
          onScrub={(x) => {
            const index = selectedIndexForScrubX(x, data.length, width);
            if (index !== null) selectIndex(index);
          }}
          onAccessibilityStep={(direction) => {
            if (data.length === 0) return;
            const currentIndex = selectedIndexRef.current ?? 0;
            const delta = direction === 'increment' ? 1 : -1;
            selectIndex(
              Math.max(0, Math.min(data.length - 1, currentIndex + delta)),
            );
          }}
        />
        {selected === null || selectedX === null ? null : (
          <View
            pointerEvents="none"
            className="absolute -top-3 rounded-[12px] bg-ink px-3 py-2"
            style={{
              left: Math.max(0, Math.min(width - 96, selectedX - 48)),
            }}
          >
            <AppText variant="caption" className="text-white">
              {formatPresentationDate(selected.date)}
              {'\n'}
              {selected.value === null
                ? 'No recorded value'
                : formatMetricValue(selected.value)}
            </AppText>
          </View>
        )}
      </View>
    </ChartFrame>
  );
}
