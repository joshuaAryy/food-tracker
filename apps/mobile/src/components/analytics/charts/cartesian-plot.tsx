import type { ReactNode } from 'react';
import Svg, { Line } from 'react-native-svg';
import { pointX } from '@/lib/analytics/chart-geometry';

export function CartesianPlot({
  width,
  height,
  pointCount,
  selectedIndex = null,
  todayIndex = null,
  children,
}: {
  width: number;
  height: number;
  pointCount: number;
  selectedIndex?: number | null;
  todayIndex?: number | null;
  children: ReactNode;
}) {
  const selectedX =
    selectedIndex === null ? null : pointX(selectedIndex, pointCount, width);
  const todayX =
    todayIndex === null ? null : pointX(todayIndex, pointCount, width);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {todayX === null ? null : (
        <Line
          x1={todayX}
          x2={todayX}
          y1={0}
          y2={height}
          stroke="#4A4A4A"
          strokeDasharray="3 3"
          opacity={0.5}
        />
      )}
      {children}
      {selectedX === null ? null : (
        <Line
          testID="comparison-selected-guide"
          x1={selectedX}
          x2={selectedX}
          y1={0}
          y2={height}
          stroke="#262626"
          strokeDasharray="2 3"
          opacity={0.45}
        />
      )}
    </Svg>
  );
}
