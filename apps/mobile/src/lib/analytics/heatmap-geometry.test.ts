import { describe, expect, it } from 'vitest';
import { heatmapCells } from './heatmap-geometry';

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
});
