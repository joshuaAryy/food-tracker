import type {
  ReportingGoals,
  ReportingGoalSource,
  NutrientKey,
} from '@food-tracker/shared';
import { resolveUserNutritionTargets } from './service.js';

/**
 * Adapts the canonical effective-target projection to the legacy reporting
 * contract. Reporting consumers must use this adapter rather than reading
 * UserGoal target columns directly.
 */
export async function resolveUserReportingGoals(
  userId: string,
  now = new Date(),
): Promise<ReportingGoals> {
  return reportingGoalsFromEffectiveTargets(
    await resolveUserNutritionTargets(userId, now),
  );
}

export function reportingGoalsFromEffectiveTargets(
  effective: Awaited<ReturnType<typeof resolveUserNutritionTargets>>,
): ReportingGoals {
  const goals: ReportingGoals = {};
  for (const target of Object.values(effective)) {
    const source: ReportingGoalSource =
      target.effectiveSource === 'user'
        ? 'user'
        : target.effectiveSource === 'personalized'
          ? 'personalized'
          : target.effectiveSource === 'reference'
            ? 'reference'
            : target.effectiveSource === 'derived'
              ? 'derived'
              : 'missing';
    goals[target.nutrientKey as NutrientKey] = {
      value: target.effectiveValue,
      unit: target.unit,
      direction: target.direction,
      source,
    };
  }
  return goals;
}
