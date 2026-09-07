import type { SetupPreviewResult } from '@food-tracker/shared';

export type OnboardingRatePlanningState = 'available' | 'unavailable' | 'error';

export function onboardingRatePlanningState(
  preview: SetupPreviewResult | null,
): OnboardingRatePlanningState {
  if (preview === null) return 'error';
  return preview.ratePlanning.status;
}
