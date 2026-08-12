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

  it('keeps linked different-unit comparisons on separate axes', () => {
    expect(resolveComparisonStrategy('calories', 'weight')).toBe('dual_axis');
    expect(resolveComparisonStrategy('calories', 'protein')).toBe('dual_axis');
    expect(resolveComparisonStrategy('protein', 'vitaminC')).toBe('dual_axis');
  });

  it('rejects self comparison through the shared allowlist', () => {
    expect(resolveComparisonStrategy('protein', 'protein')).toBe(
      'incompatible',
    );
  });
});
