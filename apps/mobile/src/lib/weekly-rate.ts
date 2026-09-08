import type { GoalType, GoalPace } from '@food-tracker/shared';

export function compatibilityPaceForRate(
  goalType: GoalType,
  rate: number,
): GoalPace | null {
  if (goalType === 'maintain') return null;
  if (goalType === 'gain') {
    if (rate <= 0.5) return 'lean_bulk';
    if (rate <= 0.75) return 'moderate_bulk';
    return 'aggressive_bulk';
  }
  if (rate <= 0.5) return 'slow';
  if (rate <= 1) return 'moderate';
  return 'aggressive';
}
