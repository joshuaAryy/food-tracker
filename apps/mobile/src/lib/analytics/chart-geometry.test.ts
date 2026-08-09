import { describe, expect, it } from 'vitest';
import {
  clampScrubX,
  decimateLabelIndexes,
  linePath,
  referenceLineY,
  uncertaintyPolygon,
  barRects,
  forecastPathWithContinuity,
  pointX,
  pointY,
  uncertaintyPolygonAtOffset,
} from './chart-geometry';

describe('analytics chart geometry', () => {
  it('creates bars only for numeric points and preserves a zero bar', () => {
    expect(
      barRects([10, null, 0], { min: 0, max: 10 }, { width: 90, height: 100 }),
    ).toEqual([
      { index: 0, x: 3, y: 0, width: 24, height: 100 },
      { index: 2, x: 63, y: 100, width: 24, height: 0 },
    ]);
  });
  it('decimates labels while keeping both bounds visible', () => {
    expect(decimateLabelIndexes(10, 4)).toEqual([0, 3, 6, 9]);
    expect(decimateLabelIndexes(3, 4)).toEqual([0, 1, 2]);
  });

  it('places a selected-date guide on the fixed point timeline', () => {
    expect(pointX(2, 5, 100)).toBe(50);
    expect(pointY(15, { min: 10, max: 20 }, 100)).toBe(50);
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

  it('starts a forecast projection from the final historical point on its full timeline', () => {
    expect(
      forecastPathWithContinuity(
        [100, 110, 120],
        [125, 130],
        { min: 100, max: 130 },
        { width: 100, height: 100 },
      ),
    ).toBe('M 50 33.333 L 75 16.667 L 100 0');
  });

  it('keeps forecast uncertainty after Today on the full timeline', () => {
    expect(
      uncertaintyPolygonAtOffset(
        [{ value: 125, lower: 120, upper: 130 }],
        { min: 100, max: 130 },
        { width: 100, height: 100 },
        { startIndex: 3, totalPointCount: 5 },
      ),
    ).toBe('75,0 75,33.333');
  });
});
