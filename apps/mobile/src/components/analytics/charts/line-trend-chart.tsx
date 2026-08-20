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
import { numericAxisTicks } from '@/lib/analytics/chart-axis';
import {
  pointX,
  pointY,
  referenceLineY,
  selectionDecorationX,
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
import { ChartAxes, chartPlotWidth } from './chart-axes';

export interface LineTrendDatum {
  date: string;
  value: number | null;
}

interface LineTrendChartProps {
  data: readonly LineTrendDatum[];
  width: number;
  height?: number;
  color: string;
  areaColor?: string | undefined;
  trendValues?: readonly (number | null)[] | undefined;
  connectTrendGaps?: boolean | undefined;
  showRawPoints?: boolean | undefined;
  reference?: number | null;
  referenceRange?: { lower: number; upper: number } | null;
  showGrid?: boolean | undefined;
  initialSelectedIndex?: number | null | undefined;
  showSelectionTooltip?: boolean | undefined;
  showSelectionDescription?: boolean | undefined;
  showAxes?: boolean | undefined;
  periodDays?: number | undefined;
  unit?: string | undefined;
  referenceLabel?: string | undefined;
  accessibilityLabel: string;
}

/** Renders supplied canonical facts; it never fills a missing value with zero. */
export function LineTrendChart({
  data,
  width,
  height = 180,
  color,
  areaColor,
  trendValues,
  connectTrendGaps,
  showRawPoints = false,
  reference = null,
  referenceRange = null,
  showGrid = false,
  initialSelectedIndex = null,
  showSelectionTooltip = true,
  showSelectionDescription = true,
  showAxes = false,
  periodDays,
  unit = '',
  referenceLabel,
  accessibilityLabel,
}: LineTrendChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    initialSelectedIndex,
  );
  const selectedIndexRef = useRef<number | null>(initialSelectedIndex);
  const plotWidth = chartPlotWidth(width, showAxes);
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
        { includeZero: false },
      ),
    [data, reference, referenceRange, trendValues],
  );
  const path = useMemo(
    () =>
      domain === null
        ? ''
        : smoothLinePath(
            trendValues ?? data.map((point) => point.value),
            domain,
            { width: plotWidth, height },
            {
              connectGaps:
                trendValues !== undefined && connectTrendGaps !== false,
            },
          ),
    [connectTrendGaps, data, domain, height, plotWidth, trendValues],
  );
  const areaValues = trendValues ?? data.map((point) => point.value);
  const firstAreaIndex = areaValues.findIndex(
    (value) => value !== null && Number.isFinite(value),
  );
  let lastAreaIndex = -1;
  areaValues.forEach((value, index) => {
    if (value !== null && Number.isFinite(value)) lastAreaIndex = index;
  });
  const areaPath =
    path === '' ||
    areaColor === undefined ||
    firstAreaIndex < 0 ||
    lastAreaIndex < 0
      ? ''
      : `${path} L ${pointX(lastAreaIndex, areaValues.length, plotWidth)} ${height} L ${pointX(firstAreaIndex, areaValues.length, plotWidth)} ${height} Z`;

  const selected =
    selectedIndex === null ? null : (data[selectedIndex] ?? null);
  const selectedX =
    selectedIndex === null
      ? null
      : pointX(selectedIndex, data.length, plotWidth);
  const selectedDecorationX =
    selectedIndex === null
      ? null
      : selectionDecorationX(selectedIndex, data.length, plotWidth, 7.5);
  const rangeBand =
    domain === null ? null : referenceBand(referenceRange, domain, height);
  const rangeGradientId = `trend-range-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
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
      {showAxes ? (
        <ChartAxes
          dates={data.map((point) => point.date)}
          domain={domain}
          height={height}
          periodDays={periodDays}
          referenceLabel={referenceLabel}
          unit={unit}
          width={width}
        >
          <LineTrendPlot
            data={data}
            domain={domain}
            height={height}
            plotWidth={plotWidth}
            color={color}
            areaColor={areaColor}
            path={path}
            areaPath={areaPath}
            reference={reference}
            rangeBand={rangeBand}
            rangeGradientId={rangeGradientId}
            showGrid={showGrid}
            showRawPoints={showRawPoints}
            selectedIndex={selectedIndex}
            selected={selected}
            selectedDecorationX={selectedDecorationX}
            selectIndex={selectIndex}
            selectedX={selectedX}
            showSelectionTooltip={showSelectionTooltip}
          />
        </ChartAxes>
      ) : (
        <LineTrendPlot
          data={data}
          domain={domain}
          height={height}
          plotWidth={plotWidth}
          color={color}
          areaColor={areaColor}
          path={path}
          areaPath={areaPath}
          reference={reference}
          rangeBand={rangeBand}
          rangeGradientId={rangeGradientId}
          showGrid={showGrid}
          showRawPoints={showRawPoints}
          selectedIndex={selectedIndex}
          selected={selected}
          selectedDecorationX={selectedDecorationX}
          selectIndex={selectIndex}
          selectedX={selectedX}
          showSelectionTooltip={showSelectionTooltip}
        />
      )}
    </ChartFrame>
  );
}

function LineTrendPlot({
  data,
  domain,
  height,
  plotWidth,
  color,
  areaColor,
  path,
  areaPath,
  reference,
  rangeBand,
  rangeGradientId,
  showGrid,
  showRawPoints,
  selectedIndex,
  selected,
  selectedDecorationX,
  selectIndex,
  selectedX,
  showSelectionTooltip,
}: {
  data: readonly LineTrendDatum[];
  domain: ReturnType<typeof fixedDomain>;
  height: number;
  plotWidth: number;
  color: string;
  areaColor?: string | undefined;
  path: string;
  areaPath: string;
  reference: number | null;
  rangeBand: ReturnType<typeof referenceBand>;
  rangeGradientId: string;
  showGrid: boolean;
  showRawPoints: boolean;
  selectedIndex: number | null;
  selected: LineTrendDatum | null;
  selectedDecorationX: number | null;
  selectIndex: (index: number) => void;
  selectedX: number | null;
  showSelectionTooltip: boolean;
}) {
  const gridTicks =
    domain === null
      ? []
      : numericAxisTicks(
          { minimum: domain.min, maximum: domain.max },
          { includeZero: domain.min === 0 },
        );
  return (
    <>
      <CartesianPlot
        width={plotWidth}
        height={height}
        pointCount={data.length}
        selectedIndex={null}
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
        {showGrid && domain !== null
          ? gridTicks.map((tick) => (
              <Line
                key={`grid-${tick}`}
                testID={`chart-grid-${tick}`}
                x1={0}
                x2={plotWidth}
                y1={pointY(tick, domain, height)}
                y2={pointY(tick, domain, height)}
                stroke="#E4E4E0"
                strokeWidth={1}
                opacity={0.9}
              />
            ))
          : null}
        {rangeBand === null ? null : (
          <Rect
            x={0}
            y={Math.max(0, rangeBand.y - 10)}
            width={plotWidth}
            height={Math.min(height, rangeBand.height + 20)}
            fill={`url(#${rangeGradientId})`}
            opacity={0.75}
          />
        )}
        {rangeBand === null ? null : (
          <Rect
            x={0}
            y={Math.max(0, rangeBand.y - 4)}
            width={plotWidth}
            height={Math.min(height, rangeBand.height + 8)}
            fill={color}
            opacity={0.035}
          />
        )}
        {domain !== null && reference !== null ? (
          <Line
            x1={0}
            x2={plotWidth}
            y1={referenceLineY(reference, domain, height)}
            y2={referenceLineY(reference, domain, height)}
            stroke={color}
            strokeDasharray="4 4"
            opacity={0.35}
          />
        ) : null}
        {path === '' ? null : (
          <>
            {areaPath === '' || areaColor === undefined ? null : (
              <Path d={areaPath} fill={areaColor} opacity={0.16} />
            )}
            <Path d={path} fill="none" stroke={color} strokeWidth={3} />
          </>
        )}
        {showRawPoints && domain !== null
          ? data.map((point, index) => {
              if (point.value === null || !Number.isFinite(point.value))
                return null;
              const x = pointX(index, data.length, plotWidth);
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
        selectedDecorationX !== null &&
        domain !== null ? (
          <Circle
            cx={selectedDecorationX}
            cy={pointY(selected.value, domain, height)}
            r={6}
            fill="#FFFFFF"
            stroke={color}
            strokeWidth={3}
          />
        ) : null}
        {selectedDecorationX === null ? null : (
          <Line
            x1={selectedDecorationX}
            x2={selectedDecorationX}
            y1={0}
            y2={height}
            stroke="#262626"
            strokeDasharray="2 3"
            opacity={0.45}
          />
        )}
      </CartesianPlot>
      <ChartSelectionOverlay
        width={plotWidth}
        height={height}
        onScrub={(x) => {
          const index = selectedIndexForScrubX(x, data.length, plotWidth);
          if (index !== null) selectIndex(index);
        }}
        onAccessibilityStep={(direction) => {
          if (data.length === 0) return;
          const currentIndex = selectedIndex ?? 0;
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
            left: Math.max(0, Math.min(plotWidth - 96, selectedX - 48)),
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
    </>
  );
}
