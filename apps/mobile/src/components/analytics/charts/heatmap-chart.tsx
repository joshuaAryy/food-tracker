import { View } from 'react-native';
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
}: {
  points: readonly { date: string; state: HeatmapState }[];
  colorForState: (state: HeatmapState) => string;
  accessibilityLabel: string;
  columns?: number;
}) {
  const cells = heatmapCells(points, columns);
  return (
    <ChartFrame accessibilityLabel={accessibilityLabel}>
      <View
        className="flex-row flex-wrap gap-1"
        style={{ width: columns * 14 + (columns - 1) * 4 }}
      >
        {cells.map((cell) => (
          <View
            key={cell.date}
            accessible
            accessibilityLabel={`${cell.date}: ${cell.state}`}
            className="h-3.5 w-3.5 rounded-[3px]"
            style={{ backgroundColor: colorForState(cell.state) }}
          />
        ))}
      </View>
    </ChartFrame>
  );
}
