import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { AppText } from '@/components/app-text';
import { formatPresentationDate } from '@/lib/date-time';
import { formatMetricValue } from '@/lib/reporting-ui';
import { fixedDomain } from '@/lib/analytics/chart-domain';
import {
  barRects,
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
import type { LineTrendDatum } from './line-trend-chart';

export function BarTrendChart({
  data,
  width,
  height = 180,
  color,
  barFill,
  barStroke,
  trendValues,
  connectTrendGaps,
  reference = null,
  referenceRange = null,
  showGrid = false,
  gridOpacity = 0.9,
  initialSelectedIndex = null,
  showSelectionTooltip = true,
  showSelectionDescription = true,
  selectedBarFill,
  selectedBarStroke,
  accessibilityLabel,
}: {
  data: readonly LineTrendDatum[];
  width: number;
  height?: number;
  color: string;
  barFill?: string | undefined;
  barStroke?: string | undefined;
  trendValues?: readonly (number | null)[] | undefined;
  connectTrendGaps?: boolean | undefined;
  reference?: number | null;
  referenceRange?: { lower: number; upper: number } | null;
  showGrid?: boolean | undefined;
  gridOpacity?: number | undefined;
  initialSelectedIndex?: number | null | undefined;
  showSelectionTooltip?: boolean | undefined;
  showSelectionDescription?: boolean | undefined;
  selectedBarFill?: string | undefined;
  selectedBarStroke?: string | undefined;
  accessibilityLabel: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    initialSelectedIndex,
  );
  const selectedIndexRef = useRef<number | null>(initialSelectedIndex);
  const domain = useMemo(
    () =>
      fixedDomain(
        [
          ...data.map((point) => point.value),
          ...(trendValues ?? []),
          ...(reference === null ? [] : [reference]),
          ...(referenceRange === null
            ? []
            : [
                referenceRange.lower,
                referenceRange.upper,
                referenceRange.upper * 1.25,
              ]),
        ],
        { includeZero: true },
      ),
    [data, reference, referenceRange, trendValues],
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
  const rangeGradientId = `bar-range-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
  const trendPath = useMemo(
    () =>
      domain === null || trendValues === undefined
        ? ''
        : smoothLinePath(
            trendValues,
            domain,
            { width, height },
            {
              connectGaps: connectTrendGaps !== false,
            },
          ),
    [connectTrendGaps, domain, height, trendValues, width],
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
        !showSelectionDescription || selected === null
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
            <Defs>
              <LinearGradient id={rangeGradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.02} />
                <Stop offset="0.24" stopColor={color} stopOpacity={0.12} />
                <Stop offset="0.76" stopColor={color} stopOpacity={0.12} />
                <Stop offset="1" stopColor={color} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
          )}
          {showGrid
            ? [0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                <Line
                  key={`grid-${fraction}`}
                  x1={0}
                  x2={width}
                  y1={fraction * height}
                  y2={fraction * height}
                  stroke="#E4E4E0"
                  strokeWidth={1}
                  opacity={gridOpacity}
                />
              ))
            : null}
          {rangeBand === null ? null : (
            <Rect
              x={0}
              y={Math.max(0, rangeBand.y - 10)}
              width={width}
              height={Math.min(height, rangeBand.height + 20)}
              fill={`url(#${rangeGradientId})`}
              opacity={0.75}
            />
          )}
          {rangeBand === null ? null : (
            <Rect
              x={0}
              y={Math.max(0, rangeBand.y - 4)}
              width={width}
              height={Math.min(height, rangeBand.height + 8)}
              fill={color}
              opacity={0.035}
            />
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
              {...(selectedIndex === bar.index && selectedBarFill !== undefined
                ? { fill: selectedBarFill }
                : {})}
              {...(barFill === undefined
                ? {}
                : { stroke: barStroke ?? color, strokeWidth: 1 })}
              opacity={
                selectedIndex === null || selectedIndex === bar.index ? 1 : 0.55
              }
              rx={3}
              {...(selectedIndex === bar.index
                ? {
                    stroke: selectedBarStroke ?? barStroke ?? color,
                    strokeWidth: 2,
                  }
                : {})}
            />
          ))}
          {trendPath === '' ? null : (
            <Path d={trendPath} fill="none" stroke={color} strokeWidth={2.5} />
          )}
          {selected === null ||
          selected.value === null ||
          selectedX === null ||
          domain === null ? null : (
            <Circle
              cx={selectedX}
              cy={pointY(selected.value, domain, height)}
              r={6}
              fill={color}
              stroke="#FFFFFF"
              strokeWidth={3}
            />
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
        {!showSelectionTooltip ||
        selected === null ||
        selectedX === null ? null : (
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
