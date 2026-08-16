import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Circle, Line, Path, Rect } from 'react-native-svg';
import { AppText } from '@/components/app-text';
import { formatPresentationDate } from '@/lib/date-time';
import { formatMetricValue } from '@/lib/reporting-ui';
import { fixedDomain } from '@/lib/analytics/chart-domain';
import {
  pointX,
  pointY,
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

export interface LineTrendDatum {
  date: string;
  value: number | null;
}

interface LineTrendChartProps {
  data: readonly LineTrendDatum[];
  width: number;
  height?: number;
  color: string;
  trendValues?: readonly (number | null)[] | undefined;
  showRawPoints?: boolean | undefined;
  reference?: number | null;
  referenceRange?: { lower: number; upper: number } | null;
  accessibilityLabel: string;
}

/** Renders supplied canonical facts; it never fills a missing value with zero. */
export function LineTrendChart({
  data,
  width,
  height = 180,
  color,
  trendValues,
  showRawPoints = false,
  reference = null,
  referenceRange = null,
  accessibilityLabel,
}: LineTrendChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedIndexRef = useRef<number | null>(null);
  const domain = useMemo(
    () =>
      fixedDomain(
        [...data.map((point) => point.value), ...(trendValues ?? [])],
        { includeZero: false },
      ),
    [data, trendValues],
  );
  const path = useMemo(
    () =>
      domain === null
        ? ''
        : smoothLinePath(
            trendValues ?? data.map((point) => point.value),
            domain,
            { width, height },
          ),
    [data, domain, height, trendValues, width],
  );

  const selected =
    selectedIndex === null ? null : (data[selectedIndex] ?? null);
  const selectedX =
    selectedIndex === null ? null : pointX(selectedIndex, data.length, width);
  const rangeBand =
    domain === null ? null : referenceBand(referenceRange, domain, height);
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
          {path === '' ? null : (
            <Path d={path} fill="none" stroke={color} strokeWidth={3} />
          )}
          {showRawPoints && domain !== null
            ? data.map((point, index) => {
                if (point.value === null || !Number.isFinite(point.value))
                  return null;
                const x = pointX(index, data.length, width);
                const y = pointY(point.value, domain, height);
                return (
                  <Circle
                    key={point.date}
                    cx={x}
                    cy={y}
                    r={3}
                    fill="#FFFFFF"
                    stroke={color}
                    strokeWidth={2}
                  />
                );
              })
            : null}
          {selected !== null &&
          selected.value !== null &&
          selectedX !== null &&
          domain !== null ? (
            <Circle
              cx={selectedX}
              cy={pointY(selected.value, domain, height)}
              r={6}
              fill="#FFFFFF"
              stroke="#111111"
              strokeWidth={3}
            />
          ) : null}
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
