import { describe, expect, it } from 'vitest';
import { metricCoverageMessage, referenceMessage } from './trend-data-state';

describe('Trend data-state copy', () => {
  it('keeps metric snapshot availability distinct from logging completeness', () => {
    expect(metricCoverageMessage({ recorded: 1, partial: 1, unknown: 1 })).toBe(
      'Some logged foods are missing this nutrient; unknown values remain gaps.',
    );
  });

  it('describes a true range without inventing one from a single target', () => {
    expect(
      referenceMessage({
        kind: 'range',
        lower: 1900,
        upper: 2300,
        unit: 'kcal',
        source: 'derived',
      }),
    ).toBe('Accepted range: 1900–2300 kcal');
    expect(
      referenceMessage({
        kind: 'target',
        value: 2000,
        unit: 'kcal',
        source: 'user',
      }),
    ).toBe('Target: 2000 kcal');
  });

  it('formats noisy reference values for presentation', () => {
    expect(
      referenceMessage({
        kind: 'range',
        lower: 92.85714285714286,
        upper: 124.4857142857143,
        unit: 'g',
        source: 'derived',
      }),
    ).toBe('Accepted range: 92.9–124.5 g');
  });
});
