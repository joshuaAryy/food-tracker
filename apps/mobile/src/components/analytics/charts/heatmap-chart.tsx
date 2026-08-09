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
}: {
  points: readonly { date: string; state: HeatmapState }[];
  colorForState: (state: HeatmapState) => string;
  accessibilityLabel: string;
}) {
  const cells = heatmapCells(points);
  return (
    <ChartFrame accessibilityLabel={accessibilityLabel}>
      <View className="flex-row flex-wrap gap-1">
        {cells.map((cell) => (
          <View
            key={cell.date}
            accessible
            accessibilityLabel={`${cell.date}: ${cell.state}`}
            className="h-8 w-8 rounded-control"
            style={{ backgroundColor: colorForState(cell.state) }}
          />
        ))}
      </View>
    </ChartFrame>
  );
}
