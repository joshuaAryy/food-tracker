import { describe, expect, it } from 'vitest';
import { chartDomainFromAxis, comparisonValues } from './comparison-chart';

describe('comparison chart contract adapter', () => {
  it('uses the backend fixed axis domain without recalculating it', () => {
    expect(chartDomainFromAxis({ minimum: 10, maximum: 50 })).toEqual({
      min: 10,
      max: 50,
    });
  });

  it('uses normalized values only when the backend supplied them', () => {
    expect(
      comparisonValues(
        [{ value: 2300, normalizedValue: 1 }, { value: null }],
        'reference_normalized',
      ),
    ).toEqual([1, null]);
  });
});
