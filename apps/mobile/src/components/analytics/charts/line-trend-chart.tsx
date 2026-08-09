import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { fixedDomain } from '@/lib/analytics/chart-domain';
import { linePath, referenceLineY } from '@/lib/analytics/chart-geometry';
import { selectedIndexForScrubX } from '@/lib/analytics/chart-interaction';
import { ChartFrame } from './chart-frame';
import { ChartSelectionOverlay } from './chart-selection-overlay';

export interface LineTrendDatum {
  date: string;
  value: number | null;
}

interface LineTrendChartProps {
  data: readonly LineTrendDatum[];
  width: number;
  height?: number;
  color: string;
  reference?: number | null;
  accessibilityLabel: string;
}

/** Renders supplied canonical facts; it never fills a missing value with zero. */
export function LineTrendChart({
  data,
  width,
  height = 180,
  color,
  reference = null,
  accessibilityLabel,
}: LineTrendChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const domain = useMemo(
    () =>
      fixedDomain(
        data.map((point) => point.value),
        { includeZero: false },
      ),
    [data],
  );
  const path = useMemo(
    () =>
      domain === null
        ? ''
        : linePath(
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
          {path === '' ? null : (
            <Path d={path} fill="none" stroke={color} strokeWidth={3} />
          )}
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
