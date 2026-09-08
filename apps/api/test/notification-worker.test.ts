import { describe, expect, it } from 'vitest';
import { recommendationsForTrackingMode } from '../src/modules/notifications/worker.js';

describe('notification worker tracking-mode safety', () => {
  it('cannot select micronutrient recommendations for Simple users', () => {
    const recommendations = [
      { type: 'micronutrient_below_target' as const },
      { type: 'protein_low' as const },
    ];

    expect(recommendationsForTrackingMode(recommendations, 'simple')).toEqual([
      { type: 'protein_low' },
    ]);
    expect(recommendationsForTrackingMode(recommendations, 'complex')).toEqual(
      recommendations,
    );
  });
});
