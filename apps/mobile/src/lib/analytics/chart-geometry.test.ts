import { describe, expect, it } from 'vitest';
import {
  clampScrubX,
  decimateLabelIndexes,
  linePath,
  referenceLineY,
  uncertaintyPolygon,
} from './chart-geometry';

describe('analytics chart geometry', () => {
  it('decimates labels while keeping both bounds visible', () => {
    expect(decimateLabelIndexes(10, 4)).toEqual([0, 3, 6, 9]);
    expect(decimateLabelIndexes(3, 4)).toEqual([0, 1, 2]);
  });

  it('keeps sparse numeric data as separate path segments', () => {
    expect(
      linePath(
        [10, null, 20],
        { min: 0, max: 20 },
        { width: 100, height: 100 },
      ),
    ).toBe('M 0 50 M 100 0');
  });

  it('clamps scrub interaction to the plot bounds', () => {
    expect(clampScrubX(-4, 200)).toBe(0);
    expect(clampScrubX(250, 200)).toBe(200);
    expect(clampScrubX(50, 200)).toBe(50);
  });

  it('maps target lines and widening uncertainty to chart coordinates', () => {
    expect(referenceLineY(50, { min: 0, max: 100 }, 100)).toBe(50);
    expect(
      uncertaintyPolygon(
        [
          { value: 50, lower: 45, upper: 55 },
          { value: 55, lower: 40, upper: 70 },
        ],
        { min: 0, max: 100 },
        { width: 100, height: 100 },
      ),
    ).toBe('0,45 100,30 100,60 0,55');
  });
});
