import { describe, expect, it } from 'vitest';
import { compatibilityPaceForRate } from '../../lib/weekly-rate';

describe('onboarding weekly rate compatibility', () => {
  it('keeps legacy goal pace derived from the numeric slider rate', () => {
    expect(compatibilityPaceForRate('lose', 0.3)).toBe('slow');
    expect(compatibilityPaceForRate('lose', 0.75)).toBe('moderate');
    expect(compatibilityPaceForRate('gain', 0.55)).toBe('moderate_bulk');
    expect(compatibilityPaceForRate('maintain', 0.55)).toBeNull();
  });
});
