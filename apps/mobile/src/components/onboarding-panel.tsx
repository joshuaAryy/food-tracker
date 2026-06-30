import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

interface OnboardingPanelProps extends PropsWithChildren {
  compact?: boolean;
}

export function OnboardingPanel({
  children,
  compact = false,
}: OnboardingPanelProps) {
  return (
    <View
      className={`rounded-[26px] bg-onboarding-surface shadow-sm ${
        compact ? 'gap-4 p-4' : 'gap-5 p-5'
      }`}
    >
      {children}
    </View>
  );
}
