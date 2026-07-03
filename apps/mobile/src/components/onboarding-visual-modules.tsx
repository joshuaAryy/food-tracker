import { View } from 'react-native';
import type { GoalType, TrackingMode } from '@food-tracker/shared';
import { AppText } from './app-text';

function formatWeight(value: number): string {
  return `${value.toFixed(1)} lb`;
}

function boundedWeight(value: number | undefined): number {
  return Number.isFinite(value) && value !== undefined && value > 0
    ? value
    : 180;
}

function directionCopy(goalType: GoalType, delta: number): string {
  if (goalType === 'maintain' || delta === 0) {
    return 'Hold steady and notice changes early.';
  }

  return delta > 0
    ? 'Move toward a higher target at a pace that feels realistic.'
    : 'Move toward a lower target at a pace that feels realistic.';
}

export function OnboardingWeightForecast({
  currentWeightLb,
  targetWeightLb,
  goalType,
}: {
  currentWeightLb: number | undefined;
  targetWeightLb: number | undefined;
  goalType: GoalType;
}) {
  const current = boundedWeight(currentWeightLb);
  const target = boundedWeight(targetWeightLb);
  const delta = Math.round((target - current) * 10) / 10;
  const maintain = goalType === 'maintain' || delta === 0;
  const steps = maintain
    ? [
        'Keep your target steady',
        'Watch for changes early',
        'Adjust when life changes',
      ]
    : [
        'Start with where you are',
        'Set where you want to go',
        'Use daily logs to stay consistent',
      ];

  return (
    <View className="mt-1 gap-5 rounded-[34px] bg-onboarding-surface-muted px-5 py-5">
      <View>
        <AppText variant="heading" className="text-onboarding-text">
          Your direction
        </AppText>
        <AppText className="mt-1 text-onboarding-muted leading-5">
          {directionCopy(goalType, delta)}
        </AppText>
      </View>

      <View className="gap-4 rounded-[30px] bg-onboarding-surface px-5 py-5">
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-[24px] bg-onboarding-surface-muted px-4 py-4">
            <AppText variant="caption" className="text-onboarding-muted">
              Now
            </AppText>
            <AppText variant="heading" className="mt-1 text-onboarding-text">
              {formatWeight(current)}
            </AppText>
          </View>
          <View className="flex-1 rounded-[24px] bg-onboarding-text px-4 py-4">
            <AppText variant="caption" className="text-white/70">
              {maintain ? 'Goal' : 'Target'}
            </AppText>
            <AppText variant="heading" className="mt-1 text-white">
              {formatWeight(target)}
            </AppText>
          </View>
        </View>

        <View className="h-px bg-onboarding-line" />

        <View className="gap-3">
          {steps.map((step, index) => (
            <View
              key={step}
              className="min-h-[54px] flex-row items-center gap-4 rounded-full bg-onboarding-surface-muted px-4"
            >
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  index === 1 ? 'bg-onboarding-text' : 'bg-onboarding-surface'
                }`}
              >
                <AppText
                  variant="caption"
                  className={
                    index === 1 ? 'text-white' : 'text-onboarding-muted'
                  }
                >
                  {index + 1}
                </AppText>
              </View>
              <AppText variant="label" className="flex-1 text-onboarding-text">
                {step}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function OnboardingPlanExplainer({ mode }: { mode: TrackingMode }) {
  const details =
    mode === 'simple'
      ? [
          'Log meals quickly',
          'Keep calories and protein visible',
          'Watch your progress',
        ]
      : [
          'Log meals in detail',
          'Keep macros visible',
          'Review patterns over time',
        ];

  return (
    <View className="gap-4 rounded-[34px] bg-onboarding-surface-muted px-5 py-5">
      <View>
        <AppText variant="heading" className="text-onboarding-text">
          What happens next
        </AppText>
        <AppText className="mt-1 text-onboarding-muted leading-5">
          Log meals, keep an eye on your targets, and adjust your plan when life
          changes.
        </AppText>
      </View>
      <View className="gap-3">
        {details.map((detail, index) => (
          <View
            key={detail}
            className="min-h-[58px] flex-row items-center gap-4 rounded-full bg-onboarding-surface px-4"
          >
            <View className="h-8 w-8 items-center justify-center rounded-full bg-onboarding-text">
              <AppText variant="caption" className="text-white">
                {index + 1}
              </AppText>
            </View>
            <AppText variant="label" className="flex-1 text-onboarding-text">
              {detail}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}
