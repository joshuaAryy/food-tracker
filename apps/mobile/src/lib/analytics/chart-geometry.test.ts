import { describe, expect, it } from 'vitest';
import {
  clampScrubX,
  decimateLabelIndexes,
  linePath,
  smoothLinePath,
  referenceLineY,
  uncertaintyPolygon,
  barRects,
  forecastPathWithContinuity,
  pointX,
  pointY,
  selectionDecorationX,
  uncertaintyPolygonAtOffset,
  roundedBarPath,
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

  it('rounds only the value-facing cap of a bar', () => {
    expect(
      roundedBarPath({ index: 0, x: 10, y: 20, width: 24, height: 60 }, 5),
    ).toBe('M 15 20 Q 10 20 10 25 L 10 80 L 34 80 L 34 25 Q 34 20 29 20 Z');
  });
  it('decimates labels while keeping both bounds visible', () => {
    expect(decimateLabelIndexes(10, 4)).toEqual([0, 3, 6, 9]);
    expect(decimateLabelIndexes(3, 4)).toEqual([0, 1, 2]);
  });

  it('places a selected-date guide on the fixed point timeline', () => {
    expect(pointX(2, 5, 100)).toBe(50);
    expect(pointY(15, { min: 10, max: 20 }, 100)).toBe(50);
  });

  it('insets endpoint selection decoration without moving raw x-domain values', () => {
    expect(pointX(0, 3, 100)).toBe(0);
    expect(pointX(2, 3, 100)).toBe(100);
    expect(selectionDecorationX(0, 3, 100, 7.5)).toBe(7.5);
    expect(selectionDecorationX(2, 3, 100, 7.5)).toBe(92.5);
    expect(selectionDecorationX(1, 3, 100, 7.5)).toBe(50);
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

  it('smooths contiguous numeric segments without bridging missing values', () => {
    const path = smoothLinePath(
      [10, 20, 15, null, 30, 35],
      { min: 0, max: 40 },
      { width: 100, height: 100 },
    );

    expect(path).toContain('M 0 75 C');
    expect(path).toContain('M 80 25 C');
    expect(path).not.toContain('L 75');
  });

  it('can connect backend-provided derived trend values across sparse raw days', () => {
    const path = smoothLinePath(
      [10, null, 20],
      { min: 0, max: 20 },
      { width: 100, height: 100 },
      { connectGaps: true },
    );

    expect(path).toContain('M 0 50 C');
    expect(path).toContain('100 0');
  });

  it('uses bounded tangent controls for monotone derived trends', () => {
    const path = smoothLinePath(
      [0, 10, 20, 30],
      { min: 0, max: 30 },
      { width: 120, height: 120 },
    );

    expect(path).toBe(
      'M 0 120 C 13.333 106.667 26.667 93.333 40 80 C 53.333 66.667 66.667 53.333 80 40 C 93.333 26.667 106.667 13.333 120 0',
    );
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
