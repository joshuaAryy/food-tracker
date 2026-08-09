import { describe, expect, it } from 'vitest';
import { interpretAnalyticsReference } from '../src/modules/analytics/trends/interpretation.js';

describe('analytics reference interpretation', () => {
  it('distinguishes true ranges from single target values', () => {
    expect(
      interpretAnalyticsReference(1700, {
        kind: 'range',
        lower: 1900,
        upper: 2300,
        unit: 'kcal',
        source: 'derived',
      }),
    ).toMatchObject({ kind: 'below_range' });
    expect(
      interpretAnalyticsReference(2000, {
        kind: 'target',
        value: 2000,
        unit: 'kcal',
        source: 'user',
      }),
    ).toBeNull();
  });

  it('reports limit and minimum states without causal language', () => {
    expect(
      interpretAnalyticsReference(2400, {
        kind: 'limit',
        value: 2300,
        unit: 'mg',
        source: 'default',
      }),
    ).toMatchObject({ kind: 'above_limit' });
    expect(
      interpretAnalyticsReference(10, {
        kind: 'minimum',
        value: 25,
        unit: 'g',
        source: 'user',
      }),
    ).toMatchObject({ kind: 'below_minimum' });
  });
});
