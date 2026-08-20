import { describe, expect, it } from 'vitest';
import { chartStyleForMetric } from './chart-style';

describe('chartStyleForMetric', () => {
  it('assigns deliberate chart families without carrying status semantics', () => {
    expect(chartStyleForMetric('calories').family).toBe('energy');
    expect(chartStyleForMetric('protein').family).toBe('protein');
    expect(chartStyleForMetric('sodium').family).toBe('limit');
    expect(chartStyleForMetric('vitaminC').family).toBe('vitamin');
    expect(chartStyleForMetric('iron').family).toBe('mineral');
    expect(chartStyleForMetric('magnesium').family).toBe('mineral');
    expect(chartStyleForMetric('calcium').family).toBe('mineral');
    expect(chartStyleForMetric('hydration').family).toBe('hydration');
    expect(chartStyleForMetric('weight').family).toBe('body');
    expect(chartStyleForMetric('loggingConsistency').family).toBe('behavior');

    expect(chartStyleForMetric('protein').family).not.toBe('limit');
    expect(chartStyleForMetric('sodium').family).not.toBe('fallback');

    const calories = chartStyleForMetric('calories');
    expect(calories.raw.opacity).toBeLessThan(calories.selected.opacity);
    expect(calories.trend.width).toBeGreaterThan(calories.raw.strokeWidth);
    expect(calories).not.toHaveProperty('status');
  });
});
