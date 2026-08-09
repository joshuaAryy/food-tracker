import { describe, expect, it } from 'vitest';
import {
  rollingAverageValues,
  smoothingWindowForTrend,
} from '../src/modules/analytics/trends/smoothing.js';

describe('analytics trend smoothing', () => {
  it('averages only eligible numeric values without turning gaps into zeros', () => {
    expect(
      rollingAverageValues([100, null, 200, 300], [true, true, false, true], 2),
    ).toEqual([100, null, null, 300]);
  });

  it('uses short daily and longer weekly rolling windows', () => {
    expect(
      smoothingWindowForTrend({ aggregation: 'daily', periodDays: 7 }),
    ).toBe(3);
    expect(
      smoothingWindowForTrend({ aggregation: 'daily', periodDays: 30 }),
    ).toBe(7);
    expect(
      smoothingWindowForTrend({ aggregation: 'weekly', periodDays: 90 }),
    ).toBe(4);
  });
});
