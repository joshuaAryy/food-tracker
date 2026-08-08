import { describe, expect, it } from 'vitest';
import {
  fixedDomain,
  normalizeToReference,
  selectedPointIndex,
} from './chart-domain';

describe('analytics chart domains', () => {
  it('keeps an appropriate zero baseline while ignoring nullable gaps', () => {
    expect(fixedDomain([null, 120, 240], { includeZero: true })).toEqual({
      min: 0,
      max: 240,
    });
  });

  it('does not convert an all-gap series into numeric zero data', () => {
    expect(fixedDomain([null, null], { includeZero: true })).toBeNull();
  });

  it('uses the full paired data period for a stable dual axis', () => {
    expect(fixedDomain([70, 75, 72], { includeZero: false })).toEqual({
      min: 70,
      max: 75,
    });
  });

  it('normalizes only against an authoritative reference', () => {
    expect(normalizeToReference(1800, 2000)).toBe(0.9);
    expect(normalizeToReference(0, 2000)).toBe(0);
    expect(normalizeToReference(null, 2000)).toBeNull();
    expect(normalizeToReference(300, null)).toBeNull();
  });

  it('finds a selected date without snapping to a different logged day', () => {
    expect(
      selectedPointIndex(
        [
          { date: '2026-08-01', value: 100 },
          { date: '2026-08-02', value: null },
          { date: '2026-08-03', value: 120 },
        ],
        '2026-08-02',
      ),
    ).toBe(1);
    expect(selectedPointIndex([], '2026-08-02')).toBe(-1);
  });
});
