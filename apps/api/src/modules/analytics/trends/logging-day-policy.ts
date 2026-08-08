import { type MealType } from '@food-tracker/shared';

export interface LoggingDayPolicy {
  version: string;
  requiredMealTypes: readonly MealType[];
  optionalMealTypes: readonly MealType[];
}

/**
 * This is a versioned Phase 17.5 implementation policy, not an immutable
 * nutritional rule. Product evidence and policy tests are required to change it.
 */
export const INITIAL_LOGGING_DAY_POLICY: LoggingDayPolicy = {
  version: 'phase-17.5-v1',
  requiredMealTypes: ['breakfast', 'lunch', 'dinner'],
  optionalMealTypes: ['snack', 'other'],
};
