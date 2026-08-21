import { describe, expect, it } from 'vitest';
import {
  INITIAL_LOGGING_DAY_POLICY,
  classifyLoggingDay,
} from '../src/modules/analytics/trends/logging-day-classifier.js';

describe('analytics logging-day state', () => {
  it('keeps the initial meal policy explicit and versioned', () => {
    expect(INITIAL_LOGGING_DAY_POLICY).toEqual({
      version: 'phase-17.5-v1',
      requiredMealTypes: ['breakfast', 'lunch', 'dinner'],
      optionalMealTypes: ['snack', 'other'],
    });
  });

  it('classifies a closed day from FoodLog meal behavior only', () => {
    expect(
      classifyLoggingDay({
        date: '2026-08-02',
        today: '2026-08-03',
        mealTypes: ['breakfast', 'lunch', 'dinner', 'snack'],
      }),
    ).toEqual({ state: 'complete', phase: 'closed' });

    expect(
      classifyLoggingDay({
        date: '2026-08-02',
        today: '2026-08-03',
        mealTypes: ['breakfast', 'dinner'],
      }),
    ).toEqual({ state: 'partial', phase: 'closed' });

    expect(
      classifyLoggingDay({
        date: '2026-08-02',
        today: '2026-08-03',
        mealTypes: [],
      }),
    ).toEqual({ state: 'unlogged', phase: 'closed' });
  });

  it('treats the current local day as in progress, never as a closed complete day', () => {
    expect(
      classifyLoggingDay({
        date: '2026-08-03',
        today: '2026-08-03',
        mealTypes: ['breakfast', 'lunch', 'dinner'],
      }),
    ).toEqual({ state: 'complete', phase: 'in_progress' });
  });
});
