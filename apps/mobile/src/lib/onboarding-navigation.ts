import type { GoalType } from '@food-tracker/shared';

interface OnboardingStepLike {
  key: string;
}

function isGoalPaceStep(step: OnboardingStepLike | undefined): boolean {
  return step?.key === 'goalPace';
}

export function nextOnboardingStepIndex(
  steps: readonly OnboardingStepLike[],
  currentIndex: number,
  goalType: GoalType,
): number {
  const nextIndex = Math.min(steps.length - 1, currentIndex + 1);
  if (goalType === 'maintain' && isGoalPaceStep(steps[nextIndex])) {
    return Math.min(steps.length - 1, nextIndex + 1);
  }
  return nextIndex;
}

export function previousOnboardingStepIndex(
  steps: readonly OnboardingStepLike[],
  currentIndex: number,
  goalType: GoalType,
): number {
  const previousIndex = Math.max(0, currentIndex - 1);
  if (goalType === 'maintain' && isGoalPaceStep(steps[previousIndex])) {
    return Math.max(0, previousIndex - 1);
  }
  return previousIndex;
}
