import { View } from 'react-native';
import { formatPresentationDate } from '@/lib/date-time';
import {
  heatmapCells,
  type HeatmapState,
} from '@/lib/analytics/heatmap-geometry';
import { ChartFrame } from './chart-frame';

export function HeatmapChart({
  points,
  colorForState,
  accessibilityLabel,
  columns = 14,
  cellSize = 14,
  cellGap = 4,
  minHeight,
  testID,
}: {
  points: readonly { date: string; state: HeatmapState }[];
  colorForState: (state: HeatmapState) => string;
  accessibilityLabel: string;
  columns?: number;
  cellSize?: number;
  cellGap?: number;
  minHeight?: number | undefined;
  testID?: string;
}) {
  const cells = heatmapCells(points, columns);
  return (
    <ChartFrame accessibilityLabel={accessibilityLabel}>
      <View
        testID={testID === undefined ? undefined : `${testID}-grid`}
        className="flex-row flex-wrap"
        style={{
          width: columns * cellSize + (columns - 1) * cellGap,
          gap: cellGap,
          minHeight,
        }}
      >
        {cells.map((cell) => (
          <View
            key={cell.date}
            accessible
            accessibilityLabel={`${formatPresentationDate(cell.date)}: ${cell.state}`}
            className="rounded-[6px]"
            style={{
              width: cellSize,
              height: cellSize,
              borderRadius: Math.min(6, cellSize / 4),
              backgroundColor: colorForState(cell.state),
            }}
          />
        ))}
      </View>
    </ChartFrame>
  );
}
