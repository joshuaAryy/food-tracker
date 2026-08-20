import { describe, expect, it } from 'vitest';
import {
  axisReferenceLabel,
  numericAxisTicks,
  selectDateTickIndexes,
} from './chart-axis';

const dates = Array.from({ length: 30 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 6, 6 + index));
  return date.toISOString().slice(0, 10);
});

describe('analytics chart axes', () => {
  it('keeps every daily position on a seven-day axis', () => {
    expect(selectDateTickIndexes(dates.slice(0, 7), 7)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
  });

  it('uses approximately weekly anchors for a thirty-day axis', () => {
    expect(selectDateTickIndexes(dates, 30)).toEqual([0, 7, 14, 21, 28, 29]);
  });

  it('uses monthly anchors and preserves the end of a ninety-day axis', () => {
    const ninetyDates = Array.from({ length: 90 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 5, 1 + index));
      return date.toISOString().slice(0, 10);
    });

    expect(selectDateTickIndexes(ninetyDates, 90)).toEqual([0, 30, 60, 89]);
  });

  it('derives restrained custom-range density while retaining both endpoints', () => {
    const indexes = selectDateTickIndexes(dates.slice(0, 18));

    expect(indexes[0]).toBe(0);
    expect(indexes.at(-1)).toBe(17);
    expect(indexes.length).toBeLessThanOrEqual(6);
    expect(indexes).toEqual([...new Set(indexes)]);
  });

  it('creates readable zero-based additive ticks', () => {
    expect(
      numericAxisTicks({ minimum: 0, maximum: 3000 }, { targetCount: 4 }),
    ).toEqual([0, 1000, 2000, 3000]);
  });

  it('creates a padded tight scale for weight without forcing zero', () => {
    expect(
      numericAxisTicks({ minimum: 78.2, maximum: 82.6 }, { targetCount: 4 }),
    ).toEqual([78, 80, 82, 84]);
  });

  it('labels reference semantics instead of exposing an unlabeled line', () => {
    expect(
      axisReferenceLabel({
        kind: 'minimum',
        value: 90,
        unit: 'mg',
        source: 'default',
      }),
    ).toBe('Minimum · 90 mg');
    expect(
      axisReferenceLabel({
        kind: 'limit',
        value: 2300,
        unit: 'mg',
        source: 'default',
      }),
    ).toBe('Limit · 2,300 mg');
    expect(
      axisReferenceLabel({
        kind: 'range',
        lower: 75,
        upper: 120,
        unit: 'mg',
        source: 'user',
      }),
    ).toBe('Range · 75–120 mg');
    expect(
      axisReferenceLabel({
        kind: 'none',
        unit: 'mg',
        reason: 'not_configured',
      }),
    ).toBeNull();
  });
});
