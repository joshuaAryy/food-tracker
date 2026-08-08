import {
  analyticsMetricForKey,
  NUTRIENT_CATALOG,
  resolveReportingGoals,
  type AnalyticsMetricKey,
  type AnalyticsReference,
} from '@food-tracker/shared';
import { acceptedCalorieRange } from '../reporting/calendar-facts.js';

export function calorieReference(input: {
  goalType: 'lose' | 'maintain' | 'gain' | null;
  targetCalories: number | null;
}): AnalyticsReference {
  const range = acceptedCalorieRange(input.goalType, input.targetCalories);
  return range === null
    ? { kind: 'none', unit: 'kcal', reason: 'not_configured' }
    : {
        kind: 'range',
        lower: range.lowerCalories,
        upper: range.upperCalories,
        unit: 'kcal',
        source: 'derived',
      };
}

export interface ReferenceBoundsInput {
  unit: AnalyticsReference extends { unit: infer Unit } ? Unit : never;
  source: 'user' | 'derived' | 'default';
  target?: number;
  minimum?: number;
  limit?: number;
  lower?: number;
  upper?: number;
}

function validValue(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

/**
 * Builds only an authoritative reference. A one-sided bound is never silently
 * promoted to a range.
 */
export function referenceFromBounds(
  input: ReferenceBoundsInput,
): AnalyticsReference {
  const hasLower = input.lower !== undefined;
  const hasUpper = input.upper !== undefined;
  if (hasLower !== hasUpper) {
    throw new Error('A true range requires both lower and upper bounds');
  }
  if (hasLower && hasUpper) {
    if (
      !validValue(input.lower) ||
      !validValue(input.upper) ||
      input.lower >= input.upper
    ) {
      throw new Error('A true range requires finite lower < upper bounds');
    }
    return {
      kind: 'range',
      lower: input.lower,
      upper: input.upper,
      unit: input.unit,
      source: input.source,
    };
  }
  if (validValue(input.target)) {
    return {
      kind: 'target',
      value: input.target,
      unit: input.unit,
      source: input.source,
    };
  }
  if (validValue(input.minimum)) {
    return {
      kind: 'minimum',
      value: input.minimum,
      unit: input.unit,
      source: input.source,
    };
  }
  if (validValue(input.limit)) {
    return {
      kind: 'limit',
      value: input.limit,
      unit: input.unit,
      source: input.source,
    };
  }
  return { kind: 'none', unit: input.unit, reason: 'not_configured' };
}

export function noReference(metric: AnalyticsMetricKey): AnalyticsReference {
  return {
    kind: 'none',
    unit: analyticsMetricForKey(metric).unit,
    reason: 'not_applicable',
  };
}

export function metricReference(
  metric: AnalyticsMetricKey,
  input: {
    goalType: 'lose' | 'maintain' | 'gain' | null;
    targetCalories: number | null;
    targetProteinGrams: number | null;
    targetCarbsGrams: number | null;
    targetFatGrams: number | null;
    targetFiberGrams: number | null;
    limitSugarGrams: number | null;
    limitSodiumMg: number | null;
  },
): AnalyticsReference {
  if (metric === 'calories') return calorieReference(input);
  if (!(metric in NUTRIENT_CATALOG)) return noReference(metric);
  const nutrientMetric = metric as keyof typeof NUTRIENT_CATALOG;
  const reportingGoal = resolveReportingGoals(input)[nutrientMetric];
  if (reportingGoal === undefined || reportingGoal.value === null) {
    return { kind: 'none', unit: analyticsMetricForKey(metric).unit, reason: 'not_configured' };
  }
  return {
    kind: reportingGoal.direction,
    value: reportingGoal.value,
    unit: reportingGoal.unit,
    source: reportingGoal.source === 'missing' ? 'default' : reportingGoal.source,
  };
}
