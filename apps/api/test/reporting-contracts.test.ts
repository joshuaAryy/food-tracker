import { describe, expect, it } from 'vitest';
import { reportsResponseSchema } from '@food-tracker/shared';

describe('reporting contracts', () => {
  it('accepts an unavailable metric without exposing a user-facing reason', () => {
    const result =
      reportsResponseSchema.shape.current.shape.calorieAdherence.safeParse({
        available: false,
        reason: 'minimum_logged_days',
      });

    expect(result.success).toBe(true);
  });
});
