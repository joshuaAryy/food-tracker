export type HeatmapState =
  | 'complete'
  | 'partial'
  | 'unlogged'
  | 'in_progress'
  | 'recorded'
  | 'unknown';

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
