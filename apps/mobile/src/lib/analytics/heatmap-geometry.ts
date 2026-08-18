export type HeatmapState =
  | 'complete'
  | 'partial'
  | 'unlogged'
  | 'in_progress'
  | 'recorded'
  | 'unknown';

export type LoggingConsistencyLayout = {
  columns: number;
  dailyGridRows: number;
  cellSize: number;
  cellGap: number;
  dailyCardMinHeight: number;
  dailyGridMinHeight: number;
  periodChartHeight: number;
  periodCardMinHeight: number;
  mealCoverageMinHeight: number;
};

export function loggingConsistencyLayout(
  period: 30 | 90,
): LoggingConsistencyLayout {
  if (period === 90) {
    return {
      columns: 14,
      dailyGridRows: 0,
      cellSize: 14,
      cellGap: 4,
      dailyCardMinHeight: 254,
      dailyGridMinHeight: 50,
      periodChartHeight: 254,
      periodCardMinHeight: 330,
      mealCoverageMinHeight: 270,
    };
  }

  return {
    columns: 10,
    dailyGridRows: 4,
    cellSize: 22,
    cellGap: 8,
    dailyCardMinHeight: 284,
    dailyGridMinHeight: 112,
    periodChartHeight: 190,
    periodCardMinHeight: 284,
    mealCoverageMinHeight: 354,
  };
}

export function heatmapCells(
  points: readonly { date: string; state: HeatmapState }[],
  columns = 7,
): { date: string; column: number; row: number; state: HeatmapState }[] {
  return points.map((point, index) => ({
    date: point.date,
    column: index % columns,
    row: Math.floor(index / columns),
    state: point.state,
  }));
}
