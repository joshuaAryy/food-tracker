import { describe, expect, it } from 'vitest';
import { classifyMetricData } from '../src/modules/analytics/trends/metric-data-coverage.js';

describe('analytics metric-data state', () => {
  it('distinguishes recorded, partial, and unknown snapshot coverage', () => {
    expect(classifyMetricData([120, 0])).toEqual({
      state: 'recorded',
      recordedLogCount: 2,
      unknownLogCount: 0,
      value: 120,
    });
    expect(classifyMetricData([120, null])).toEqual({
      state: 'partial',
      recordedLogCount: 1,
      unknownLogCount: 1,
      value: 120,
    });
    expect(classifyMetricData([null, null])).toEqual({
      state: 'unknown',
      recordedLogCount: 0,
      unknownLogCount: 2,
      value: null,
    });
  });

  it('keeps an explicit numeric zero recorded rather than unknown', () => {
    expect(classifyMetricData([0])).toEqual({
      state: 'recorded',
      recordedLogCount: 1,
      unknownLogCount: 0,
      value: 0,
    });
  });
});
