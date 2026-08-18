import { describe, expect, it } from 'vitest';
import { heatmapCells, loggingConsistencyLayout } from './heatmap-geometry';

describe('analytics heatmap geometry', () => {
  it('keeps logging and metric coverage states as distinct input vocabularies', () => {
    expect(
      heatmapCells([
        { date: '2026-08-01', state: 'complete' },
        { date: '2026-08-02', state: 'unknown' },
      ]),
    ).toEqual([
      { date: '2026-08-01', column: 0, row: 0, state: 'complete' },
      { date: '2026-08-02', column: 1, row: 0, state: 'unknown' },
    ]);
  });

  it('uses the final 30-day grid geometry while retaining a distinct 90-day composition', () => {
    expect(loggingConsistencyLayout(30)).toEqual({
      columns: 10,
      dailyGridRows: 4,
      cellSize: 22,
      cellGap: 8,
      dailyCardMinHeight: 284,
      dailyGridMinHeight: 112,
      periodChartHeight: 190,
      periodCardMinHeight: 284,
      mealCoverageMinHeight: 354,
    });
    expect(loggingConsistencyLayout(90)).toEqual({
      columns: 14,
      dailyGridRows: 0,
      cellSize: 14,
      cellGap: 4,
      dailyCardMinHeight: 254,
      dailyGridMinHeight: 50,
      periodChartHeight: 254,
      periodCardMinHeight: 330,
      mealCoverageMinHeight: 270,
    });
  });
});
