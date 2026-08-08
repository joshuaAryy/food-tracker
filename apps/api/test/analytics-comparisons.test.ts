import { describe, expect, it } from 'vitest';
import { resolveComparisonStrategy } from '../src/modules/analytics/trends/comparisons.js';

describe('analytics comparison strategies', () => {
  it('allowlists shared-unit, dual-axis, and reference-normalized comparisons', () => {
    expect(resolveComparisonStrategy('protein', 'carbs')).toBe('shared_unit');
    expect(resolveComparisonStrategy('protein', 'weight')).toBe('dual_axis');
    expect(resolveComparisonStrategy('sodium', 'potassium')).toBe(
      'reference_normalized',
    );
  });

  it('does not normalize unrelated different-unit metrics', () => {
    expect(resolveComparisonStrategy('calories', 'weight')).toBe(
      'incompatible',
    );
    expect(resolveComparisonStrategy('protein', 'vitaminC')).toBe(
      'incompatible',
    );
  });
});
