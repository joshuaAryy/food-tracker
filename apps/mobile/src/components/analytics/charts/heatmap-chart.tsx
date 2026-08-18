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
  minRows,
  showEmptyCells = false,
  testID,
}: {
  points: readonly { date: string; state: HeatmapState }[];
  colorForState: (state: HeatmapState) => string;
  accessibilityLabel: string;
  columns?: number;
  cellSize?: number;
  cellGap?: number;
  minHeight?: number | undefined;
  minRows?: number;
  showEmptyCells?: boolean;
  testID?: string;
}) {
  const cells = heatmapCells(points, columns);
  const renderedRows = Math.ceil(cells.length / columns);
  const emptyCellCount = showEmptyCells
    ? Math.max(0, (minRows ?? renderedRows) * columns - cells.length)
    : 0;
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
        {Array.from({ length: emptyCellCount }, (_, index) => (
          <View
            key={`empty-${index}`}
            accessible
            accessibilityLabel="Outside the selected date range"
            className="rounded-[6px]"
            style={{
              width: cellSize,
              height: cellSize,
              borderRadius: Math.min(6, cellSize / 4),
              backgroundColor: '#F7F7F3',
              borderColor: '#E6E6DF',
              borderWidth: 1,
            }}
          />
        ))}
      </View>
    </ChartFrame>
  );
}
