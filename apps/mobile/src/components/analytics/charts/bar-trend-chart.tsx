import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { fixedDomain } from '@/lib/analytics/chart-domain';
import { barRects, referenceLineY } from '@/lib/analytics/chart-geometry';
import { selectedIndexForScrubX } from '@/lib/analytics/chart-interaction';
import { ChartFrame } from './chart-frame';
import { ChartSelectionOverlay } from './chart-selection-overlay';
import type { LineTrendDatum } from './line-trend-chart';

export function BarTrendChart({
  data,
  width,
  height = 180,
  color,
  reference = null,
  accessibilityLabel,
}: {
  data: readonly LineTrendDatum[];
  width: number;
  height?: number;
  color: string;
  reference?: number | null;
  accessibilityLabel: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const domain = useMemo(
    () =>
      fixedDomain(
        data.map((point) => point.value),
        { includeZero: true },
      ),
    [data],
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
  return (
    <ChartFrame
      accessibilityLabel={accessibilityLabel}
      selectedDescription={
        selected === null
          ? undefined
          : `${selected.date}: ${selected.value === null ? 'No recorded value' : selected.value}`
      }
    >
      <View>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
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
            <Rect key={bar.index} {...bar} fill={color} rx={3} />
          ))}
        </Svg>
        <ChartSelectionOverlay
          width={width}
          height={height}
          onScrub={(x) =>
            setSelectedIndex(selectedIndexForScrubX(x, data.length, width))
          }
        />
      </View>
    </ChartFrame>
  );
}
