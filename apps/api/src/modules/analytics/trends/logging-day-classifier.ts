import {
  type LoggingDayPhase,
  type LoggingDayState,
  type MealType,
} from '@food-tracker/shared';
import {
  INITIAL_LOGGING_DAY_POLICY,
  type LoggingDayPolicy,
} from './logging-day-policy.js';

export { INITIAL_LOGGING_DAY_POLICY } from './logging-day-policy.js';

export interface LoggingDayClassificationInput {
  date: string;
  today: string;
  mealTypes: readonly MealType[];
  policy?: LoggingDayPolicy;
}

export interface LoggingDayClassification {
  state: LoggingDayState;
  phase: LoggingDayPhase;
}

/**
 * Classifies only FoodLog meal behavior. Metric or provider availability must
 * never affect this result.
 */
export function classifyLoggingDay({
  date,
  today,
  mealTypes,
  policy = INITIAL_LOGGING_DAY_POLICY,
}: LoggingDayClassificationInput): LoggingDayClassification {
  const phase: LoggingDayPhase = date === today ? 'in_progress' : 'closed';

  if (mealTypes.length === 0) {
    return { state: 'unlogged', phase };
  }

  const loggedMealTypes = new Set(mealTypes);
  const hasRequiredMealTypes = policy.requiredMealTypes.every((mealType) =>
    loggedMealTypes.has(mealType),
  );

  return {
    state: hasRequiredMealTypes ? 'complete' : 'partial',
    phase,
  };
}
