import { View } from 'react-native';
import { AppText } from './app-text';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  label: string;
}

export function OnboardingProgress({
  currentStep,
  totalSteps,
  label,
}: OnboardingProgressProps) {
  const safeCurrentStep = Math.min(Math.max(currentStep, 1), totalSteps);

  return (
    <View className="min-w-0 flex-1 gap-2">
      <View className="h-0.5 overflow-hidden rounded-full bg-onboarding-line">
        <View
          className="h-full rounded-full bg-onboarding-text"
          style={{ width: `${(safeCurrentStep / totalSteps) * 100}%` }}
        />
      </View>
      <AppText
        variant="caption"
        className="text-right text-onboarding-muted uppercase tracking-[1.5px]"
      >
        {label}
      </AppText>
    </View>
  );
}
